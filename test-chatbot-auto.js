/**
 * Script de test automatisé pour le chatbot
 */

const admin = require('firebase-admin');

// Initialiser Firebase Admin
const serviceAccount = require('./service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const BACKEND_URL = 'https://etudeasy-mistral-backend.onrender.com';

// Historique de conversation
let conversationHistory = [];

/**
 * Envoie un message au chatbot
 */
async function sendMessage(token, message) {
  console.log('\n' + '='.repeat(80));
  console.log('USER:', message);
  console.log('='.repeat(80));

  // Ajouter le message utilisateur à l'historique
  conversationHistory.push({
    role: 'user',
    content: message,
  });

  try {
    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages: conversationHistory,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ ERREUR HTTP:', response.status, errorText);
      return null;
    }

    const data = await response.json();

    if (!data.success) {
      console.error('❌ ERREUR BACKEND:', data.message);
      console.error('   Détails:', data.error);
      return null;
    }

    console.log('\n✅ ASSISTANT:', data.message || '(message vide)');

    if (data.toolCalls && data.toolCalls.length > 0) {
      console.log('\n🔧 TOOL CALLS:');
      data.toolCalls.forEach(tc => {
        console.log(`   - ${tc.function.name}`);
        console.log(`     Args:`, JSON.parse(tc.function.arguments));
      });
    }

    // Ajouter la réponse à l'historique
    if (data.message) {
      conversationHistory.push({
        role: 'assistant',
        content: data.message,
      });
    }

    // Ajouter les tool calls à l'historique pour les tests suivants
    if (data.toolCalls && data.toolCalls.length > 0) {
      conversationHistory.push({
        role: 'assistant',
        content: data.message || 'Action effectuée',
        tool_calls: data.toolCalls,
      });
    }

    return data;
  } catch (error) {
    console.error('❌ ERREUR RÉSEAU:', error.message);
    return null;
  }
}

/**
 * Teste le chatbot avec une série de messages
 */
async function runTests() {
  console.log('🚀 Démarrage des tests du chatbot...\n');

  // Obtenir un token Firebase
  console.log('🔑 Génération du token Firebase...');
  const testUserId = '4t2tzh2VtQbJrRxksWJ693xg4Dh1';
  const token = await admin.auth().createCustomToken(testUserId);

  // Échanger le custom token contre un ID token
  const authResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=AIzaSyDGCKx5BT8VQuMX0N9N6_qQQJIxZFaYwT0`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, returnSecureToken: true }),
    }
  );
  const authData = await authResponse.json();
  const idToken = authData.idToken;
  console.log('✅ Token obtenu\n');

  // Réinitialiser l'historique
  conversationHistory = [];

  // Test 1: Message initial
  console.log('\n📋 TEST 1: Demande initiale de planification');
  await sendMessage(idToken, 'Planifie moi une revision ce week end pour mon examen de maths');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Réponse à une proposition (cas problématique)
  console.log('\n📋 TEST 2: Sélection dimanche soir');
  await sendMessage(idToken, 'je veux bien celle de dimanche soir');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Placement direct avec jour spécifique
  console.log('\n📋 TEST 3: Placement direct dimanche après-midi');
  conversationHistory = []; // Reset
  await sendMessage(idToken, 'Place-moi une révision dimanche après-midi');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n' + '='.repeat(80));
  console.log('✅ Tests terminés');
  console.log('='.repeat(80));

  process.exit(0);
}

// Lancer les tests
runTests().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
