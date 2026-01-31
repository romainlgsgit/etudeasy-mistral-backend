/**
 * Script pour obtenir un token Firebase de test
 * À exécuter dans l'app React Native
 */

// Ajoutez ce code temporairement dans votre app (par exemple dans App.tsx)
// et copiez le token qui s'affiche dans les logs

import { auth } from './config/firebase';

async function getTestToken() {
  try {
    const user = auth.currentUser;

    if (!user) {
      console.log('❌ Aucun utilisateur connecté. Connectez-vous d\'abord.');
      return;
    }

    const token = await user.getIdToken();

    console.log('='.repeat(80));
    console.log('🔑 TOKEN FIREBASE DE TEST');
    console.log('='.repeat(80));
    console.log(token);
    console.log('='.repeat(80));
    console.log('\nCopiez ce token et exécutez:');
    console.log(`node test-chatbot.js ${token}`);
    console.log('');

    return token;
  } catch (error) {
    console.error('Erreur:', error);
  }
}

// Appelez cette fonction
getTestToken();
