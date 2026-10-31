import { urlDeFichero } from './api-web.js';

export function usaPortadaDelSitio(story) {
  return !!(story?.coverUrl && story.portadaPreferida !== 'generada');
}

export function urlDePortada(story) {
  if (!story) return '';
  if (story.localCoverPath) {
    const ruta = encodeURI(String(story.localCoverPath).replace(/\\/g, '/'));

    const version = story.localCoverAt || '';

    if (window.__MYLAIBERRY_BASE__ !== undefined) {
      return urlDeFichero(String(story.localCoverPath)) + (version ? `&v=${version}` : '');
    }
    return version ? `local-file:///${ruta}?v=${version}` : `local-file:///${ruta}`;
  }
  return story.coverUrl || '';
}
