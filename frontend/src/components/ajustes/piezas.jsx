import { SectionHeader, Card } from '../ui/Layout';
import { InsetGroupedList, ActionCell } from '../ui/List';
import { Switch, SegmentedControl } from '../ui/Controls';

export function Seccion({ icono, titulo, descripcion, children }) {
  return (
    <section className="py-5 md:py-6">
      <SectionHeader icon={icono} title={titulo} description={descripcion} />
      <InsetGroupedList padded>
        {children}
      </InsetGroupedList>
    </section>
  );
}

export function Dato({ valor, etiqueta, detalle }) {
  return (
    <Card className="bg-surface-secondary">
      <span className="block text-title-2 font-bold text-text-primary tabular-nums leading-none">{valor}</span>
      <span className="block text-caption uppercase tracking-wider text-text-secondary mt-2">{etiqueta}</span>
      {detalle && <span className="block text-footnote text-text-tertiary mt-1">{detalle}</span>}
    </Card>
  );
}

export function Interruptor({ activo, onChange, titulo, descripcion }) {
  return (
    <ActionCell
      title={titulo}
      subtitle={descripcion}
      onClick={() => onChange?.(!activo)}
      className="-mx-2 px-2 rounded-md select-none"
      trailing={
        <Switch
          checked={activo}
          onChange={onChange}
          label={titulo}
        />
      }
    />
  );
}

export function Opciones({ valor, opciones, onChange }) {
  return (
    <SegmentedControl
      value={valor}
      onChange={onChange}
      showCheck
      options={opciones.map(o => ({
        id: o.id,
        label: o.etiqueta,
        icon: o.icono
      }))}
    />
  );
}
