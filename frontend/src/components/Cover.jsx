import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { usaPortadaDelSitio, urlDePortada } from '../portada';

function hash(texto) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

const TINTAS = [
  { fondo: '#1d3557', tinta: '#f1faee', acento: '#e63946' },
  { fondo: '#6a040f', tinta: '#ffddd2', acento: '#ffba08' },
  { fondo: '#283618', tinta: '#fefae0', acento: '#dda15e' },
  { fondo: '#3d348b', tinta: '#f7f7ff', acento: '#f7b801' },
  { fondo: '#0b3954', tinta: '#e0fbfc', acento: '#ff6663' },
  { fondo: '#4a1942', tinta: '#f9dbbd', acento: '#f4a259' },
  { fondo: '#1b263b', tinta: '#e0e1dd', acento: '#778da9' },
  { fondo: '#7f4f24', tinta: '#fff3e6', acento: '#a3b18a' },
  { fondo: '#212529', tinta: '#f8f9fa', acento: '#adb5bd' },
  { fondo: '#02231c', tinta: '#d8f3dc', acento: '#95d5b2' }
];

function enLineas(texto, porLinea, maximo) {
  const lineas = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    if (!actual) actual = palabra;
    else if ((actual + ' ' + palabra).length <= porLinea) actual += ' ' + palabra;
    else { lineas.push(actual); actual = palabra; }
  }
  if (actual) lineas.push(actual);
  if (lineas.length > maximo) {
    return [...lineas.slice(0, maximo - 1), lineas[maximo - 1].slice(0, porLinea - 1) + '…'];
  }
  return lineas;
}

const ANCHO_UTIL = 168;
const RATIO_CAR = 0.52;

function medida(titulo) {
  const palabras = titulo.split(/\s+/).filter(Boolean);
  const masLarga = palabras.reduce((m, p) => Math.max(m, p.length), 1);

  let cuerpo, porLinea, maximo;
  if (titulo.length <= 20)      { cuerpo = 25; porLinea = 11; maximo = 4; }
  else if (titulo.length <= 45) { cuerpo = 19; porLinea = 14; maximo = 5; }
  else                          { cuerpo = 15; porLinea = 18; maximo = 6; }

  porLinea = Math.max(porLinea, masLarga);
  cuerpo = Math.min(cuerpo, Math.floor(ANCHO_UTIL / (porLinea * RATIO_CAR)));

  return { cuerpo: Math.max(cuerpo, 9), porLinea, maximo };
}

export default function Cover({ story, className = '', imgClassName = '' }) {
  const { t } = useI18n();
  const { title, author, source } = story || {};

  const [rota, setRota] = useState(false);

  if (usaPortadaDelSitio(story) && !rota) {
    return (
      <img
        src={urlDePortada(story)}
        alt={title || t('cover.alt')}
        className={imgClassName || className}
        loading="lazy"
        onError={() => setRota(true)}
      />
    );
  }

  const titulo = (title || t('cover.untitled')).trim();
  const semilla = hash(titulo + (author || ''));
  const paleta = TINTAS[semilla % TINTAS.length];

  const { cuerpo, porLinea, maximo } = medida(titulo);
  const lineas = enLineas(titulo, porLinea, maximo);
  const alturaLinea = cuerpo * 1.1;

  const esquina = semilla % 4;
  const radio = 92 + ((semilla >> 3) % 60);
  const cx = (esquina === 0 || esquina === 3) ? 0 : 200;
  const cy = (esquina < 2) ? 0 : 300;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      role="img"
      aria-label={t('cover.aria', { title: title || t('cover.untitled') })}
    >
      <svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" className="block w-full h-full">
        <rect width="200" height="300" fill={paleta.fondo} />
        <circle cx={cx} cy={cy} r={radio} fill={paleta.acento} opacity="0.10" />
        <circle cx={cx} cy={cy} r={radio * 0.62} fill={paleta.tinta} opacity="0.05" />

        {source && (
          <text
            x="16" y="28"
            fill={paleta.tinta} opacity="0.55"
            fontFamily="ui-monospace, Consolas, monospace"
            fontSize="7" letterSpacing="1.6"
          >
            {source.toUpperCase()}
          </text>
        )}

        <rect x="16" y="40" width="46" height="3" fill={paleta.acento} />

        {lineas.map((linea, i) => {

          const seSale = linea.length * cuerpo * RATIO_CAR > ANCHO_UTIL;
          return (
            <text
              key={i}
              x="16"
              y={70 + i * alturaLinea}
              fill={paleta.tinta}
              fontFamily="Georgia, 'Times New Roman', serif"
              fontSize={cuerpo}
              fontWeight="700"
              {...(seSale ? { textLength: ANCHO_UTIL, lengthAdjust: 'spacingAndGlyphs' } : {})}
            >
              {linea}
            </text>
          );
        })}

        {author && (
          <text
            x="16" y="278"
            fill={paleta.tinta} opacity="0.6"
            fontFamily="ui-monospace, Consolas, monospace"
            fontSize="7.5" letterSpacing="1.2"
          >
            {author.toUpperCase().slice(0, 26)}
          </text>
        )}
      </svg>
    </div>
  );
}
