import { useEffect, useState } from 'react';
import { Hourglass, Check, X } from 'lucide-react';

import Cover from '../Cover';
import { Card, SectionHeader } from '../ui/Layout';
import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { Tag } from '../ui/Feedback';
import { useI18n } from '../../i18n/I18nContext';
import { pulsable } from '../../pulsable';
import { porDecidir, restante } from './plazo';

export default function PorDecidir({ items = [], onDetalle, onGuardar, onDescartar }) {
  const { t } = useI18n();
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 60000);
    return () => clearInterval(reloj);
  }, []);

  const lista = porDecidir(items);
  if (!lista.length) return null;

  return (
    <section aria-labelledby="por-decidir" className="mb-8">
      <SectionHeader icon={Hourglass} title={<span id="por-decidir">{t('pending.title')}</span>}
        description={t('pending.subtitle')}
        action={<Tag tone="accent">{t('pending.count', { n: lista.length })}</Tag>} />
      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {lista.map(item => {
          const queda = restante(item.propuesta.vence, ahora);
          return (
            <li key={item.id}>
              <Card className="flex gap-3">
                <div className="w-16 shrink-0 aspect-[2/3] rounded-md overflow-hidden cursor-pointer" {...pulsable(() => onDetalle?.(item), item.title)} tabIndex={-1}>
                  <Cover story={item} className="w-full h-full" imgClassName="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                  <div className="cursor-pointer" {...pulsable(() => onDetalle?.(item), item.title)}>
                    <h4 className="text-headline text-text-primary leading-snug line-clamp-2">{item.title}</h4>
                    <p className="text-footnote text-text-secondary line-clamp-1">{[item.author, item.source].filter(Boolean).join(' · ')}</p>
                  </div>
                  <Tag tone={queda.n === 0 || queda.clave === 'pending.in_minutes' ? 'warning' : 'neutral'} className="self-start">
                    {t(queda.clave, { n: queda.n })}
                  </Tag>
                  {item.synopsis && <p className="text-footnote text-text-secondary line-clamp-3">{item.synopsis}</p>}
                  {item.propuesta.motivo && <p className="text-caption text-text-tertiary line-clamp-1">{t('pending.why', { motivo: item.propuesta.motivo })}</p>}
                  <div className="flex gap-2 mt-1">
                    <PrimaryButton icon={Check} className="flex-1" aria-label={t('pending.keep_aria', { title: item.title })} onClick={() => onGuardar?.(item)}>
                      {t('pending.keep')}
                    </PrimaryButton>
                    <SecondaryButton icon={X} className="flex-1" aria-label={t('pending.discard_aria', { title: item.title })} onClick={() => onDescartar?.(item)}>
                      {t('pending.discard')}
                    </SecondaryButton>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
