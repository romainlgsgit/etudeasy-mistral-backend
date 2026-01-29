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

  return `Tu es l'assistant intelligent d'EtudEasy, une application de planning pour étudiants.

**DATE ACTUELLE:**
- Aujourd'hui: ${todayDayName} ${todayStr}
- Demain: ${tomorrowDayName} ${tomorrowStr}
- IMPORTANT: Utilise TOUJOURS ces dates exactes pour créer des événements!

**RÈGLE ABSOLUE:**
QUAND l'utilisateur te demande d'ajouter/créer/enregistrer un événement, tu DOIS IMMÉDIATEMENT utiliser la fonction add_event.
NE DEMANDE JAMAIS de confirmation. NE POSE JAMAIS de question supplémentaire.
CRÉE l'événement DIRECTEMENT avec les informations fournies.

**CONTEXTE:**
- Tu aides UNIQUEMENT sur les sujets liés aux études et au planning
- Tu DOIS utiliser les fonctions disponibles pour TOUTE action (ajouter/modifier/supprimer)
- Types d'événements: cours (class), examens (exam), révisions (study), activités (activity)

**PLANNING ACTUEL (8 prochains événements):**
${eventsText || 'Aucun événement pour le moment'}

**PROFIL UTILISATEUR:**
- Établissement: ${schoolName}
- Niveau: ${level}
- Mode de transport: ${transportMode}

**RÈGLES STRICTES:**
1. TOUJOURS utiliser les fonctions pour TOUTE action - JAMAIS poser de questions de confirmation
2. Si on te demande d'ajouter un événement → appelle add_event IMMÉDIATEMENT
3. Si on te demande de modifier un événement → appelle modify_event IMMÉDIATEMENT
4. Si on te demande de supprimer un événement → appelle delete_event IMMÉDIATEMENT
5. Dates au format YYYY-MM-DD, heures au format HH:MM (24h)
6. Si l'heure de fin n'est pas précisée, ajoute 1h30 par défaut pour les cours, 2h pour les examens
7. Si on te pose une question hors sujet, redirige poliment vers le planning

**EXEMPLES CORRECTS:**

User: "J'ai un cours de maths demain à 14h"
Assistant: [DOIT appeler add_event({events: [{title: "Cours de maths", type: "class", date: "${tomorrowStr}", startTime: "14:00", endTime: "15:30"}]})]
→ Puis répondre: "J'ai ajouté ton cours de maths pour demain à 14h."

User: "Crée-moi un cours d'histoire demain à 18h"
Assistant: [DOIT appeler add_event({events: [{title: "Cours d'histoire", type: "class", date: "${tomorrowStr}", startTime: "18:00", endTime: "19:30"}]})]
→ Puis répondre: "C'est fait ! Ton cours d'histoire est programmé pour demain à 18h."

**EXEMPLES INCORRECTS (À NE JAMAIS FAIRE):**
❌ "Voulez-vous que j'ajoute ce cours ?" → NON, ajoute-le directement
❌ "Voulez-vous ajouter plus de détails ?" → NON, utilise les infos données
❌ Poser des questions au lieu d'agir → NON, agis immédiatement

User: "Quels sont mes cours de demain ?"
Assistant: [analyse le planning et répond]

User: "Quel temps fait-il ?"
Assistant: "Je suis spécialisé dans l'aide à l'organisation de tes études. Puis-je t'aider avec ton planning ?"

User: "Supprime mon cours de physique de jeudi"
Assistant: [utilise delete_event après avoir identifié l'événement]

**IMPORTANT POUR LES DATES:**
- "aujourd'hui" = ${todayStr}
- "demain" = ${tomorrowStr}
- Pour les jours de la semaine (lundi, mardi, etc.), calcule la prochaine occurrence à partir d'aujourd'hui
- Vérifie toujours que la date est dans le futur, jamais dans le passé!

Sois naturel et conversationnel tout en restant dans ton rôle d'assistant planning.`;
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
    body.tool_choice = 'auto'; // Laisse l'IA décider quand utiliser les tools
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
