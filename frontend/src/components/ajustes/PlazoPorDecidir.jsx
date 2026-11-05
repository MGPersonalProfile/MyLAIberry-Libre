import { Hourglass } from 'lucide-react';

import { Seccion } from './piezas';
import { Tag } from '../ui/Feedback';
import { useI18n } from '../../i18n/I18nContext';

const OPCIONES = [6, 12, 24, 48, 72];

export default function PlazoPorDecidir({ valor = 24, alCambiar }) {
  const { t } = useI18n();
  return (
    <Seccion icono={Hourglass} titulo={t('settings.pending_hours')} descripcion={t('settings.pending_hours_hint')}>
      <div className="flex gap-1.5 flex-wrap" role="group" aria-label={t('settings.pending_hours')}>
        {OPCIONES.map(n => (
          <Tag key={n} tone="accent" active={valor === n} onClick={() => alCambiar(n)}>
            {t('settings.pending_hours_unit', { n })}
          </Tag>
        ))}
        {!OPCIONES.includes(valor) && <Tag tone="accent" active>{t('settings.pending_hours_unit', { n: valor })}</Tag>}
      </div>
    </Seccion>
  );
}
