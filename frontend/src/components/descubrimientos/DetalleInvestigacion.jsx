import { useI18n } from '../../i18n/I18nContext';

function itemConocido(c, obra, t) {
  if (c.campo === 'palabras') {
    const n = Number(c.valor).toLocaleString();
    return c.estimado ? t('pending.known_words_est', { n }) : t('pending.known_words', { n });
  }
  if (c.campo === 'capitulos') {
    return c.local ? t('pending.known_chapters_local', { n: c.valor }) : t('pending.known_chapters', { n: c.valor });
  }
  if (c.campo === 'estado') {
    return c.valor === 'completa' ? t('pending.known_complete') : t('pending.known_in_progress');
  }
  return null;
}

export default function DetalleInvestigacion({ obra = {}, explicacion = {} }) {
  const { t } = useI18n();
  const motivos = explicacion.motivos || [];
  const conocido = explicacion.conocido || [];
  const desconocido = explicacion.desconocido || [];
  const advertencias = explicacion.advertencias || [];
  const coste = explicacion.coste || obra.propuesta?.coste || { peticionesWeb: 0, llamadasModelo: 0 };

  return (
    <div className="mt-2 pt-2 border-t border-border/40 text-footnote flex flex-col gap-2">
      <div>
        <h5 className="font-semibold text-text-primary text-[12px]">{t('pending.investigation_why')}</h5>
        <ul className="list-disc list-inside text-text-secondary text-[11px] mt-0.5 space-y-0.5">
          {motivos.length > 0 ? (
            motivos.map((m, i) => (
              <li key={i}>
                <span>{m.valor}</span>
                {m.evidencia && <span className="opacity-75 ml-1">({t('pending.evidence_from', { obra: m.evidencia })})</span>}
              </li>
            ))
          ) : obra.propuesta?.motivo ? (
            <li>{obra.propuesta.motivo}</li>
          ) : null}
        </ul>
      </div>

      <div>
        <h5 className="font-semibold text-text-primary text-[12px]">{t('pending.investigation_known')}</h5>
        <ul className="list-disc list-inside text-text-secondary text-[11px] mt-0.5 space-y-0.5">
          {conocido.map((c, i) => {
            const texto = itemConocido(c, obra, t);
            return texto ? <li key={i}>{texto}</li> : null;
          })}
          {obra.synopsis && <li>{t('pending.known_synopsis')}</li>}
        </ul>
      </div>

      {desconocido.length > 0 && (
        <div>
          <h5 className="font-semibold text-text-primary text-[12px]">{t('pending.investigation_unknown')}</h5>
          <p className="text-text-secondary text-[11px] mt-0.5">
            {t('discover.not_published', { que: desconocido.map(c => t('discover.field.' + c)).join(', ') })}
          </p>
        </div>
      )}

      {advertencias.length > 0 && (
        <div>
          <h5 className="font-semibold text-amber-500/90 text-[12px]">{t('pending.investigation_warnings')}</h5>
          <p className="text-amber-500/80 text-[11px] mt-0.5">
            {t('discover.unverified', { que: advertencias.map(a => t('discover.field.' + a.campo)).join(', ') })}
          </p>
        </div>
      )}

      <div>
        <h5 className="font-semibold text-text-primary text-[12px]">{t('pending.investigation_cost')}</h5>
        <p className="text-text-secondary text-[11px] mt-0.5">
          {t('pending.cost_summary', { web: coste.peticionesWeb || 0, model: coste.llamadasModelo || 0 })}
        </p>
      </div>
    </div>
  );
}
