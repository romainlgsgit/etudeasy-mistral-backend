/**
 * Test complet de tous les scénarios après correction des bugs
 */

const BACKEND_URL = 'https://etudeasy-mistral-backend.onrender.com';

let conversationHistory = [];
let testResults = [];

async function sendMessage(token, message, description) {
  console.log('\n' + '='.repeat(80));
  console.log(`📝 TEST: ${description}`);
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
      testResults.push({ description, success: false, error: `HTTP ${response.status}` });
      return null;
    }

    const data = await response.json();

    if (!data.success) {
      console.error('❌ ERREUR BACKEND:', data.message);
      testResults.push({ description, success: false, error: data.message });
      return null;
    }

    console.log('\n🤖 ASSISTANT:', data.message || '(message vide)');

    // Analyser les tool calls pour détecter auto_place_event
    let placementInfo = null;
    if (data.toolCalls && data.toolCalls.length > 0) {
      data.toolCalls.forEach(tc => {
        if (tc.function.name === 'auto_place_event') {
          const args = JSON.parse(tc.function.arguments);
          placementInfo = {
            targetDate: args.preferences?.targetDate,
            preferredTimeOfDay: args.preferences?.preferredTimeOfDay,
            title: args.eventInfo?.title,
            type: args.eventInfo?.type,
          };
          console.log(`\n📅 AUTO_PLACE_EVENT appelé:`);
          console.log(`   Title: ${placementInfo.title}`);
          console.log(`   Target Date: ${placementInfo.targetDate}`);
          console.log(`   Time of Day: ${placementInfo.preferredTimeOfDay}`);
        }
      });
    }

    conversationHistory.push({
      role: 'assistant',
      content: data.message,
    });

    return { data, placementInfo };
  } catch (error) {
    console.error('❌ ERREUR RÉSEAU:', error.message);
    testResults.push({ description, success: false, error: error.message });
    return null;
  }
}

function getExpectedDate(dayName) {
  const today = new Date();
  const daysMap = {
    'dimanche': 0,
    'lundi': 1,
    'mardi': 2,
    'mercredi': 3,
    'jeudi': 4,
    'vendredi': 5,
    'samedi': 6,
  };

  const targetDayIndex = daysMap[dayName.toLowerCase()];
  const currentDayIndex = today.getDay();

  let daysToAdd = targetDayIndex - currentDayIndex;
  if (daysToAdd <= 0) {
    daysToAdd += 7; // Semaine prochaine
  }

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysToAdd);

  return targetDate.toISOString().split('T')[0];
}

function verifyDate(actualDate, expectedDate, description) {
  if (actualDate === expectedDate) {
    console.log(`✅ SUCCÈS: Date correcte (${actualDate})`);
    testResults.push({ description, success: true, actualDate, expectedDate });
    return true;
  } else {
    console.log(`❌ ÉCHEC: Date incorrecte`);
    console.log(`   Attendu: ${expectedDate}`);
    console.log(`   Reçu:    ${actualDate}`);
    testResults.push({ description, success: false, actualDate, expectedDate });
    return false;
  }
}

