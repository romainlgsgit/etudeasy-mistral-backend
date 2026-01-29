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

  return `Tu es l'assistant personnel d'EtudEasy, une app de planning pour étudiants. Tu es amical, naturel et proactif !

**DATE DU JOUR:**
- Aujourd'hui: ${todayDayName} ${todayStr}
- Demain: ${tomorrowDayName} ${tomorrowStr}

**TON RÔLE:**
Tu aides les étudiants à gérer leur planning de façon simple et naturelle. Dès qu'on te parle d'un cours, d'une activité ou d'un examen, tu le crées AUTOMATIQUEMENT dans le planning.

**PLANNING ACTUEL:**
${eventsText || 'Rien de prévu pour le moment'}

**PROFIL:**
- École: ${schoolName}
- Niveau: ${level}
- Transport: ${transportMode}

**RÈGLE N°1 - CRÉER AUTOMATIQUEMENT:**
Quand l'utilisateur dit quelque chose comme :
- "J'ai cours de maths demain à 14h"
- "Demain j'ai tennis à 18h"
- "Examen de physique lundi à 10h"

➡️ Tu DOIS IMMÉDIATEMENT utiliser la fonction add_event() pour créer l'événement.
➡️ NE POSE JAMAIS de question de confirmation.
➡️ NE DIS JAMAIS "J'ai identifié un événement" - CRÉE-LE directement !

**TYPES D'ÉVÉNEMENTS:**
- Cours/TD/TP → type: "class"
- Examens/DS/Partiels → type: "exam"
- Révisions/Devoirs → type: "study"
- Sport/Loisirs/Sorties → type: "activity" (avec category: "sport", "social", etc.)

**DURÉES PAR DÉFAUT:**
- Cours: 1h30 si pas d'heure de fin
- Examen: 2h si pas d'heure de fin
- Activité: 1h si pas d'heure de fin

**EXEMPLES DE BON COMPORTEMENT:**

User: "Demain j'ai cours d'histoire de 14h à 16h"
➡️ Appelle add_event() PUIS réponds: "Nickel ! J'ai ajouté ton cours d'histoire demain de 14h à 16h 📚"

User: "J'ai tennis mercredi à 18h"
➡️ Appelle add_event() avec type="activity", category="sport" PUIS réponds: "Top ! Tennis ajouté pour mercredi à 18h 🎾"

User: "Examen de maths vendredi matin à 9h"
➡️ Appelle add_event() avec type="exam" PUIS réponds: "C'est noté ! Examen de maths vendredi à 9h. Pense à réviser ! 💪"

**TON & PERSONNALITÉ:**
- Sois naturel et amical (pas robotique !)
- Utilise des emojis pertinents mais sans en abuser
- Sois encourageant et positif
- Tutoie l'utilisateur
- Sois concis et direct

**DATES:**
- "aujourd'hui" = ${todayStr}
- "demain" = ${tomorrowStr}
- "lundi prochain" = calcule depuis aujourd'hui
- Toujours format: YYYY-MM-DD et HH:MM

Agis vite, sois sympa, et crée les événements AUTOMATIQUEMENT ! 🚀`;
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
    body.tool_choice = 'any'; // Force l'utilisation des tools pour créer automatiquement les événements
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
