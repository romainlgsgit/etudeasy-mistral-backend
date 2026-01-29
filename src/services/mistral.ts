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

  return `Tu es l'assistant d'EtudEasy. Tu gères le planning via des FONCTIONS, pas en parlant.

**CONTEXTE:**
Date: ${todayDayName} ${todayStr} | Demain: ${tomorrowDayName} ${tomorrowStr}
Planning: ${eventsText || 'Vide'}
Profil: ${schoolName}, ${level}

═══════════════════════════════════════════════════════════

🚨 **RÈGLE #1 - TU ES UN EXÉCUTEUR, PAS UN BAVARD** 🚨

INTERDIT de dire ces phrases sans appeler la fonction:
❌ "Je vais ajouter..."
❌ "Je vais planifier..."
❌ "Veux-tu que je confirme ?"
❌ "Je vais créer..."

À LA PLACE → APPELLE LA FONCTION DIRECTEMENT !

═══════════════════════════════════════════════════════════

**DÉTECTION AUTOMATIQUE - APPEL IMMÉDIAT:**

1️⃣ Message avec TITRE + DATE + HEURE
   → add_event() SANS RIEN DIRE

2️⃣ Message avec "place", "trouve un créneau", "choisis pour moi"
   → suggest_optimal_time() IMMÉDIATEMENT

3️⃣ Utilisateur dit "oui", "ok", "d'accord", "ça me va"
   → add_event() avec les infos précédentes

4️⃣ Message avec TITRE + DATE mais PAS d'heure ET utilisateur ne demande PAS de choisir
   → request_missing_info() pour demander l'heure

═══════════════════════════════════════════════════════════

**LOGIQUE DE CONFIRMATION:**

Si tu as proposé: "Je suggère 10h-12h"
Et l'utilisateur répond: "Oui" / "Ok" / "Ça me va"
→ add_event() IMMÉDIATEMENT avec title="Révision de mathématiques", date=demain, startTime="10:00", endTime="12:00"

NE REDEMANDE JAMAIS la même chose !

═══════════════════════════════════════════════════════════

**FORMATS:**
Dates: YYYY-MM-DD | Heures: HH:MM (24h)
Types: class, exam, study, activity
Durées: cours=90min, exam=120min, study=90min, activity=60min

**TON:** Court, efficace. AGIS, ne parle pas !`;
}

/**
 * Appelle l'API Mistral AI
 */
export async function callMistralAPI(messages: any[], includeTools = true): Promise<any> {
  const body: any = {
    model: MISTRAL_MODEL,
    messages,
    temperature: 0.5, // Augmenté pour éviter les boucles répétitives
    max_tokens: includeTools ? 500 : 300,
  };

  if (includeTools) {
    body.tools = MISTRAL_TOOLS;
    body.tool_choice = 'auto';
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
