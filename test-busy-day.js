/**
 * Test pour vérifier que le chatbot propose des alternatives
 * quand le jour demandé est plein
 */

const RENDER_URL = 'https://etudeasy-mistral-backend.onrender.com';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImY3NThlNTYzYzBiNjRhNzVmN2UzZGFlNDk0ZDM5NTk1YzE0MGVmOTMiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiSmVhbiBNaWNoZWwiLCJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vZXR1ZGVhc3ktZDhkYzciLCJhdWQiOiJldHVkZWFzeS1kOGRjNyIsImF1dGhfdGltZSI6MTc2OTgwMjQ1OCwidXNlcl9pZCI6ImszQlc5UUl0Vm5nYUtLRUFNeTlDTXZpaXRnQzIiLCJzdWIiOiJrM0JXOVFJdFZuZ2FLS0VBTXk5Q012aWl0Z0MyIiwiaWF0IjoxNzcwMDQ5NTU1LCJleHAiOjE3NzAwNTMxNTUsImVtYWlsIjoidGVzdDEyM0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsidGVzdDEyM0BnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.iVF0HWbTkhGLSSRAfkOGZ2TgdLOc-msBqu5OwhBsnbCtDYGUOLsvweFQjfeIcMOQmiBmrzg16Y5_-SJgOtDmw62rJZhjuBUhmrvQllZenPwSn7kGO1Yr2vZoVOukj5hUaTuECCC04Sg78FA_10IFdPnwDMGkTrCQi_JAkAe2eARhM_77HrNf80s57I9V3N4ENQ_se2MewmyPm6PfQqWboy_p2XPkfQFtuSNOs6ps6NVt79bQO8KENSzk1SoXqSA3ZBgzz4l7vlHEUTpqHmo3oGCDyzxLY-NMwY7i_uOiTrU9-M50OYAE8fX-57BMH1IwlxVWlJngX9smr0DM2qyZJA';

async function testBusyDay() {
  console.log('🧪 TEST: CALENDRIER CHARGÉ - PROPOSITION D\'ALTERNATIVES');
  console.log('='.repeat(80));
  console.log('📅 Contexte: Le calendrier de test est plein sur certains jours');
  console.log('🎯 Objectif: Vérifier que le chatbot propose des alternatives');
  console.log('='.repeat(80));
  console.log();

  // Test 1: Mercredi (probablement plein)
  console.log('📝 TEST 1: "Je veux réviser mercredi"');
  console.log('   Attendu: Proposition d\'alternatives si mercredi est plein');
  console.log();

  try {
    const response = await fetch(`${RENDER_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Je veux réviser mercredi' }]
      })
    });

    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}`);
      return false;
    }

    const data = await response.json();
    console.log('📥 Réponse reçue:\n');
    console.log('💬 Réponse IA:');
    console.log(`"${data.message}"`);
    console.log();

    // Analyser la réponse
    const responseText = data.message.toLowerCase();

    const hasMercredi = responseText.includes('mercredi');
    const hasComplet = responseText.includes('complet') ||
                      responseText.includes('plein') ||
                      responseText.includes('aucun créneau') ||
                      responseText.includes('pas de créneau');
    const hasAlternatives = responseText.includes('jeudi') ||
                           responseText.includes('vendredi') ||
                           responseText.includes('propose');
    const hasAutoPlaced = responseText.includes('placé') ||
                         responseText.includes('ajouté');

    console.log('🔍 Analyse du comportement:');
    console.log(`   Mentionne "mercredi": ${hasMercredi ? '✅' : '❌'}`);
    console.log(`   Dit que mercredi est complet: ${hasComplet ? '✅' : '⚠️'}`);
    console.log(`   Propose des alternatives: ${hasAlternatives ? '✅' : '❌'}`);
    console.log(`   A placé automatiquement: ${hasAutoPlaced ? '❌ BAD' : '✅ GOOD'}`);
    console.log();

    // Vérifier le comportement attendu
    if (hasAutoPlaced && !hasComplet) {
      console.log('❌ ÉCHEC: Le chatbot a placé automatiquement sans informer');
      console.log('   → Ancien comportement (bug)');
      return false;
    } else if (hasComplet && hasAlternatives) {
      console.log('✅ SUCCÈS: Le chatbot informe que mercredi est complet');
      console.log('   → Et propose des alternatives');
      console.log('   → Nouveau comportement correct! 🎉');
      return true;
    } else if (hasAutoPlaced && hasComplet) {
      console.log('⚠️  PARTIEL: Le chatbot informe mais place quand même');
      console.log('   → Mieux que avant, mais peut être amélioré');
      return true;
    } else if (!hasComplet && !hasAutoPlaced) {
      console.log('✅ SUCCÈS: Mercredi a des créneaux disponibles');
      console.log('   → Le chatbot a trouvé un créneau mercredi');
      return true;
    } else {
      console.log('⚠️  INCONNU: Comportement non catégorisé');
      return false;
    }

  } catch (error) {
    console.error('💥 Erreur:', error.message);
    return false;
  }
}

console.log('🚀 Démarrage du test calendrier chargé...\n');
testBusyDay()
  .then((success) => {
    console.log();
    console.log('='.repeat(80));
    if (success) {
      console.log('✅ TEST RÉUSSI: Le comportement avec calendrier chargé est correct!');
    } else {
      console.log('❌ TEST ÉCHOUÉ: Le comportement nécessite encore des ajustements');
    }
    console.log('='.repeat(80));
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
  });
