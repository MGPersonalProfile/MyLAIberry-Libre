import { useId, useState } from 'react';
import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { InsetGroupedList } from '../ui/List';
import { Notice } from '../ui/Feedback';
import { useI18n } from '../../i18n/I18nContext';

const idDe = cap => cap.episodeNo || String(cap.index);

function nombreIdioma(codigo, lang, t) {
  if (['es', 'es-la', 'en'].includes(codigo)) return t(`import.comic_language_${codigo}`);
  try { return new Intl.DisplayNames([lang], { type: 'language' }).of(codigo); }
  catch { return codigo; }
}

function Episodio({ cap, marcado, alternar }) {
  const { t, lang } = useI18n();
  return (
    <label className="flex gap-3 items-center px-4 py-2.5 hover:bg-surface-hover cursor-pointer">
      <input type="checkbox" checked={marcado} onChange={alternar} className="accent-accent shrink-0 w-4 h-4" />
      <span className="min-w-0 flex-1 text-small text-text-primary">
        {cap.title || t('import.comic_episode', { n: cap.numero ?? cap.episodeNo })}
      </span>
      {cap.idioma && <span className="text-footnote text-text-secondary">{nombreIdioma(cap.idioma, lang, t)}</span>}
    </label>
  );
}

function ListaEpisodios({ serie, ocupado, onConfirmar, onCancelar }) {
  const { t } = useI18n();
  const ids = serie.chapters.map(idDe);
  const [marcados, setMarcados] = useState(() => new Set(ids));
  const alternar = id => setMarcados(prev => {
    const nuevo = new Set(prev);
    if (nuevo.has(id)) nuevo.delete(id);
    else nuevo.add(id);
    return nuevo;
  });

  return (
    <>
      {ids.length ? (
        <fieldset disabled={ocupado} className="space-y-3">
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setMarcados(new Set(ids))}>{t('selection.all')}</SecondaryButton>
            <SecondaryButton onClick={() => setMarcados(new Set())}>{t('selection.none')}</SecondaryButton>
          </div>
          <InsetGroupedList divided>
            <div className="max-h-60 overflow-y-auto divide-y divide-separator">
              {serie.chapters.map(cap => (
                <Episodio key={idDe(cap)} cap={cap} marcado={marcados.has(idDe(cap))} alternar={() => alternar(idDe(cap))} />
              ))}
            </div>
          </InsetGroupedList>
        </fieldset>
      ) : <Notice variant="info" compact>{t('import.comic_empty')}</Notice>}
      <div className="flex gap-2 pt-2">
        <PrimaryButton disabled={ocupado || !marcados.size}
          onClick={() => onConfirmar([...marcados], serie.idiomaComic)} className="flex-1">
          {t('import.comic_import_selected', { n: marcados.size })}
        </PrimaryButton>
        <SecondaryButton onClick={onCancelar}>{t('common.cancel')}</SecondaryButton>
      </div>
    </>
  );
}

export default function SeleccionEpisodiosComic({ inicial, onCambiarIdioma, onConfirmar, onCancelar }) {
  const { t, lang } = useI18n();
  const selector = useId();
  const [serie, setSerie] = useState(inicial);
  const [pendiente, setPendiente] = useState('');
  const [error, setError] = useState('');

  async function cambiarIdioma(idioma) {
    setPendiente(idioma);
    setError('');
    try {
      const resultado = await onCambiarIdioma(idioma);
      if (resultado?.status === 'success') setSerie(resultado.data);
      else setError(resultado?.clave ? t(resultado.clave) : resultado?.message || t('import.comic_load_error'));
    } catch (err) {
      setError(err?.message || t('import.comic_load_error'));
    } finally {
      setPendiente('');
    }
  }

  return (
    <div className="space-y-4" data-seleccion-comic data-seleccion-webtoon={serie.source === 'Webtoon' ? '' : undefined}>
      <div>
        <h3 className="text-subhead font-semibold text-text-primary">{serie.title || t('import.comic_select_episodes')}</h3>
        {serie.author && <p className="text-footnote text-text-secondary">{serie.author}</p>}
      </div>
      {!!serie.idiomasComic?.length && (
        <div className="flex items-center gap-3">
          <label htmlFor={selector} className="text-small text-text-primary">{t('import.comic_language')}</label>
          <select id={selector} value={pendiente || serie.idiomaComic} disabled={!!pendiente}
            className="rounded-lg border border-separator bg-surface px-3 py-2 text-small text-text-primary"
            onChange={event => cambiarIdioma(event.target.value)}>
            {serie.idiomasComic.map(codigo => <option key={codigo} value={codigo}>{nombreIdioma(codigo, lang, t)}</option>)}
          </select>
        </div>
      )}
      {pendiente && <div role="status" className="text-footnote text-text-secondary">{t('import.starting')}</div>}
      {error && <Notice variant="error" compact>{error}</Notice>}
      <ListaEpisodios key={serie.idiomaComic} serie={serie} ocupado={!!pendiente} onConfirmar={onConfirmar} onCancelar={onCancelar} />
    </div>
  );
}
