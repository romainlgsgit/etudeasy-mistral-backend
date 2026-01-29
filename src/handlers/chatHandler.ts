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

/**
 * Détecte si l'utilisateur confirme (oui, ok, d'accord)
 */
function isConfirmation(message: string): boolean {
  const lowerMsg = message.toLowerCase().trim();
  return /^(oui|ok|d'accord|ça me va|je veux|parfait|vas-y)/.test(lowerMsg);
}

/**
 * Extrait les informations d'horaire d'un message
 */
function extractTimeInfo(message: string): { startTime?: string; endTime?: string } | null {
  // Chercher des patterns comme "10h à 12h", "de 10h à 12h", "14h-16h"
  const timePattern = /(\d{1,2})h(?:\s*(?:à|-)\s*(\d{1,2})h)?/g;
  const matches = [...message.matchAll(timePattern)];

  if (matches.length >= 1) {
    const start = matches[0][1];
    const end = matches[0][2] || (parseInt(start) + 2).toString(); // +2h par défaut

    return {
      startTime: `${start.padStart(2, '0')}:00`,
      endTime: `${end.padStart(2, '0')}:00`,
    };
  }

  return null;
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

  // Nettoyer l'historique: enlever tool_calls des messages assistant
  const cleanedMessages = messages.map(msg => {
    if (msg.role === 'assistant' && (msg as any).tool_calls) {
      return {
        role: msg.role,
        content: msg.content || '',
      };
    }
    return msg;
  });

  // Rate limiting - récupérer les infos
  const rateLimitInfo = await checkRateLimit(userId);

  // Si limite atteinte, retourner un message indiquant le mode hors ligne
  if (!rateLimitInfo.withinLimit) {
    console.log(`[Chat] Rate limit atteint pour ${userId}, mode hors ligne activé`);
    return res.json({
      message: `Tu as atteint ta limite de 150 messages pour aujourd'hui. Le mode hors ligne est activé automatiquement jusqu'à demain minuit. Tu peux continuer à utiliser l'assistant, mais avec des fonctionnalités réduites.`,
      success: true,
      rateLimitReached: true,
      rateLimitInfo: {
        messagesUsed: rateLimitInfo.messagesUsed,
        messagesRemaining: 0,
        resetAt: rateLimitInfo.resetAt,
        resetInMs: rateLimitInfo.resetInMs,
      },
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
    const mistralResponse = await callMistralAPI([systemMessage, ...cleanedMessages]);

    const assistantMessage = mistralResponse.choices[0].message;

    // 4. Gérer les tool calls si présents
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log(`[Chat] ${assistantMessage.tool_calls.length} tool call(s) à exécuter`);

      // Exécuter les tool calls
      const toolResults = await handleToolCalls(assistantMessage.tool_calls, userId);

      // Nettoyer le message assistant : UNIQUEMENT tool_calls, PAS de content
      // Mistral API requiert soit content, soit tool_calls, mais PAS les deux
      const cleanedAssistantMessage: any = {
        role: 'assistant' as const,
        tool_calls: assistantMessage.tool_calls,
        // Ne JAMAIS inclure content quand tool_calls est présent
      };

      // Deuxième appel à Mistral avec les résultats
      // IMPORTANT: includeTools=false car on veut juste une réponse textuelle
      console.log('[Chat] Deuxième appel Mistral avec résultats tools');
      const finalResponse = await callMistralAPI(
        [
          systemMessage,
          ...cleanedMessages,
          cleanedAssistantMessage,
          ...toolResults,
        ],
        false // Désactiver les tools pour éviter content + tool_calls
      );

      const finalMessage = finalResponse.choices[0].message;

      return res.json({
        message: finalMessage.content,
        toolCalls: assistantMessage.tool_calls,
        success: true,
        rateLimitInfo: {
          messagesUsed: rateLimitInfo.messagesUsed,
          messagesRemaining: rateLimitInfo.messagesRemaining,
          resetAt: rateLimitInfo.resetAt,
          resetInMs: rateLimitInfo.resetInMs,
        },
      });
    }

    // 5. Détection de boucle de confirmation
    const lastUserMessage = cleanedMessages[cleanedMessages.length - 1];
    const previousAssistantMessage = cleanedMessages.length >= 2 ? cleanedMessages[cleanedMessages.length - 2] : null;

    // Si l'utilisateur confirme et qu'il n'y a pas de tool call, forcer la création
    if (
      lastUserMessage &&
      lastUserMessage.role === 'user' &&
      isConfirmation(lastUserMessage.content) &&
      !assistantMessage.tool_calls &&
      previousAssistantMessage &&
      previousAssistantMessage.role === 'assistant'
    ) {
      console.log('[Chat] Détection de confirmation sans tool call - Extraction forcée');

      // Chercher les infos d'horaire dans le message précédent de l'IA
      const timeInfo = extractTimeInfo(previousAssistantMessage.content);

      if (timeInfo) {
        console.log('[Chat] Horaire détecté:', timeInfo);

        // Calculer la date de "demain"
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];

        // Forcer l'appel à add_event
        const forcedToolCall = {
          id: 'forced_' + Date.now(),
          function: {
            name: 'add_event',
            arguments: JSON.stringify({
              events: [
                {
                  title: 'Révision de mathématiques',
                  type: 'study',
                  date: dateStr,
                  startTime: timeInfo.startTime,
                  endTime: timeInfo.endTime,
                },
              ],
            }),
          },
        };

        // Exécuter le tool call forcé
        const toolResults = await handleToolCalls([forcedToolCall], userId);

        console.log('[Chat] Tool call forcé exécuté');

        return res.json({
          message: `Super ! J'ai créé ta révision de mathématiques demain de ${timeInfo.startTime} à ${timeInfo.endTime} 📚`,
          toolCalls: [forcedToolCall],
          success: true,
          rateLimitInfo: {
            messagesUsed: rateLimitInfo.messagesUsed,
            messagesRemaining: rateLimitInfo.messagesRemaining,
            resetAt: rateLimitInfo.resetAt,
            resetInMs: rateLimitInfo.resetInMs,
          },
        });
      }
    }

    // 6. Retour simple si pas de tool calls
    return res.json({
      message: assistantMessage.content,
      success: true,
      rateLimitInfo: {
        messagesUsed: rateLimitInfo.messagesUsed,
        messagesRemaining: rateLimitInfo.messagesRemaining,
        resetAt: rateLimitInfo.resetAt,
        resetInMs: rateLimitInfo.resetInMs,
      },
    });
  } catch (error: any) {
    console.error('[Chat] Erreur:', error);

    return res.json({
      message:
        'Je rencontre une difficulté technique temporaire. Peux-tu reformuler ta demande ?',
      error: error.message,
      success: false,
      rateLimitInfo: {
        messagesUsed: rateLimitInfo.messagesUsed,
        messagesRemaining: rateLimitInfo.messagesRemaining,
        resetAt: rateLimitInfo.resetAt,
        resetInMs: rateLimitInfo.resetInMs,
      },
    });
  }
}
