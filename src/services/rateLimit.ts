/**
 * Service de rate limiting
 */

import * as admin from 'firebase-admin';

const DAILY_MESSAGE_LIMIT = 150;

export interface RateLimitInfo {
  withinLimit: boolean;
  messagesUsed: number;
  messagesRemaining: number;
  resetAt: string; // ISO date string pour le prochain reset (minuit)
  resetInMs: number; // Millisecondes avant reset
}

/**
 * Vérifie et incrémente le compteur de rate limiting
 * Retourne des infos détaillées sur l'utilisation
 */
export async function checkRateLimit(userId: string): Promise<RateLimitInfo> {
  const today = new Date().toISOString().split('T')[0];
  const db = admin.firestore();
  const usageRef = db.collection('apiUsage').doc(`${userId}_${today}`);

  const usageDoc = await usageRef.get();
  const currentUsage = usageDoc.exists ? usageDoc.data()?.count || 0 : 0;

  // Calculer le temps avant reset (minuit prochain)
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const resetInMs = tomorrow.getTime() - now.getTime();

  const withinLimit = currentUsage < DAILY_MESSAGE_LIMIT;

  // Incrémenter le compteur seulement si dans la limite
  if (withinLimit) {
    await usageRef.set(
      {
        userId,
        date: today,
        count: currentUsage + 1,
        lastUpdated: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  return {
    withinLimit,
    messagesUsed: withinLimit ? currentUsage + 1 : currentUsage,
    messagesRemaining: Math.max(0, DAILY_MESSAGE_LIMIT - (withinLimit ? currentUsage + 1 : currentUsage)),
    resetAt: tomorrow.toISOString(),
    resetInMs,
  };
}
