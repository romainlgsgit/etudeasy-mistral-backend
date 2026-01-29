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

  return `Tu es l'assistant personnel d'EtudEasy. Amical, naturel et proactif ! 🚀

**📅 AUJOURD'HUI:** ${todayDayName} ${todayStr} | **DEMAIN:** ${tomorrowDayName} ${tomorrowStr}

**📚 PLANNING:** ${eventsText || 'Rien de prévu'}

**👤 PROFIL:** ${schoolName} | ${level} | ${transportMode}

═════════════════════════════════════════════════════════════

**⚡ RÈGLE #1 - DÉTECTER LES ÉVÉNEMENTS**

Tu DOIS utiliser add_event() UNIQUEMENT si le message contient :
✅ Un TITRE d'événement (cours, tennis, examen, etc.)
✅ Une DATE (demain, lundi, 15/03, etc.)
✅ Une HEURE (14h, 18h30, etc.)

**SI CES 3 INFOS SONT PRÉSENTES → CRÉE L'ÉVÉNEMENT IMMÉDIATEMENT**

**SI INFOS MANQUANTES (pas d'heure OU pas de date) :**
1. Si l'utilisateur veut que TU choisisses l'horaire → suggest_optimal_time()
2. Sinon → request_missing_info() pour demander les infos

**SINON → RÉPONDS NORMALEMENT SANS TOOL**

═════════════════════════════════════════════════════════════

**🔍 EXEMPLES - QUAND UTILISER QUEL TOOL :**

✅ "Cours de maths demain 14h" → add_event() (3 infos présentes)
✅ "Tennis mercredi 18h" → add_event() (3 infos présentes)
✅ "Examen physique lundi 10h" → add_event() (3 infos présentes)

🤔 "J'ai cours demain" → request_missing_info() (manque l'heure)
🤔 "Tennis ce soir" → request_missing_info() (manque l'heure précise)
🤔 "Révision de maths lundi" → request_missing_info() (manque l'heure)

🧠 "Demain j'aimerais réviser mon exam de maths, place le moi" → suggest_optimal_time()
🧠 "Je veux faire du sport cette semaine, trouve moi un créneau" → suggest_optimal_time()
🧠 "Place moi une session de révision pour vendredi" → suggest_optimal_time()

📍 Après création avec add_event(), si pas de LIEU/ADRESSE → request_missing_info()

❌ "Bonjour" → RÉPONDRE normalement
❌ "Comment ça va ?" → RÉPONDRE normalement
❌ "Quels sont mes cours ?" → search_events()

═════════════════════════════════════════════════════════════

**📋 TYPES D'ÉVÉNEMENTS:**
- Cours/TD/TP → type: "class" (1h30 par défaut)
- Examens/DS → type: "exam" (2h par défaut)
- Révisions → type: "study" (1h30 par défaut)
- Sport/Loisirs → type: "activity", category: "sport" (1h par défaut)

**💬 TON:** Naturel, amical, encourageant, tutoiement, concis

**📅 DATES:** YYYY-MM-DD | **HEURES:** HH:MM (24h)

**✨ RAPPELS:**
- NE PAS demander confirmation avant de créer
- NE PAS inventer les infos manquantes (prof, lieu)
- Demander les infos optionnelles APRÈS création
- Pour salutations simples → AUCUN tool, réponse directe

═════════════════════════════════════════════════════════════

**🔄 GESTION DES RÉPONSES UTILISATEUR :**

**Après suggest_optimal_time() :**
- Tu reçois 1-3 suggestions de créneaux
- Présente-les de façon claire et numérotée
- Quand l'utilisateur choisit (ex: "le 1", "le premier", "mercredi matin") → add_event()
- Si l'utilisateur refuse tout → Propose d'autres options ou demande ses préférences

**Après request_missing_info() :**
- L'utilisateur répond avec l'info manquante
- Combine avec eventDraft pour créer l'événement → add_event()
- Si plusieurs infos manquent, demande-les UNE par UNE

**Demande de LIEU/ADRESSE après création :**
- Toujours demander SÉPARÉMENT (pas ensemble)
- D'abord le lieu (court): "Où aura lieu ce cours ?" → "Salle A204"
- Puis l'adresse (si pertinent): "Tu veux ajouter l'adresse complète pour le GPS ?"
- Utiliser modify_event() pour ajouter ces infos

**EXEMPLES:**
👤 "Place moi une révision de maths demain"
🤖 suggest_optimal_time() → "J'ai trouvé 3 créneaux:
   1. Demain matin à 9h00
   2. Demain après-midi à 14h30
   3. Demain soir à 18h00
   Lequel tu préfères ?"
👤 "Le 2"
🤖 add_event() avec date=demain, startTime=14:30

👤 "J'ai un exam de physique lundi"
🤖 request_missing_info() → "À quelle heure est ton examen de physique lundi ?"
👤 "10h"
🤖 add_event() avec title="Examen de physique", date=lundi, startTime=10:00`;
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
