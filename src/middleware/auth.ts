/**
 * Middleware d'authentification Firebase
 */

import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

/**
 * Vérifie le token Firebase dans les headers
 */
export async function verifyFirebaseToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'unauthenticated',
      message: 'Token Firebase requis',
    });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.userId = decodedToken.uid;
    next();
  } catch (error) {
    console.error('Erreur vérification token:', error);
    return res.status(401).json({
      error: 'unauthenticated',
      message: 'Token Firebase invalide',
    });
  }
}
