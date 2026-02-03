/**
 * Test pour vérifier que la fenêtre de 8 jours est bien déployée
 * Samedi prochain (2026-02-07) devrait être inclus dans l'analyse
 */

const RENDER_URL = 'https://etudeasy-mistral-backend.onrender.com';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImY3NThlNTYzYzBiNjRhNzVmN2UzZGFlNDk0ZDM5NTk1YzE0MGVmOTMiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiSmVhbiBNaWNoZWwiLCJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vZXR1ZGVhc3ktZDhkYzciLCJhdWQiOiJldHVkZWFzeS1kOGRjNyIsImF1dGhfdGltZSI6MTc2OTgwMjQ1OCwidXNlcl9pZCI6ImszQlc5UUl0Vm5nYUtLRUFNeTlDTXZpaXRnQzIiLCJzdWIiOiJrM0JXOVFJdFZuZ2FLS0VBTXk5Q012aWl0Z0MyIiwiaWF0IjoxNzcwMDQ5NTU1LCJleHAiOjE3NzAwNTMxNTUsImVtYWlsIjoidGVzdDEyM0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsidGVzdDEyM0BnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.iVF0HWbTkhGLSSRAfkOGZ2TgdLOc-msBqu5OwhBsnbCtDYGUOLsvweFQjfeIcMOQmiBmrzg16Y5_-SJgOtDmw62rJZhjuBUhmrvQllZenPwSn7kGO1Yr2vZoVOukj5hUaTuECCC04Sg78FA_10IFdPnwDMGkTrCQi_JAkAe2eARhM_77HrNf80s57I9V3N4ENQ_se2MewmyPm6PfQqWboy_p2XPkfQFtuSNOs6ps6NVt79bQO8KENSzk1SoXqSA3ZBgzz4l7vlHEUTpqHmo3oGCDyzxLY-NMwY7i_uOiTrU9-M50OYAE8fX-57BMH1IwlxVWlJngX9smr0DM2qyZJA';

async function testWindowSize() {
  console.log('🧪 TEST: FENÊTRE D\'ANALYSE 8 JOURS');
  console.log('='.repeat(80));
  console.log('📅 Aujourd\'hui: Lundi 2 février 2026');
  console.log('🎯 Objectif: Vérifier que samedi 7 février est inclus dans l\'analyse');
  console.log('='.repeat(80));
  console.log();

  const testMessage = 'Ajoute un cours de sport samedi';

  console.log(`📝 Message test: "${testMessage}"`);
  console.log('🔍 Attendu: Événement placé samedi 2026-02-07');
  console.log();

  try {
    const response = await fetch(`${RENDER_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: testMessage }]
      })
    });

    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}`);
      return false;
    }

    const data = await response.json();

    console.log('📥 Réponse reçue');
    console.log();

    // Analyser les tool calls
    if (data.toolCalls && data.toolCalls.length > 0) {
      const toolCall = data.toolCalls[0];
      const args = JSON.parse(toolCall.function.arguments);

      console.log('🔧 Tool call:');
      console.log(`   Function: ${toolCall.function.name}`);
      console.log(`   Target Date: ${args.preferences?.targetDate || 'non spécifié'}`);
      console.log();
    }

    console.log('💬 Réponse IA:');
    console.log(`   "${data.message}"`);
    console.log();

    // Vérifier si samedi est mentionné
    const hasSamedi = data.message.toLowerCase().includes('samedi');
    const has2026_02_07 = data.message.includes('2026-02-07') || data.message.includes('07/02') || data.message.includes('07-02');

    console.log('🔍 Analyse:');
    console.log(`   Contient "samedi": ${hasSamedi ? '✅' : '❌'}`);
    console.log(`   Contient date 07/02: ${has2026_02_07 ? '✅' : '❌'}`);
    console.log();

    if (hasSamedi) {
      console.log('✅ SUCCÈS: La fenêtre de 8 jours semble fonctionner!');
      console.log('   Samedi prochain est bien inclus dans l\'analyse.');
      return true;
    } else {
      console.log('❌ ÉCHEC: Samedi n\'est pas dans la réponse');
      console.log('   La fenêtre de 8 jours n\'est peut-être pas déployée.');
      return false;
    }

  } catch (error) {
    console.error('💥 Erreur:', error.message);
    return false;
  }
}

console.log('🚀 Démarrage du test de la fenêtre 8 jours...\n');
testWindowSize()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((error) => {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
  });
