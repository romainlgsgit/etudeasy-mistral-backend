/**
 * Service de rate limiting
 */

import * as admin from 'firebase-admin';

const DAILY_MESSAGE_LIMIT = 150;

/**
 * Vérifie et incrémente le compteur de rate limiting
 */
export async function checkRateLimit(userId: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  const db = admin.firestore();
  const usageRef = db.collection('apiUsage').doc(`${userId}_${today}`);

  const usageDoc = await usageRef.get();
  const currentUsage = usageDoc.exists ? usageDoc.data()?.count || 0 : 0;

  if (currentUsage >= DAILY_MESSAGE_LIMIT) {
    return false;
  }

  // Incrémenter le compteur
  await usageRef.set(
    {
      userId,
      date: today,
      count: currentUsage + 1,
      lastUpdated: new Date().toISOString(),
    },
    { merge: true }
  );

  return true;
}
