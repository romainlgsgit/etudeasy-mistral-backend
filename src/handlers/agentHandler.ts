/**
 * Handler pour /chat-agent
 * Appelle l'agent Mistral AI Studio avec le contexte planning de l'utilisateur
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';

const AGENT_ID = 'ag_019cfada283570a0961dca54317686db';
const MISTRAL_AGENTS_URL = 'https://api.mistral.ai/v1/agents/completions';

export async function chatWithAgentHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { messages, eventsContext } = req.body;
    const apiKey = process.env.MISTRAL_API_KEY;

    if (!apiKey) {
      res.status(500).json({ success: false, message: 'Mistral API key not configured' });
      return;
    }

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ success: false, message: 'messages array required' });
      return;
    }

    // Build system message: current date + user's events
    const today = new Date();
    const dateStr = today.toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const isoDate = today.toISOString().split('T')[0];

    const systemContent = [
      `Aujourd'hui : ${dateStr} (${isoDate}).`,
      `Planning actuel de l'utilisateur (${eventsContext?.length ?? 0} événements) :`,
      JSON.stringify(eventsContext ?? [], null, 2),
    ].join('\n\n');

    console.log(`[AgentHandler] Calling Mistral agent with ${messages.length} messages, ${eventsContext?.length ?? 0} events`);

    const response = await fetch(MISTRAL_AGENTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        messages: [
          { role: 'system', content: systemContent },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AgentHandler] Mistral API error:', response.status, errorText);
      res.status(response.status).json({
        success: false,
        message: `Erreur Mistral ${response.status}`,
      });
      return;
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? '';

    console.log('[AgentHandler] Agent response received, length:', content.length);
    res.json({ success: true, message: content });
  } catch (err: any) {
    console.error('[AgentHandler] Unexpected error:', err);
    res.status(500).json({ success: false, message: err.message ?? 'Internal server error' });
  }
}
