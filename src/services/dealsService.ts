/**
 * Service pour récupérer les bons plans étudiants depuis Dealabs RSS
 * Cache les 4 meilleurs deals de la semaine (reset chaque lundi)
 */

import * as https from 'https';
import * as http from 'http';

export interface Deal {
  title: string;
  description: string;
  url: string;
}

interface DealsCache {
  deals: Deal[];
  weekStart: string; // date du lundi courant (YYYY-MM-DD)
}

let cache: DealsCache | null = null;

function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay(); // 0=dimanche, 1=lundi, ...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split('T')[0];
}

function fetchURL(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { timeout: 10000 }, (res) => {
      // Suivre les redirections
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchURL(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function cleanHTML(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRSSItems(xml: string): Deal[] {
  const items: Deal[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];

    const titleMatch =
      item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
      item.match(/<title>([\s\S]*?)<\/title>/);

    const descMatch =
      item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
      item.match(/<description>([\s\S]*?)<\/description>/);

    const linkMatch =
      item.match(/<link>([\s\S]*?)<\/link>/) ||
      item.match(/<guid[^>]*>([\s\S]*?)<\/guid>/);

    if (titleMatch && linkMatch) {
      const title = cleanHTML(titleMatch[1]);
      const rawDesc = descMatch ? cleanHTML(descMatch[1]) : '';
      // Limiter la description à 120 caractères
      const description = rawDesc.length > 120 ? rawDesc.slice(0, 117) + '...' : rawDesc;
      const url = linkMatch[1].trim();

      if (title && url.startsWith('http')) {
        items.push({ title, description, url });
      }
    }
  }

  return items;
}

export async function getWeeklyDeals(): Promise<Deal[]> {
  const currentMonday = getMondayOfCurrentWeek();

  // Retourner le cache si on est encore dans la même semaine
  if (cache && cache.weekStart === currentMonday) {
    console.log('[Deals] Cache hit pour la semaine du', currentMonday);
    return cache.deals;
  }

  console.log('[Deals] Fetch nouveaux deals pour la semaine du', currentMonday);

  try {
    const xml = await fetchURL('https://www.dealabs.com/rss/hot.xml');
    const allItems = parseRSSItems(xml);
    const deals = allItems.slice(0, 4);

    if (deals.length > 0) {
      cache = { deals, weekStart: currentMonday };
      console.log('[Deals] Cache mis à jour avec', deals.length, 'deals');
    }

    return deals;
  } catch (error) {
    console.error('[Deals] Erreur fetch RSS:', error);
    // Retourner le cache expiré si disponible plutôt que rien
    if (cache) {
      console.log('[Deals] Utilisation du cache expiré en fallback');
      return cache.deals;
    }
    return [];
  }
}
