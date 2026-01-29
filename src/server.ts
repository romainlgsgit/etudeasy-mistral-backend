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

// Initialiser Firebase Admin
admin.initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID || 'etudeasy-d8dc7',
});

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
