/**
 * Script de test de conversation avec le chatbot
 * Usage: node test-conversation.js <FIREBASE_TOKEN>
 */

const BACKEND_URL = 'https://etudeasy-mistral-backend.onrender.com';

// Historique de conversation
let conversationHistory = [];

/**
 * Envoie un message au chatbot
 */
async function sendMessage(token, message) {
  console.log('\n' + '='.repeat(80));
  console.log('👤 USER:', message);
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
      if (data.error) console.error('   Détails:', data.error);
      return null;
    }

    console.log('\n🤖 ASSISTANT:', data.message || '(message vide)');

    if (data.toolCalls && data.toolCalls.length > 0) {
      console.log('\n🔧 TOOL CALLS:');
      data.toolCalls.forEach(tc => {
        console.log(`   • ${tc.function.name}`);
        const args = JSON.parse(tc.function.arguments);
        console.log(`     Args:`, JSON.stringify(args, null, 2));
      });
    }

    if (data.rateLimitInfo) {
      console.log(`\n📊 Rate limit: ${data.rateLimitInfo.messagesUsed}/150 messages utilisés`);
    }

    // Ajouter la réponse à l'historique (simplifié pour éviter les tool_calls)
    if (data.message) {
      conversationHistory.push({
        role: 'assistant',
        content: data.message,
      });
    }

    return data;
  } catch (error) {
    console.error('❌ ERREUR RÉSEAU:', error.message);
    return null;
  }
}

/**
 * Teste une conversation avec plusieurs messages
 */
async function runConversation(token) {
  console.log('🚀 Démarrage du test de conversation...\n');
  console.log('📅 Contexte: Nous sommes vendredi 30 janvier 2026');
  console.log('   • Demain = samedi 31 janvier');
  console.log('   • Dimanche = 1er février\n');

  // Test 1: Demande initiale
  console.log('\n📝 TEST 1: Demande de planification week-end');
  await sendMessage(token, 'Planifie moi une revision ce week end pour mon examen de maths');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 2: Sélection d'une proposition
  console.log('\n📝 TEST 2: Sélection dimanche soir (test du bug)');
  await sendMessage(token, 'je veux bien celle de dimanche soir');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 3: Nouvelle conversation - placement direct
  console.log('\n📝 TEST 3: Placement direct dimanche après-midi');
  conversationHistory = []; // Reset
  await sendMessage(token, 'Place-moi une révision dimanche après-midi');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 4: Vérification date samedi
  console.log('\n📝 TEST 4: Placement samedi matin');
  conversationHistory = []; // Reset
  await sendMessage(token, 'Ajoute une séance de sport samedi matin');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n' + '='.repeat(80));
  console.log('✅ Tests terminés');
  console.log('='.repeat(80));

  process.exit(0);
}

// Vérifier qu'un token est fourni
if (process.argv.length < 3) {
  console.error('❌ Usage: node test-conversation.js <FIREBASE_TOKEN>');
  console.error('\nPour obtenir un token:');
  console.error('1. Ouvre l\'app EtudEasy');
  console.error('2. Va dans le chatbot');
  console.error('3. Le token apparaît dans les logs Metro');
  process.exit(1);
}

const token = process.argv[2];
console.log('🔑 Token reçu:', token.substring(0, 20) + '...\n');

// Lancer la conversation
runConversation(token).catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
