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

/**
 * Extrait le titre d'un événement des messages de conversation
 */
function extractEventTitle(messages: ChatMessage[]): string {
  // Chercher dans les derniers messages utilisateur
  for (let i = messages.length - 1; i >= 0 && i >= messages.length - 5; i--) {
    const msg = messages[i];
    if (msg.role !== 'user') continue;

    const text = msg.content.toLowerCase();

    // Patterns pour extraire le titre
    const patterns = [
      /(?:cours|classe)\s+(?:de\s+)?(\w+)/i,
      /(?:révision|revision)\s+(?:de\s+)?(\w+)?/i,
      /(?:examen|exam)\s+(?:de\s+)?(\w+)/i,
      /(?:étude|etude)\s+(?:de\s+)?(\w+)?/i,
      /(?:sport|foot|basket|tennis|gym|yoga|natation)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        if (match[1]) {
          // Capitaliser le premier caractère
          const subject = match[1].charAt(0).toUpperCase() + match[1].slice(1);
          if (text.includes('révision') || text.includes('revision')) {
            return `Révision de ${subject}`;
          } else if (text.includes('cours') || text.includes('classe')) {
            return `Cours de ${subject}`;
          } else if (text.includes('examen') || text.includes('exam')) {
            return `Examen de ${subject}`;
          }
          return subject;
        } else if (match[0]) {
          // Retourner le mot trouvé capitalisé
          return match[0].charAt(0).toUpperCase() + match[0].slice(1);
        }
      }
    }
  }

  return 'Révision'; // Titre par défaut
}

/**
 * Détecte le type d'événement à partir des messages
 */
function extractEventType(messages: ChatMessage[]): 'class' | 'exam' | 'study' | 'activity' {
  for (let i = messages.length - 1; i >= 0 && i >= messages.length - 5; i--) {
    const msg = messages[i];
    if (msg.role !== 'user') continue;

    const text = msg.content.toLowerCase();

    if (/examen|exam|contrôle|controle|ds|partiel/i.test(text)) return 'exam';
    if (/cours|classe|td|tp|amphi/i.test(text)) return 'class';
    if (/sport|foot|basket|tennis|gym|yoga|natation|match|entraînement/i.test(text)) return 'activity';
    if (/révision|revision|étude|etude|travail/i.test(text)) return 'study';
  }

  return 'study'; // Type par défaut
}

