/**
 * Configuration Mistral AI et définition des tools
 */

export const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

// Choix du modèle - mistral-small-latest (meilleur function calling)
export const MISTRAL_MODEL = 'mistral-small-latest';

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
  {
    type: 'function',
    function: {
      name: 'propose_organization',
      description: 'OUTIL PRINCIPAL : Propose une organisation de tâches/activités basée sur les créneaux disponibles fournis par le système. Cet outil ne modifie JAMAIS le planning directement.',
      parameters: {
        type: 'object',
        properties: {
          userRequest: {
            type: 'string',
            description: 'Demande originale de l\'utilisateur (ex: "aide-moi à organiser mes révisions")',
          },
          proposals: {
            type: 'array',
            description: 'Liste des propositions d\'organisation',
            items: {
              type: 'object',
              properties: {
                slotDay: {
                  type: 'string',
                  description: 'Jour du créneau (ex: "Lundi")',
                },
                slotStart: {
                  type: 'string',
                  description: 'Heure de début du créneau (HH:MM)',
                },
                slotEnd: {
                  type: 'string',
                  description: 'Heure de fin du créneau (HH:MM)',
                },
                activityType: {
                  type: 'string',
                  description: 'Type d\'activité proposé (révision, travail perso, sport, repos, etc.)',
                },
                activityTitle: {
                  type: 'string',
                  description: 'Titre suggéré pour l\'activité',
                },
                duration: {
                  type: 'number',
                  description: 'Durée suggérée en minutes',
                },
                reason: {
                  type: 'string',
                  description: 'Explication du choix de ce créneau et cette activité',
                },
              },
              required: ['slotDay', 'slotStart', 'slotEnd', 'activityType', 'activityTitle', 'duration', 'reason'],
            },
          },
          summary: {
            type: 'string',
            description: 'Résumé général de l\'organisation proposée',
          },
        },
        required: ['userRequest', 'proposals', 'summary'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'auto_place_event',
      description: '🎯 OUTIL AUTOMATIQUE INTELLIGENT : Place automatiquement un événement dans le meilleur créneau disponible. Analyse le planning, trouve le meilleur moment, et crée l\'événement. Utilise cet outil quand l\'utilisateur demande "place-moi...", "trouve-moi un créneau", "choisis pour moi", ou dit "ok" après une suggestion.',
      parameters: {
        type: 'object',
        properties: {
          eventInfo: {
            type: 'object',
            description: 'Informations sur l\'événement à placer',
            properties: {
              title: {
                type: 'string',
                description: 'Titre de l\'événement (ex: "Révision de mathématiques")',
              },
              type: {
                type: 'string',
                enum: ['class', 'exam', 'study', 'activity'],
                description: 'Type d\'événement',
              },
              duration: {
                type: 'number',
                description: 'Durée souhaitée en minutes (ex: 90 pour 1h30). Par défaut: 90min pour study, 60min pour activity',
              },
              category: {
                type: 'string',
                enum: ['sport', 'social', 'academic', 'creative', 'wellness'],
                description: 'Catégorie si type=activity',
              },
              location: {
                type: 'string',
                description: 'Lieu de l\'événement (optionnel)',
              },
            },
            required: ['title', 'type'],
          },
          preferences: {
            type: 'object',
            description: 'Préférences de placement (optionnel)',
            properties: {
              targetDate: {
                type: 'string',
                description: 'Date cible si spécifiée (YYYY-MM-DD). Ex: "2026-01-31" pour demain',
              },
              preferredTimeOfDay: {
                type: 'string',
                enum: ['morning', 'afternoon', 'evening', 'any'],
                description: 'Moment de la journée préféré. Par défaut: any',
              },
              priorityQuality: {
                type: 'boolean',
                description: 'Prioriser la qualité du créneau sur la date. Par défaut: false',
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

  // Déterminer si on a une analyse de planning disponible
  const hasAnalysis = userContext.planningAnalysis && userContext.planningAnalysis.availableSlots;

  // Mode 1 : ORGANISATION & PLANIFICATION (avec analyse)
  if (hasAnalysis) {
    const analysis = userContext.planningAnalysis;
    const slots = analysis.availableSlots?.availableSlotsFormatted || [];
    const criticalInfo = analysis.availableSlots?.criticalInfo || [];
    const summary = analysis.availableSlots?.summary || '';

    // Formater les créneaux disponibles
    const slotsText = slots
      .slice(0, 10)
      .map((s: any) => `  • ${s.day} ${s.start}-${s.end} (${s.duration}min, qualité: ${s.quality})`)
      .join('\n');

    return `Tu es un assistant bienveillant d'organisation pour un étudiant.

🚨 **RÈGLE FONDAMENTALE** 🚨
Tu n'as PAS le droit de modifier directement son planning ni de créer, supprimer ou déplacer des événements.

═══════════════════════════════════════════════════════════

**CONTEXTE :**
Date: ${todayDayName} ${todayStr}

${summary}

**Informations critiques :**
${criticalInfo.map((info: string) => `  ${info}`).join('\n')}

**Créneaux disponibles validés :**
${slotsText || '  Aucun créneau disponible'}

═══════════════════════════════════════════════════════════

**TON RÔLE :**

1. **ANALYSER** la demande de l'utilisateur
   Exemples : "Aide-moi à mieux organiser mes révisions", "Planifier mes tâches de la semaine", "J'ai trop de choses à faire"

2. **PROPOSER** une organisation réaliste et équilibrée
   Pour chaque proposition, indique :
   - Le type d'activité (révision, travail perso, sport, repos, etc.)
   - Une durée indicative
   - Le créneau suggéré (parmi ceux fournis ci-dessus UNIQUEMENT)
   - La raison du choix

3. **EXPLIQUER** tes choix de manière claire, rassurante et adaptée à la vie étudiante

4. **UTILISER** la fonction propose_organization() pour structurer ta réponse

═══════════════════════════════════════════════════════════

**CONTRAINTES ABSOLUES :**

❌ Ne JAMAIS imposer d'horaires en dehors des créneaux fournis ci-dessus
❌ Ne JAMAIS créer, modifier ou supprimer d'événements
❌ Ne JAMAIS utiliser add_event(), modify_event() ou delete_event()

✅ UTILISE UNIQUEMENT propose_organization() pour faire des suggestions

═══════════════════════════════════════════════════════════

**FORMAT DE RÉPONSE :**

Utilise propose_organization() avec :
- userRequest: la demande originale
- proposals: liste des propositions (créneau + activité + raison)
- summary: résumé bienveillant de ton organisation

Le résultat sera présenté à l'utilisateur pour validation.
SEUL l'utilisateur peut décider d'appliquer ou non tes suggestions.

═══════════════════════════════════════════════════════════

**TON :** Bienveillant, rassurant, pédagogique. Tu es là pour conseiller, pas pour imposer.`;
  }

  // Mode 2 : GESTION CLASSIQUE DES ÉVÉNEMENTS (sans analyse)
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

**DÉTECTION AUTOMATIQUE - CHOIX DE LA BONNE FONCTION:**

🎯 **auto_place_event()** - Utilise QUAND:
   • "place-moi une révision DEMAIN" (date vague sans heure)
   • "trouve-moi un créneau pour réviser"
   • "ajoute un cours de sport quand tu peux"
   • "choisis un moment pour étudier"
   • Utilisateur dit "ok"/"oui" après que tu aies suggéré un créneau
   → L'IA analyse le planning et place automatiquement au meilleur moment

📝 **add_event()** - Utilise QUAND:
   • "j'ai un cours de maths LUNDI à 14h" (date ET heure précises)
   • "ajoute un examen le 2026-02-15 de 10h à 12h"
   → L'utilisateur spécifie l'horaire exact

❓ **request_missing_info()** - Utilise QUAND:
   • L'utilisateur donne TITRE + DATE mais PAS d'heure
   • ET ne demande PAS de choisir automatiquement
   → Demande l'heure manquante

═══════════════════════════════════════════════════════════

**EXEMPLES CONCRETS:**

User: "Place-moi une révision demain"
→ auto_place_event({ eventInfo: { title: "Révision", type: "study" }, preferences: { targetDate: "${tomorrowStr}" } })

User: "J'ai un cours de maths lundi à 14h"
→ add_event({ events: [{ title: "Cours de mathématiques", type: "class", date: "...", startTime: "14:00", endTime: "15:30" }] })

User: "Trouve-moi un créneau pour faire du sport"
→ auto_place_event({ eventInfo: { title: "Sport", type: "activity", category: "sport" } })

User: "J'ai un examen de physique vendredi"
→ request_missing_info({ eventDraft: { title: "Examen de physique", type: "exam", date: "..." }, missingFields: ["startTime", "endTime"], question: "À quelle heure est ton examen de physique vendredi ?" })

═══════════════════════════════════════════════════════════

**FORMATS:**
Dates: YYYY-MM-DD | Heures: HH:MM (24h)
Types: class, exam, study, activity
Durées par défaut: study=90min, activity=60min

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
