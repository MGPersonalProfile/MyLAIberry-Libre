import { Bot } from 'lucide-react';
import { Seccion, Interruptor } from './piezas';
import { Divider } from '../ui/List';
import { Notice } from '../ui/Feedback';
import { useI18n } from '../../i18n/I18nContext';
import useIniciativa from '../../hooks/useIniciativa';
import ClaveDeepSeek from './ClaveDeepSeek';

function Numero({ etiqueta, valor, max, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 max-w-md text-callout text-text-primary">
      <span>{etiqueta}</span>
      <input
        type="number" min="0" max={max} step="1" value={valor ?? 0}
        onChange={(e) => {
          const n = Math.max(0, Math.min(max, parseInt(e.target.value, 10) || 0));
          onChange(n);
        }}
        className="w-24 bg-surface-secondary border border-border rounded-md px-3 py-1.5 text-right tabular-nums text-text-primary"
      />
    </label>
  );
}

export default function SeccionAsistente() {
  const { t } = useI18n();
  const { disponible, ajustes, consumo, accion, modelos, error } = useIniciativa(null);
  const cambiar = (parche) => accion('settings', parche);

  return (
    <Seccion icono={Bot} titulo={t('settings.assistant')} descripcion={t('settings.assistant_desc')}>
      <div className="mb-5"><ClaveDeepSeek /></div>
      <Divider className="mb-4" />
      {!disponible || !ajustes ? (
        <p className="text-callout text-text-secondary">{t('settings.assistant_off')}</p>
      ) : (
        <div className="space-y-4">
          <Interruptor
            activo={!!ajustes.paused}
            onChange={(v) => cambiar({ paused: v })}
            titulo={t('settings.assistant_paused')}
            descripcion={t('settings.assistant_paused_desc')}
          />
          <Divider />
          <Interruptor
            activo={ajustes.proactive !== false}
            onChange={(v) => cambiar({ proactive: v })}
            titulo={t('settings.assistant_proactive')}
            descripcion={t('settings.assistant_proactive_desc')}
          />
          <Divider />
          <Interruptor
            activo={ajustes.desarrollador === true}
            onChange={(v) => cambiar({ desarrollador: v })}
            titulo={t('settings.assistant_developer')}
            descripcion={t('settings.assistant_developer_desc')}
          />
          <Divider />
          <div className="space-y-3">
            <Numero etiqueta={t('settings.assistant_daily')} valor={ajustes.dailyCalls} max={1000}
              onChange={(n) => cambiar({ dailyCalls: n })} />
            <Numero etiqueta={t('settings.assistant_background')} valor={ajustes.backgroundCalls} max={1000}
              onChange={(n) => cambiar({ backgroundCalls: n })} />
            <p className="text-footnote text-text-secondary tabular-nums">
              {t('settings.assistant_today', { n: consumo.calls, tope: ajustes.dailyCalls ?? 0 })}
            </p>
          </div>
          <Divider />
          <label className="block max-w-md">
            <span className="block text-callout text-text-primary font-medium">{t('settings.assistant_model')}</span>
            <span className="block text-footnote text-text-secondary mt-0.5 mb-2">{t('settings.assistant_model_desc')}</span>
            <select
              value={ajustes.model}
              onChange={(e) => cambiar({ model: e.target.value })}
              className="w-full bg-surface-secondary border border-border rounded-md px-3 py-2 text-text-primary font-mono text-callout"
            >
              {[...new Set([ajustes.model, ...modelos])].filter(Boolean).map(m => (
                <option key={m} value={m} className="bg-surface text-text-primary">{m}</option>
              ))}
            </select>
          </label>
          {error && <Notice tone="danger">{error}</Notice>}
        </div>
      )}
    </Seccion>
  );
}