export async function chatWithMistralHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  const userId = req.userId!;
  const { messages, language } = req.body as { messages: ChatMessage[]; language?: string };

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
    const rateLimitMessage = language === 'es'
      ? `Has alcanzado tu límite de 150 mensajes por hoy. El modo sin conexión se activa automáticamente hasta mañana a medianoche. Puedes seguir usando el asistente, pero con funcionalidades reducidas.`
      : `Tu as atteint ta limite de 150 messages pour aujourd'hui. Le mode hors ligne est activé automatiquement jusqu'à demain minuit. Tu peux continuer à utiliser l'assistant, mais avec des fonctionnalités réduites.`;
    return res.json({
      message: rateLimitMessage,
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
    userContext.language = language || 'fr';

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

      // Log des tool calls pour debugging
      assistantMessage.tool_calls.forEach((tc: any) => {
        if (tc.function?.name === 'auto_place_event') {
          try {
            const args = JSON.parse(tc.function.arguments);
            console.log(`[Chat] 📅 auto_place_event appelé avec targetDate: ${args.preferences?.targetDate}`);
          } catch (e) {
            // ignore
          }
        }
      });

      // Exécuter les tool calls (en passant le message utilisateur pour le parsing de dates)
      const toolResults = await handleToolCalls(
        assistantMessage.tool_calls,
        userId,
        lastUserMessage.content
      );

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

        let responseMessage = userContext.language === 'es'
          ? "¡Aquí está mi organización propuesta para tu semana! 📅"
          : "Voici mon organisation proposée pour ta semaine ! 📅";

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

      // Vérifier que le message n'est pas vide
      let responseMessage = finalMessage.content || '';

      // Si le message est vide OU contient une question de confirmation (bug), créer un message clair
      const isConfirmationQuestion = /veux-tu|tu veux|je confirme|confirmes|d'accord\s*\?|ok\s*\?|¿quieres|confirmo/i.test(responseMessage);

      if (!responseMessage.trim() || isConfirmationQuestion) {
        console.log('[Chat] Message vide ou question de confirmation détectée, génération message explicite');

        // Créer un message explicite selon le tool appelé
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function?.name;
          const toolResult = toolResults.find((r: any) => r.tool_call_id === toolCall.id);

          if (!toolResult) continue;

          try {
            const result = JSON.parse(toolResult.content);

            if (toolName === 'auto_place_event' && result.success && result.placement) {
              const p = result.placement;
              responseMessage = userContext.language === 'es'
                ? `✅ ¡Hecho! **${p.title || 'Evento'}** colocado **${p.dayName} de ${p.startTime} a ${p.endTime}** 📅`
                : `✅ C'est fait ! **${p.title || 'Événement'}** placé **${p.dayName} de ${p.startTime} à ${p.endTime}** 📅`;
            } else if (toolName === 'add_event' && result.success) {
              const events = result.events || [];
              const count = events.length || result.count || 1;

              if (events.length === 1) {
                const e = events[0];
                responseMessage = userContext.language === 'es'
                  ? `✅ ¡Hecho! **${e.title}** añadido **${e.dayName} de ${e.startTime} a ${e.endTime}** 📅`
                  : `✅ C'est fait ! **${e.title}** ajouté **${e.dayName} de ${e.startTime} à ${e.endTime}** 📅`;
              } else if (events.length > 1) {
                const eventList = events.map((e: any) =>
                  `• **${e.title}** - ${e.dayName} ${e.startTime}-${e.endTime}`
                ).join('\n');
                responseMessage = userContext.language === 'es'
                  ? `✅ ¡Perfecto! ${count} eventos añadidos:\n${eventList}`
                  : `✅ Parfait ! ${count} événements ajoutés :\n${eventList}`;
              } else {
                responseMessage = userContext.language === 'es'
                  ? `✅ ¡Evento añadido a tu calendario! 📅`
                  : `✅ Événement ajouté à ton planning ! 📅`;
              }
            } else if (toolName === 'modify_event' && result.success) {
              responseMessage = userContext.language === 'es'
                ? `✅ ¡Evento modificado con éxito! ✏️`
                : `✅ Événement modifié avec succès ! ✏️`;
            } else if (toolName === 'delete_event' && result.success) {
              responseMessage = userContext.language === 'es'
                ? `✅ ¡Evento eliminado! 🗑️`
                : `✅ Événement supprimé ! 🗑️`;
            } else if (toolName === 'search_events' && result.success) {
              const events = result.events || [];
              if (events.length === 0) {
                responseMessage = userContext.language === 'es'
                  ? `📋 No encontré ningún evento que coincida.`
                  : `📋 Je n'ai trouvé aucun événement correspondant.`;
              } else {
                const eventList = events.slice(0, 5).map((e: any) =>
                  `• **${e.title}** - ${e.date} de ${e.startTime} à ${e.endTime}`
                ).join('\n');
                responseMessage = userContext.language === 'es'
                  ? `📋 Encontré ${events.length} evento(s):\n${eventList}`
                  : `📋 J'ai trouvé ${events.length} événement(s) :\n${eventList}`;
              }
            } else if (!result.success && result.error) {
              responseMessage = userContext.language === 'es'
                ? `❌ ${result.error}${result.suggestion ? `\n💡 ${result.suggestion}` : ''}`
                : `❌ ${result.error}${result.suggestion ? `\n💡 ${result.suggestion}` : ''}`;
            }
          } catch (e) {
            console.error('[Chat] Erreur parsing tool result:', e);
          }
        }

        // Si toujours pas de message, message par défaut
        if (!responseMessage.trim()) {
          responseMessage = userContext.language === 'es'
            ? "✅ ¡Acción realizada!"
            : "✅ Action effectuée !";
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

        // Extraire le titre et le type intelligemment
        const eventTitle = extractEventTitle(cleanedMessages);
        const eventType = extractEventType(cleanedMessages);

        // Calculer la date de "demain"
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];
        const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
        const dayName = dayNames[tomorrow.getDay()];

        console.log(`[Chat] Création forcée: "${eventTitle}" (${eventType}) pour ${dayName}`);

        // Forcer l'appel à add_event
        const forcedToolCall = {
          id: 'forced_' + Date.now(),
          function: {
            name: 'add_event',
            arguments: JSON.stringify({
              events: [
                {
                  title: eventTitle,
                  type: eventType,
                  date: dateStr,
                  startTime: timeInfo.startTime,
                  endTime: timeInfo.endTime,
                },
              ],
            }),
          },
        };

        // Exécuter le tool call forcé
        await handleToolCalls([forcedToolCall], userId, lastUserMessage.content);

        console.log('[Chat] Tool call forcé exécuté');

        // Capitaliser le jour
        const dayNameCap = dayName.charAt(0).toUpperCase() + dayName.slice(1);

        return res.json({
          message: userContext.language === 'es'
            ? `✅ ¡Hecho! **${eventTitle}** añadido **${dayNameCap} de ${timeInfo.startTime} a ${timeInfo.endTime}** 📅`
            : `✅ C'est fait ! **${eventTitle}** ajouté **${dayNameCap} de ${timeInfo.startTime} à ${timeInfo.endTime}** 📅`,
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
      message: language === 'es'
        ? 'Estoy teniendo una dificultad técnica temporal. ¿Puedes reformular tu solicitud?'
        : 'Je rencontre une difficulté technique temporaire. Peux-tu reformuler ta demande ?',
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
