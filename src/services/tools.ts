/**
 * Gestion de l'exécution des tool calls
 */

import * as admin from 'firebase-admin';
import { clearUserContextCache } from './context';

/**
 * Calcule le dayIndex (0=Lundi, 6=Dimanche) depuis une date
 */
function calculateDayIndex(dateString: string): number {
  const date = new Date(dateString);
  const day = date.getDay();
  // Convertir dimanche (0) en 6, et les autres jours -1
  return day === 0 ? 6 : day - 1;
}

/**
 * Retourne la couleur par défaut selon le type d'événement
 */
function getEventTypeColor(type: string): string {
  const colors: Record<string, string> = {
    class: '#3B82F6', // Bleu
    exam: '#EF4444', // Rouge
    study: '#F59E0B', // Orange
    activity: '#14B8A6', // Turquoise
  };
  return colors[type] || '#6B7280'; // Gris par défaut
}

/**
 * Convertit une heure "HH:MM" en minutes depuis minuit
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convertit des minutes depuis minuit en format "HH:MM"
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Trouve un créneau horaire optimal dans le planning de l'utilisateur
 */
async function findOptimalTimeSlot(
  userId: string,
  eventInfo: any,
  constraints: any = {}
): Promise<any> {
  console.log('[findOptimalTimeSlot] Début avec userId:', userId);

  const db = admin.firestore();

  // Paramètres par défaut
  const duration = eventInfo.duration || 90; // 90 minutes par défaut
  const minBreak = constraints.minBreakBetweenEvents || 15;
  const avoidWeekends = constraints.avoidWeekends || false;
  const preferEarlyMorning = constraints.preferEarlyMorning || false;

  // Date de départ : soit celle spécifiée, soit demain
  let searchDate: Date;
  if (eventInfo.date) {
    searchDate = new Date(eventInfo.date);
  } else {
    searchDate = new Date();
    searchDate.setDate(searchDate.getDate() + 1); // Demain
  }

  // Chercher sur 7 jours maximum
  const suggestions: any[] = [];

  for (let i = 0; i < 7 && suggestions.length < 3; i++) {
    const currentDate = new Date(searchDate);
    currentDate.setDate(currentDate.getDate() + i);
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay();

    // Skip weekends si demandé
    if (avoidWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      continue;
    }

    // Récupérer tous les événements de cette date
    console.log('[findOptimalTimeSlot] Requête Firestore pour date:', dateStr, 'userId:', userId);
    let eventsSnapshot;
    try {
      eventsSnapshot = await db
        .collection('scheduleEvents')
        .where('userId', '==', userId)
        .where('date', '==', dateStr)
        .get();
      console.log('[findOptimalTimeSlot] Événements trouvés:', eventsSnapshot.size);
    } catch (firestoreError: any) {
      console.error('[findOptimalTimeSlot] Erreur Firestore:', firestoreError.message);
      console.error('[findOptimalTimeSlot] Stack:', firestoreError.stack);
      throw firestoreError;
    }

    // Trier en mémoire pour éviter besoin d'index composite
    const dayEvents = eventsSnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a: any, b: any) => {
        const timeA = timeToMinutes(a.startTime);
        const timeB = timeToMinutes(b.startTime);
        return timeA - timeB;
      });

    // Définir les créneaux possibles selon les préférences
    const preferredSlots = eventInfo.preferredTimeSlots || ['morning', 'afternoon', 'evening'];
    const timeSlots: { start: number; end: number; label: string; priority: number }[] = [];

    if (preferredSlots.includes('morning')) {
      timeSlots.push({ start: 8 * 60, end: 12 * 60, label: 'matin', priority: preferEarlyMorning ? 3 : 2 });
    }
    if (preferredSlots.includes('afternoon')) {
      timeSlots.push({ start: 13 * 60, end: 18 * 60, label: 'après-midi', priority: 2 });
    }
    if (preferredSlots.includes('evening')) {
      timeSlots.push({ start: 18 * 60, end: 21 * 60, label: 'soir', priority: 1 });
    }

    // Chercher un créneau libre dans chaque slot
    for (const slot of timeSlots) {
      let proposedStart = slot.start;
      let foundSlot = false;

      while (proposedStart + duration <= slot.end && !foundSlot) {
        const proposedEnd = proposedStart + duration;

        // Vérifier qu'il n'y a pas de conflit avec les événements existants
        let hasConflict = false;

        for (const event of dayEvents) {
          const eventStart = timeToMinutes((event as any).startTime);
          const eventEnd = timeToMinutes((event as any).endTime);

          // Vérifier chevauchement + pause minimum
          if (
            (proposedStart >= eventStart - minBreak && proposedStart < eventEnd + minBreak) ||
            (proposedEnd > eventStart - minBreak && proposedEnd <= eventEnd + minBreak) ||
            (proposedStart <= eventStart && proposedEnd >= eventEnd)
          ) {
            hasConflict = true;
            // Sauter après cet événement
            proposedStart = eventEnd + minBreak;
            break;
          }
        }

        if (!hasConflict && proposedStart + duration <= slot.end) {
          // Créneau trouvé !
          suggestions.push({
            date: dateStr,
            startTime: minutesToTime(proposedStart),
            endTime: minutesToTime(proposedEnd),
            dayName: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][dayOfWeek],
            timeOfDay: slot.label,
            priority: slot.priority,
            reason: `Créneau libre de ${duration} minutes le ${slot.label}`,
          });
          foundSlot = true;
        }
      }
    }
  }

  // Trier par priorité (préférences utilisateur)
  suggestions.sort((a, b) => b.priority - a.priority);

  // Si aucun créneau trouvé, suggérer des horaires par défaut pour demain
  if (suggestions.length === 0 && !eventInfo.date) {
    const tomorrow = new Date(searchDate);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const tomorrowDay = tomorrow.getDay();
    const dayName = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][tomorrowDay];

    // Proposer 3 créneaux par défaut
    suggestions.push(
      {
        date: tomorrowStr,
        startTime: '10:00',
        endTime: minutesToTime(10 * 60 + duration),
        dayName,
        timeOfDay: 'matin',
        priority: 2,
        reason: 'Créneau suggéré le matin (peut nécessiter ajustement)',
      },
      {
        date: tomorrowStr,
        startTime: '14:00',
        endTime: minutesToTime(14 * 60 + duration),
        dayName,
        timeOfDay: 'après-midi',
        priority: 2,
        reason: 'Créneau suggéré l\'après-midi (peut nécessiter ajustement)',
      },
      {
        date: tomorrowStr,
        startTime: '18:00',
        endTime: minutesToTime(18 * 60 + duration),
        dayName,
        timeOfDay: 'soir',
        priority: 1,
        reason: 'Créneau suggéré le soir (peut nécessiter ajustement)',
      }
    );
  }

  return {
    suggestions: suggestions.slice(0, 3),
    eventInfo,
  };
}

