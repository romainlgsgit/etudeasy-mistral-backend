/**
 * TEST EXHAUSTIF DU CHATBOT ETUDEASY
 *
 * Ce script teste tous les scénarios possibles:
 * - Placement jours de la semaine
 * - Placement weekend
 * - Expressions relatives (demain, après-demain)
 * - Moments de la journée (matin, après-midi, soir)
 * - Types d'événements (révision, sport, activité)
 * - Formulations variées
 */

const RENDER_URL = 'https://etudeasy-mistral-backend.onrender.com';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImY3NThlNTYzYzBiNjRhNzVmN2UzZGFlNDk0ZDM5NTk1YzE0MGVmOTMiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiSmVhbiBNaWNoZWwiLCJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vZXR1ZGVhc3ktZDhkYzciLCJhdWQiOiJldHVkZWFzeS1kOGRjNyIsImF1dGhfdGltZSI6MTc2OTgwMjQ1OCwidXNlcl9pZCI6ImszQlc5UUl0Vm5nYUtLRUFNeTlDTXZpaXRnQzIiLCJzdWIiOiJrM0JXOVFJdFZuZ2FLS0VBTXk5Q012aWl0Z0MyIiwiaWF0IjoxNzcwMDQ5NTU1LCJleHAiOjE3NzAwNTMxNTUsImVtYWlsIjoidGVzdDEyM0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsidGVzdDEyM0BnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.iVF0HWbTkhGLSSRAfkOGZ2TgdLOc-msBqu5OwhBsnbCtDYGUOLsvweFQjfeIcMOQmiBmrzg16Y5_-SJgOtDmw62rJZhjuBUhmrvQllZenPwSn7kGO1Yr2vZoVOukj5hUaTuECCC04Sg78FA_10IFdPnwDMGkTrCQi_JAkAe2eARhM_77HrNf80s57I9V3N4ENQ_se2MewmyPm6PfQqWboy_p2XPkfQFtuSNOs6ps6NVt79bQO8KENSzk1SoXqSA3ZBgzz4l7vlHEUTpqHmo3oGCDyzxLY-NMwY7i_uOiTrU9-M50OYAE8fX-57BMH1IwlxVWlJngX9smr0DM2qyZJA';

// Date actuelle pour référence
const NOW = new Date('2026-02-02'); // Lundi 2 février 2026
const DAYS = {
  'lundi': '2026-02-02', // Aujourd'hui
  'mardi': '2026-02-03',
  'mercredi': '2026-02-04',
  'jeudi': '2026-02-05',
  'vendredi': '2026-02-06',
  'samedi': '2026-02-07',
  'dimanche': '2026-02-08', // Prochain dimanche
  'lundi_prochain': '2026-02-09' // Prochain lundi
};

