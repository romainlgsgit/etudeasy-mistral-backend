/**
 * Backend Express.js pour Mistral AI - EtudEasy
 * Alternative gratuite à Firebase Functions
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import { chatWithMistralHandler } from './handlers/chatHandler';
import { verifyFirebaseToken } from './middleware/auth';

// Charger les variables d'environnement
dotenv.config();

// Initialiser Firebase Admin avec credentials
if (admin.apps.length === 0) {
  try {
    // En production (Render), utilise les credentials depuis env variable
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || 'etudeasy-d8dc7',
      });
      console.log('✅ Firebase Admin initialisé avec service account');
    } else {
      // En local, essaie sans credentials (Application Default Credentials)
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'etudeasy-d8dc7',
      });
      console.log('✅ Firebase Admin initialisé (mode local)');
    }
  } catch (error) {
    console.error('❌ Erreur initialisation Firebase:', error);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Route de santé
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'EtudEasy Mistral AI Backend',
    timestamp: new Date().toISOString(),
  });
});

// Route principale - Chat avec Mistral AI
app.post('/chat', verifyFirebaseToken, chatWithMistralHandler);

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📡 Endpoint: http://localhost:${PORT}/chat`);
  console.log(`🔑 Mistral API Key configurée: ${process.env.MISTRAL_API_KEY ? '✓' : '✗'}`);
});

export default app;
