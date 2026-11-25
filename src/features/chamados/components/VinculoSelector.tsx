import { useEffect, useState } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { PlantasService } from '@/services/plantas.services';
import { getUnidadesByPlanta } from '@/services/unidades.services';
import { equipamentosApi } from '@/services/equipamentos.services';
import type { Vinculo } from '../utils/vinculo';

interface Opcao {
  value: string;
  label: string;
}


/**
 * Planta → instalação → equipamento, controlado. No chamado de reparo o equipamento é
 * obrigatório; no externo (Equatorial...) basta a planta, instalação e equipamento são opcionais.
 */
export function VinculoSelector({
  value,
  onChange,
  equipamentoObrigatorio,
}: {
  value: Vinculo;
  onChange: (v: Vinculo) => void;
  equipamentoObrigatorio: boolean;
}) {
  const [plantas, setPlantas] = useState<Opcao[]>([]);
  const [unidades, setUnidades] = useState<Opcao[]>([]);
  const [equipamentos, setEquipamentos] = useState<Opcao[]>([]);

  useEffect(() => {
    PlantasService.getAllPlantas({ limit: 100 })
      .then((r: any) => setPlantas((r?.data ?? []).map((p: any) => ({ value: String(p.id).trim(), label: p.nome }))))
      .catch(() => setPlantas([]));
  }, []);

  useEffect(() => {
    setUnidades([]);
    if (!value.planta_id) return;
    getUnidadesByPlanta(value.planta_id)
      .then((d: any) =>
        setUnidades((Array.isArray(d) ? d : []).map((u: any) => ({ value: String(u.id).trim(), label: u.nome }))),
      )
      .catch(() => setUnidades([]));
  }, [value.planta_id]);

  useEffect(() => {
    setEquipamentos([]);
    if (!value.unidade_id) return;
    equipamentosApi
      .findAll({ unidade_id: value.unidade_id, limit: 200 } as any)
      .then((r: any) => {
        const lista = r?.data?.data ?? r?.data ?? [];
        setEquipamentos(
          (Array.isArray(lista) ? lista : []).map((e: any) => ({
            value: String(e.id).trim(),
            label: e.tag ? `${e.nome} (${e.tag})` : e.nome,
          })),
        );
      })
      .catch(() => setEquipamentos([]));
  }, [value.unidade_id]);

  const opcional = equipamentoObrigatorio ? null : <span className="font-normal text-muted-foreground"> (opcional)</span>;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="min-w-0 space-y-1.5">
        <label className="text-sm font-medium">Planta</label>
        <Combobox
          options={plantas}
          value={value.planta_id}
          onValueChange={(v) => onChange({ planta_id: v, unidade_id: '', equipamento_id: '' })}
          placeholder="Selecione a planta"
          searchPlaceholder="Buscar planta..."
          emptyText="Nenhuma planta"
        />
      </div>
      <div className="min-w-0 space-y-1.5">
        <label className="text-sm font-medium">Instalação{opcional}</label>
        <Combobox
          options={unidades}
          value={value.unidade_id}
          onValueChange={(v) => onChange({ ...value, unidade_id: v, equipamento_id: '' })}
          placeholder={value.planta_id ? 'Selecione a instalação' : 'Escolha a planta'}
          searchPlaceholder="Buscar instalação..."
          emptyText="Nenhuma instalação"
          disabled={!value.planta_id}
        />
      </div>
      <div className="min-w-0 space-y-1.5">
        <label className="text-sm font-medium">Equipamento{opcional}</label>
        <Combobox
          options={equipamentos}
          value={value.equipamento_id}
          onValueChange={(v) => onChange({ ...value, equipamento_id: v })}
          placeholder={value.unidade_id ? 'Selecione o equipamento' : 'Escolha a instalação'}
          searchPlaceholder="Buscar equipamento..."
          emptyText="Nenhum equipamento"
          disabled={!value.unidade_id}
        />
      </div>
    </div>
  );
}
