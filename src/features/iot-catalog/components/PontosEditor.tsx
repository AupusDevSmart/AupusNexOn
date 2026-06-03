import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  TIMESTAMP_FORMATS,
  TIMESTAMP_POSITIONS,
  emptyPontoRow,
  type PontoKind,
  type PontoRow,
  type PontosForm,
  type PublishForm,
} from '../iot-catalog-shapes';
import { StringListField, addBtn, cellInput, selectCls } from './editor-fields';

interface Props {
  value: PontosForm;
  onChange: (next: PontosForm) => void;
}

const SECTIONS: { kind: PontoKind; title: string; hint: string }[] = [
  { kind: 'ai', title: 'Analog Inputs (AI)', hint: 'Grandezas analogicas medidas' },
  { kind: 'bi', title: 'Binary Inputs (BI)', hint: 'Estados / protecoes lidas' },
  { kind: 'bo', title: 'Binary Outputs (BO)', hint: 'Comandos enviados' },
];

export function PontosEditor({ value, onChange }: Props) {
  const updateRow = (kind: PontoKind, key: string, patch: Partial<PontoRow>) => {
    onChange({
      ...value,
      [kind]: value[kind].map((r) => (r._key === key ? { ...r, ...patch } : r)),
    });
  };
  const addRow = (kind: PontoKind) => onChange({ ...value, [kind]: [...value[kind], emptyPontoRow()] });
  const removeRow = (kind: PontoKind, key: string) =>
    onChange({ ...value, [kind]: value[kind].filter((r) => r._key !== key) });

  const updatePublish = (patch: Partial<PublishForm>) =>
    onChange({ ...value, publish: { ...value.publish, ...patch } });

  return (
    <div className="space-y-4">
      {SECTIONS.map(({ kind, title, hint }) => {
        const rows = value[kind];
        return (
          <div key={kind} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">{title}</h4>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
              <Button size="sm" variant="outline" className={addBtn} onClick={() => addRow(kind)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Ponto
              </Button>
            </div>

            {rows.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhum ponto.</p>
            ) : (
              <table className="w-full table-fixed text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="font-medium pb-1 pr-2 w-[15%]">id *</th>
                    <th className="font-medium pb-1 pr-2 w-[22%]">label</th>
                    <th className="font-medium pb-1 pr-2 w-[9%]">unit</th>
                    <th className="font-medium pb-1 pr-2 w-[14%]">group</th>
                    <th className="font-medium pb-1 pr-2 w-[20%]">json</th>
                    <th className="font-medium pb-1 pr-2 w-[11%]">format</th>
                    <th className="w-9" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row._key}>
                      <td className="py-0.5 pr-2 align-top">
                        <Input
                          className={`${cellInput} font-mono`}
                          value={row.id}
                          onChange={(e) => updateRow(kind, row._key, { id: e.target.value })}
                          placeholder="va"
                        />
                      </td>
                      <td className="py-0.5 pr-2 align-top">
                        <Input
                          className={cellInput}
                          value={row.label}
                          onChange={(e) => updateRow(kind, row._key, { label: e.target.value })}
                          placeholder="Tensao Fase A"
                        />
                      </td>
                      <td className="py-0.5 pr-2 align-top">
                        <Input
                          className={cellInput}
                          value={row.unit}
                          onChange={(e) => updateRow(kind, row._key, { unit: e.target.value })}
                          placeholder="V"
                        />
                      </td>
                      <td className="py-0.5 pr-2 align-top">
                        <Input
                          className={cellInput}
                          value={row.group}
                          onChange={(e) => updateRow(kind, row._key, { group: e.target.value })}
                          placeholder="tensao"
                        />
                      </td>
                      <td className="py-0.5 pr-2 align-top">
                        <Input
                          className={`${cellInput} font-mono`}
                          value={row.json}
                          onChange={(e) => updateRow(kind, row._key, { json: e.target.value })}
                          placeholder="info.va"
                        />
                      </td>
                      <td className="py-0.5 pr-2 align-top">
                        <Input
                          className={cellInput}
                          value={row.format}
                          onChange={(e) => updateRow(kind, row._key, { format: e.target.value })}
                          placeholder="hex"
                        />
                      </td>
                      <td className="py-0.5 align-top">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => removeRow(kind, row._key)}
                          title="Remover ponto"
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
      })}

      <Collapsible className="rounded-md border">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-3 text-left [&[data-state=open]>svg]:rotate-180">
          <div>
            <h4 className="text-sm font-medium">Avancado</h4>
            <p className="text-xs text-muted-foreground">Ordem dos grupos e configuracao de publicacao.</p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 px-3 pb-3">
          <StringListField
            label="Ordem dos grupos (group_order)"
            values={value.groupOrder}
            onChange={(groupOrder) => onChange({ ...value, groupOrder })}
            placeholder="info"
            addLabel="Grupo"
          />

          <div className="space-y-2">
            <Label className="text-xs">Publicacao (publish)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">timestamp_format</Label>
                <select
                  className={selectCls}
                  value={value.publish.timestamp_format}
                  onChange={(e) => updatePublish({ timestamp_format: e.target.value })}
                >
                  <option value="">—</option>
                  {TIMESTAMP_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">timestamp_position</Label>
                <select
                  className={selectCls}
                  value={value.publish.timestamp_position}
                  onChange={(e) => updatePublish({ timestamp_position: e.target.value })}
                >
                  <option value="">—</option>
                  {TIMESTAMP_POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <StringListField
              label="meta_fields"
              values={value.publish.meta_fields}
              onChange={(meta_fields) => updatePublish({ meta_fields })}
              placeholder="inverter_id"
              addLabel="Campo"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
