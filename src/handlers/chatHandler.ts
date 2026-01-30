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
import { analyzePlanningForUser, isOrganizationRequest } from '../services/planningAnalysis';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Détecte si l'utilisateur confirme (oui, ok, d'accord) ou demande une action
 */
function isConfirmation(message: string): boolean {
  const lowerMsg = message.toLowerCase().trim();
  return /^(oui|ok|d'accord|ça me va|je veux|parfait|vas-y|fais-le|fais le|place le|choisis|tu l'as fait|fait)/.test(lowerMsg);
}

/**
 * Détecte si le message demande un placement automatique
 */
function isAutoPlacementRequest(message: string): boolean {
  const lowerMsg = message.toLowerCase();
  return /place.{0,10}moi|trouve.{0,10}créneau|choisis|comme tu (veux|préfères)/.test(lowerMsg);
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
        content: msg.content || 'Action effectuée',
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
    // 0. Récupérer le dernier message utilisateur (utilisé plusieurs fois)
    const lastUserMessage = cleanedMessages[cleanedMessages.length - 1];

    // 1. Construire le contexte utilisateur
    console.log(`[Chat] Construction contexte pour ${userId}`);
    let userContext = await getUserContext(userId);

    // 1.5. Détecter si c'est une demande d'organisation et analyser le planning
    if (lastUserMessage && lastUserMessage.role === 'user' && isOrganizationRequest(lastUserMessage.content)) {
      console.log('[Chat] Détection demande d\'organisation - Analyse du planning');

      const planningAnalysis = await analyzePlanningForUser(userId);
      if (planningAnalysis) {
        userContext = {
          ...userContext,
          planningAnalysis,
        };
        console.log('[Chat] Analyse de planning ajoutée au contexte');
      }
    }

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

      // Vérifier si c'est propose_organization (tool terminal, pas besoin de reformulation)
      const isProposalTool = assistantMessage.tool_calls.some(
        (tc: any) => tc.function?.name === 'propose_organization'
      );

      if (isProposalTool) {
        console.log('[Chat] Tool propose_organization détecté - pas de deuxième appel');

        // Extraire le summary des proposals
        const proposalResult = toolResults.find((r: any) => {
          const content = JSON.parse(r.content);
          return content.success && content.proposalId;
        });

        let responseMessage = "Voici mon organisation proposée pour ta semaine ! 📅";

        if (proposalResult) {
          try {
            const toolContent = JSON.parse(proposalResult.content);
            // Le summary est dans les arguments du tool call
            const toolCall = assistantMessage.tool_calls.find((tc: any) => tc.function?.name === 'propose_organization');
            if (toolCall) {
              const args = JSON.parse(toolCall.function.arguments);
              if (args.summary) {
                responseMessage = args.summary;
              }
              // Ajouter les propositions formatées
              if (args.proposals && args.proposals.length > 0) {
                responseMessage += "\n\n";
                args.proposals.forEach((p: any, i: number) => {
                  responseMessage += `\n**${i + 1}. ${p.activityTitle}**\n`;
                  responseMessage += `📅 ${p.slotDay} de ${p.slotStart} à ${p.slotEnd} (${p.duration}min)\n`;
                  responseMessage += `💡 ${p.reason}\n`;
                });
              }
            }
          } catch (e) {
            console.error('[Chat] Erreur parsing proposal:', e);
          }
        }

        return res.json({
          message: responseMessage,
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

      // Pour les autres tools, faire le deuxième appel normal
      const cleanedAssistantMessage: any = {
        role: 'assistant' as const,
        content: assistantMessage.content || '', // Mistral API accepte string vide avec tool_calls
        tool_calls: assistantMessage.tool_calls,
      };

      console.log('[Chat] Deuxième appel Mistral avec résultats tools');
      const finalResponse = await callMistralAPI(
        [
          systemMessage,
          ...cleanedMessages,
          cleanedAssistantMessage,
          ...toolResults,
        ],
        false // Désactiver les tools pour forcer une réponse textuelle
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

    // 5. Détection intelligente et création forcée
    const previousAssistantMessage = cleanedMessages.length >= 2 ? cleanedMessages[cleanedMessages.length - 2] : null;

    // CAS 1: Utilisateur confirme OU demande placement automatique
    if (
      lastUserMessage &&
      lastUserMessage.role === 'user' &&
      (isConfirmation(lastUserMessage.content) || isAutoPlacementRequest(lastUserMessage.content)) &&
      !assistantMessage.tool_calls
    ) {
      console.log('[Chat] Détection action sans tool call - Extraction forcée');

      // Chercher les infos d'horaire dans le message précédent de l'IA OU dans les messages utilisateur
      let timeInfo = null;
      let searchInMessages = [previousAssistantMessage?.content, lastUserMessage.content];

      // Chercher aussi dans les 3 derniers messages
      for (let i = cleanedMessages.length - 3; i < cleanedMessages.length; i++) {
        if (i >= 0) {
          searchInMessages.push(cleanedMessages[i].content);
        }
      }

      for (const msg of searchInMessages) {
        if (msg) {
          timeInfo = extractTimeInfo(msg);
          if (timeInfo) break;
        }
      }

      // Si pas d'horaire trouvé mais demande de placement auto, suggérer 10h-12h par défaut
      if (!timeInfo && isAutoPlacementRequest(lastUserMessage.content)) {
        timeInfo = { startTime: '10:00', endTime: '12:00' };
        console.log('[Chat] Placement auto avec horaire par défaut 10h-12h');
      }

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
        await handleToolCalls([forcedToolCall], userId);

        console.log('[Chat] Tool call forcé exécuté');

        return res.json({
          message: `C'est fait ! Révision de maths demain de ${timeInfo.startTime} à ${timeInfo.endTime} 📚`,
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
