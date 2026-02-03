/**
 * Test spécifique pour jeudi (probablement complètement plein)
 */

const RENDER_URL = 'https://etudeasy-mistral-backend.onrender.com';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImY3NThlNTYzYzBiNjRhNzVmN2UzZGFlNDk0ZDM5NTk1YzE0MGVmOTMiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiSmVhbiBNaWNoZWwiLCJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vZXR1ZGVhc3ktZDhkYzciLCJhdWQiOiJldHVkZWFzeS1kOGRjNyIsImF1dGhfdGltZSI6MTc2OTgwMjQ1OCwidXNlcl9pZCI6ImszQlc5UUl0Vm5nYUtLRUFNeTlDTXZpaXRnQzIiLCJzdWIiOiJrM0JXOVFJdFZuZ2FLS0VBTXk5Q012aWl0Z0MyIiwiaWF0IjoxNzcwMDQ5NTU1LCJleHAiOjE3NzAwNTMxNTUsImVtYWlsIjoidGVzdDEyM0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsidGVzdDEyM0BnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.iVF0HWbTkhGLSSRAfkOGZ2TgdLOc-msBqu5OwhBsnbCtDYGUOLsvweFQjfeIcMOQmiBmrzg16Y5_-SJgOtDmw62rJZhjuBUhmrvQllZenPwSn7kGO1Yr2vZoVOukj5hUaTuECCC04Sg78FA_10IFdPnwDMGkTrCQi_JAkAe2eARhM_77HrNf80s57I9V3N4ENQ_se2MewmyPm6PfQqWboy_p2XPkfQFtuSNOs6ps6NVt79bQO8KENSzk1SoXqSA3ZBgzz4l7vlHEUTpqHmo3oGCDyzxLY-NMwY7i_uOiTrU9-M50OYAE8fX-57BMH1IwlxVWlJngX9smr0DM2qyZJA';

async function testJeudi() {
  console.log('🧪 TEST: JEUDI (Probablement Complet)');
  console.log('='.repeat(80));
  console.log('📝 Message: "Mets-moi une séance de sport jeudi"');
  console.log('🎯 Si jeudi est complet, attendu: Proposition d\'alternatives');
  console.log('='.repeat(80));
  console.log();

  try {
    const response = await fetch(`${RENDER_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Mets-moi une séance de sport jeudi' }]
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

    const responseText = data.message.toLowerCase();

    const hasJeudi = responseText.includes('jeudi');
    const hasMardi = responseText.includes('mardi');
    const hasSamedi = responseText.includes('samedi');
    const hasComplet = responseText.includes('complet') ||
                      responseText.includes('plein') ||
                      responseText.includes('aucun créneau') ||
                      responseText.includes('pas de créneau') ||
                      responseText.includes('disponible');
    const hasAlternatives = (responseText.includes('propose') ||
                            responseText.includes('alternative') ||
                            responseText.includes('plutôt')) &&
                           (responseText.includes('vendredi') ||
                            responseText.includes('samedi') ||
                            responseText.includes('dimanche'));

    console.log('🔍 Analyse:');
    console.log(`   Contient "jeudi": ${hasJeudi ? '✅' : '❌'}`);
    console.log(`   Contient "mardi": ${hasMardi ? '⚠️ (placé sur mauvais jour)' : '✅'}`);
    console.log(`   Contient "samedi": ${hasSamedi ? '⚠️' : '✅'}`);
    console.log(`   Informe sur disponibilité: ${hasComplet ? '✅' : '⚠️'}`);
    console.log(`   Propose alternatives: ${hasAlternatives ? '✅' : '❌'}`);
    console.log();

    // Scénarios possibles
    if (hasJeudi && !hasMardi && !hasSamedi) {
      console.log('✅ PARFAIT: Événement placé jeudi comme demandé');
      console.log('   → Jeudi a des créneaux disponibles');
      return true;
    } else if (hasComplet && hasAlternatives) {
      console.log('✅ EXCELLENT: Jeudi est complet, alternatives proposées');
      console.log('   → Nouveau comportement fonctionne!');
      return true;
    } else if ((hasMardi || hasSamedi) && !hasComplet && !hasAlternatives) {
      console.log('❌ ÉCHEC: Placé sur autre jour sans informer');
      console.log('   → Ancien comportement (bug toujours présent)');
      return false;
    } else if ((hasMardi || hasSamedi) && hasComplet) {
      console.log('⚠️  PARTIEL: Informe que jeudi est complet mais place quand même ailleurs');
      console.log('   → Mieux mais pas parfait');
      return true;
    } else {
      console.log('⚠️  COMPORTEMENT NON CATÉGORISÉ');
      return false;
    }

  } catch (error) {
    console.error('💥 Erreur:', error.message);
    return false;
  }
}

console.log('🚀 Test jeudi...\n');
testJeudi()
  .then((success) => {
    console.log();
    console.log('='.repeat(80));
    console.log(success ? '✅ TEST RÉUSSI' : '❌ TEST ÉCHOUÉ');
    console.log('='.repeat(80));
    process.exit(success ? 0 : 1);
  });
