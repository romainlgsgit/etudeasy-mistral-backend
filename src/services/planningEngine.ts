/**
 * Moteur logique de génération de créneaux planning
 *
 * Séparation claire des rôles :
 * - Mistral : parsing de la demande + reformulation
 * - Ce moteur : génération des créneaux basée sur le planning réel
 */

import { analyzePlanningForUser } from './planningAnalysis';

export interface PlanningRequest {
  objectif: string;
  frequence: number;   // nombre de créneaux à trouver
  duree: number;       // durée en minutes
  moment: 'matin' | 'après-midi' | 'soir' | 'any';
}

export interface PlanningSlot {
  jour: string;   // "Mercredi"
  date: string;   // "2026-03-20"
  start: string;  // "20:00"
  end: string;    // "21:00"
  score: number;
}

// Plages horaires par moment
const MOMENT_RANGES: Record<string, { start: number; end: number }> = {
  'matin':       { start: 6 * 60,  end: 12 * 60 },
  'après-midi':  { start: 12 * 60, end: 18 * 60 },
  'apres-midi':  { start: 12 * 60, end: 18 * 60 },
  'soir':        { start: 18 * 60, end: 22 * 60 },
  'any':         { start: 6 * 60,  end: 22 * 60 },
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Scoring d'un créneau selon les règles métier :
 * +2 si cohérent avec le moment demandé
 * -2 si après activité intense (qualité acceptable)
 * +1 si horaire régulier (heure ronde)
 * -3 si trop tard (>22h)
 * +1 si créneau de qualité excellent
 */
function scoreSlot(slot: any, parsed: PlanningRequest): number {
  let score = 0;
  const startMin = timeToMinutes(slot.start);
  const startHour = Math.floor(startMin / 60);

  // +2 si cohérent avec le moment demandé
  const range = MOMENT_RANGES[parsed.moment] ?? MOMENT_RANGES['any'];
  if (startMin >= range.start && startMin < range.end) {
    score += 2;
  }

  // -3 si trop tard (>22h)
  if (startHour >= 22) {
    score -= 3;
  }

  // +1 si horaire régulier (heure ronde ou demi-heure)
  const minutes = startMin % 60;
  if (minutes === 0 || minutes === 30) {
    score += 1;
  }

  // Qualité du créneau
  if (slot.quality === 'excellent') {
    score += 1;
  } else if (slot.quality === 'acceptable') {
    // -2 si après activité intense (proxy via qualité acceptable)
    score -= 2;
  }

  return score;
}

/**
 * Génère les créneaux optimaux pour une demande de planning.
 * Utilise le planning réel de l'utilisateur pour trouver les créneaux disponibles.
 */
export async function generatePlanningSlots(
  userId: string,
  parsed: PlanningRequest,
): Promise<PlanningSlot[]> {
  console.log(`[PlanningEngine] Génération créneaux pour: "${parsed.objectif}", ${parsed.frequence}x/sem, ${parsed.duree}min, moment=${parsed.moment}`);

  // 1. Récupérer le planning réel de l'utilisateur
  const analysis = await analyzePlanningForUser(userId);
  if (!analysis) {
    console.warn('[PlanningEngine] Aucune analyse disponible');
    return [];
  }

  const allSlots = analysis.availableSlots.availableSlotsFormatted;
  console.log(`[PlanningEngine] ${allSlots.length} créneaux disponibles au total`);

  const range = MOMENT_RANGES[parsed.moment] ?? MOMENT_RANGES['any'];
  const durationNeeded = parsed.duree;

  // 2. Filtrer les créneaux qui respectent les contraintes
  const filtered = allSlots.filter(slot => {
    const startMin = timeToMinutes(slot.start);
    const endMin = timeToMinutes(slot.end);
    const available = endMin - startMin;

    // Contrainte de moment
    if (startMin < range.start || startMin >= range.end) return false;

    // Contrainte de durée
    if (available < durationNeeded) return false;

    // Jamais après 22h
    if (startMin >= 22 * 60) return false;

    return true;
  });

  console.log(`[PlanningEngine] ${filtered.length} créneaux après filtrage`);

  // 3. Scorer et trier
  const scored = filtered.map(slot => {
    // Ajuster la fin du créneau à la durée demandée
    const startMin = timeToMinutes(slot.start);
    const endMin = Math.min(timeToMinutes(slot.end), startMin + durationNeeded);

    return {
      jour: slot.day,
      date: slot.date,
      start: slot.start,
      end: minutesToTime(endMin),
      score: scoreSlot(slot, parsed),
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // 4. Sélectionner les N meilleurs créneaux (N = fréquence)
  //    En privilégiant des jours différents
  const selected: PlanningSlot[] = [];
  const usedDates = new Set<string>();

  // Passe 1 : jours différents uniquement
  for (const slot of scored) {
    if (selected.length >= parsed.frequence) break;
    if (!usedDates.has(slot.date)) {
      selected.push(slot);
      usedDates.add(slot.date);
    }
  }

  // Passe 2 : si pas assez, compléter avec des créneaux supplémentaires
  if (selected.length < parsed.frequence) {
    for (const slot of scored) {
      if (selected.length >= parsed.frequence) break;
      const alreadyAdded = selected.some(s => s.date === slot.date && s.start === slot.start);
      if (!alreadyAdded) {
        selected.push(slot);
      }
    }
  }

  console.log(`[PlanningEngine] ${selected.length} créneaux sélectionnés`);
  return selected;
}
