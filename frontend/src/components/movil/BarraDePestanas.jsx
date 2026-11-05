import { useI18n } from '../../i18n/I18nContext';
import { PESTANAS_MOVIL } from './pestanasMovil';

export default function BarraDePestanas({ vista, alIrA, avisoAsistente }) {
  const { t } = useI18n();
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-[60] bg-background/95 backdrop-blur-md border-t border-separator"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label={t('mobile.tabs')}
    >
      <ul className="flex">
        {PESTANAS_MOVIL.map(({ id, clave, icono: Icono, vistas }) => {
          const activa = vistas.includes(vista);
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => alIrA(id)}
                aria-current={activa ? 'page' : undefined}
                className={`w-full h-[49px] flex flex-col items-center justify-center gap-0.5 transition-colors duration-150 ${
                  activa ? 'text-accent' : 'text-text-secondary'
                }`}
              >
                <span className="relative">
                  <Icono className="w-6 h-6" strokeWidth={activa ? 2.2 : 1.75} />
                  {id === 'asistente' && avisoAsistente && (
                    <span
                      className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ${
                        avisoAsistente === 'respondiendo' ? 'bg-warning animate-pulse' : 'bg-success'
                      }`}
                      role="status"
                      aria-label={t(avisoAsistente === 'respondiendo' ? 'assistant.replying' : 'assistant.reply_ready')}
                    />
                  )}
                </span>
                <span className="text-[10px] font-medium leading-none">{t(clave)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
