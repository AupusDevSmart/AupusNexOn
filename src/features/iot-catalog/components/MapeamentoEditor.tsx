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
  DATA_TYPES,
  FACTORS,
  MODES,
  emptyAiBlockRow,
  type AiBlockRow,
  type AiMapRow,
  type BiBlockForm,
  type BiBoMapRow,
  type HandshakeForm,
  type MapeamentoForm,
} from '../iot-catalog-shapes';
import { KvEditor, addBtn, cellInput, selectCls } from './editor-fields';

interface Props {
  value: MapeamentoForm;
  onChange: (next: MapeamentoForm) => void;
  /** false enquanto nenhum tipo foi escolhido (sem pontos pra gerar linhas). */
  hasTipo: boolean;
}

export function MapeamentoEditor({ value, onChange, hasTipo }: Props) {
  const updateBlock = (key: string, patch: Partial<AiBlockRow>) =>
    onChange({
      ...value,
      aiBlocks: value.aiBlocks.map((b) => (b._key === key ? { ...b, ...patch } : b)),
    });
  const addBlock = () => onChange({ ...value, aiBlocks: [...value.aiBlocks, emptyAiBlockRow()] });
  const removeBlock = (key: string) =>
    onChange({ ...value, aiBlocks: value.aiBlocks.filter((b) => b._key !== key) });

  const updateAi = (key: string, patch: Partial<AiMapRow>) =>
    onChange({
      ...value,
      aiRows: value.aiRows.map((r) => (r._key === key ? { ...r, ...patch } : r)),
    });
  const removeAi = (key: string) =>
    onChange({ ...value, aiRows: value.aiRows.filter((r) => r._key !== key) });

  const updateBibo = (which: 'biRows' | 'boRows', key: string, patch: Partial<BiBoMapRow>) =>
    onChange({
      ...value,
      [which]: value[which].map((r) => (r._key === key ? { ...r, ...patch } : r)),
    });
  const removeBibo = (which: 'biRows' | 'boRows', key: string) =>
    onChange({ ...value, [which]: value[which].filter((r) => r._key !== key) });

  const updateBiBlock = (patch: Partial<BiBlockForm>) =>
    onChange({ ...value, biBlock: { ...value.biBlock, ...patch } });
  const updateHandshake = (patch: Partial<HandshakeForm>) =>
    onChange({ ...value, handshake: { ...value.handshake, ...patch } });

  return (
    <div className="space-y-4">
      {/* ai_blocks */}
      <div className="space-y-2 rounded-md border p-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium">Blocos AI (ai_blocks)</h4>
            <p className="text-xs text-muted-foreground">
              Leitura em bloco. O indice (#) e' referenciado em "block" nos pontos AI.
            </p>
          </div>
          <Button size="sm" variant="outline" className={addBtn} onClick={addBlock}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Bloco
          </Button>
        </div>
        {value.aiBlocks.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Nenhum bloco.</p>
        ) : (
          <table className="w-full table-fixed text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="font-medium pb-1 pr-2 w-9">#</th>
                <th className="font-medium pb-1 pr-2 w-[20%]">start *</th>
                <th className="font-medium pb-1 pr-2 w-[16%]">count *</th>
                <th className="font-medium pb-1 pr-2 w-[16%]">func</th>
                <th className="font-medium pb-1 pr-2">label</th>
                <th className="w-9" />
              </tr>
            </thead>
            <tbody>
              {value.aiBlocks.map((b, i) => (
                <tr key={b._key}>
                  <td className="py-0.5 pr-2 font-mono text-muted-foreground align-top pt-2.5">{i}</td>
                  <td className="py-0.5 pr-2 align-top">
                    <Input
                      className={cellInput}
                      value={b.start}
                      onChange={(e) => updateBlock(b._key, { start: e.target.value })}
                      placeholder="700"
                      inputMode="numeric"
                    />
                  </td>
                  <td className="py-0.5 pr-2 align-top">
                    <Input
                      className={cellInput}
                      value={b.count}
                      onChange={(e) => updateBlock(b._key, { count: e.target.value })}
                      placeholder="23"
                      inputMode="numeric"
                    />
                  </td>
                  <td className="py-0.5 pr-2 align-top">
                    <Input
                      className={cellInput}
                      value={b.func}
                      onChange={(e) => updateBlock(b._key, { func: e.target.value })}
                      placeholder="3"
                      inputMode="numeric"
                    />
                  </td>
                  <td className="py-0.5 pr-2 align-top">
                    <Input
                      className={cellInput}
                      value={b.label}
                      onChange={(e) => updateBlock(b._key, { label: e.target.value })}
                      placeholder="Analogicos principais"
                    />
                  </td>
                  <td className="py-0.5 align-top">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => removeBlock(b._key)}
                      title="Remover bloco"
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

      {!hasTipo ? (
        <p className="text-sm text-muted-foreground rounded-md border border-dashed p-4 text-center">
          Selecione um tipo para carregar os pontos a mapear.
        </p>
      ) : (
        <>
          {/* AI pontos */}
          <div className="space-y-2 rounded-md border p-3">
            <div>
              <h4 className="text-sm font-medium">Pontos AI (ai_map)</h4>
              <p className="text-xs text-muted-foreground">
                Uma linha por ponto do tipo. Preencha block/offset dos que o modelo expoe.
              </p>
            </div>
            {value.aiRows.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Tipo sem pontos AI.</p>
            ) : (
              <table className="w-full table-fixed text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="font-medium pb-1 pr-2 w-[16%]">ponto</th>
                    <th className="font-medium pb-1 pr-2 w-[9%]">block</th>
                    <th className="font-medium pb-1 pr-2 w-[9%]">offset</th>
                    <th className="font-medium pb-1 pr-2 w-[15%]">scale</th>
                    <th className="font-medium pb-1 pr-2 w-[15%]">dataType</th>
                    <th className="font-medium pb-1 pr-2 w-[12%]">mode</th>
                    <th className="font-medium pb-1 pr-2 w-[13%]">factor</th>
                    <th className="w-9" />
                  </tr>
                </thead>
                <tbody>
                  {value.aiRows.map((row) => (
                    <tr key={row._key}>
                      <td className="py-0.5 pr-2 align-top pt-2">
                        {row.orphan ? (
                          <Input
                            className={`${cellInput} font-mono`}
                            value={row.pointId}
                            onChange={(e) => updateAi(row._key, { pointId: e.target.value })}
                            placeholder="ponto"
                          />
                        ) : (
                          <span className="font-mono break-all" title={row.pointLabel}>
                            {row.pointId}
                          </span>
                        )}
                      </td>
                      <td className="py-0.5 pr-2 align-top">
                        <select
                          className={selectCls}
                          value={row.block}
                          onChange={(e) => updateAi(row._key, { block: e.target.value })}
                        >
                          <option value="">—</option>
                          {value.aiBlocks.map((_, i) => (
                            <option key={i} value={String(i)}>
                              {i}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-0.5 pr-2 align-top">
                        <Input
                          className={cellInput}
                          value={row.offset}
                          onChange={(e) => updateAi(row._key, { offset: e.target.value })}
                          placeholder="0"
                          inputMode="numeric"
                        />
                      </td>
                      <td className="py-0.5 pr-2 align-top">
                        <Input
                          className={cellInput}
                          value={row.scale}
                          onChange={(e) => updateAi(row._key, { scale: e.target.value })}
                          placeholder="10 / voltage"
                        />
                      </td>
                      <td className="py-0.5 pr-2 align-top">
                        <select
                          className={selectCls}
                          value={row.dataType}
                          onChange={(e) => updateAi(row._key, { dataType: e.target.value })}
                        >
                          <option value="">—</option>
                          {DATA_TYPES.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-0.5 pr-2 align-top">
                        <select
                          className={selectCls}
                          value={row.mode}
                          onChange={(e) => updateAi(row._key, { mode: e.target.value })}
                        >
                          <option value="">—</option>
                          {MODES.map((mo) => (
                            <option key={mo} value={mo}>
                              {mo}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-0.5 pr-2 align-top">
                        <select
                          className={selectCls}
                          value={row.apply_factor}
                          onChange={(e) => updateAi(row._key, { apply_factor: e.target.value })}
                        >
                          <option value="">—</option>
                          {FACTORS.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-0.5 align-top">
                        {row.orphan && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => removeAi(row._key)}
                            title="Remover ponto orfao"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <BiboSection
            title="Pontos BI (bi_map)"
            hint="Estados/protecoes. Use register/coil/func conforme o equipamento."
            rows={value.biRows}
            onUpdate={(key, patch) => updateBibo('biRows', key, patch)}
            onRemove={(key) => removeBibo('biRows', key)}
          />
          <BiboSection
            title="Pontos BO (bo_map)"
            hint="Comandos. Use coil/func."
            rows={value.boRows}
            onUpdate={(key, patch) => updateBibo('boRows', key, patch)}
            onRemove={(key) => removeBibo('boRows', key)}
          />
        </>
      )}

      {/* Avancado estruturado */}
      <Collapsible className="rounded-md border">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-3 text-left [&[data-state=open]>svg]:rotate-180">
          <div>
            <h4 className="text-sm font-medium">Avancado</h4>
            <p className="text-xs text-muted-foreground">
              Escalas, leitura de coils, handshake e metadados (num_mppts, word_order...).
            </p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 px-3 pb-3">
          <KvEditor
            label="Escalas (scales)"
            rows={value.scales}
            onChange={(scales) => onChange({ ...value, scales })}
            nameLabel="nome"
            valueLabel="fator"
            namePlaceholder="voltage"
            valuePlaceholder="128"
            addLabel="Escala"
          />

          <div className="grid grid-cols-2 gap-4">
            <Triplet
              label="Leitura de coils (bi_block)"
              fields={[
                ['start', value.biBlock.start, (v) => updateBiBlock({ start: v }), '0'],
                ['count', value.biBlock.count, (v) => updateBiBlock({ count: v }), '53'],
                ['func', value.biBlock.func, (v) => updateBiBlock({ func: v }), '1'],
              ]}
            />
            <Triplet
              label="Handshake (boot)"
              fields={[
                ['register', value.handshake.register, (v) => updateHandshake({ register: v }), '136'],
                ['count', value.handshake.count, (v) => updateHandshake({ count: v }), '2'],
                ['func', value.handshake.func, (v) => updateHandshake({ func: v }), '3'],
              ]}
            />
          </div>

          <KvEditor
            label="Metadados"
            rows={value.meta}
            onChange={(meta) => onChange({ ...value, meta })}
            nameLabel="chave"
            valueLabel="valor"
            namePlaceholder="num_mppts"
            valuePlaceholder="12 / low_first"
            addLabel="Metadado"
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface TripletProps {
  label: string;
  fields: Array<[string, string, (v: string) => void, string]>;
}

function Triplet({ label, fields }: TripletProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="grid grid-cols-3 gap-2">
        {fields.map(([name, val, onChange, placeholder]) => (
          <div key={name} className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{name}</Label>
            <Input
              className={cellInput}
              value={val}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              inputMode="numeric"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface BiboSectionProps {
  title: string;
  hint: string;
  rows: BiBoMapRow[];
  onUpdate: (key: string, patch: Partial<BiBoMapRow>) => void;
  onRemove: (key: string) => void;
}

function BiboSection({ title, hint, rows, onUpdate, onRemove }: BiboSectionProps) {
  return (
    <Collapsible className="rounded-md border">
      <CollapsibleTrigger className="flex w-full items-center justify-between p-3 text-left [&[data-state=open]>svg]:rotate-180">
        <div>
          <h4 className="text-sm font-medium">
            {title} <span className="text-muted-foreground">({rows.length})</span>
          </h4>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Tipo sem pontos.</p>
        ) : (
          <table className="w-full table-fixed text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="font-medium pb-1 pr-2 w-[34%]">ponto</th>
                <th className="font-medium pb-1 pr-2 w-[24%]">register</th>
                <th className="font-medium pb-1 pr-2 w-[18%]">coil</th>
                <th className="font-medium pb-1 pr-2 w-[18%]">func</th>
                <th className="w-9" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._key}>
                  <td className="py-0.5 pr-2 align-top pt-2">
                    {row.orphan ? (
                      <Input
                        className={`${cellInput} font-mono`}
                        value={row.pointId}
                        onChange={(e) => onUpdate(row._key, { pointId: e.target.value })}
                        placeholder="ponto"
                      />
                    ) : (
                      <span className="font-mono break-all" title={row.pointLabel}>
                        {row.pointId}
                      </span>
                    )}
                  </td>
                  <td className="py-0.5 pr-2 align-top">
                    <Input
                      className={cellInput}
                      value={row.register}
                      onChange={(e) => onUpdate(row._key, { register: e.target.value })}
                      placeholder="673"
                      inputMode="numeric"
                    />
                  </td>
                  <td className="py-0.5 pr-2 align-top">
                    <Input
                      className={cellInput}
                      value={row.coil}
                      onChange={(e) => onUpdate(row._key, { coil: e.target.value })}
                      placeholder="2"
                      inputMode="numeric"
                    />
                  </td>
                  <td className="py-0.5 pr-2 align-top">
                    <Input
                      className={cellInput}
                      value={row.func}
                      onChange={(e) => onUpdate(row._key, { func: e.target.value })}
                      placeholder="1"
                      inputMode="numeric"
                    />
                  </td>
                  <td className="py-0.5 align-top">
                    {row.orphan && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => onRemove(row._key)}
                        title="Remover ponto orfao"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
