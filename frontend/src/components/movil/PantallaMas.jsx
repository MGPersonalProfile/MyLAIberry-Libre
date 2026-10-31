import { Bookmark, Users, Compass, Settings, Download, ChevronRight } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

function Grupo({ children }) {
  return <ul className="rounded-2xl bg-white/[0.06] overflow-hidden divide-y divide-white/10">{children}</ul>;
}

function Fila({ icono: Icono, color, titulo, alPulsar }) {
  return (
    <li>
      <button type="button" onClick={alPulsar} className="w-full h-[52px] px-4 flex items-center gap-3 text-left active:bg-white/10">
        <span className={`w-8 h-8 rounded-lg grid place-items-center ${color}`}><Icono className="w-[18px] h-[18px] text-white" /></span>
        <span className="flex-1 text-[17px]">{titulo}</span>
        <ChevronRight className="w-5 h-5 text-gray-500" />
      </button>
    </li>
  );
}

export default function PantallaMas({ alIrA, alImportar }) {
  const { t } = useI18n();
  return (
    <main className="px-4 pt-24 pb-8 space-y-6 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold">{t('mobile.more')}</h1>
      <Grupo>
        <Fila icono={Bookmark} color="bg-red-600" titulo={t('nav.mylist')} alPulsar={() => alIrA('milista')} />
        <Fila icono={Users} color="bg-sky-600" titulo={t('nav.authors')} alPulsar={() => alIrA('autores')} />
        <Fila icono={Compass} color="bg-amber-600" titulo={t('carousel.discoveries')} alPulsar={() => alIrA('descubrimientos')} />
      </Grupo>
      <Grupo>
        <Fila icono={Download} color="bg-emerald-600" titulo={t('mobile.import')} alPulsar={alImportar} />
        <Fila icono={Settings} color="bg-zinc-600" titulo={t('settings.nav')} alPulsar={() => alIrA('ajustes')} />
      </Grupo>
    </main>
  );
}
