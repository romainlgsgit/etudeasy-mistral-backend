const TOKEN = process.argv[2];

async function testSingle() {
  console.log('🧪 Test simple: "Place-moi une révision jeudi"\n');

  const response = await fetch('https://etudeasy-mistral-backend.onrender.com/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Place-moi une révision jeudi' }]
    }),
  });

  const data = await response.json();
  console.log('✅ Réponse:', data.message);

  if (data.toolCalls && data.toolCalls.length > 0) {
    data.toolCalls.forEach(tc => {
      if (tc.function.name === 'auto_place_event') {
        const args = JSON.parse(tc.function.arguments);
        console.log('\n📅 Tool call:', tc.function.name);
        console.log('   targetDate:', args.preferences?.targetDate);
        console.log('   Attendu: 2026-02-05 (jeudi prochain)');
      }
    });
  }
}

testSingle().catch(console.error);
