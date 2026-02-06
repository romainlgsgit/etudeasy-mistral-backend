const TOKEN = process.argv[2];

async function testNextWeek() {
  console.log('🧪 Test: "la semaine prochaine place-moi 2 cours de sport vendredi et samedi"\n');
  console.log('📅 Aujourd\'hui:', new Date().toISOString().split('T')[0]);
  
  // Calculer les dates attendues
  const today = new Date();
  const thisWeekFriday = new Date(today);
  const daysUntilFriday = (5 - today.getDay() + 7) % 7;
  thisWeekFriday.setDate(today.getDate() + daysUntilFriday);
  
  const nextWeekFriday = new Date(thisWeekFriday);
  nextWeekFriday.setDate(nextWeekFriday.getDate() + 7);
  
  const nextWeekSaturday = new Date(nextWeekFriday);
  nextWeekSaturday.setDate(nextWeekFriday.getDate() + 1);
  
  console.log('📅 Vendredi cette semaine:', thisWeekFriday.toISOString().split('T')[0]);
  console.log('📅 Vendredi semaine prochaine (attendu):', nextWeekFriday.toISOString().split('T')[0]);
  console.log('📅 Samedi semaine prochaine (attendu):', nextWeekSaturday.toISOString().split('T')[0]);
  console.log('');

  const response = await fetch('https://etudeasy-mistral-backend.onrender.com/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'la semaine prochaine place-moi 2 cours de sport vendredi et samedi' }]
    }),
  });

  const data = await response.json();
  console.log('✅ Réponse:', data.message);

  if (data.toolCalls && data.toolCalls.length > 0) {
    console.log('\n📅 Tool calls:');
    data.toolCalls.forEach((tc, i) => {
      if (tc.function.name === 'auto_place_event') {
        const args = JSON.parse(tc.function.arguments);
        const targetDate = args.preferences?.targetDate;
        console.log(`  ${i+1}. ${tc.function.name}`);
        console.log(`     targetDate: ${targetDate}`);
        
        // Vérifier si c'est la bonne semaine
        if (targetDate === nextWeekFriday.toISOString().split('T')[0] || 
            targetDate === nextWeekSaturday.toISOString().split('T')[0]) {
          console.log('     ✅ CORRECT - Semaine prochaine!');
        } else if (targetDate === thisWeekFriday.toISOString().split('T')[0]) {
          console.log('     ❌ FAUX - C\'est cette semaine!');
        }
      }
    });
  } else {
    console.log('\n⚠️ Pas de tool calls');
  }
}

testNextWeek().catch(console.error);
