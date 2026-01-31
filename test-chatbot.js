/**
 * Script de test automatique pour le chatbot
 * Usage: node test-chatbot.js <FIREBASE_TOKEN>
 */

const BACKEND_URL = 'https://etudeasy-mistral-backend.onrender.com';

// Couleurs pour l'affichage
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Envoie un message au chatbot
 */
async function sendMessage(token, message) {
  const response = await fetch(`${BACKEND_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: message }
      ]
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  return await response.json();
}

/**
 * Affiche un résultat de test
 */
function logTest(testNumber, title, success, details) {
  const icon = success ? '✅' : '❌';
  const color = success ? colors.green : colors.red;

  console.log(`\n${color}${icon} Test ${testNumber}: ${title}${colors.reset}`);
  if (details) {
    console.log(`   ${colors.cyan}${details}${colors.reset}`);
  }
}

/**
 * Tests
 */
async function runTests(token) {
  console.log(`${colors.blue}╔════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║     🤖 Tests Automatiques du Chatbot                  ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════════╝${colors.reset}`);

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Placement automatique basique
  try {
    console.log(`\n${colors.yellow}→ Test 1: Placement automatique basique${colors.reset}`);
    console.log(`  Message: "Place-moi une révision demain"`);

    const response = await sendMessage(token, 'Place-moi une révision demain');

    const usedAutoPlace = response.toolCalls?.some(tc => tc.function?.name === 'auto_place_event');

    if (usedAutoPlace) {
      logTest(1, 'Placement automatique basique', true,
        `Réponse: ${response.message.substring(0, 100)}...`);
      passedTests++;
    } else {
      logTest(1, 'Placement automatique basique', false,
        `Tool utilisé: ${response.toolCalls?.[0]?.function?.name || 'aucun'}`);
      failedTests++;
    }
  } catch (error) {
    logTest(1, 'Placement automatique basique', false, `Erreur: ${error.message}`);
    failedTests++;
  }

  // Test 2: Recherche de créneau
  try {
    console.log(`\n${colors.yellow}→ Test 2: Recherche de créneau${colors.reset}`);
    console.log(`  Message: "Trouve-moi un créneau pour réviser les maths"`);

    const response = await sendMessage(token, 'Trouve-moi un créneau pour réviser les maths');

    const usedAutoPlace = response.toolCalls?.some(tc => tc.function?.name === 'auto_place_event');
    const mentionsMaths = response.message.toLowerCase().includes('math');

    if (usedAutoPlace && mentionsMaths) {
      logTest(2, 'Recherche de créneau', true,
        `Réponse: ${response.message.substring(0, 100)}...`);
      passedTests++;
    } else {
      logTest(2, 'Recherche de créneau', false,
        `Auto-place: ${usedAutoPlace}, Mentionne maths: ${mentionsMaths}`);
      failedTests++;
    }
  } catch (error) {
    logTest(2, 'Recherche de créneau', false, `Erreur: ${error.message}`);
    failedTests++;
  }

  // Test 3: Ajout manuel (contraste)
  try {
    console.log(`\n${colors.yellow}→ Test 3: Ajout manuel avec heure précise${colors.reset}`);
    console.log(`  Message: "J'ai un cours de maths lundi à 14h"`);

    const response = await sendMessage(token, "J'ai un cours de maths lundi à 14h");

    const usedAddEvent = response.toolCalls?.some(tc => tc.function?.name === 'add_event');
    const notAutoPlace = !response.toolCalls?.some(tc => tc.function?.name === 'auto_place_event');

    if (usedAddEvent && notAutoPlace) {
      logTest(3, 'Ajout manuel avec heure précise', true,
        `Réponse: ${response.message.substring(0, 100)}...`);
      passedTests++;
    } else {
      logTest(3, 'Ajout manuel avec heure précise', false,
        `Tool utilisé: ${response.toolCalls?.[0]?.function?.name || 'aucun'}`);
      failedTests++;
    }
  } catch (error) {
    logTest(3, 'Ajout manuel avec heure précise', false, `Erreur: ${error.message}`);
    failedTests++;
  }

  // Test 4: Demande vague
  try {
    console.log(`\n${colors.yellow}→ Test 4: Demande vague (sans date ni heure)${colors.reset}`);
    console.log(`  Message: "Ajoute une session de révision"`);

    const response = await sendMessage(token, 'Ajoute une session de révision');

    const usedAutoPlace = response.toolCalls?.some(tc => tc.function?.name === 'auto_place_event');

    if (usedAutoPlace) {
      logTest(4, 'Demande vague', true,
        `Réponse: ${response.message.substring(0, 100)}...`);
      passedTests++;
    } else {
      logTest(4, 'Demande vague', false,
        `Tool utilisé: ${response.toolCalls?.[0]?.function?.name || 'aucun'}`);
      failedTests++;
    }
  } catch (error) {
    logTest(4, 'Demande vague', false, `Erreur: ${error.message}`);
    failedTests++;
  }

  // Test 5: Placement avec préférence
  try {
    console.log(`\n${colors.yellow}→ Test 5: Placement avec préférence de moment${colors.reset}`);
    console.log(`  Message: "Ajoute un cours de sport en fin d'après-midi"`);

    const response = await sendMessage(token, "Ajoute un cours de sport en fin d'après-midi");

    const usedAutoPlace = response.toolCalls?.some(tc => tc.function?.name === 'auto_place_event');
    const mentionsSport = response.message.toLowerCase().includes('sport');

    if (usedAutoPlace && mentionsSport) {
      logTest(5, 'Placement avec préférence', true,
        `Réponse: ${response.message.substring(0, 100)}...`);
      passedTests++;
    } else {
      logTest(5, 'Placement avec préférence', false,
        `Auto-place: ${usedAutoPlace}, Mentionne sport: ${mentionsSport}`);
      failedTests++;
    }
  } catch (error) {
    logTest(5, 'Placement avec préférence', false, `Erreur: ${error.message}`);
    failedTests++;
  }

  // Test 6: Demande d'informations manquantes
  try {
    console.log(`\n${colors.yellow}→ Test 6: Demande d'informations manquantes${colors.reset}`);
    console.log(`  Message: "J'ai un examen de physique vendredi"`);

    const response = await sendMessage(token, "J'ai un examen de physique vendredi");

    const usedRequestInfo = response.toolCalls?.some(tc => tc.function?.name === 'request_missing_info');
    const asksForTime = response.message.toLowerCase().includes('heure') ||
                        response.message.toLowerCase().includes('quelle');

    if (usedRequestInfo || asksForTime) {
      logTest(6, 'Demande d\'informations manquantes', true,
        `Réponse: ${response.message.substring(0, 100)}...`);
      passedTests++;
    } else {
      logTest(6, 'Demande d\'informations manquantes', false,
        `Tool utilisé: ${response.toolCalls?.[0]?.function?.name || 'aucun'}`);
      failedTests++;
    }
  } catch (error) {
    logTest(6, 'Demande d\'informations manquantes', false, `Erreur: ${error.message}`);
    failedTests++;
  }

  // Test 7: Conversation simple
  try {
    console.log(`\n${colors.yellow}→ Test 7: Conversation simple${colors.reset}`);
    console.log(`  Message: "Bonjour, comment ça va ?"`);

    const response = await sendMessage(token, 'Bonjour, comment ça va ?');

    const noToolCalls = !response.toolCalls || response.toolCalls.length === 0;
    const hasResponse = response.message && response.message.length > 0;

    if (noToolCalls && hasResponse) {
      logTest(7, 'Conversation simple', true,
        `Réponse: ${response.message.substring(0, 100)}...`);
      passedTests++;
    } else {
      logTest(7, 'Conversation simple', false,
        `Tool calls: ${response.toolCalls?.length || 0}, Response: ${hasResponse}`);
      failedTests++;
    }
  } catch (error) {
    logTest(7, 'Conversation simple', false, `Erreur: ${error.message}`);
    failedTests++;
  }

  // Test 8: Questions sur le planning
  try {
    console.log(`\n${colors.yellow}→ Test 8: Questions sur le planning${colors.reset}`);
    console.log(`  Message: "Qu'est-ce que j'ai demain ?"`);

    const response = await sendMessage(token, "Qu'est-ce que j'ai demain ?");

    const usedSearch = response.toolCalls?.some(tc => tc.function?.name === 'search_events');
    const hasResponse = response.message && response.message.length > 0;

    if (hasResponse) {
      logTest(8, 'Questions sur le planning', true,
        `Réponse: ${response.message.substring(0, 100)}...`);
      passedTests++;
    } else {
      logTest(8, 'Questions sur le planning', false,
        `Pas de réponse valide`);
      failedTests++;
    }
  } catch (error) {
    logTest(8, 'Questions sur le planning', false, `Erreur: ${error.message}`);
    failedTests++;
  }

  // Test 9: Rate limit info
  try {
    console.log(`\n${colors.yellow}→ Test 9: Vérification rate limit info${colors.reset}`);
    console.log(`  Message: "Test rate limit"`);

    const response = await sendMessage(token, 'Test rate limit');

    const hasRateLimitInfo = response.rateLimitInfo &&
                             typeof response.rateLimitInfo.messagesUsed === 'number';

    if (hasRateLimitInfo) {
      logTest(9, 'Vérification rate limit info', true,
        `Messages utilisés: ${response.rateLimitInfo.messagesUsed}/${response.rateLimitInfo.messagesUsed + response.rateLimitInfo.messagesRemaining}`);
      passedTests++;
    } else {
      logTest(9, 'Vérification rate limit info', false,
        `Pas de rate limit info`);
      failedTests++;
    }
  } catch (error) {
    logTest(9, 'Vérification rate limit info', false, `Erreur: ${error.message}`);
    failedTests++;
  }

  // Test 10: Réponse réussie
  try {
    console.log(`\n${colors.yellow}→ Test 10: Vérification flag success${colors.reset}`);
    console.log(`  Message: "Test success flag"`);

    const response = await sendMessage(token, 'Test success flag');

    if (response.success === true) {
      logTest(10, 'Vérification flag success', true,
        `Success: ${response.success}`);
      passedTests++;
    } else {
      logTest(10, 'Vérification flag success', false,
        `Success: ${response.success}`);
      failedTests++;
    }
  } catch (error) {
    logTest(10, 'Vérification flag success', false, `Erreur: ${error.message}`);
    failedTests++;
  }

  // Résumé
  console.log(`\n${colors.blue}╔════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║              📊 Résumé des Tests                       ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`${colors.green}✅ Tests réussis: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}❌ Tests échoués: ${failedTests}${colors.reset}`);
  console.log(`📈 Taux de réussite: ${Math.round((passedTests / (passedTests + failedTests)) * 100)}%\n`);

  if (failedTests === 0) {
    console.log(`${colors.green}🎉 Tous les tests sont passés avec succès !${colors.reset}\n`);
  } else {
    console.log(`${colors.yellow}⚠️  Certains tests ont échoué. Vérifiez les logs ci-dessus.${colors.reset}\n`);
  }
}

/**
 * Main
 */
async function main() {
  const token = process.argv[2];

  if (!token) {
    console.error(`${colors.red}❌ Erreur: Token Firebase manquant${colors.reset}`);
    console.log(`\nUsage: node test-chatbot.js <FIREBASE_TOKEN>\n`);
    console.log(`Pour obtenir un token Firebase:`);
    console.log(`1. Ouvrez l'application mobile`);
    console.log(`2. Ajoutez ce code temporaire dans votre app:`);
    console.log(`   const token = await auth.currentUser?.getIdToken();`);
    console.log(`   console.log('TOKEN:', token);`);
    console.log(`3. Copiez le token et exécutez ce script\n`);
    process.exit(1);
  }

  console.log(`${colors.cyan}🔑 Token Firebase détecté (${token.substring(0, 20)}...)${colors.reset}`);
  console.log(`${colors.cyan}🌐 Backend URL: ${BACKEND_URL}${colors.reset}\n`);

  try {
    await runTests(token);
  } catch (error) {
    console.error(`${colors.red}❌ Erreur fatale: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

main();
