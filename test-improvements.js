/**
 * Test des améliorations du chatbot
 * Ce script teste les nouvelles fonctionnalités en local
 */

require('dotenv').config();
const admin = require('firebase-admin');

// Initialiser Firebase Admin
const serviceAccount = require('./service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'etudeasy-d8dc7'
});

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

// Importer les services
const { buildSystemPrompt, callMistralAPI } = require('./dist/services/mistral');
const { handleToolCalls } = require('./dist/services/tools');
const { getUserContext } = require('./dist/services/context');

// Test user ID (utiliser un vrai user ID si disponible)
const TEST_USER_ID = 'test-user-improvements';

async function runTest(testName, testFn) {
  console.log(`\n${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}${colors.bold}🧪 ${testName}${colors.reset}`);
  console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  try {
    await testFn();
    console.log(`\n${colors.green}✅ Test passé: ${testName}${colors.reset}`);
    return true;
  } catch (error) {
    console.log(`\n${colors.red}❌ Test échoué: ${testName}${colors.reset}`);
    console.log(`   ${colors.red}Erreur: ${error.message}${colors.reset}`);
    return false;
  }
}

async function testSystemPrompt() {
  console.log('📝 Vérification du nouveau prompt système...\n');

  const userContext = {
    events: [],
    profile: { academicInfo: { name: 'Test School', level: 'Licence' } },
    language: 'fr'
  };

  const prompt = buildSystemPrompt(userContext);

  // Vérifier les nouvelles règles
  const hasRule1 = prompt.includes('RÈGLE #1');
  const hasRule2 = prompt.includes('RÈGLE #2');
  const hasCapabilities = prompt.includes('TOUTES TES CAPACITÉS');
  const hasConfirmationFormat = prompt.includes('✅ BON FORMAT');
  const hasBadFormat = prompt.includes('❌ MAUVAIS FORMAT');

  console.log(`   ${hasRule1 ? '✅' : '❌'} Règle #1 (Exécuteur, pas bavard)`);
  console.log(`   ${hasRule2 ? '✅' : '❌'} Règle #2 (Messages de confirmation clairs)`);
  console.log(`   ${hasCapabilities ? '✅' : '❌'} Documentation des capacités`);
  console.log(`   ${hasConfirmationFormat ? '✅' : '❌'} Format de confirmation correct`);
  console.log(`   ${hasBadFormat ? '✅' : '❌'} Exemples de mauvais formats`);

  if (!hasRule1 || !hasRule2 || !hasCapabilities) {
    throw new Error('Le prompt système ne contient pas toutes les nouvelles règles');
  }
}

async function testSpanishPrompt() {
  console.log('📝 Vérification du prompt espagnol...\n');

  const userContext = {
    events: [],
    profile: { academicInfo: { name: 'Test School', level: 'Licence' } },
    language: 'es'
  };

  const prompt = buildSystemPrompt(userContext);

  // Vérifier les nouvelles règles en espagnol
  const hasRegla1 = prompt.includes('REGLA #1');
  const hasRegla2 = prompt.includes('REGLA #2');
  const hasCapacidades = prompt.includes('TODAS TUS CAPACIDADES');

  console.log(`   ${hasRegla1 ? '✅' : '❌'} Regla #1 (version espagnole)`);
  console.log(`   ${hasRegla2 ? '✅' : '❌'} Regla #2 (version espagnole)`);
  console.log(`   ${hasCapacidades ? '✅' : '❌'} Capacidades (version espagnole)`);

  if (!hasRegla1 || !hasRegla2 || !hasCapacidades) {
    throw new Error('Le prompt espagnol ne contient pas toutes les nouvelles règles');
  }
}

async function testAddEventResponse() {
  console.log('📝 Test de la réponse add_event avec détails...\n');

  // Simuler un tool call add_event
  const mockToolCall = {
    id: 'test-123',
    function: {
      name: 'add_event',
      arguments: JSON.stringify({
        events: [{
          title: 'Cours de Mathématiques',
          type: 'class',
          date: '2026-02-10',
          startTime: '14:00',
          endTime: '15:30'
        }]
      })
    }
  };

  // Exécuter le tool call
  const results = await handleToolCalls([mockToolCall], TEST_USER_ID, 'Test message');

  const result = JSON.parse(results[0].content);

  console.log(`   Succès: ${result.success ? '✅' : '❌'}`);
  console.log(`   Events inclus: ${result.events ? '✅' : '❌'}`);

  if (result.events && result.events.length > 0) {
    const event = result.events[0];
    console.log(`   Titre: ${event.title}`);
    console.log(`   Jour: ${event.dayName}`);
    console.log(`   Horaire: ${event.startTime} - ${event.endTime}`);
  }

  // Nettoyer l'événement de test
  if (result.eventIds && result.eventIds.length > 0) {
    const db = admin.firestore();
    for (const id of result.eventIds) {
      await db.collection('scheduleEvents').doc(id).delete();
      console.log(`   🧹 Événement de test supprimé: ${id}`);
    }
  }

  if (!result.success || !result.events || result.events.length === 0) {
    throw new Error('La réponse add_event ne contient pas les détails des événements');
  }
}

