/**
 * Handler pour la route POST /plan
 *
 * Flux :
 * 1. Mistral parse la demande utilisateur → JSON structuré {objectif, frequence, duree, moment}
 * 2. Moteur logique backend → génère les créneaux depuis le planning réel
 * 3. Mistral reformule les créneaux de façon naturelle et motivante
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { generatePlanningSlots, PlanningRequest } from '../services/planningEngine';
import { MISTRAL_API_URL, MISTRAL_MODEL } from '../services/mistral';
import { checkRateLimit } from '../services/rateLimit';

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY!;

/** Appel Mistral simple (sans tools) */
async function callMistralText(
  systemPrompt: string,
  userContent: string,
  maxTokens = 300,
): Promise<string> {
  const response = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Mistral API error: ${response.status} ${err}`);
  }

  const data = (await response.json()) as any;
  return data.choices[0].message.content as string;
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const PARSE_SYSTEM_PROMPT = `Tu es un extracteur d'informations. Retourne UNIQUEMENT un objet JSON valide, sans texte avant ou après.

Format attendu :
{
  "objectif": "string (nom de l'activité en français, ex: lecture, sport, révision)",
  "frequence": number (nombre de fois par semaine, entier entre 1 et 7, défaut: 2),
  "duree": number (durée en minutes, entier entre 15 et 240, défaut: 60),
  "moment": "matin" | "après-midi" | "soir" | "any"
}

Règles :
- "matin" si l'utilisateur dit matin, matinée, tôt
- "après-midi" si l'utilisateur dit après-midi, l'après-midi
- "soir" si l'utilisateur dit soir, soirée, le soir
- "any" si pas de moment précisé
- duree : convertis "1h" → 60, "1h30" → 90, "2h" → 120
- frequence : "tous les jours" → 7, "chaque jour" → 7, "2 fois par semaine" → 2

Exemples :
- "Je veux faire de la lecture 2 fois par semaine le soir" → {"objectif":"lecture","frequence":2,"duree":60,"moment":"soir"}
- "Je veux réviser 3x par semaine le matin pendant 1h30" → {"objectif":"révision","frequence":3,"duree":90,"moment":"matin"}
- "Je veux faire du sport une fois par semaine" → {"objectif":"sport","frequence":1,"duree":60,"moment":"any"}`;

const REFORMULATE_SYSTEM_PROMPT = `Tu es un coach planning bienveillant et motivant pour des étudiants.

RÈGLES STRICTES :
- Ne modifie JAMAIS les horaires fournis (ni le jour, ni l'heure)
- Maximum 2-3 phrases courtes
- Ton positif et encourageant
- Pas de listes à puces, texte fluide et naturel
- Ne répète pas les horaires en détail, parle-en de façon naturelle`;

// ── Handler ───────────────────────────────────────────────────────────────────

export async function planningRequestHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId!;
  const { message, language } = req.body as { message: string; language?: string };

  if (!message?.trim()) {
    res.status(400).json({ error: 'message requis' });
    return;
  }

  // Rate limiting
  const rateLimitInfo = await checkRateLimit(userId);
  if (!rateLimitInfo.withinLimit) {
    res.json({
      message:
        language === 'es'
          ? 'Has alcanzado tu límite de mensajes por hoy.'
          : 'Tu as atteint ta limite de messages pour aujourd\'hui.',
      success: false,
      rateLimitReached: true,
      slots: [],
    });
    return;
  }

  try {
    // ── ÉTAPE 1 : Mistral parse la demande → JSON ─────────────────────────────
    console.log('[Plan] Étape 1 — Parsing de la demande');
    let rawParse: string;
    try {
      rawParse = await callMistralText(PARSE_SYSTEM_PROMPT, message, 200);
    } catch (e) {
      console.error('[Plan] Erreur appel Mistral parse:', e);
      res.json({
        message:
          'Je rencontre une difficulté technique. Peux-tu reformuler ta demande ?',
        success: false,
        slots: [],
      });
      return;
    }

    let parsed: PlanningRequest;
    try {
      // Extraire le JSON même si Mistral ajoute du texte autour
      const jsonMatch = rawParse.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] ?? rawParse);

      // Normaliser et sécuriser les valeurs
      parsed.objectif = String(parsed.objectif || 'activité').trim();
      parsed.frequence = Math.min(Math.max(Math.round(parsed.frequence) || 2, 1), 7);
      parsed.duree = Math.min(Math.max(Math.round(parsed.duree) || 60, 15), 240);

      const validMoments = ['matin', 'après-midi', 'apres-midi', 'soir', 'any'];
      if (!validMoments.includes(parsed.moment)) parsed.moment = 'any';
    } catch (e) {
      console.error('[Plan] Erreur parsing JSON Mistral:', rawParse);
      res.json({
        message:
          'Je n\'ai pas bien compris ta demande. Peux-tu préciser : quelle activité, combien de fois par semaine, et à quel moment de la journée ?',
        success: false,
        slots: [],
      });
      return;
    }

    console.log('[Plan] Parsed:', JSON.stringify(parsed));

    // ── ÉTAPE 2 : Moteur logique → génération des créneaux ───────────────────
    console.log('[Plan] Étape 2 — Génération des créneaux');
    const slots = await generatePlanningSlots(userId, parsed);

    if (slots.length === 0) {
      const momentLabel =
        parsed.moment === 'any' ? 'dans la journée' : `le ${parsed.moment}`;
      res.json({
        message: `Je n'ai pas trouvé de créneau disponible pour "${parsed.objectif}" ${momentLabel}. Ton planning semble chargé sur les prochains jours. Essaie un autre moment de la journée ?`,
        slots: [],
        parsed,
        success: true,
        rateLimitInfo: {
          messagesUsed: rateLimitInfo.messagesUsed,
          messagesRemaining: rateLimitInfo.messagesRemaining,
          resetAt: rateLimitInfo.resetAt,
        },
      });
      return;
    }

    // ── ÉTAPE 3 : Mistral reformule naturellement ─────────────────────────────
    console.log('[Plan] Étape 3 — Reformulation');
    const slotsDescription = slots
      .map(s => `${s.jour} de ${s.start} à ${s.end}`)
      .join(', ');

    const reformulatePrompt =
      `L'étudiant(e) voulait : "${message}"\n` +
      `Activité : "${parsed.objectif}" (${parsed.duree} min par séance)\n` +
      `Créneaux trouvés dans le planning réel : ${slotsDescription}\n\n` +
      `Présente ces créneaux de façon naturelle et motivante. NE MODIFIE JAMAIS les horaires.`;

    let reformulated: string;
    try {
      reformulated = await callMistralText(REFORMULATE_SYSTEM_PROMPT, reformulatePrompt, 250);
      reformulated = reformulated.trim();
    } catch (e) {
      console.warn('[Plan] Erreur reformulation, fallback texte simple');
      reformulated = `J'ai trouvé ${slots.length} créneau(x) pour "${parsed.objectif}" : ${slotsDescription}. Tu peux les ajouter directement à ton planning !`;
    }

    res.json({
      message: reformulated,
      slots,
      parsed,
      success: true,
      rateLimitInfo: {
        messagesUsed: rateLimitInfo.messagesUsed,
        messagesRemaining: rateLimitInfo.messagesRemaining,
        resetAt: rateLimitInfo.resetAt,
      },
    });
  } catch (error: any) {
    console.error('[Plan] Erreur inattendue:', error);
    res.json({
      message: 'Je rencontre une difficulté technique temporaire. Peux-tu reformuler ta demande ?',
      error: error.message,
      success: false,
      slots: [],
    });
  }
}