// Scénarios de test
const TEST_SCENARIOS = [
  // === JOURS DE LA SEMAINE ===
  {
    category: 'Jours de la semaine',
    message: 'Place-moi une révision de maths lundi',
    expectedDate: DAYS.lundi_prochain, // Lundi prochain car aujourd'hui est lundi
    expectedDay: 'lundi',
    expectedType: 'study'
  },
  {
    category: 'Jours de la semaine',
    message: 'Ajoute un cours de physique mardi',
    expectedDate: DAYS.mardi,
    expectedDay: 'mardi',
    expectedType: 'course'
  },
  {
    category: 'Jours de la semaine',
    message: 'Je veux réviser mercredi',
    expectedDate: DAYS.mercredi,
    expectedDay: 'mercredi',
    expectedType: 'study'
  },
  {
    category: 'Jours de la semaine',
    message: 'Mets-moi une séance de sport jeudi',
    expectedDate: DAYS.jeudi,
    expectedDay: 'jeudi',
    expectedType: 'activity'
  },
  {
    category: 'Jours de la semaine',
    message: 'Planifie une révision vendredi',
    expectedDate: DAYS.vendredi,
    expectedDay: 'vendredi',
    expectedType: 'study'
  },

  // === WEEKEND ===
  {
    category: 'Weekend',
    message: 'Ajoute un cours de sport samedi',
    expectedDate: DAYS.samedi,
    expectedDay: 'samedi',
    expectedType: 'activity'
  },
  {
    category: 'Weekend',
    message: 'Place une révision dimanche matin',
    expectedDate: DAYS.dimanche,
    expectedDay: 'dimanche',
    expectedType: 'study',
    expectedTime: 'morning'
  },

  // === EXPRESSIONS RELATIVES ===
  {
    category: 'Expressions relatives',
    message: 'Ajoute une révision demain',
    expectedDate: '2026-02-03', // Demain = mardi
    expectedDay: 'mardi',
    expectedType: 'study'
  },
  {
    category: 'Expressions relatives',
    message: 'Place un cours de sport après-demain',
    expectedDate: '2026-02-04', // Après-demain = mercredi
    expectedDay: 'mercredi',
    expectedType: 'activity'
  },

  // === MOMENTS DE LA JOURNÉE ===
  {
    category: 'Moments de la journée',
    message: 'Place-moi une révision lundi matin',
    expectedDate: DAYS.lundi_prochain, // Lundi prochain
    expectedDay: 'lundi',
    expectedTime: 'morning',
    expectedType: 'study'
  },
  {
    category: 'Moments de la journée',
    message: 'Ajoute un cours de sport mardi après-midi',
    expectedDate: DAYS.mardi,
    expectedDay: 'mardi',
    expectedTime: 'afternoon',
    expectedType: 'activity'
  },
  {
    category: 'Moments de la journée',
    message: 'Je veux réviser mercredi soir',
    expectedDate: DAYS.mercredi,
    expectedDay: 'mercredi',
    expectedTime: 'evening',
    expectedType: 'study'
  },

  // === FORMULATIONS VARIÉES ===
  {
    category: 'Formulations variées',
    message: 'Peux-tu me placer une révision jeudi s\'il te plaît ?',
    expectedDate: DAYS.jeudi,
    expectedDay: 'jeudi',
    expectedType: 'study'
  },
  {
    category: 'Formulations variées',
    message: 'J\'aimerais bien réviser vendredi',
    expectedDate: DAYS.vendredi,
    expectedDay: 'vendredi',
    expectedType: 'study'
  },
  {
    category: 'Formulations variées',
    message: 'Trouve-moi un créneau samedi pour le sport',
    expectedDate: DAYS.samedi,
    expectedDay: 'samedi',
    expectedType: 'activity'
  },

  // === TYPES D'ÉVÉNEMENTS VARIÉS ===
  {
    category: 'Types d\'événements',
    message: 'Ajoute une séance de révision de français lundi',
    expectedDate: DAYS.lundi_prochain, // Lundi prochain
    expectedDay: 'lundi',
    expectedType: 'study',
    expectedSubject: 'français'
  },
  {
    category: 'Types d\'événements',
    message: 'Planifie un cours de guitare mardi',
    expectedDate: DAYS.mardi,
    expectedDay: 'mardi',
    expectedType: 'activity'
  },
  {
    category: 'Types d\'événements',
    message: 'Place-moi une activité de lecture mercredi',
    expectedDate: DAYS.mercredi,
    expectedDay: 'mercredi',
    expectedType: 'activity'
  }
];

// Fonction pour envoyer un message au chatbot
async function sendMessage(message) {
  try {
    const response = await fetch(`${RENDER_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: message
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi du message:', error.message);
    return null;
  }
}

// Fonction pour vérifier si un événement a été créé avec les bonnes propriétés
function verifyEvent(response, expected) {
  if (!response || !response.message) {
    return { success: false, error: 'Pas de réponse du serveur' };
  }

  const responseText = response.message.toLowerCase();

  // Vérifier que l'événement a été placé (succès)
  const isSuccess = responseText.includes('placé') ||
                    responseText.includes('ajouté') ||
                    responseText.includes('créé') ||
                    responseText.includes('planifié');

  if (!isSuccess) {
    return { success: false, error: 'L\'IA n\'a pas confirmé la création de l\'événement' };
  }

  // Vérifier le jour (si spécifié)
  if (expected.expectedDay) {
    const hasDayName = responseText.includes(expected.expectedDay);
    if (!hasDayName) {
      return { success: false, error: `Le jour "${expected.expectedDay}" n'est pas mentionné dans la réponse` };
    }
  }

  return { success: true };
}

