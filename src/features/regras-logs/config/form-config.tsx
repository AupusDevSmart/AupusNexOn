import { useState, useEffect } from 'react';
import { FormField } from '@/types/base';
import { Combobox } from '@/components/ui/combobox';
import { RegrasLogsService, CampoMqtt } from '@/services/regras-logs.services';
import { PlantasService } from '@/services/plantas.services';
import { getUnidadesByPlanta } from '@/services/unidades.services';
import { equipamentosApi } from '@/services/equipamentos.services';
import { OPERADORES, SEVERIDADES } from '../types';

const PlantaUnidadeEquipamentoSelector = ({ value, onChange, disabled, onMultipleChange, formData }: any) => {
  const [plantas, setPlantas] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [loadingPlantas, setLoadingPlantas] = useState(true);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [loadingEquipamentos, setLoadingEquipamentos] = useState(false);

  const selectedPlantaId = formData?._plantaId || '';
  const selectedUnidadeId = formData?._unidadeId || '';

  useEffect(() => {
    async function fetch() {
      try {
        setLoadingPlantas(true);
        const response = await PlantasService.getAllPlantas({ limit: 100 });
        setPlantas(response.data || []);
      } catch (error) {
        console.error('Erro ao carregar plantas:', error);
      } finally {
        setLoadingPlantas(false);
      }
    }
    fetch();
  }, []);

  useEffect(() => {
    if (!selectedPlantaId) {
      setUnidades([]);
      setEquipamentos([]);
      return;
    }
    async function fetch() {
      try {
        setLoadingUnidades(true);
        const data = await getUnidadesByPlanta(selectedPlantaId);
        setUnidades(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Erro ao carregar unidades:', error);
        setUnidades([]);
      } finally {
        setLoadingUnidades(false);
      }
    }
    fetch();
  }, [selectedPlantaId]);

  useEffect(() => {
    if (!selectedUnidadeId) {
      setEquipamentos([]);
      return;
    }
    async function fetch() {
      try {
        setLoadingEquipamentos(true);
        const response = await equipamentosApi.findAll({
          unidade_id: selectedUnidadeId.trim(),
          mqtt_habilitado: true,
          limit: 100,
        });
        const list = (response as any)?.data?.data || (response as any)?.data || response?.data || [];
        setEquipamentos(Array.isArray(list) ? list : []);
      } catch (error) {
        console.error('Erro ao carregar equipamentos:', error);
        setEquipamentos([]);
      } finally {
        setLoadingEquipamentos(false);
      }
    }
    fetch();
  }, [selectedUnidadeId]);

  if (disabled) {
    const eq = equipamentos.find((e) => e.id === value);
    const planta = plantas.find((p) => p.id === selectedPlantaId);
    const unidade = unidades.find((u) => u.id === selectedUnidadeId);
    return (
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Planta</label>
          <div className="w-full px-3 py-2 border border-border bg-muted rounded-md text-foreground text-sm">
            {planta?.nome || '-'}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Unidade</label>
          <div className="w-full px-3 py-2 border border-border bg-muted rounded-md text-foreground text-sm">
            {unidade?.nome || '-'}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Equipamento</label>
          <div className="w-full px-3 py-2 border border-border bg-muted rounded-md text-foreground text-sm">
            {eq?.nome || value || 'N/A'}
          </div>
        </div>
      </div>
    );
  }

  const plantaOptions = plantas.map((p) => ({ value: p.id?.trim(), label: p.nome }));
  const unidadeOptions = unidades.map((u) => ({
    value: u.id?.trim(),
    label: u.cidade ? `${u.nome} - ${u.cidade}/${u.estado}` : u.nome,
  }));
  const equipamentoOptions = equipamentos.map((e) => ({ value: e.id?.trim(), label: e.nome }));

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Planta</label>
        <Combobox
          options={plantaOptions}
          value={selectedPlantaId}
          onValueChange={(id) => {
            if (onMultipleChange) {
              onMultipleChange({ _plantaId: id, _unidadeId: '', equipamento_id: '', campo_json: '' });
            }
          }}
          placeholder={loadingPlantas ? 'Carregando...' : 'Selecione a planta'}
          searchPlaceholder="Buscar planta..."
          emptyText="Nenhuma planta encontrada"
          disabled={loadingPlantas}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Unidade</label>
        <Combobox
          options={unidadeOptions}
          value={selectedUnidadeId}
          onValueChange={(id) => {
            if (onMultipleChange) {
              onMultipleChange({ _unidadeId: id, equipamento_id: '', campo_json: '' });
            }
          }}
          placeholder={
            !selectedPlantaId
              ? 'Selecione uma planta primeiro'
              : loadingUnidades
                ? 'Carregando unidades...'
                : 'Selecione a unidade'
          }
          searchPlaceholder="Buscar unidade..."
          emptyText="Nenhuma unidade encontrada"
          disabled={!selectedPlantaId || loadingUnidades}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Equipamento (MQTT)</label>
        <Combobox
          options={equipamentoOptions}
          value={value || ''}
          onValueChange={(id) => {
            onChange(id);
            if (onMultipleChange) {
              onMultipleChange({ equipamento_id: id, campo_json: '' });
            }
          }}
          placeholder={
            !selectedUnidadeId
              ? 'Selecione uma unidade primeiro'
              : loadingEquipamentos
                ? 'Carregando equipamentos...'
                : equipamentos.length === 0
                  ? 'Nenhum equipamento MQTT nesta unidade'
                  : 'Selecione o equipamento'
          }
          searchPlaceholder="Buscar equipamento..."
          emptyText="Nenhum equipamento MQTT encontrado"
          disabled={!selectedUnidadeId || loadingEquipamentos}
        />
      </div>
    </div>
  );
};

