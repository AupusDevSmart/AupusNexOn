import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { emptyKvRow, type KvRow } from '../iot-catalog-shapes';

export const cellInput = 'h-8 text-xs w-full rounded-sm';
// Select nativo (leve) — usado nas tabelas grandes pra evitar dezenas de
// instancias de Radix Select por linha.
export const selectCls =
  'h-8 text-xs w-full rounded-sm border border-input bg-background px-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
// Botao de adicionar compacto, reusado nas listas/tabelas do avancado.
export const addBtn = 'h-7 rounded-sm px-2 text-xs';

interface StringListFieldProps {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}

/** Lista editavel de strings (sem JSON). */
export function StringListField({
  label,
  values,
  onChange,
  placeholder,
  addLabel = 'Adicionar',
}: StringListFieldProps) {
  const update = (i: number, v: string) => onChange(values.map((x, idx) => (idx === i ? v : x)));
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i));
  const add = () => onChange([...values, '']);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <Button size="sm" variant="outline" className={addBtn} onClick={add}>
          <Plus className="h-3.5 w-3.5 mr-1" /> {addLabel}
        </Button>
      </div>
      {values.length > 0 && (
        <div className="space-y-1">
          {values.map((v, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                className={cellInput}
                value={v}
                onChange={(e) => update(i, e.target.value)}
                placeholder={placeholder}
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 shrink-0"
                onClick={() => remove(i)}
                title="Remover"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface KvEditorProps {
  label: string;
  rows: KvRow[];
  onChange: (next: KvRow[]) => void;
  nameLabel?: string;
  valueLabel?: string;
  namePlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
}

/** Tabela chave-valor editavel (sem JSON). */
export function KvEditor({
  label,
  rows,
  onChange,
  nameLabel = 'chave',
  valueLabel = 'valor',
  namePlaceholder,
  valuePlaceholder,
  addLabel = 'Adicionar',
}: KvEditorProps) {
  const update = (key: string, patch: Partial<KvRow>) =>
    onChange(rows.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  const remove = (key: string) => onChange(rows.filter((r) => r._key !== key));
  const add = () => onChange([...rows, emptyKvRow()]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <Button size="sm" variant="outline" className={addBtn} onClick={add}>
          <Plus className="h-3.5 w-3.5 mr-1" /> {addLabel}
        </Button>
      </div>
      {rows.length > 0 && (
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="font-medium pb-1 pr-2 w-[45%]">{nameLabel}</th>
              <th className="font-medium pb-1 pr-2">{valueLabel}</th>
              <th className="w-9" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._key}>
                <td className="py-0.5 pr-2 align-top">
                  <Input
                    className={`${cellInput} font-mono`}
                    value={row.name}
                    onChange={(e) => update(row._key, { name: e.target.value })}
                    placeholder={namePlaceholder}
                  />
                </td>
                <td className="py-0.5 pr-2 align-top">
                  <Input
                    className={cellInput}
                    value={row.value}
                    onChange={(e) => update(row._key, { value: e.target.value })}
                    placeholder={valuePlaceholder}
                  />
                </td>
                <td className="py-0.5 align-top">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => remove(row._key)}
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
