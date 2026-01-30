/**
 * Service d'analyse de planning (Version Backend)
 *
 * Version simplifiée des services d'analyse pour le backend Mistral.
 * Permet de détecter les créneaux disponibles et générer le contexte pour l'IA.
 */

import * as admin from 'firebase-admin';

interface AvailableSlot {
  day: string;
  start: string;
  end: string;
  duration: number;
  quality: 'excellent' | 'good' | 'acceptable';
  recommended: string[];
}

interface PlanningAnalysis {
  availableSlots: {
    summary: string;
    criticalInfo: string[];
    availableSlotsFormatted: AvailableSlot[];
  };
}

/**
 * Analyse le planning d'un utilisateur et détecte les créneaux disponibles
 */
export async function analyzePlanningForUser(userId: string): Promise<PlanningAnalysis | null> {
  const db = admin.firestore();

  try {
    // 1. Récupérer les données utilisateur
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      console.log('[PlanningAnalysis] User data not found');
      return null;
    }

    // 2. Récupérer les événements des 7 prochains jours
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 7);

    const startDateStr = now.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const eventsSnapshot = await db
      .collection('scheduleEvents')
      .where('userId', '==', userId)
      .where('date', '>=', startDateStr)
      .where('date', '<=', endDateStr)
      .get();

    const events = eventsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as any[];

    // 3. Grouper les événements par jour
    const eventsByDate = new Map<string, any[]>();
    events.forEach((event) => {
      const existing = eventsByDate.get(event.date) || [];
      existing.push(event);
      eventsByDate.set(event.date, existing);
    });

    // 4. Récupérer les contraintes utilisateur
    const constraints = {
      sleep: {
        wakeTime: '07:00',
        bedtime: '23:00',
      },
      meals: {
        lunch: { start: '12:00', end: '13:00' },
        dinner: { start: '19:00', end: '20:00' },
      },
      study: {
        minDuration: 30,
        maxDuration: userData.profile?.studyHabits?.studyDuration || 120,
        preferredTime: userData.profile?.studyHabits?.preferredStudyTime,
        avoidLateEvening: true,
        lateEveningThreshold: '22:00',
      },
    };

    // 5. Détecter les créneaux disponibles
    const availableSlots: AvailableSlot[] = [];
    const criticalInfo: string[] = [];

    // Analyser chaque jour
    const currentDate = new Date(now);
    for (let i = 0; i < 7; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayEvents = eventsByDate.get(dateStr) || [];
      const dayName = getDayName(currentDate);

      // Trier les événements par heure
      dayEvents.sort((a, b) => {
        const timeA = timeToMinutes(a.startTime);
        const timeB = timeToMinutes(b.startTime);
        return timeA - timeB;
      });

      // Trouver les créneaux libres
      const freeSlots = findFreeSlots(dayEvents, constraints);

      freeSlots.forEach((slot) => {
        if (slot.duration >= constraints.study.minDuration) {
          availableSlots.push({
            day: dayName,
            start: slot.start,
            end: slot.end,
            duration: slot.duration,
            quality: evaluateSlotQuality(slot.start, slot.duration, constraints),
            recommended: getRecommendations(slot.start, slot.duration),
          });
        }
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 6. Générer les informations critiques
    const exams = events.filter((e) => e.type === 'exam');
    if (exams.length > 0) {
      criticalInfo.push(
        `📝 ${exams.length} examen(s) à venir : ${exams.map((e) => e.title).join(', ')}`
      );
    }

    const totalAvailableTime = availableSlots.reduce((sum, slot) => sum + slot.duration, 0);
    if (totalAvailableTime < 300) {
      criticalInfo.push('⚠️ Peu de temps disponible cette semaine. Priorise les tâches importantes.');
    }

    const excellentSlots = availableSlots.filter((s) => s.quality === 'excellent').length;
    if (excellentSlots >= 3) {
      criticalInfo.push(
        `✨ ${excellentSlots} créneaux de qualité excellente disponibles !`
      );
    }

    // 7. Générer le résumé
    const summary = generateSummary(availableSlots, events);

    return {
      availableSlots: {
        summary,
        criticalInfo,
        availableSlotsFormatted: availableSlots.slice(0, 15), // Limiter à 15 meilleurs créneaux
      },
    };
  } catch (error) {
    console.error('[PlanningAnalysis] Error:', error);
    return null;
  }
}

/**
 * Trouve les créneaux libres dans une journée
 */
function findFreeSlots(
  dayEvents: any[],
  constraints: any
): Array<{ start: string; end: string; duration: number }> {
  const freeSlots: Array<{ start: string; end: string; duration: number }> = [];

  // Créneaux bloqués
  const blocked: Array<{ start: string; end: string }> = [];

  // Bloquer le sommeil
  blocked.push({ start: '00:00', end: constraints.sleep.wakeTime });
  blocked.push({ start: constraints.sleep.bedtime, end: '23:59' });

  // Bloquer les repas
  blocked.push({ start: constraints.meals.lunch.start, end: constraints.meals.lunch.end });
  blocked.push({ start: constraints.meals.dinner.start, end: constraints.meals.dinner.end });

  // Bloquer les événements
  dayEvents.forEach((event) => {
    blocked.push({ start: event.startTime, end: event.endTime });
  });

  // Bloquer la soirée tardive si nécessaire
  if (constraints.study.avoidLateEvening) {
    blocked.push({ start: constraints.study.lateEveningThreshold, end: constraints.sleep.bedtime });
  }

  // Fusionner les bloqués qui se chevauchent
  const mergedBlocked = mergeOverlapping(blocked);

  // Trouver les trous
  for (let i = 0; i < mergedBlocked.length - 1; i++) {
    const current = mergedBlocked[i];
    const next = mergedBlocked[i + 1];

    const gapStart = current.end;
    const gapEnd = next.start;
    const duration = timeToMinutes(gapEnd) - timeToMinutes(gapStart);

    if (duration > 0) {
      freeSlots.push({ start: gapStart, end: gapEnd, duration });
    }
  }

  return freeSlots;
}

/**
 * Fusionne les créneaux qui se chevauchent
 */
function mergeOverlapping(slots: Array<{ start: string; end: string }>): Array<{ start: string; end: string }> {
  if (slots.length === 0) return [];

  const sorted = [...slots].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  const merged: Array<{ start: string; end: string }> = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (timeToMinutes(current.start) <= timeToMinutes(last.end)) {
      // Fusionner
      if (timeToMinutes(current.end) > timeToMinutes(last.end)) {
        last.end = current.end;
      }
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Évalue la qualité d'un créneau
 */
function evaluateSlotQuality(
  startTime: string,
  duration: number,
  constraints: any
): 'excellent' | 'good' | 'acceptable' {
  let score = 50;

  const hour = parseInt(startTime.split(':')[0]);

  // Durée appropriée
  if (duration >= constraints.study.minDuration && duration <= constraints.study.maxDuration) {
    score += 20;
  }

  // Heure de la journée
  if (hour >= 8 && hour < 12) {
    score += 15; // Matinée
  } else if (hour >= 14 && hour < 17) {
    score += 10; // Après-midi
  } else if (hour >= 20) {
    score -= 15; // Soirée tardive
  }

  // Durée longue = meilleur
  if (duration >= 90) {
    score += 10;
  }

  if (score >= 70) return 'excellent';
  if (score >= 55) return 'good';
  return 'acceptable';
}

/**
 * Génère des recommandations pour un créneau
 */
function getRecommendations(startTime: string, duration: number): string[] {
  const hour = parseInt(startTime.split(':')[0]);
  const recommendations: string[] = [];

  if (hour >= 8 && hour < 12) {
    recommendations.push('révision intensive', 'travaux difficiles');
  } else if (hour >= 14 && hour < 17) {
    recommendations.push('exercices', 'projets');
  } else if (hour >= 17 && hour < 20) {
    recommendations.push('révisions légères', 'lecture');
  }

  if (duration >= 90) {
    recommendations.push('projet long terme');
  }

  return recommendations;
}

/**
 * Génère un résumé textuel
 */
function generateSummary(slots: AvailableSlot[], events: any[]): string {
  const lines: string[] = [];

  lines.push('📊 RÉSUMÉ DE LA SEMAINE');
  lines.push('');
  lines.push(`Événements programmés : ${events.length}`);

  const totalTime = slots.reduce((sum, slot) => sum + slot.duration, 0);
  lines.push(`Temps disponible total : ${Math.floor(totalTime / 60)}h ${totalTime % 60}min`);
  lines.push(`Nombre de créneaux exploitables : ${slots.length}`);
  lines.push('');

  const excellentSlots = slots.filter((s) => s.quality === 'excellent').length;
  const goodSlots = slots.filter((s) => s.quality === 'good').length;

  lines.push('Qualité des créneaux :');
  lines.push(`  - Excellents : ${excellentSlots}`);
  lines.push(`  - Bons : ${goodSlots}`);

  return lines.join('\n');
}

/**
 * Convertit une heure HH:MM en minutes depuis minuit
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Retourne le nom du jour en français
 */
function getDayName(date: Date): string {
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  return days[date.getDay()];
}

/**
 * Détecte si un message demande une organisation de planning
 */
export function isOrganizationRequest(message: string): boolean {
  const lowerMsg = message.toLowerCase();
  const keywords = [
    'organis',
    'planifi',
    'aide.{0,10}(à|a).{0,10}(organis|planifi)',
    'optimis',
    'révis',
    'employ.{0,5}du.{0,5}temps',
    'créneaux',
    'temps libre',
    'quand.{0,10}(réviser|travailler|étudier)',
    'comment.{0,10}(organis|planifi)',
  ];

  return keywords.some((keyword) => new RegExp(keyword, 'i').test(lowerMsg));
}
