import { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { SearchField, Switch } from '../ui/Controls';
import { Notice } from '../ui/Feedback';
import { ActionCell, InsetGroupedList } from '../ui/List';

export default function BuscarEnLaObra({ obraId, idioma, actual, total, alElegir }) {
  const { t } = useI18n();
  const [texto, setTexto] = useState('');
  const [todaLaObra, setTodaLaObra] = useState(false);
  const [estado, setEstado] = useState(null);
  if (!window.api?.buscarEnLaObra) return null;

  const buscar = async (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setEstado('buscando');
    try {
      const r = await window.api.buscarEnLaObra(obraId, texto.trim(), todaLaObra ? total : actual + 1, idioma);
      setEstado(r?.status === 'ok' ? r : { error: r?.message || t('reader.search_failed') });
    } catch (err) {
      setEstado({ error: err?.message || t('reader.search_failed') });
    }
  };

  return (
    <div className="px-6 py-3 border-b border-separator dark text-text-primary" data-buscar-en-la-obra>
      <form onSubmit={buscar}>
        <SearchField value={texto} onChange={setTexto} placeholder={t('reader.search_placeholder')}
                     clearLabel={t('discover.search_clear')} />
      </form>
      <div className="mt-3 flex items-center gap-3 text-footnote text-text-secondary">
        <Switch checked={todaLaObra} onChange={setTodaLaObra} label={t('reader.search_all')} />
        <span>{t('reader.search_all')}</span>
      </div>
      {estado === 'buscando' && <p className="mt-2 text-footnote text-text-secondary" role="status">{t('reader.searching')}</p>}
      {estado?.error && <Notice tone="error" compact className="mt-2">{estado.error}</Notice>}
      {estado?.apariciones && <Resultados estado={estado} alElegir={alElegir} />}
    </div>
  );
}

function Resultados({ estado, alElegir }) {
  const { t } = useI18n();
  return (
    <div className="mt-3">
      <p className="mb-1.5 px-1 text-footnote text-text-secondary">
        {estado.capitulosConElTexto
          ? t('reader.search_found', { n: estado.capitulosConElTexto, revisados: estado.revisados })
          : t('reader.search_none', { revisados: estado.revisados })}
      </p>
      {estado.apariciones.length > 0 && (
        <InsetGroupedList divided className="max-h-72 overflow-y-auto rounded-xl">
          {estado.apariciones.map(a => (
            <ActionCell key={a.indice} onClick={() => alElegir(a.indice)}
                        title={t('reader.search_chapter', { n: a.capitulo, veces: a.veces })}
                        subtitle={<span className="line-clamp-2">{a.fragmento}</span>} />
          ))}
        </InsetGroupedList>
      )}
      {estado.masAllaDeEstos > 0 && <p className="mt-1.5 px-1 text-footnote text-text-tertiary">{t('reader.search_more', { n: estado.masAllaDeEstos })}</p>}
    </div>
  );
}
