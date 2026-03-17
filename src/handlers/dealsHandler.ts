import { Request, Response } from 'express';
import { getWeeklyDeals } from '../services/dealsService';

export async function getDealsHandler(req: Request, res: Response): Promise<void> {
  try {
    const deals = await getWeeklyDeals();
    res.json({ deals });
  } catch (error) {
    console.error('[DealsHandler] Erreur:', error);
    res.status(500).json({ error: 'Impossible de récupérer les bons plans' });
  }
}
