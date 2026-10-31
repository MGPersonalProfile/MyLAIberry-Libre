import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { parrafosDelDom, textoDe } from '../voz';
import { personajesEnTextos, quienHabla } from '../voz-personajes';
import { trocearDialogos } from '../voz-dialogos';
import { generosParaAjustes } from '../voz-conversacion';

function textosDelCapitulo() {
  return parrafosDelDom(document.querySelector('.reader-content')).map(textoDe);
}

function detectarPersonajes() {
  return personajesEnTextos(textosDelCapitulo());
}

function detectarGeneros() {
  return generosParaAjustes(textosDelCapitulo().map(texto => quienHabla(trocearDialogos(texto))));
}

function nombreEscrito(texto) {
  const limpio = texto.trim().replace(/\s+/g, ' ');
  if (!limpio) return '';
  return limpio[0].toLocaleUpperCase() + limpio.slice(1);
}

export default function AjustesDeVoz({ voces, ajustes, alCambiar }) {
  const { t } = useI18n();
  const [detectados] = useState(detectarPersonajes);
  const [generos] = useState(detectarGeneros);
  const [manuales, setManuales] = useState([]);
  const [nuevo, setNuevo] = useState('');
  if (!voces.length) return null;

  const asignaciones = ajustes.vocesPorPersonaje || {};
  const personajes = [...new Set([...detectados, ...manuales, ...Object.keys(asignaciones)])];

  const asignar = (personaje, voz) => {
    const siguientes = { ...asignaciones };
    if (voz) siguientes[personaje] = voz;
    else delete siguientes[personaje];
    alCambiar({ vocesPorPersonaje: siguientes });
  };

  const anadir = (evento) => {
    evento.preventDefault();
    const personaje = nombreEscrito(nuevo);
    if (!personaje) return;
    setManuales(actuales => [...new Set([...actuales, personaje])]);
    setNuevo('');
  };

  const opciones = voces.map(voz => (
    <option key={voz.name} value={voz.name}>{voz.name.replace(/^Microsoft /, '')}</option>
  ));

  return (
    <div>
      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">
        {t('reader.voice')}
      </p>
      <label className="block text-xs text-gray-500 mb-1" htmlFor="voz-narracion">
        {t('reader.voice_narration')}
      </label>
      <select
        id="voz-narracion"
        value={ajustes.vozNarracion}
        onChange={(e) => alCambiar({ vozNarracion: e.target.value })}
        className="w-full bg-black/30 border border-white/5 rounded-lg px-3 py-2 text-sm mb-3"
      >
        <option value="">{t('reader.voice_automatic')}</option>
        {opciones}
      </select>

      <label className="block text-xs text-gray-500 mb-1" htmlFor="voz-dialogo">
        {t('reader.voice_dialogue')}
      </label>
      <select
        id="voz-dialogo"
        value={ajustes.vozDialogo}
        onChange={(e) => alCambiar({ vozDialogo: e.target.value })}
        className="w-full bg-black/30 border border-white/5 rounded-lg px-3 py-2 text-sm mb-3"
      >
        <option value="">{t('reader.voice_dialogue_auto')}</option>
        {opciones}
      </select>

      <div className="grid grid-cols-2 gap-2 mb-1">
        {[['vozMujer', 'reader.voice_women'], ['vozHombre', 'reader.voice_men']].map(([clave, texto]) => (
          <div key={clave} className="min-w-0">
            <label className="block text-xs text-gray-500 mb-1" htmlFor={`voz-${clave}`}>{t(texto)}</label>
            <select
              id={`voz-${clave}`}
              value={ajustes[clave] || ''}
              onChange={(e) => alCambiar({ [clave]: e.target.value })}
              className="w-full bg-black/30 border border-white/5 rounded-lg px-2 py-2 text-xs"
            >
              <option value="">{t('reader.voice_gender_auto')}</option>
              {opciones}
            </select>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-600 mb-3">{t('reader.voice_gender_hint')}</p>

      <div className="flex items-center gap-3">
        <label className="text-xs text-gray-500 shrink-0" htmlFor="velocidad-voz">
          {t('reader.voice_speed')}
        </label>
        <input
          id="velocidad-voz"
          type="range" min="0.6" max="2" step="0.1"
          value={ajustes.velocidadVoz}
          onChange={(e) => alCambiar({ velocidadVoz: Number(e.target.value) })}
          className="flex-1 accent-red-600"
        />
        <span className="font-mono text-xs tabular-nums w-8 text-right">
          {ajustes.velocidadVoz}×
        </span>
      </div>

      <details className="mt-4 group">
        <summary className="cursor-pointer list-none text-xs text-gray-400 hover:text-gray-200">
          {t('reader.character_voices')}
          {Object.keys(asignaciones).length > 0 && (
            <span className="ml-2 text-gray-600">{Object.keys(asignaciones).length}</span>
          )}
        </summary>
        <div className="mt-3 space-y-2">
          {personajes.map(personaje => (
            <div key={personaje} className="flex items-center gap-2">
              <span className="w-24 truncate text-xs text-gray-400" title={personaje}>
                {personaje}
                {generos[personaje] && (
                  <span className="block text-[10px] text-gray-600">
                    {t(generos[personaje] === 'f' ? 'reader.character_woman' : 'reader.character_man')}
                  </span>
                )}
              </span>
              <select
                value={asignaciones[personaje] || ''}
                onChange={(evento) => asignar(personaje, evento.target.value)}
                aria-label={`${t('reader.character_voice_for')} ${personaje}`}
                className="min-w-0 flex-1 bg-black/30 border border-white/5 rounded-lg px-2 py-2 text-xs"
              >
                <option value="">{t('reader.voice_dialogue_auto')}</option>
                {opciones}
              </select>
              {asignaciones[personaje] && (
                <button
                  type="button"
                  onClick={() => asignar(personaje, '')}
                  aria-label={`${t('reader.character_voice_remove')} ${personaje}`}
                  className="w-8 h-8 text-gray-600 hover:text-gray-300"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <form onSubmit={anadir} className="flex gap-2">
            <input
              value={nuevo}
              onChange={(evento) => setNuevo(evento.target.value)}
              placeholder={t('reader.character_name')}
              aria-label={t('reader.character_name')}
              className="min-w-0 flex-1 bg-black/30 border border-white/5 rounded-lg px-3 py-2 text-xs"
            />
            <button
              type="submit"
              disabled={!nuevo.trim()}
              aria-label={t('reader.character_add')}
              className="w-9 rounded-lg border border-white/5 text-gray-400 disabled:opacity-30"
            >
              +
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
