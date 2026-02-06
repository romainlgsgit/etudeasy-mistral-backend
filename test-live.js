/**
 * Test live du chatbot avec génération de token
 */

require('dotenv').config();
const admin = require('firebase-admin');

// Initialiser Firebase Admin
const serviceAccount = require('./service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'etudeasy-d8dc7'
});

const BACKEND_URL = 'https://etudeasy-mistral-backend.onrender.com';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

// Chercher un vrai utilisateur dans Firestore
async function findRealUser() {
  const db = admin.firestore();
  const usersSnapshot = await db.collection('users').limit(1).get();

  if (usersSnapshot.empty) {
    console.log(`${colors.yellow}⚠️ Aucun utilisateur trouvé, création d'un utilisateur de test...${colors.reset}`);
    return null;
  }

  const user = usersSnapshot.docs[0];
  console.log(`${colors.green}✅ Utilisateur trouvé: ${user.id}${colors.reset}`);
  return user.id;
}

// Générer un custom token pour l'utilisateur
async function generateToken(userId) {
  const customToken = await admin.auth().createCustomToken(userId);
  return customToken;
}

// Envoyer un message au chatbot
async function sendMessage(token, message, conversationHistory = []) {
  const messages = [
    ...conversationHistory,
    { role: 'user', content: message }
  ];

  const response = await fetch(`${BACKEND_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ messages, language: 'fr' }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  return await response.json();
}

async function runLiveTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║     🌐 Tests Live du Chatbot Amélioré                         ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  // Trouver un vrai utilisateur
  const userId = await findRealUser();
  if (!userId) {
    console.log(`${colors.red}❌ Impossible de trouver un utilisateur pour les tests${colors.reset}`);
    return;
  }

  // Générer un token
  console.log(`\n${colors.cyan}🔑 Génération du token...${colors.reset}`);
  const token = await generateToken(userId);
  console.log(`${colors.green}✅ Token généré${colors.reset}\n`);

  // Tests
  const tests = [
    {
      name: 'Placement automatique',
      message: 'Place-moi une révision demain',
      check: (response) => {
        const usedAutoPlace = response.toolCalls?.some(tc => tc.function?.name === 'auto_place_event');
        const hasCheckmark = response.message?.includes('✅') || response.message?.includes('C\'est fait');
        return usedAutoPlace || hasCheckmark;
      }
    },
    {
      name: 'Ajout avec horaire précis',
      message: 'Ajoute un cours de maths lundi à 14h',
      check: (response) => {
        const usedAddEvent = response.toolCalls?.some(tc => tc.function?.name === 'add_event');
        return usedAddEvent;
      }
    },
    {
      name: 'Message de confirmation clair',
      message: 'Place-moi une session de sport samedi',
      check: (response) => {
        // Vérifier que le message ne contient pas de question de confirmation
        const hasConfirmQuestion = /veux-tu|tu veux|confirmes|d'accord\s*\?/i.test(response.message || '');
        const hasCheckmark = response.message?.includes('✅');
        return !hasConfirmQuestion || hasCheckmark;
      }
    },
    {
      name: 'Recherche d\'événements',
      message: 'Qu\'est-ce que j\'ai demain ?',
      check: (response) => {
        const usedSearch = response.toolCalls?.some(tc => tc.function?.name === 'search_events');
        return usedSearch || response.message?.toLowerCase().includes('événement');
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.blue}🧪 Test: ${test.name}${colors.reset}`);
    console.log(`   Message: "${test.message}"\n`);

    try {
      const response = await sendMessage(token, test.message);

      console.log(`   ${colors.cyan}Réponse:${colors.reset}`);
      console.log(`   ${response.message?.substring(0, 200) || 'Pas de message'}${response.message?.length > 200 ? '...' : ''}`);

      if (response.toolCalls && response.toolCalls.length > 0) {
        console.log(`\n   ${colors.cyan}Tool calls:${colors.reset}`);
        response.toolCalls.forEach(tc => {
          console.log(`   - ${tc.function?.name}`);
        });
      }

      const success = test.check(response);

      if (success) {
        console.log(`\n   ${colors.green}✅ Test passé${colors.reset}`);
        passed++;
      } else {
        console.log(`\n   ${colors.red}❌ Test échoué${colors.reset}`);
        failed++;
      }
    } catch (error) {
      console.log(`\n   ${colors.red}❌ Erreur: ${error.message}${colors.reset}`);
      failed++;
    }

    // Pause pour éviter le rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Résumé
  console.log(`\n${colors.blue}════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}📊 Résumé des tests live${colors.reset}`);
  console.log(`${colors.blue}════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`   ${colors.green}✅ Passés: ${passed}${colors.reset}`);
  console.log(`   ${colors.red}❌ Échoués: ${failed}${colors.reset}`);
  console.log(`${colors.blue}════════════════════════════════════════════════════════════════${colors.reset}\n`);

  // Nettoyage
  console.log(`${colors.cyan}🧹 Nettoyage des événements de test...${colors.reset}`);
  const db = admin.firestore();
  const today = new Date().toISOString().split('T')[0];

  // Supprimer les événements créés aujourd'hui par les tests
  const eventsSnapshot = await db.collection('scheduleEvents')
    .where('userId', '==', userId)
    .where('createdAt', '>=', today)
    .get();

  let deleted = 0;
  for (const doc of eventsSnapshot.docs) {
    const data = doc.data();
    // Ne supprimer que les événements créés dans les dernières minutes
    const createdAt = new Date(data.createdAt);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    if (createdAt > fiveMinutesAgo) {
      await doc.ref.delete();
      deleted++;
    }
  }

  console.log(`   ${deleted} événement(s) de test supprimé(s)\n`);
}

runLiveTests().catch(error => {
  console.error(`${colors.red}Erreur fatale:${colors.reset}`, error);
  process.exit(1);
});
