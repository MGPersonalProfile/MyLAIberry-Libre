import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { Plus, X } from 'lucide-react';
import { IconButton } from './ui/Buttons';
import { CLASE_CAMPO } from './ui/clases';
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
      <p className="text-caption text-text-secondary font-semibold uppercase tracking-wider mb-3">
        {t('reader.voice')}
      </p>
      <label className="block text-footnote text-text-secondary mb-1" htmlFor="voz-narracion">
        {t('reader.voice_narration')}
      </label>
      <select
        id="voz-narracion"
        value={ajustes.vozNarracion}
        onChange={(e) => alCambiar({ vozNarracion: e.target.value })}
        className={`w-full mb-3 ${CLASE_CAMPO}`}
      >
        <option value="">{t('reader.voice_automatic')}</option>
        {opciones}
      </select>

      <label className="block text-footnote text-text-secondary mb-1" htmlFor="voz-dialogo">
        {t('reader.voice_dialogue')}
      </label>
      <select
        id="voz-dialogo"
        value={ajustes.vozDialogo}
        onChange={(e) => alCambiar({ vozDialogo: e.target.value })}
        className={`w-full mb-3 ${CLASE_CAMPO}`}
      >
        <option value="">{t('reader.voice_dialogue_auto')}</option>
        {opciones}
      </select>

      <div className="grid grid-cols-2 gap-2 mb-1">
        {[['vozMujer', 'reader.voice_women'], ['vozHombre', 'reader.voice_men']].map(([clave, texto]) => (
          <div key={clave} className="min-w-0">
            <label className="block text-footnote text-text-secondary mb-1" htmlFor={`voz-${clave}`}>{t(texto)}</label>
            <select
              id={`voz-${clave}`}
              value={ajustes[clave] || ''}
              onChange={(e) => alCambiar({ [clave]: e.target.value })}
              className={`w-full !px-2 ${CLASE_CAMPO}`}
            >
              <option value="">{t('reader.voice_gender_auto')}</option>
              {opciones}
            </select>
          </div>
        ))}
      </div>
      <p className="text-caption text-text-tertiary mb-3">{t('reader.voice_gender_hint')}</p>

      <div className="flex items-center gap-3">
        <label className="text-footnote text-text-secondary shrink-0" htmlFor="velocidad-voz">
          {t('reader.voice_speed')}
        </label>
        <input
          id="velocidad-voz"
          type="range" min="0.6" max="2" step="0.1"
          value={ajustes.velocidadVoz}
          onChange={(e) => alCambiar({ velocidadVoz: Number(e.target.value) })}
          className="flex-1 accent-accent"
        />
        <span className="font-mono text-footnote text-text-primary tabular-nums w-8 text-right">
          {ajustes.velocidadVoz}×
        </span>
      </div>

      <details className="mt-4 group">
        <summary className="cursor-pointer list-none text-footnote text-text-secondary hover:text-text-primary">
          {t('reader.character_voices')}
          {Object.keys(asignaciones).length > 0 && (
            <span className="ml-2 text-text-tertiary">{Object.keys(asignaciones).length}</span>
          )}
        </summary>
        <div className="mt-3 space-y-2">
          {personajes.map(personaje => (
            <div key={personaje} className="flex items-center gap-2">
              <span className="w-24 truncate text-footnote text-text-secondary" title={personaje}>
                {personaje}
                {generos[personaje] && (
                  <span className="block text-caption text-text-tertiary">
                    {t(generos[personaje] === 'f' ? 'reader.character_woman' : 'reader.character_man')}
                  </span>
                )}
              </span>
              <select
                value={asignaciones[personaje] || ''}
                onChange={(evento) => asignar(personaje, evento.target.value)}
                aria-label={`${t('reader.character_voice_for')} ${personaje}`}
                className={`flex-1 !px-2 ${CLASE_CAMPO}`}
              >
                <option value="">{t('reader.voice_dialogue_auto')}</option>
                {opciones}
              </select>
              {asignaciones[personaje] && (
                <IconButton size="sm" icon={X} onClick={() => asignar(personaje, '')} label={`${t('reader.character_voice_remove')} ${personaje}`} />
              )}
            </div>
          ))}
          <form onSubmit={anadir} className="flex gap-2">
            <input
              value={nuevo}
              onChange={(evento) => setNuevo(evento.target.value)}
              placeholder={t('reader.character_name')}
              aria-label={t('reader.character_name')}
              className={`flex-1 ${CLASE_CAMPO}`}
            />
            <IconButton type="submit" icon={Plus} disabled={!nuevo.trim()} label={t('reader.character_add')} className="border border-border" />
          </form>
        </div>
      </details>
    </div>
  );
}
