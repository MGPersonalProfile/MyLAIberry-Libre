const fs = require('fs');
const path = require('path');

const SERVIDOR = 'https://ntfy.sh/';

function canal(env = process.env) {
  if (env.MYLAIBERRY_NTFY) return String(env.MYLAIBERRY_NTFY).trim() || null;
  if (!env.CREDENTIALS_DIRECTORY) return null;
  try {
    return fs.readFileSync(path.join(env.CREDENTIALS_DIRECTORY, 'ntfy'), 'utf-8').trim() || null;
  } catch {
    return null;
  }
}

async function avisarPorNtfy({ title, body }, { enlace = null, env = process.env, pedir = fetch } = {}) {
  const c = canal(env);
  if (!c) return false;

  const cabecera = t => /^[\x20-\x7e]*$/.test(t) ? t : `=?UTF-8?B?${Buffer.from(t, 'utf-8').toString('base64')}?=`;
  const headers = { Title: cabecera(title), Tags: 'books' };
  if (enlace) headers.Click = enlace;
  try {
    const r = await pedir(SERVIDOR + encodeURIComponent(c), { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) });
    return !!r.ok;
  } catch (e) {
    console.warn('[Avisos] ntfy no respondió:', e.message);
    return false;
  }
}

module.exports = { canal, avisarPorNtfy };
