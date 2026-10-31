const royalroad = require('./royalroad');
const ao3 = require('./ao3');
const ffn = require('./ffn');
const fichub = require('./fichub');
const sequential = require('./sequential');
const webnovel = require('./webnovel');
const universal = require('./universal');
const gutenberg = require('./gutenberg');

const SITE_MATCHERS = [

  { pattern: /royalroad\.com/i,          scraper: royalroad,   name: 'RoyalRoad',              tier: 1 },
  { pattern: /archiveofourown\.org/i,    scraper: ao3,         name: 'Archive of Our Own',     tier: 1 },
  { pattern: /fanfiction\.net/i,         scraper: ffn,         name: 'FanFiction.net',         tier: 1 },
  { pattern: /wetriedtls\.com/i,         scraper: sequential,  name: 'We Tried TLS',           tier: 1 },

  { pattern: /webnovel\.com/i,            scraper: webnovel,    name: 'Webnovel',               tier: 1 },

  { pattern: /gutenberg\.org/i,           scraper: gutenberg,   name: 'Project Gutenberg',      tier: 1 },

  { pattern: /spacebattles\.com/i,       scraper: fichub,      name: 'SpaceBattles (FicHub)',   tier: 2 },
  { pattern: /sufficientvelocity\.com/i, scraper: fichub,      name: 'SufficientVelocity (FicHub)', tier: 2 },
  { pattern: /questionablequesting/i,    scraper: fichub,      name: 'QuestionableQuesting (FicHub)', tier: 2 },
  { pattern: /fictionpress\.com/i,       scraper: fichub,      name: 'FictionPress (FicHub)',   tier: 2 },
  { pattern: /adultfanfiction\.org/i,    scraper: fichub,      name: 'AdultFanfiction (FicHub)', tier: 2 },
];

function detectScraper(url) {
  for (const matcher of SITE_MATCHERS) {
    if (matcher.pattern.test(url)) {
      return { scraper: matcher.scraper, name: matcher.name, tier: matcher.tier };
    }
  }

  if (/\/(chapter|capitulo|capítulo)-\d+/i.test(url) || /\/series\/[^/]+\/?$/i.test(url)) {
    let host = 'Sitio de novelas';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {  }
    return { scraper: sequential, name: `${host} (secuencial)`, tier: 2 };
  }

  return { scraper: universal, name: 'Sitio genérico', tier: 3 };
}

async function scrapeStory(url, onProgress, opciones) {
  const { scraper, name, tier } = detectScraper(url);

  if (onProgress) {
    onProgress({
      step: 'detect',
      message: `Sitio detectado: ${name}`,
      details: `Usando extractor Tier ${tier}`
    });
  }

  return await scraper.scrape(url, onProgress, opciones);
}

async function leerAutor(autorUrl) {
  const { scraper, name } = detectScraper(autorUrl);
  if (!scraper || typeof scraper.leerAutor !== 'function') {
    throw new Error(`Todavía no se pueden seguir autores de ${name}`);
  }
  return await scraper.leerAutor(autorUrl);
}

function admiteAutores(url) {
  const { scraper } = detectScraper(url);
  return !!(scraper && typeof scraper.leerAutor === 'function');
}

function urlDeAutor(url) {

  const { scraper } = detectScraper(url);
  const candidatos = scraper && typeof scraper.urlDeAutor === 'function'
    ? [scraper]
    : SITE_MATCHERS.map(m => m.scraper).filter(s => typeof s.urlDeAutor === 'function');

  for (const s of candidatos) {
    const canonica = s.urlDeAutor(url);
    if (canonica) return canonica;
  }
  return url;
}

module.exports = {
  detectScraper,
  scrapeStory,
  leerAutor,
  admiteAutores,
  urlDeAutor,
  SITE_MATCHERS
};