/**
 * Gère l'exécution des tool calls de Mistral
 */
export async function handleToolCalls(
  toolCalls: any[],
  userId: string
): Promise<any[]> {
  const db = admin.firestore();
  const results: any[] = [];

  for (const toolCall of toolCalls) {
    const { name, arguments: argsString } = toolCall.function;

    // Parser les arguments
    let args: any;
    try {
      args = typeof argsString === 'string' ? JSON.parse(argsString) : argsString;
    } catch (error) {
      console.error('[Tools] Erreur parsing arguments:', error);
      results.push({
        tool_call_id: toolCall.id,
        role: 'tool',
        name: name,
        content: JSON.stringify({
          success: false,
          error: 'Arguments invalides',
        }),
      });
      continue;
    }

    console.log(`[Tools] Exécution: ${name}`, args);

    try {
      switch (name) {
        case 'add_event': {
          const eventIds: string[] = [];

          for (const eventData of args.events) {
            // Récupérer l'adresse du campus depuis le profil utilisateur
            let campusAddress: string | undefined;
            try {
              const userDoc = await db.collection('users').doc(userId).get();
              const userData = userDoc.data();
              campusAddress = userData?.profile?.academicInfo?.address;
            } catch (error) {
              console.warn('[Tools] Erreur récupération adresse campus:', error);
            }

            // Normalisation de la localisation
            const rawLocation = eventData.location || '';
            let resolvedLocation = rawLocation;
            let isLocationValid = false;

            // Pour les cours sans adresse spécifique, utiliser l'adresse du campus
            if (eventData.type === 'class' && campusAddress) {
              // Si une localisation est fournie mais semble être une salle
              const roomPattern = /^[a-z]{1,3}\d+$/i; // JP20, A101, etc.
              if (rawLocation && roomPattern.test(rawLocation.trim())) {
                // C'est une salle → utiliser l'adresse du campus
                resolvedLocation = campusAddress;
                isLocationValid = false;
                console.log(`[Tools] Normalisation salle "${rawLocation}" → campus "${campusAddress}"`);
              } else if (!rawLocation || rawLocation.trim().length < 5) {
                // Pas de localisation → utiliser l'adresse du campus
                resolvedLocation = campusAddress;
                isLocationValid = true;
              } else {
                // Localisation fournie, on la garde
                resolvedLocation = rawLocation;
                isLocationValid = true; // On suppose qu'elle est valide
              }
            }

            // Préparer l'événement pour Firestore
            const scheduleEvent = {
              userId,
              title: eventData.title,
              type: eventData.type,
              date: eventData.date,
              startTime: eventData.startTime,
              endTime: eventData.endTime,
              location: rawLocation,
              rawLocation,
              resolvedLocation,
              isLocationValid,
              address: resolvedLocation, // Legacy
              color: getEventTypeColor(eventData.type),
              dayIndex: calculateDayIndex(eventData.date),
              syncSource: 'local',
              syncStatus: 'synced',
              validationStatus: 'pending',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            // Ajouter les champs optionnels
            if (eventData.category) {
              (scheduleEvent as any).category = eventData.category;
            }
            if (eventData.professor) {
              (scheduleEvent as any).professor = eventData.professor;
            }

            // Créer l'événement dans Firestore
            const docRef = await db.collection('scheduleEvents').add(scheduleEvent);
            eventIds.push(docRef.id);
            console.log(`[Tools] Événement créé: ${docRef.id}`);
          }

          // Nettoyer le cache du contexte
          clearUserContextCache(userId);

          results.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: name,
            content: JSON.stringify({
              success: true,
              eventIds,
              count: eventIds.length,
              message: `${eventIds.length} événement(s) ajouté(s) avec succès`,
            }),
          });
          break;
        }

        case 'modify_event': {
          const { eventId, updates } = args;

          // Vérifier que l'événement existe et appartient à l'utilisateur
          const eventDoc = await db.collection('scheduleEvents').doc(eventId).get();

          if (!eventDoc.exists) {
            results.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              name: name,
              content: JSON.stringify({
                success: false,
                error: 'Événement non trouvé',
              }),
            });
            break;
          }

          const eventData = eventDoc.data();
          if (eventData?.userId !== userId) {
            results.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              name: name,
              content: JSON.stringify({
                success: false,
                error: 'Non autorisé',
              }),
            });
            break;
          }

          // Préparer les updates
          const updateData: any = {
            ...updates,
            updatedAt: new Date().toISOString(),
          };

          // Recalculer dayIndex si la date change
          if (updates.date) {
            updateData.dayIndex = calculateDayIndex(updates.date);
          }

          // Mettre à jour
          await db.collection('scheduleEvents').doc(eventId).update(updateData);

          // Nettoyer le cache
          clearUserContextCache(userId);

          results.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: name,
            content: JSON.stringify({
              success: true,
              message: 'Événement modifié avec succès',
            }),
          });
          break;
        }

        case 'delete_event': {
          const { eventId } = args;

          // Vérifier que l'événement existe et appartient à l'utilisateur
          const eventDoc = await db.collection('scheduleEvents').doc(eventId).get();

          if (!eventDoc.exists) {
            results.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              name: name,
              content: JSON.stringify({
                success: false,
                error: 'Événement non trouvé',
              }),
            });
            break;
          }

          const eventData = eventDoc.data();
          if (eventData?.userId !== userId) {
            results.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              name: name,
              content: JSON.stringify({
                success: false,
                error: 'Non autorisé',
              }),
            });
            break;
          }

          // Supprimer l'événement
          await db.collection('scheduleEvents').doc(eventId).delete();

          // Nettoyer le cache
          clearUserContextCache(userId);

          results.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: name,
            content: JSON.stringify({
              success: true,
              message: 'Événement supprimé avec succès',
            }),
          });
          break;
        }

        case 'search_events': {
          const { query, startDate, endDate, type } = args;

          // Construire la requête Firestore
          let eventsQuery: any = db
            .collection('scheduleEvents')
            .where('userId', '==', userId);

          // Filtrer par type si spécifié et différent de 'all'
          if (type && type !== 'all') {
            eventsQuery = eventsQuery.where('type', '==', type);
          }

          // Filtrer par date si spécifié
          if (startDate) {
            eventsQuery = eventsQuery.where('date', '>=', startDate);
          }
          if (endDate) {
            eventsQuery = eventsQuery.where('date', '<=', endDate);
          }

          const eventsSnapshot = await eventsQuery.limit(50).get();
          let events = eventsSnapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => ({
            id: doc.id,
            ...doc.data(),
          }));

          // Filtrer par mot-clé si spécifié
          if (query) {
            const lowerQuery = query.toLowerCase();
            events = events.filter((event: any) =>
              event.title.toLowerCase().includes(lowerQuery)
            );
          }

          results.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: name,
            content: JSON.stringify({
              success: true,
              events: events.slice(0, 10), // Limiter pour économiser tokens
              count: events.length,
            }),
          });
          break;
        }

        case 'get_recommendations': {
          const { type: recommendationType } = args;

          // Récupérer les événements de l'utilisateur
          const eventsSnapshot = await db
            .collection('scheduleEvents')
            .where('userId', '==', userId)
            .orderBy('date', 'asc')
            .limit(50)
            .get();

          const events = eventsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          let recommendations: string[] = [];

          switch (recommendationType) {
            case 'study_time':
              // Analyser le temps de révision
              const studyEvents = events.filter((e: any) => e.type === 'study');
              if (studyEvents.length < 3) {
                recommendations.push(
                  'Tu n\'as pas beaucoup de sessions de révision planifiées. Je te conseille d\'en ajouter régulièrement.'
                );
              }
              recommendations.push(
                'Essaie de réviser par sessions de 45 minutes avec des pauses de 15 minutes.'
              );
              break;

            case 'free_slots':
              // Identifier les créneaux libres
              recommendations.push(
                'Analyse ton emploi du temps pour identifier les créneaux libres et planifier des révisions.'
              );
              break;

            case 'exam_preparation':
              // Recommandations pour la préparation aux examens
              const exams = events.filter((e: any) => e.type === 'exam');
              if (exams.length > 0) {
                recommendations.push(
                  `Tu as ${exams.length} examen(s) à venir. Je te conseille de prévoir au moins 3 sessions de révision par matière.`
                );
              }
              break;

            case 'workload_balance':
              // Analyser l'équilibre de charge
              const classCount = events.filter((e: any) => e.type === 'class').length;
              const activityCount = events.filter((e: any) => e.type === 'activity')
                .length;
              if (activityCount < classCount * 0.2) {
                recommendations.push(
                  'N\'oublie pas de prévoir des activités pour te détendre ! Un bon équilibre études/loisirs est important.'
                );
              }
              break;
          }

          results.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: name,
            content: JSON.stringify({
              success: true,
              recommendations,
            }),
          });
          break;
        }

        case 'request_missing_info': {
          const { eventDraft, missingFields, question } = args;

          // Sauvegarder le brouillon d'événement pour référence future
          // L'utilisateur répondra dans le prochain message et l'IA pourra créer l'événement
          results.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: name,
            content: JSON.stringify({
              success: true,
              action: 'awaiting_user_input',
              eventDraft,
              missingFields,
              question,
              message: 'Demande d\'informations envoyée à l\'utilisateur',
            }),
          });
          break;
        }

        case 'suggest_optimal_time': {
          const { eventInfo, constraints } = args;

          console.log('[Tools] suggest_optimal_time appelé avec:', { userId, eventInfo, constraints });

          // Trouver les meilleurs créneaux
          const optimal = await findOptimalTimeSlot(userId, eventInfo, constraints || {});

          console.log('[Tools] suggest_optimal_time résultat:', optimal);

          if (optimal.suggestions.length === 0) {
            results.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              name: name,
              content: JSON.stringify({
                success: false,
                message: 'Aucun créneau disponible trouvé dans les prochains jours',
                eventInfo,
              }),
            });
          } else {
            results.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              name: name,
              content: JSON.stringify({
                success: true,
                suggestions: optimal.suggestions,
                eventInfo,
                message: `${optimal.suggestions.length} créneau(x) optimal(aux) trouvé(s)`,
              }),
            });
          }
          break;
        }

        default:
          results.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: name,
            content: JSON.stringify({
              success: false,
              error: `Fonction inconnue: ${name}`,
            }),
          });
      }
    } catch (error: any) {
      console.error(`[Tools] Erreur exécution ${name}:`, error);
      results.push({
        tool_call_id: toolCall.id,
        role: 'tool',
        name: name,
        content: JSON.stringify({
          success: false,
          error: error.message || 'Erreur interne',
        }),
      });
    }
  }

  return results;
}
