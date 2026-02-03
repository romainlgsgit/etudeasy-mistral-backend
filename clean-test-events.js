/**
 * Script pour nettoyer tous les événements de test du calendrier
 * Utilise l'API Firebase Admin pour supprimer directement les événements
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Charger les credentials Firebase
const serviceAccount = JSON.parse(
  readFileSync('./config/etudeasy-d8dc7-firebase-adminsdk-xkwwu-0d1af68853.json', 'utf8')
);

// Initialiser Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// User ID de test
const TEST_USER_ID = 'k3BW9QItVngaKKEAMy9CMviitgC2';

async function cleanTestEvents() {
  console.log('🧹 Nettoyage des événements de test...\n');

  try {
    // Récupérer tous les événements de l'utilisateur de test
    const eventsSnapshot = await db
      .collection('scheduleEvents')
      .where('userId', '==', TEST_USER_ID)
      .get();

    const totalEvents = eventsSnapshot.size;
    console.log(`📋 ${totalEvents} événements trouvés`);

    if (totalEvents === 0) {
      console.log('✅ Aucun événement à supprimer');
      return;
    }

    // Supprimer tous les événements
    const batch = db.batch();
    let count = 0;

    eventsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
      console.log(`   ${count}. Suppression: ${doc.data().title || 'Sans titre'} (${doc.data().date})`);
    });

    await batch.commit();

    console.log(`\n✅ ${count} événements supprimés avec succès!`);
    console.log('📅 Le calendrier de test est maintenant vide\n');

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    process.exit(1);
  }
}

// Exécuter le nettoyage
cleanTestEvents()
  .then(() => {
    console.log('🎉 Nettoyage terminé!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
  });
