/**
 * Test du parser de dates en local
 */

// Importer le parser compilé
const { parseDateFromMessage } = require('./dist/services/dateParser');

console.log('🧪 Test du parser de dates\n');
console.log('📅 Date actuelle:', new Date().toISOString().split('T')[0]);
console.log('📅 Jour actuel:', ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][new Date().getDay()]);
console.log('\n' + '='.repeat(80) + '\n');

const tests = [
  'Place-moi une révision jeudi',
  'Ajoute un cours de sport samedi',
  'Je préfère plutôt mercredi',
  'Place-moi une révision demain',
  'Ajoute un cours de sport en fin d\'après-midi',
];

tests.forEach(message => {
  console.log(`📝 Message: "${message}"`);
  const result = parseDateFromMessage(message);
  console.log('   Résultat:', JSON.stringify(result, null, 2));
  console.log('');
});
