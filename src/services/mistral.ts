/**
 * Configuration Mistral AI et définition des tools
 */

export const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

// Choix du modèle (optimisé pour budget limité)
export const MISTRAL_MODEL = 'open-mistral-nemo'; // ou 'mistral-small-latest' si besoin

// Clé API depuis les variables d'environnement
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY!;

// Définition des tools disponibles pour l'IA
export const MISTRAL_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_event',
      description: 'Ajoute un ou plusieurs événements au planning de l\'étudiant',
      parameters: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            description: 'Liste des événements à ajouter',
            items: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Titre de l\'événement (ex: "Cours de Mathématiques")',
                },
                type: {
                  type: 'string',
                  enum: ['class', 'exam', 'study', 'activity'],
                  description: 'Type d\'événement: class (cours), exam (examen), study (révision), activity (activité)',
                },
                date: {
                  type: 'string',
                  description: 'Date au format YYYY-MM-DD (ex: "2026-01-30")',
                },
                startTime: {
                  type: 'string',
                  description: 'Heure de début au format HH:MM (24h, ex: "14:00")',
                },
                endTime: {
                  type: 'string',
                  description: 'Heure de fin au format HH:MM (24h, ex: "15:30")',
                },
                location: {
                  type: 'string',
                  description: 'Lieu de l\'événement (ex: "Salle A204", "Amphithéâtre")',
                },
                category: {
                  type: 'string',
                  enum: ['sport', 'social', 'academic', 'creative', 'wellness'],
                  description: 'Catégorie si type=activity (sport, social, académique, créatif, bien-être)',
                },
                professor: {
                  type: 'string',
                  description: 'Nom du professeur (optionnel, pour les cours/examens)',
                },
              },
              required: ['title', 'type', 'date', 'startTime', 'endTime'],
            },
          },
        },
        required: ['events'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'modify_event',
      description: 'Modifie un événement existant dans le planning',
      parameters: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'ID de l\'événement à modifier',
          },
          updates: {
            type: 'object',
            description: 'Champs à mettre à jour',
            properties: {
              title: { type: 'string' },
              startTime: { type: 'string', description: 'Format HH:MM' },
              endTime: { type: 'string', description: 'Format HH:MM' },
              location: { type: 'string' },
              date: { type: 'string', description: 'Format YYYY-MM-DD' },
            },
          },
        },
        required: ['eventId', 'updates'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_event',
      description: 'Supprime un événement du planning',
      parameters: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'ID de l\'événement à supprimer',
          },
        },
        required: ['eventId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_events',
      description: 'Recherche des événements dans le planning par critères',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Mot-clé à rechercher dans les titres',
          },
          startDate: {
            type: 'string',
            description: 'Date de début de recherche (YYYY-MM-DD)',
          },
          endDate: {
            type: 'string',
            description: 'Date de fin de recherche (YYYY-MM-DD)',
          },
          type: {
            type: 'string',
            enum: ['class', 'exam', 'study', 'activity', 'all'],
            description: 'Filtrer par type d\'événement',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recommendations',
      description: 'Obtient des recommandations pour optimiser le planning étudiant',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['study_time', 'free_slots', 'exam_preparation', 'workload_balance'],
            description: 'Type de recommandation: temps d\'étude, créneaux libres, préparation examen, équilibre charge',
          },
        },
        required: ['type'],
      },
    },
  },
];

/**
 * Construit le prompt système avec le contexte utilisateur
 */