async function runAllTests(token) {
  console.log('🚀 DÉBUT DES TESTS COMPLETS - Scénarios de bugs corrigés\n');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const daysOfWeek = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const todayName = daysOfWeek[today.getDay()];

  console.log(`📅 Aujourd'hui: ${todayName} ${todayStr}\n`);

  // Attendre un peu pour que Render démarre
  console.log('⏳ Attente de 5 secondes pour le warm-up du backend...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // ========================================
  // TEST 1: "Place-moi une révision jeudi"
  // ========================================
  conversationHistory = [];
  const expectedJeudi = getExpectedDate('jeudi');
  console.log(`\n🧪 TEST 1: Placement avec jour simple (jeudi)`);
  console.log(`   Attendu: Jeudi ${expectedJeudi}`);

  const result1 = await sendMessage(
    token,
    'Place-moi une révision jeudi',
    'TEST 1: Placement jeudi'
  );

  if (result1 && result1.placementInfo) {
    verifyDate(result1.placementInfo.targetDate, expectedJeudi, 'TEST 1: Placement jeudi');
  }

  await new Promise(resolve => setTimeout(resolve, 3000));

  // ========================================
  // TEST 2: "Ajoute un cours de sport samedi"
  // ========================================
  conversationHistory = [];
  const expectedSamedi = getExpectedDate('samedi');
  console.log(`\n🧪 TEST 2: Placement avec jour simple (samedi)`);
  console.log(`   Attendu: Samedi ${expectedSamedi}`);

  const result2 = await sendMessage(
    token,
    'Ajoute un cours de sport samedi',
    'TEST 2: Placement samedi'
  );

  if (result2 && result2.placementInfo) {
    verifyDate(result2.placementInfo.targetDate, expectedSamedi, 'TEST 2: Placement samedi');
  }

  await new Promise(resolve => setTimeout(resolve, 3000));

  // ========================================
  // TEST 3: Préférence utilisateur après suggestion
  // ========================================
  conversationHistory = [];
  const expectedMercredi = getExpectedDate('mercredi');
  console.log(`\n🧪 TEST 3: Préférence utilisateur "je préfère mercredi"`);
  console.log(`   Attendu: Mercredi ${expectedMercredi}`);

  await sendMessage(
    token,
    'Planifie moi une révision cette semaine',
    'TEST 3.1: Demande initiale'
  );

  await new Promise(resolve => setTimeout(resolve, 3000));

  const result3 = await sendMessage(
    token,
    'Je préfère plutôt mercredi',
    'TEST 3.2: Préférence mercredi'
  );

  if (result3 && result3.placementInfo) {
    verifyDate(result3.placementInfo.targetDate, expectedMercredi, 'TEST 3: Préférence mercredi');
  }

  await new Promise(resolve => setTimeout(resolve, 3000));

  // ========================================
  // TEST 4: "Semaine prochaine" + jour
  // ========================================
  conversationHistory = [];
  console.log(`\n🧪 TEST 4: "la semaine prochaine" + jour dans message suivant`);

  await sendMessage(
    token,
    'Planifie un entraînement de tennis pour la semaine prochaine',
    'TEST 4.1: Semaine prochaine'
  );

  await new Promise(resolve => setTimeout(resolve, 3000));

  const expectedDimanche = getExpectedDate('dimanche');
  console.log(`   Attendu: Dimanche ${expectedDimanche}`);

  const result4 = await sendMessage(
    token,
    'dimanche',
    'TEST 4.2: Dimanche'
  );

  if (result4 && result4.placementInfo) {
    verifyDate(result4.placementInfo.targetDate, expectedDimanche, 'TEST 4: Dimanche semaine prochaine');
  }

  await new Promise(resolve => setTimeout(resolve, 3000));

  // ========================================
  // TEST 5: "demain"
  // ========================================
  conversationHistory = [];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const expectedTomorrow = tomorrow.toISOString().split('T')[0];

  console.log(`\n🧪 TEST 5: "Place-moi une révision demain"`);
  console.log(`   Attendu: ${expectedTomorrow}`);

  const result5 = await sendMessage(
    token,
    'Place-moi une révision demain',
    'TEST 5: Demain'
  );

  if (result5 && result5.placementInfo) {
    verifyDate(result5.placementInfo.targetDate, expectedTomorrow, 'TEST 5: Demain');
  }

  await new Promise(resolve => setTimeout(resolve, 3000));

  // ========================================
  // TEST 6: Moment de la journée
  // ========================================
  conversationHistory = [];
  console.log(`\n🧪 TEST 6: "Ajoute un cours de sport en fin d'après-midi"`);

  const result6 = await sendMessage(
    token,
    'Ajoute un cours de sport en fin d\'après-midi',
    'TEST 6: Fin après-midi'
  );

  if (result6 && result6.placementInfo) {
    const timeOfDay = result6.placementInfo.preferredTimeOfDay;
    if (timeOfDay === 'afternoon' || timeOfDay === 'evening') {
      console.log(`✅ SUCCÈS: Moment de journée correct (${timeOfDay})`);
      testResults.push({ description: 'TEST 6: Fin après-midi', success: true, timeOfDay });
    } else {
      console.log(`❌ ÉCHEC: Moment de journée incorrect (${timeOfDay})`);
      testResults.push({ description: 'TEST 6: Fin après-midi', success: false, timeOfDay });
    }
  }

  await new Promise(resolve => setTimeout(resolve, 3000));

  // ========================================
  // RÉSUMÉ DES RÉSULTATS
  // ========================================
  console.log('\n' + '='.repeat(80));
  console.log('📊 RÉSUMÉ DES TESTS');
  console.log('='.repeat(80));

  const successCount = testResults.filter(r => r.success).length;
  const failCount = testResults.filter(r => !r.success).length;

  console.log(`\n✅ Succès: ${successCount}/${testResults.length}`);
  console.log(`❌ Échecs: ${failCount}/${testResults.length}`);

  if (failCount > 0) {
    console.log('\n❌ TESTS ÉCHOUÉS:');
    testResults.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.description}`);
      if (r.expectedDate) {
        console.log(`     Attendu: ${r.expectedDate}, Reçu: ${r.actualDate}`);
      }
      if (r.error) {
        console.log(`     Erreur: ${r.error}`);
      }
    });
  }

  console.log('\n' + '='.repeat(80));
  if (failCount === 0) {
    console.log('🎉 TOUS LES TESTS SONT PASSÉS !');
  } else {
    console.log('⚠️  CERTAINS TESTS ONT ÉCHOUÉ');
  }
  console.log('='.repeat(80));

  process.exit(failCount === 0 ? 0 : 1);
}

if (process.argv.length < 3) {
  console.error('❌ Usage: node test-all-scenarios.js <FIREBASE_TOKEN>');
  process.exit(1);
}

const token = process.argv[2];
runAllTests(token).catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
