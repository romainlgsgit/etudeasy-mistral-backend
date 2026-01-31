/**
 * Test des bugs de dates signalés par l'utilisateur
 */

const BACKEND_URL = 'https://etudeasy-mistral-backend.onrender.com';

let conversationHistory = [];

async function sendMessage(token, message) {
  console.log('\n' + '='.repeat(80));
  console.log('👤 USER:', message);
  console.log('='.repeat(80));

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
      return null;
    }

    console.log('\n🤖 ASSISTANT:', data.message || '(message vide)');

    if (data.toolCalls && data.toolCalls.length > 0) {
      data.toolCalls.forEach(tc => {
        if (tc.function.name === 'auto_place_event') {
          const args = JSON.parse(tc.function.arguments);
          console.log(`\n📅 AUTO_PLACE_EVENT:`);
          console.log(`   targetDate: ${args.preferences?.targetDate}`);
          console.log(`   preferredTimeOfDay: ${args.preferences?.preferredTimeOfDay}`);
        }
      });
    }

    conversationHistory.push({
      role: 'assistant',
      content: data.message,
    });

    return data;
  } catch (error) {
    console.error('❌ ERREUR RÉSEAU:', error.message);
    return null;
  }
}

async function runTests(token) {
  console.log('🚀 Test des bugs de dates...\n');
  console.log('📅 Aujourd\'hui: Vendredi 30 janvier 2026');
  console.log('   • Samedi = 31 janvier');
  console.log('   • Dimanche = 1er février');
  console.log('   • Lundi = 2 février (semaine prochaine)');
  console.log('   • Jeudi = 5 février (semaine prochaine)\n');

  // BUG 1: "jeudi" sans préciser devrait prendre jeudi PROCHAIN, pas celui passé
  console.log('\n🧪 TEST 1: "Place-moi une révision jeudi"');
  console.log('   Attendu: Jeudi 5 février (prochain jeudi)');
  conversationHistory = [];
  await sendMessage(token, 'Place-moi une révision jeudi');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // BUG 2: "vendredi" devrait prendre vendredi PROCHAIN (pas aujourd'hui si après 18h)
  console.log('\n🧪 TEST 2: "Ajoute un cours de sport vendredi"');
  console.log('   Attendu: Vendredi 6 février (vendredi prochain)');
  conversationHistory = [];
  await sendMessage(token, 'Ajoute un cours de sport vendredi');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // BUG 3: "semaine prochaine" + jour devrait forcer la semaine prochaine
  console.log('\n🧪 TEST 3: "Planifie un entraînement pour la semaine prochaine" puis "samedi"');
  console.log('   Attendu: Samedi 7 février (semaine prochaine)');
  conversationHistory = [];
  await sendMessage(token, 'Planifie un entraînement de tennis pour la semaine prochaine');
  await new Promise(resolve => setTimeout(resolve, 3000));
  await sendMessage(token, 'samedi');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // TEST 4: Réponse à une proposition avec un jour différent
  console.log('\n🧪 TEST 4: Proposition puis "je préfère mercredi"');
  console.log('   Attendu: Mercredi 4 février');
  conversationHistory = [];
  await sendMessage(token, 'Planifie moi une révision ce week-end');
  await new Promise(resolve => setTimeout(resolve, 3000));
  await sendMessage(token, 'Je préfère plutôt mercredi');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n' + '='.repeat(80));
  console.log('✅ Tests terminés');
  console.log('='.repeat(80));

  process.exit(0);
}

if (process.argv.length < 3) {
  console.error('❌ Usage: node test-date-bugs.js <FIREBASE_TOKEN>');
  process.exit(1);
}

const token = process.argv[2];
runTests(token).catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