export function buildSystemPrompt(userContext: any): string {
  // Date actuelle
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // Format YYYY-MM-DD
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const daysOfWeek = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const todayDayName = daysOfWeek[today.getDay()];
  const tomorrowDayName = daysOfWeek[tomorrow.getDay()];

  // Formater les événements de manière concise
  const eventsText = userContext.events
    .slice(0, 8)
    .map((e: any) =>
      `- ${e.title} (${e.type}) le ${e.date} de ${e.startTime} à ${e.endTime}${e.location ? ` à ${e.location}` : ''}`
    )
    .join('\n');

  const profile = userContext.profile || {};
  const schoolName = profile.academicInfo?.name || 'Non défini';
  const level = profile.academicInfo?.level || 'Non défini';
  const transportMode = profile.alarmSettings?.transportMode || 'Non défini';

  return `Tu es l'assistant personnel d'EtudEasy. Tu es amical, naturel et tu AGIS directement ! 🚀

**📅 DATE DU JOUR:**
- Aujourd'hui: ${todayDayName} ${todayStr}
- Demain: ${tomorrowDayName} ${tomorrowStr}

**📚 PLANNING ACTUEL:**
${eventsText || 'Rien de prévu pour le moment'}

**👤 PROFIL:**
École: ${schoolName} | Niveau: ${level} | Transport: ${transportMode}

═══════════════════════════════════════════════════════════════

**🎯 RÈGLE ABSOLUE - DÉTECTION D'ÉVÉNEMENT:**

Dès que l'utilisateur mentionne un ÉVÉNEMENT (cours, examen, activité), tu DOIS:

1️⃣ **IDENTIFIER** si c'est un événement à créer
   ✅ "J'ai cours de maths demain 14h" → OUI, événement !
   ✅ "Tennis mercredi 18h" → OUI, événement !
   ✅ "Examen physique lundi" → OUI, événement !
   ❌ "Bonjour" → NON, juste une salutation
   ❌ "Quels sont mes cours ?" → NON, c'est une question

2️⃣ **VÉRIFIER** les infos obligatoires
   - ✅ Titre (ex: "Maths", "Tennis")
   - ✅ Date ("demain", "lundi", "15/03")
   - ✅ Heure de début ("14h", "18h30")
   - ⚠️ Heure de fin (si absente, utilise durée par défaut)

3️⃣ **DEMANDER** les infos optionnelles SEULEMENT si logique
   - Nom du prof (pour cours/examens)
   - Lieu (si pas évident)
   - Catégorie (pour activités: sport, social, etc.)

   💡 Demande en disant: "J'ai bien noté ! Au fait, tu connais le nom du prof ?" ou "C'est dans quelle salle ?"

4️⃣ **CRÉER** immédiatement avec add_event()
   - Utilise les infos données
   - NE PAS inventer le nom du prof si pas donné
   - NE PAS demander confirmation
   - Répondre naturellement après création

═══════════════════════════════════════════════════════════════

**📋 TYPES D'ÉVÉNEMENTS:**
- **Cours/TD/TP** → type: "class" (durée: 1h30)
- **Examens/DS** → type: "exam" (durée: 2h)
- **Révisions/Devoirs** → type: "study" (durée: 1h30)
- **Sport/Loisirs** → type: "activity", category: "sport"/"social"/"wellness"/etc. (durée: 1h)

**💬 EXEMPLES CONCRETS:**

User: "Demain cours d'histoire 14h"
Assistant: [Appelle add_event] "Nickel ! Cours d'histoire ajouté demain à 14h 📚 Au fait, tu connais le nom du prof ?"

User: "Tennis mercredi 18h"
Assistant: [Appelle add_event avec category="sport"] "Top ! Tennis mercredi à 18h 🎾 C'est dans quel club ?"

User: "Examen de maths vendredi 9h salle A203 avec M. Dupont"
Assistant: [Appelle add_event avec lieu et prof] "C'est noté ! Examen de maths vendredi 9h en salle A203 avec M. Dupont 💪 Pense à réviser !"

User: "Bonjour"
Assistant: [PAS de tool call] "Salut ! 👋 Comment je peux t'aider avec ton planning aujourd'hui ?"

User: "Quels sont mes cours cette semaine ?"
Assistant: [Utilise search_events ou analyse le planning] "Voici tes cours de la semaine: ..."

═══════════════════════════════════════════════════════════════

**🎭 TON:**
- Naturel et amical (pas robotique)
- Emojis pertinents mais pas trop
- Encourageant et positif
- Tutoiement
- Concis et efficace

**📅 DATES:**
"aujourd'hui" = ${todayStr} | "demain" = ${tomorrowStr}
Format: YYYY-MM-DD pour dates, HH:MM pour heures (24h)

**✨ RAPPEL IMPORTANT:**
- AGIS directement, ne demande PAS de confirmation
- NE DIS PAS "J'ai identifié..." - CRÉE directement !
- Demande les infos optionnelles APRÈS avoir créé l'événement
- Sois rapide et efficace !`;
}

/**
 * Appelle l'API Mistral AI
 */
export async function callMistralAPI(messages: any[], includeTools = true): Promise<any> {
  const body: any = {
    model: MISTRAL_MODEL,
    messages,
    temperature: 0.2, // Plus bas pour plus de déterminisme
    max_tokens: includeTools ? 500 : 300,
  };

  if (includeTools) {
    body.tools = MISTRAL_TOOLS;
    body.tool_choice = 'any'; // Force l'utilisation des tools (safe car 2e appel a includeTools=false)
  }

  const response = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}