async function testAutoPlaceEventResponse() {
  console.log('📝 Test de la réponse auto_place_event avec titre...\n');

  // Simuler un tool call auto_place_event
  const mockToolCall = {
    id: 'test-456',
    function: {
      name: 'auto_place_event',
      arguments: JSON.stringify({
        eventInfo: {
          title: 'Révision de Physique',
          type: 'study',
          duration: 90
        },
        preferences: {
          targetDate: '2026-02-10'
        }
      })
    }
  };

  // Exécuter le tool call
  const results = await handleToolCalls([mockToolCall], TEST_USER_ID, 'Place-moi une révision');

  const result = JSON.parse(results[0].content);

  if (result.success && result.placement) {
    console.log(`   Succès: ✅`);
    console.log(`   Titre dans placement: ${result.placement.title ? '✅' : '❌'}`);
    console.log(`   Titre: ${result.placement.title}`);
    console.log(`   Jour: ${result.placement.dayName}`);
    console.log(`   Horaire: ${result.placement.startTime} - ${result.placement.endTime}`);
    console.log(`   Qualité: ${result.placement.slotQuality}`);

    // Nettoyer l'événement de test
    if (result.eventId) {
      const db = admin.firestore();
      await db.collection('scheduleEvents').doc(result.eventId).delete();
      console.log(`   🧹 Événement de test supprimé: ${result.eventId}`);
    }

    if (!result.placement.title) {
      throw new Error('Le placement ne contient pas le titre');
    }
  } else {
    console.log(`   ${result.error || 'Erreur inconnue'}`);
    // Ce n'est pas forcément une erreur, le jour peut être complet
    if (result.error && result.error.includes('Aucun créneau')) {
      console.log(`   ℹ️ Pas de créneau disponible (comportement normal)`);
    } else {
      throw new Error(`Échec: ${result.error || 'Erreur inconnue'}`);
    }
  }
}

async function testMistralAPICall() {
  console.log('📝 Test d\'appel à Mistral API...\n');

  const userContext = {
    events: [],
    profile: { academicInfo: { name: 'Test School', level: 'Licence' } },
    language: 'fr'
  };

  const systemPrompt = buildSystemPrompt(userContext);

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Ajoute un cours de maths demain à 14h' }
  ];

  console.log('   Envoi de la requête à Mistral...');

  const response = await callMistralAPI(messages, true);

  const assistantMessage = response.choices[0].message;

  console.log(`   Réponse reçue: ✅`);
  console.log(`   Tool calls: ${assistantMessage.tool_calls ? assistantMessage.tool_calls.length : 0}`);

  if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    const toolCall = assistantMessage.tool_calls[0];
    console.log(`   Fonction appelée: ${toolCall.function.name}`);

    if (toolCall.function.name === 'add_event') {
      console.log(`   ✅ Mistral a correctement utilisé add_event pour un horaire précis`);
    }
  }

  // Vérifier que la réponse ne contient pas de question de confirmation
  const content = assistantMessage.content || '';
  const hasConfirmationQuestion = /veux-tu|tu veux|je confirme|confirmes/i.test(content);

  if (hasConfirmationQuestion && assistantMessage.tool_calls) {
    console.log(`   ⚠️ Attention: Le message contient une question de confirmation alors que l'action a été exécutée`);
  } else {
    console.log(`   ✅ Pas de question de confirmation inappropriée`);
  }
}

async function cleanup() {
  console.log('\n🧹 Nettoyage des données de test...');

  const db = admin.firestore();

  // Supprimer tous les événements de l'utilisateur de test
  const eventsSnapshot = await db.collection('scheduleEvents')
    .where('userId', '==', TEST_USER_ID)
    .get();

  let deleted = 0;
  for (const doc of eventsSnapshot.docs) {
    await doc.ref.delete();
    deleted++;
  }

  console.log(`   ${deleted} événement(s) de test supprimé(s)`);
}

async function main() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║     🤖 Tests des Améliorations du Chatbot                     ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════════════════╝${colors.reset}`);

  const results = [];

  results.push(await runTest('Prompt système français', testSystemPrompt));
  results.push(await runTest('Prompt système espagnol', testSpanishPrompt));
  results.push(await runTest('Réponse add_event avec détails', testAddEventResponse));
  results.push(await runTest('Réponse auto_place_event avec titre', testAutoPlaceEventResponse));
  results.push(await runTest('Appel Mistral API', testMistralAPICall));

  await cleanup();

  // Résumé
  const passed = results.filter(r => r).length;
  const failed = results.filter(r => !r).length;

  console.log(`\n${colors.blue}════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}📊 Résumé des tests${colors.reset}`);
  console.log(`${colors.blue}════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`   ${colors.green}✅ Passés: ${passed}${colors.reset}`);
  console.log(`   ${colors.red}❌ Échoués: ${failed}${colors.reset}`);
  console.log(`${colors.blue}════════════════════════════════════════════════════════════════${colors.reset}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error(`${colors.red}Erreur fatale:${colors.reset}`, error);
  process.exit(1);
});
