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
            // Préparer l'événement pour Firestore
            const scheduleEvent = {
              userId,
              title: eventData.title,
              type: eventData.type,
              date: eventData.date,
              startTime: eventData.startTime,
              endTime: eventData.endTime,
              location: eventData.location || '',
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

            // Auto-remplir l'adresse de l'établissement pour les cours
            if (eventData.type === 'class') {
              try {
                const userDoc = await db.collection('users').doc(userId).get();
                const userData = userDoc.data();
                const schoolAddress = userData?.profile?.academicInfo?.address;
                if (schoolAddress && !eventData.address) {
                  (scheduleEvent as any).address = schoolAddress;
                }
              } catch (error) {
                console.warn('[Tools] Erreur auto-remplissage adresse:', error);
              }
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