const CampoJsonSelector = ({ value, onChange, disabled, formData }: any) => {
  const [campos, setCampos] = useState<CampoMqtt[]>([]);
  const [loading, setLoading] = useState(false);
  const equipamentoId = formData?.equipamento_id;

  useEffect(() => {
    if (!equipamentoId) {
      setCampos([]);
      return;
    }
    async function fetch() {
      try {
        setLoading(true);
        const result = await RegrasLogsService.getCampos(equipamentoId);
        setCampos(result);
      } catch (error) {
        console.error('Erro ao carregar campos:', error);
        setCampos([]);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [equipamentoId]);

  if (disabled) {
    return (
      <div className="flex items-center p-3 border rounded-md bg-muted/30">
        <code className="text-sm font-mono">{value || 'N/A'}</code>
      </div>
    );
  }

  const options = campos.map((campo) => ({
    value: campo.path,
    label: `${campo.path} (${campo.ultimoValor})`,
  }));

  const placeholder = loading
    ? 'Carregando campos...'
    : !equipamentoId
      ? 'Selecione um equipamento primeiro'
      : campos.length === 0
        ? 'Nenhum campo disponivel'
        : 'Selecione o campo';

  return (
    <Combobox
      options={options}
      value={value || ''}
      onValueChange={onChange}
      placeholder={placeholder}
      searchPlaceholder="Buscar campo..."
      emptyText="Nenhum campo encontrado"
      disabled={disabled || loading || !equipamentoId}
    />
  );
};

const OperadorSelector = ({ value, onChange, disabled }: any) => {
  if (disabled) {
    const op = OPERADORES.find((o) => o.value === value);
    return (
      <div className="flex items-center p-3 border rounded-md bg-muted/30">
        <span className="text-sm font-medium">{op?.label || value || 'N/A'}</span>
      </div>
    );
  }

  const options = OPERADORES.map((op) => ({ value: op.value, label: op.label }));

  return (
    <Combobox
      options={options}
      value={value || '<'}
      onValueChange={onChange}
      placeholder="Selecione o operador"
      searchPlaceholder="Buscar operador..."
      emptyText="Nenhum operador encontrado"
      disabled={disabled}
    />
  );
};

const SeveridadeSelector = ({ value, onChange, disabled }: any) => {
  if (disabled) {
    return (
      <div className="flex items-center p-3 border rounded-md bg-muted/30">
        <span className="text-sm font-medium">{value || 'N/A'}</span>
      </div>
    );
  }

  const options = SEVERIDADES.map((s) => ({ value: s, label: s }));

  return (
    <Combobox
      options={options}
      value={value || 'MEDIA'}
      onValueChange={onChange}
      placeholder="Selecione a severidade"
      searchPlaceholder="Buscar severidade..."
      emptyText="Nenhuma severidade encontrada"
      disabled={disabled}
    />
  );
};

export const regrasLogsFormFields: FormField[] = [
  {
    key: 'equipamento_id',
    label: 'Equipamento',
    type: 'custom',
    required: true,
    render: PlantaUnidadeEquipamentoSelector,
    group: 'equipamento_mqtt',
    colSpan: 2,
  } as any,
  {
    key: 'campo_json',
    label: 'Campo MQTT',
    type: 'custom',
    required: true,
    render: CampoJsonSelector,
    group: 'equipamento_mqtt',
    dependencies: ['equipamento_id'],
    colSpan: 2,
  } as any,
  {
    key: 'nome',
    label: 'Nome da Regra',
    type: 'text',
    required: true,
    placeholder: 'Ex: Tensao baixa fase A',
    group: 'configuracao',
    colSpan: 2,
  } as any,
  {
    key: 'operador',
    label: 'Operador',
    type: 'custom',
    required: true,
    defaultValue: '<',
    render: OperadorSelector,
    group: 'configuracao',
  } as any,
  {
    key: 'valor',
    label: 'Valor',
    type: 'number',
    required: true,
    placeholder: '0',
    group: 'configuracao',
  },
  {
    key: 'mensagem',
    label: 'Mensagem',
    type: 'textarea',
    required: true,
    placeholder: 'Mensagem que sera registrada no log',
    group: 'configuracao',
    colSpan: 2,
  } as any,
  {
    key: 'severidade',
    label: 'Severidade',
    type: 'custom',
    required: true,
    defaultValue: 'MEDIA',
    render: SeveridadeSelector,
    group: 'configuracao',
  } as any,
  {
    key: 'cooldown_minutos',
    label: 'Cooldown (minutos)',
    type: 'number',
    required: true,
    defaultValue: 5,
    min: 1,
    placeholder: '5',
    group: 'configuracao',
  },
  {
    key: 'ativo',
    label: 'Ativo',
    type: 'checkbox',
    defaultValue: true,
    group: 'configuracao',
  } as any,
];

export const regrasLogsFormGroups = [
  {
    key: 'equipamento_mqtt',
    title: 'Equipamento e Campo MQTT',
    fields: ['equipamento_id', 'campo_json'],
  },
  {
    key: 'configuracao',
    title: 'Configuracao da Regra',
    fields: ['nome', 'operador', 'valor', 'mensagem', 'severidade', 'cooldown_minutos', 'ativo'],
  },
];
