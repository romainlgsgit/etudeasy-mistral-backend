/**
 * Test simple pour debug avec logs détaillés
 */

const RENDER_URL = 'https://etudeasy-mistral-backend.onrender.com';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImY3NThlNTYzYzBiNjRhNzVmN2UzZGFlNDk0ZDM5NTk1YzE0MGVmOTMiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiSmVhbiBNaWNoZWwiLCJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vZXR1ZGVhc3ktZDhkYzciLCJhdWQiOiJldHVkZWFzeS1kOGRjNyIsImF1dGhfdGltZSI6MTc2OTgwMjQ1OCwidXNlcl9pZCI6ImszQlc5UUl0Vm5nYUtLRUFNeTlDTXZpaXRnQzIiLCJzdWIiOiJrM0JXOVFJdFZuZ2FLS0VBTXk5Q012aWl0Z0MyIiwiaWF0IjoxNzcwMDQ5NTU1LCJleHAiOjE3NzAwNTMxNTUsImVtYWlsIjoidGVzdDEyM0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsidGVzdDEyM0BnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.iVF0HWbTkhGLSSRAfkOGZ2TgdLOc-msBqu5OwhBsnbCtDYGUOLsvweFQjfeIcMOQmiBmrzg16Y5_-SJgOtDmw62rJZhjuBUhmrvQllZenPwSn7kGO1Yr2vZoVOukj5hUaTuECCC04Sg78FA_10IFdPnwDMGkTrCQi_JAkAe2eARhM_77HrNf80s57I9V3N4ENQ_se2MewmyPm6PfQqWboy_p2XPkfQFtuSNOs6ps6NVt79bQO8KENSzk1SoXqSA3ZBgzz4l7vlHEUTpqHmo3oGCDyzxLY-NMwY7i_uOiTrU9-M50OYAE8fX-57BMH1IwlxVWlJngX9smr0DM2qyZJA';

// Test message
const TEST_MESSAGE = 'Place-moi une révision jeudi';

async function testWithDebug() {
  console.log('🧪 TEST DEBUG');
  console.log('='.repeat(80));
  console.log(`📅 Date actuelle: ${new Date().toLocaleDateString('fr-FR')}`);
  console.log(`📝 Message: "${TEST_MESSAGE}"`);
  console.log(`🎯 Attendu: jeudi 2026-02-05`);
  console.log('='.repeat(80));
  console.log();

  console.log('📤 Envoi de la requête...');

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
            content: TEST_MESSAGE
          }
        ]
      })
    });

    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
      process.exit(1);
    }

    const data = await response.json();

    console.log('📥 Réponse reçue:\n');
    console.log(JSON.stringify(data, null, 2));
    console.log();
    console.log('='.repeat(80));
    console.log('💬 Réponse IA:');
    console.log(data.message);
    console.log('='.repeat(80));

    // Analyser la réponse
    const hasJeudi = data.message.toLowerCase().includes('jeudi');
    const hasMardi = data.message.toLowerCase().includes('mardi');
    const has2026_02_05 = data.message.includes('2026-02-05') || data.message.includes('05');

    console.log();
    console.log('🔍 Analyse:');
    console.log(`   Contient "jeudi": ${hasJeudi ? '✅' : '❌'}`);
    console.log(`   Contient "mardi": ${hasMardi ? '⚠️' : '✅'}`);
    console.log(`   Contient date 05: ${has2026_02_05 ? '✅' : '❌'}`);

    if (hasJeudi && !hasMardi) {
      console.log('\n✅ TEST RÉUSSI!');
      process.exit(0);
    } else {
      console.log('\n❌ TEST ÉCHOUÉ!');
      if (hasMardi) {
        console.log('   ⚠️  Événement placé sur MARDI au lieu de JEUDI');
      }
      if (!hasJeudi) {
        console.log('   ⚠️  Le mot "jeudi" n\'apparaît pas dans la réponse');
      }
      process.exit(1);
    }

  } catch (error) {
    console.error('💥 Erreur:', error);
    process.exit(1);
  }
}

// Exécuter le test
console.log('🚀 Démarrage du test de debug...\n');
testWithDebug();
