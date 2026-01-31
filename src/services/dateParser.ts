/**
 * Service intelligent de parsing de dates
 * Corrige les bugs de mapping jour → date
 */

export interface ParsedDateInfo {
  targetDate: string | null; // YYYY-MM-DD
  dayName: string | null; // Nom du jour mentionné
  preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'any' | null;
  isNextWeek: boolean;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Parse un message utilisateur pour extraire les informations de date
 */
export function parseDateFromMessage(message: string): ParsedDateInfo {
  const lowerMsg = message.toLowerCase().trim();

  // Mapping des jours en français
  const daysMap: Record<string, number> = {
    'dimanche': 0,
    'lundi': 1,
    'mardi': 2,
    'mercredi': 3,
    'jeudi': 4,
    'vendredi': 5,
    'samedi': 6,
  };

  // Détection "semaine prochaine" ou "la semaine prochaine"
  const isNextWeek = /la semaine prochaine|semaine prochaine|week-?end prochain/.test(lowerMsg);

  // Extraire le jour mentionné
  let detectedDay: string | null = null;
  let detectedDayIndex: number | null = null;

  for (const [dayName, dayIndex] of Object.entries(daysMap)) {
    // Chercher le jour dans le message (avec word boundaries)
    const regex = new RegExp(`\\b${dayName}\\b`, 'i');
    if (regex.test(lowerMsg)) {
      detectedDay = dayName;
      detectedDayIndex = dayIndex;
      break;
    }
  }

  // Détecter "demain"
  if (/\bdemain\b/.test(lowerMsg)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      targetDate: tomorrow.toISOString().split('T')[0],
      dayName: getDayNameFr(tomorrow.getDay()),
      preferredTimeOfDay: extractTimeOfDay(lowerMsg),
      isNextWeek: false,
      confidence: 'high',
    };
  }

  // Détecter "aujourd'hui"
  if (/\baujourd'?hui\b/.test(lowerMsg)) {
    const today = new Date();
    return {
      targetDate: today.toISOString().split('T')[0],
      dayName: getDayNameFr(today.getDay()),
      preferredTimeOfDay: extractTimeOfDay(lowerMsg),
      isNextWeek: false,
      confidence: 'high',
    };
  }

  // Si un jour est détecté
  if (detectedDay && detectedDayIndex !== null) {
    const targetDate = calculateTargetDate(detectedDayIndex, isNextWeek, message);
    return {
      targetDate,
      dayName: detectedDay,
      preferredTimeOfDay: extractTimeOfDay(lowerMsg),
      isNextWeek,
      confidence: 'high',
    };
  }

  // Détecter "ce week-end" ou "ce weekend"
  if (/ce week-?end|weekend/.test(lowerMsg)) {
    const today = new Date();
    const currentDay = today.getDay();

    // Si on est avant samedi, prendre le samedi de cette semaine
    // Sinon, prendre le samedi de la semaine prochaine
    let targetDayIndex = 6; // Samedi par défaut
    if (currentDay === 6) {
      // On est samedi, proposer dimanche
      targetDayIndex = 0;
    } else if (currentDay === 0) {
      // On est dimanche, proposer samedi prochain
      targetDayIndex = 6;
    }

    const targetDate = calculateTargetDate(targetDayIndex, currentDay === 0, message);
    return {
      targetDate,
      dayName: targetDayIndex === 6 ? 'samedi' : 'dimanche',
      preferredTimeOfDay: extractTimeOfDay(lowerMsg),
      isNextWeek: false,
      confidence: 'medium',
    };
  }

  // Aucune date détectée
  return {
    targetDate: null,
    dayName: null,
    preferredTimeOfDay: extractTimeOfDay(lowerMsg),
    isNextWeek: false,
    confidence: 'low',
  };
}

/**
 * Calcule la date cible pour un jour de la semaine donné
 */
function calculateTargetDate(targetDayIndex: number, forceNextWeek: boolean, message?: string): string {
  const today = new Date();
  const currentDayIndex = today.getDay();

  let daysToAdd = targetDayIndex - currentDayIndex;

  // Logique de calcul
  if (forceNextWeek) {
    // Forcer la semaine prochaine
    if (daysToAdd <= 0) {
      daysToAdd += 7;
    } else {
      daysToAdd += 7;
    }
  } else {
    // Si le jour est déjà passé cette semaine, prendre la semaine prochaine
    if (daysToAdd < 0) {
      daysToAdd += 7;
    } else if (daysToAdd === 0) {
      // C'est aujourd'hui
      // EXCEPTION: Si le message contient explicitement "aujourd'hui", on garde aujourd'hui
      if (message && /\baujourd'?hui\b/.test(message.toLowerCase())) {
        daysToAdd = 0;
      } else {
        // Sinon, quand on demande un jour et qu'on est ce jour-là, on veut TOUJOURS la semaine prochaine
        // (car si on dit "samedi" et qu'on est samedi, on pense au prochain samedi)
        daysToAdd = 7;
      }
    }
  }

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysToAdd);

  return targetDate.toISOString().split('T')[0];
}

/**
 * Extrait le moment de la journée préféré
 */
function extractTimeOfDay(message: string): 'morning' | 'afternoon' | 'evening' | 'any' {
  const lowerMsg = message.toLowerCase();

  if (/matin|matinée|tôt/.test(lowerMsg)) {
    return 'morning';
  }
  if (/après-midi|aprèm|milieu de journ/.test(lowerMsg)) {
    return 'afternoon';
  }
  if (/soir|soirée|fin.*après-midi|tard/.test(lowerMsg)) {
    return 'evening';
  }

  return 'any';
}

/**
 * Retourne le nom du jour en français depuis l'index (0=dimanche, 6=samedi)
 */
function getDayNameFr(dayIndex: number): string {
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  return days[dayIndex];
}

/**
 * Valide et corrige une targetDate fournie par l'IA
 *
 * @param aiTargetDate - La date fournie par l'IA
 * @param userMessage - Le message de l'utilisateur
 * @returns La date corrigée si nécessaire
 */
export function validateAndCorrectTargetDate(
  aiTargetDate: string | undefined,
  userMessage: string
): string | null {
  // Parser le message utilisateur
  const parsed = parseDateFromMessage(userMessage);

  // Si on a détecté une date avec haute confiance, l'utiliser
  if (parsed.confidence === 'high' && parsed.targetDate) {
    // Si l'IA a fourni une date différente, loguer un warning
    if (aiTargetDate && aiTargetDate !== parsed.targetDate) {
      console.warn(`[DateParser] ⚠️ Correction de targetDate:`);
      console.warn(`  IA a fourni: ${aiTargetDate}`);
      console.warn(`  Détecté dans message: ${parsed.targetDate} (${parsed.dayName})`);
      console.warn(`  Message utilisateur: "${userMessage}"`);
    }
    return parsed.targetDate;
  }

  // Sinon, faire confiance à l'IA (si fourni)
  if (aiTargetDate) {
    return aiTargetDate;
  }

  // En dernier recours, utiliser la date parsée (même avec confidence moyenne/basse)
  return parsed.targetDate;
}

/**
 * Obtient le nom du jour depuis une date YYYY-MM-DD
 */
export function getDayNameFromDate(dateStr: string): string {
  const date = new Date(dateStr);
  return getDayNameFr(date.getDay());
}

/**
 * Teste si deux dates correspondent au même jour de la semaine
 */
export function isSameDayOfWeek(date1: string, date2: string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getDay() === d2.getDay();
}
