/**
 * Construction du contexte utilisateur depuis Firestore
 */

import * as admin from 'firebase-admin';

// Cache du contexte utilisateur (5 minutes)
interface CachedContext {
  context: any;
  expiresAt: number;
}

const contextCache = new Map<string, CachedContext>();
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Récupère le contexte utilisateur avec cache
 */
export async function getUserContext(userId: string): Promise<any> {
  // Vérifier le cache
  const cached = contextCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) {
    console.log(`[Context] Cache hit pour ${userId}`);
    return cached.context;
  }

  console.log(`[Context] Construction contexte pour ${userId}`);
  const context = await buildUserContext(userId);

  // Mettre en cache
  contextCache.set(userId, {
    context,
    expiresAt: Date.now() + CACHE_DURATION_MS,
  });

  return context;
}

/**
 * Construit le contexte utilisateur depuis Firestore
 */
async function buildUserContext(userId: string): Promise<any> {
  const db = admin.firestore();

  try {
    // Récupérer les événements (limiter pour économiser tokens)
    const now = new Date();
    const eventsSnapshot = await db
      .collection('scheduleEvents')
      .where('userId', '==', userId)
      .orderBy('date', 'asc')
      .limit(20)
      .get();

    const allEvents = eventsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filtrer les événements futurs et récents (dernière semaine et 2 prochaines semaines)
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const twoWeeksAhead = new Date(now);
    twoWeeksAhead.setDate(twoWeeksAhead.getDate() + 14);

    const relevantEvents = allEvents.filter((event: any) => {
      const eventDate = new Date(event.date);
      return eventDate >= oneWeekAgo && eventDate <= twoWeeksAhead;
    });

    // Récupérer le profil utilisateur
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    // Récupérer les examens à venir
    const upcomingExamsSnapshot = await db
      .collection('scheduleEvents')
      .where('userId', '==', userId)
      .where('type', '==', 'exam')
      .orderBy('date', 'asc')
      .limit(5)
      .get();

    const upcomingExams = upcomingExamsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return {
      events: relevantEvents.slice(0, 10), // Limiter à 10 pour économiser tokens
      profile: userData?.profile || {},
      upcomingExams: upcomingExams.slice(0, 3),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Context] Erreur construction contexte:', error);
    return {
      events: [],
      profile: {},
      upcomingExams: [],
      error: 'Erreur de récupération du contexte',
    };
  }
}

/**
 * Nettoie le cache du contexte pour un utilisateur
 */
export function clearUserContextCache(userId: string): void {
  contextCache.delete(userId);
  console.log(`[Context] Cache cleared pour ${userId}`);
}

/**
 * Nettoie les entrées de cache expirées (à appeler périodiquement)
 */
export function cleanupExpiredCache(): void {
  const now = Date.now();
  for (const [userId, cached] of contextCache.entries()) {
    if (now >= cached.expiresAt) {
      contextCache.delete(userId);
    }
  }
}
