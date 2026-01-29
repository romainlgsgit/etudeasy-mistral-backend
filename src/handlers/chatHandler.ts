/**
 * Handler pour la route /chat
 * Reprend la logique de Firebase Functions
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { getUserContext } from '../services/context';
import { buildSystemPrompt, callMistralAPI } from '../services/mistral';
import { handleToolCalls } from '../services/tools';
import { checkRateLimit } from '../services/rateLimit';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function chatWithMistralHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  const userId = req.userId!;
  const { messages } = req.body as { messages: ChatMessage[] };

  // Validation
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({
      error: 'invalid-argument',
      message: 'Le paramètre messages est requis et doit être un tableau',
    });
  }

  // Rate limiting
  const withinLimit = await checkRateLimit(userId);
  if (!withinLimit) {
    return res.status(429).json({
      error: 'resource-exhausted',
      message: 'Limite quotidienne de messages atteinte (50/jour). Réessayez demain.',
    });
  }

  try {
    // 1. Construire le contexte utilisateur
    console.log(`[Chat] Construction contexte pour ${userId}`);
    const userContext = await getUserContext(userId);

    // 2. Préparer le prompt système
    const systemPrompt = buildSystemPrompt(userContext);
    const systemMessage: ChatMessage = {
      role: 'system',
      content: systemPrompt,
    };

    // 3. Appeler Mistral API
    console.log('[Chat] Appel Mistral API');
    const mistralResponse = await callMistralAPI([systemMessage, ...messages]);

    const assistantMessage = mistralResponse.choices[0].message;

    // 4. Gérer les tool calls si présents
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log(`[Chat] ${assistantMessage.tool_calls.length} tool call(s) à exécuter`);

      // Exécuter les tool calls
      const toolResults = await handleToolCalls(assistantMessage.tool_calls, userId);

      // Deuxième appel à Mistral avec les résultats
      console.log('[Chat] Deuxième appel Mistral avec résultats tools');
      const finalResponse = await callMistralAPI([
        systemMessage,
        ...messages,
        assistantMessage,
        ...toolResults,
      ]);

      const finalMessage = finalResponse.choices[0].message;

      return res.json({
        message: finalMessage.content,
        toolCalls: assistantMessage.tool_calls,
        success: true,
      });
    }

    // 5. Retour simple si pas de tool calls
    return res.json({
      message: assistantMessage.content,
      success: true,
    });
  } catch (error: any) {
    console.error('[Chat] Erreur:', error);

    return res.json({
      message:
        'Je rencontre une difficulté technique temporaire. Peux-tu reformuler ta demande ?',
      error: error.message,
      success: false,
    });
  }
}
