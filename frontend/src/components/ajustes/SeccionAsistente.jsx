import { Bot } from 'lucide-react';
import { Seccion, Interruptor } from './piezas';
import { useI18n } from '../../i18n/I18nContext';
import useIniciativa from '../../hooks/useIniciativa';
import ClaveDeepSeek from './ClaveDeepSeek';

function Numero({ etiqueta, valor, max, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 max-w-md text-sm text-gray-300">
      <span>{etiqueta}</span>
      <input
        type="number" min="0" max={max} step="1" value={valor ?? 0}
        onChange={(e) => {
          const n = Math.max(0, Math.min(max, parseInt(e.target.value, 10) || 0));
          onChange(n);
        }}
        className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-right tabular-nums text-white"
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
      <div className="mb-6"><ClaveDeepSeek /></div>
      {!disponible || !ajustes ? (
        <p className="text-sm text-gray-500">{t('settings.assistant_off')}</p>
      ) : (
        <div className="space-y-5">
          <Interruptor
            activo={!!ajustes.paused}
            onChange={(v) => cambiar({ paused: v })}
            titulo={t('settings.assistant_paused')}
            descripcion={t('settings.assistant_paused_desc')}
          />
          <Interruptor
            activo={ajustes.proactive !== false}
            onChange={(v) => cambiar({ proactive: v })}
            titulo={t('settings.assistant_proactive')}
            descripcion={t('settings.assistant_proactive_desc')}
          />
          <div className="space-y-3 pl-[3.75rem]">
            <Numero etiqueta={t('settings.assistant_daily')} valor={ajustes.dailyCalls} max={1000}
              onChange={(n) => cambiar({ dailyCalls: n })} />
            <Numero etiqueta={t('settings.assistant_background')} valor={ajustes.backgroundCalls} max={1000}
              onChange={(n) => cambiar({ backgroundCalls: n })} />
            <p className="text-xs text-gray-500 tabular-nums">
              {t('settings.assistant_today', { n: consumo.calls, tope: ajustes.dailyCalls ?? 0 })}
            </p>
          </div>
          <label className="block pl-[3.75rem] max-w-md">
            <span className="block text-sm text-white font-medium">{t('settings.assistant_model')}</span>
            <span className="block text-xs text-gray-500 mt-0.5 mb-2">{t('settings.assistant_model_desc')}</span>

            <select
              value={ajustes.model}
              onChange={(e) => cambiar({ model: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm"
            >
              {[...new Set([ajustes.model, ...modelos])].filter(Boolean).map(m => (
                <option key={m} value={m} className="bg-zinc-900">{m}</option>
              ))}
            </select>
          </label>
          {error && <p className="text-xs text-red-400 pl-[3.75rem]">{error}</p>}
        </div>
      )}
    </Seccion>
  );
}
