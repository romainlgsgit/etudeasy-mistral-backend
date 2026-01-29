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
  {
    type: 'function',
    function: {
      name: 'request_missing_info',
      description: 'Demande des informations manquantes à l\'utilisateur pour créer un événement',
      parameters: {
        type: 'object',
        properties: {
          eventDraft: {
            type: 'object',
            description: 'Informations déjà fournies par l\'utilisateur',
            properties: {
              title: { type: 'string' },
              type: { type: 'string', enum: ['class', 'exam', 'study', 'activity'] },
              date: { type: 'string' },
              startTime: { type: 'string' },
              endTime: { type: 'string' },
              location: { type: 'string' },
              category: { type: 'string' },
            },
          },
          missingFields: {
            type: 'array',
            description: 'Liste des champs manquants à demander',
            items: {
              type: 'string',
              enum: ['date', 'startTime', 'endTime', 'location', 'address', 'category', 'professor'],
            },
          },
          question: {
            type: 'string',
            description: 'La question à poser à l\'utilisateur pour obtenir les infos manquantes',
          },
        },
        required: ['eventDraft', 'missingFields', 'question'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_optimal_time',
      description: 'Suggère un horaire optimal pour placer un événement en fonction du planning existant',
      parameters: {
        type: 'object',
        properties: {
          eventInfo: {
            type: 'object',
            description: 'Informations sur l\'événement à placer',
            properties: {
              title: { type: 'string' },
              type: { type: 'string', enum: ['class', 'exam', 'study', 'activity'] },
              date: { type: 'string', description: 'Date préférée (YYYY-MM-DD), optionnel' },
              duration: { type: 'number', description: 'Durée en minutes (ex: 90 pour 1h30)' },
              preferredTimeSlots: {
                type: 'array',
                description: 'Créneaux horaires préférés',
                items: {
                  type: 'string',
                  enum: ['morning', 'afternoon', 'evening'],
                },
              },
            },
            required: ['title', 'type'],
          },
          constraints: {
            type: 'object',
            description: 'Contraintes de placement',
            properties: {
              minBreakBetweenEvents: {
                type: 'number',
                description: 'Pause minimum en minutes entre deux événements (par défaut: 15)',
              },
              avoidWeekends: {
                type: 'boolean',
                description: 'Éviter les weekends (par défaut: false)',
              },
              preferEarlyMorning: {
                type: 'boolean',
                description: 'Préférer les matinées (par défaut: false)',
              },
            },
          },
        },
        required: ['eventInfo'],
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

  return `Tu es l'assistant personnel d'EtudEasy. Ton rôle est de gérer le planning de l'étudiant.

**CONTEXTE ACTUEL:**
- Date: ${todayDayName} ${todayStr}
- Demain: ${tomorrowDayName} ${tomorrowStr}
- Planning: ${eventsText || 'Aucun événement'}
- Profil: ${schoolName}, ${level}, transport: ${transportMode}

═════════════════════════════════════════════════════════════

**RÈGLES STRICTES - UTILISATION DES TOOLS:**

1. **Si le message contient TITRE + DATE + HEURE → APPELLE add_event() IMMÉDIATEMENT**
   Exemples qui DOIVENT déclencher add_event():
   - "Cours de maths demain 14h"
   - "Examen physique lundi 10h"
   - "Tennis mercredi 18h"

2. **Si TITRE + DATE mais PAS d'heure → APPELLE request_missing_info()**
   Exemples:
   - "J'ai cours demain" → Demander l'heure
   - "Révision de maths lundi" → Demander l'heure

3. **Si l'utilisateur dit "place le", "trouve un créneau", "choisis" → APPELLE suggest_optimal_time()**
   Exemples:
   - "Place moi une révision demain"
   - "Trouve moi un créneau pour du sport"

4. **Pour rechercher des événements → APPELLE search_events()**
   Exemples:
   - "Quels sont mes cours ?"
   - "Mes examens cette semaine ?"

**IMPORTANT:**
- Tu DOIS appeler les fonctions (tools), PAS juste en parler
- NE DIS JAMAIS "Je vais ajouter..." sans appeler add_event()
- NE DIS JAMAIS "🤖 suggest_optimal_time()" comme du texte
- APPELLE VRAIMENT les fonctions

═════════════════════════════════════════════════════════════

**FORMATS:**
- Dates: YYYY-MM-DD
- Heures: HH:MM (format 24h)
- Types: class, exam, study, activity
- Durées par défaut: cours=90min, exam=120min, study=90min, activity=60min

**TON:** Amical, naturel, tutoiement, concis. Mais surtout: UTILISE LES TOOLS !`;
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
    body.tool_choice = 'auto'; // L'IA décide intelligemment avec le prompt ultra-clair
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