// Fonction pour afficher les résultats
function displayResults(results) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 RÉSUMÉ DES TESTS');
  console.log('='.repeat(80));

  const total = results.length;
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\nTotal: ${total} tests`);
  console.log(`✅ Réussis: ${passed} (${Math.round(passed/total*100)}%)`);
  console.log(`❌ Échoués: ${failed} (${Math.round(failed/total*100)}%)`);

  // Grouper par catégorie
  const byCategory = {};
  results.forEach(r => {
    if (!byCategory[r.category]) {
      byCategory[r.category] = { passed: 0, failed: 0 };
    }
    if (r.success) {
      byCategory[r.category].passed++;
    } else {
      byCategory[r.category].failed++;
    }
  });

  console.log('\n📁 Résultats par catégorie:');
  Object.keys(byCategory).forEach(cat => {
    const stats = byCategory[cat];
    const total = stats.passed + stats.failed;
    const percent = Math.round(stats.passed / total * 100);
    console.log(`  ${cat}: ${stats.passed}/${total} (${percent}%) ✅`);
  });

  // Afficher les tests échoués
  const failedTests = results.filter(r => !r.success);
  if (failedTests.length > 0) {
    console.log('\n❌ Tests échoués:');
    failedTests.forEach(test => {
      console.log(`\n  Message: "${test.message}"`);
      console.log(`  Catégorie: ${test.category}`);
      console.log(`  Erreur: ${test.error}`);
      if (test.response) {
        console.log(`  Réponse IA: "${test.response.substring(0, 100)}..."`);
      }
    });
  }

  console.log('\n' + '='.repeat(80));

  return { total, passed, failed, successRate: passed/total };
}

// Fonction principale
async function runTests() {
  console.log('🚀 DÉMARRAGE DES TESTS EXHAUSTIFS');
  console.log('='.repeat(80));
  console.log(`📅 Date de référence: ${NOW.toLocaleDateString('fr-FR')}`);
  console.log(`🔗 API: ${RENDER_URL}`);
  console.log(`📝 Nombre de scénarios: ${TEST_SCENARIOS.length}`);
  console.log('='.repeat(80));
  console.log();

  const results = [];

  for (let i = 0; i < TEST_SCENARIOS.length; i++) {
    const test = TEST_SCENARIOS[i];

    console.log(`\n[${i+1}/${TEST_SCENARIOS.length}] 🧪 Test: ${test.category}`);
    console.log(`   Message: "${test.message}"`);
    console.log(`   Jour attendu: ${test.expectedDay} (${test.expectedDate})`);

    // Envoyer le message
    const response = await sendMessage(test.message);

    // Attendre un peu pour éviter de surcharger l'API
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (!response || !response.message) {
      console.log('   ❌ ÉCHEC: Pas de réponse du serveur');
      results.push({
        ...test,
        success: false,
        error: 'Pas de réponse du serveur',
        response: null
      });
      continue;
    }

    // Vérifier la réponse
    const verification = verifyEvent(response, test);

    if (verification.success) {
      console.log('   ✅ SUCCÈS');
      console.log(`   Réponse: "${response.message.substring(0, 80)}..."`);
      results.push({
        ...test,
        success: true,
        response: response.message
      });
    } else {
      console.log(`   ❌ ÉCHEC: ${verification.error}`);
      console.log(`   Réponse: "${response.message.substring(0, 80)}..."`);
      results.push({
        ...test,
        success: false,
        error: verification.error,
        response: response.message
      });
    }
  }

  // Afficher les résultats
  const summary = displayResults(results);

  // Retourner le taux de succès
  return summary.successRate;
}

// Exécuter les tests
runTests()
  .then(successRate => {
    if (successRate >= 0.9) {
      console.log('\n🎉 EXCELLENT! Le chatbot fonctionne à plus de 90%');
      process.exit(0);
    } else if (successRate >= 0.75) {
      console.log('\n⚠️  BON mais des améliorations sont nécessaires (75-90%)');
      process.exit(1);
    } else {
      console.log('\n❌ INSUFFISANT! Des corrections majeures sont nécessaires (<75%)');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 ERREUR FATALE:', error);
    process.exit(1);
  });
