/**
 * Backend Express.js pour Mistral AI - EtudEasy
 * Alternative gratuite à Firebase Functions
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { chatWithMistralHandler } from './handlers/chatHandler';
import { chatWithAgentHandler } from './handlers/agentHandler';
import { generateExamHandler, evaluateAnswerHandler } from './handlers/examHandler';
import { planningRequestHandler } from './handlers/planHandler';
import { verifyFirebaseToken } from './middleware/auth';

// Charger les variables d'environnement
dotenv.config();

// Initialiser Firebase Admin avec credentials
if (admin.apps.length === 0) {
  try {
    // En production (Render), utilise les credentials depuis env variable JSON
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || 'etudeasy-d8dc7',
      });
      console.log('✅ Firebase Admin initialisé avec service account (JSON)');
    }
    // En local, utilise le fichier de service account
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const credPath = path.resolve(__dirname, '..', process.env.GOOGLE_APPLICATION_CREDENTIALS);
      const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || 'etudeasy-d8dc7',
      });
      console.log('✅ Firebase Admin initialisé avec service account (fichier)');
    }
    // Sinon, essaie sans credentials (Application Default Credentials)
    else {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'etudeasy-d8dc7',
      });
      console.log('⚠️  Firebase Admin initialisé (mode local sans credentials)');
    }
  } catch (error) {
    console.error('❌ Erreur initialisation Firebase:', error);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Augmenter la limite pour les images
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Route de santé
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'EtudEasy Mistral AI Backend',
    timestamp: new Date().toISOString(),
  });
});

// Route principale - Chat avec Mistral AI (mode tool-calling)
app.post('/chat', verifyFirebaseToken, chatWithMistralHandler);

// Route Agent Mistral AI Studio (mode intelligent)
app.post('/chat-agent', verifyFirebaseToken, chatWithAgentHandler);

// Route pour générer des examens blancs
app.post('/generate-exam', verifyFirebaseToken, generateExamHandler);

// Route pour évaluer une réponse textuelle
app.post('/evaluate-answer', verifyFirebaseToken, evaluateAnswerHandler);

// Route planning IA : parse + génère créneaux + reformule
app.post('/plan', verifyFirebaseToken, planningRequestHandler);

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📡 Endpoint: http://localhost:${PORT}/chat`);
  console.log(`🔑 Mistral API Key configurée: ${process.env.MISTRAL_API_KEY ? '✓' : '✗'}`);
});

export default app;
