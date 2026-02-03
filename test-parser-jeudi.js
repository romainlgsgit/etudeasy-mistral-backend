import { parseDateFromMessage } from './src/services/dateParser.js';

const message = 'Place-moi une révision jeudi';
console.log('📅 Date actuelle:', new Date().toLocaleDateString('fr-FR'));
console.log('📝 Message:', message);
console.log();

const result = parseDateFromMessage(message);
console.log('📊 Résultat parser:');
console.log(JSON.stringify(result, null, 2));
console.log();

if (result.targetDate === '2026-02-05') {
  console.log('✅ Parser fonctionne correctement! (2026-02-05 = jeudi)');
} else {
  console.log(`❌ Parser BUGUÉ! Attendu: 2026-02-05, Obtenu: ${result.targetDate}`);
}
