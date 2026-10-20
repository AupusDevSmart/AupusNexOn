import { useEffect, useState } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { PlantasService } from '@/services/plantas.services';
import { getUnidadesByPlanta } from '@/services/unidades.services';
import { equipamentosApi } from '@/services/equipamentos.services';

interface Opcao {
  value: string;
  label: string;
}

/**
 * Planta → unidade → equipamento, em cascata (mesmo desenho do seletor das Regras de Logs,
 * sem o filtro de MQTT: chamado vale para qualquer equipamento).
 */
export function EquipamentoSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (equipamentoId: string) => void;
}) {
  const [plantaId, setPlantaId] = useState('');
  const [unidadeId, setUnidadeId] = useState('');
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
    setUnidadeId('');
    if (!plantaId) return;
    getUnidadesByPlanta(plantaId)
      .then((d: any) =>
        setUnidades((Array.isArray(d) ? d : []).map((u: any) => ({ value: String(u.id).trim(), label: u.nome }))),
      )
      .catch(() => setUnidades([]));
  }, [plantaId]);

  useEffect(() => {
    setEquipamentos([]);
    if (!unidadeId) return;
    equipamentosApi
      .findAll({ unidade_id: unidadeId, limit: 200 } as any)
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
  }, [unidadeId]);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1">
        <label className="text-sm font-medium">Planta</label>
        <Combobox
          options={plantas}
          value={plantaId}
          onValueChange={(v) => {
            setPlantaId(v);
            onChange('');
          }}
          placeholder="Selecione a planta"
          searchPlaceholder="Buscar planta..."
          emptyText="Nenhuma planta"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Unidade</label>
        <Combobox
          options={unidades}
          value={unidadeId}
          onValueChange={(v) => {
            setUnidadeId(v);
            onChange('');
          }}
          placeholder={plantaId ? 'Selecione a unidade' : 'Escolha a planta'}
          searchPlaceholder="Buscar unidade..."
          emptyText="Nenhuma unidade"
          disabled={!plantaId}
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Equipamento</label>
        <Combobox
          options={equipamentos}
          value={value}
          onValueChange={onChange}
          placeholder={unidadeId ? 'Selecione o equipamento' : 'Escolha a unidade'}
          searchPlaceholder="Buscar equipamento..."
          emptyText="Nenhum equipamento"
          disabled={!unidadeId}
        />
      </div>
    </div>
  );
}
