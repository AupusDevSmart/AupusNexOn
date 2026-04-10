import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RegrasLogsService, CampoMqtt } from '@/services/regras-logs.services';
import { api } from '@/config/api';

interface EquipamentoBasico {
  id: string;
  nome: string;
}

interface CampoMqttSelectorProps {
  equipamentoId: string;
  campoJson: string;
  onEquipamentoChange: (id: string) => void;
  onCampoChange: (path: string) => void;
  disabled?: boolean;
}

export function CampoMqttSelector({
  equipamentoId,
  campoJson,
  onEquipamentoChange,
  onCampoChange,
  disabled,
}: CampoMqttSelectorProps) {
  const [equipamentos, setEquipamentos] = useState<EquipamentoBasico[]>([]);
  const [campos, setCampos] = useState<CampoMqtt[]>([]);
  const [loadingEquip, setLoadingEquip] = useState(true);
  const [loadingCampos, setLoadingCampos] = useState(false);

  // Carregar equipamentos com MQTT habilitado
  useEffect(() => {
    async function fetchEquipamentos() {
      try {
        setLoadingEquip(true);
        const { data } = await api.get('/equipamentos', {
          params: { mqtt_habilitado: true, limit: 200 },
        });
        const lista = (data.data || data || []).map((e: any) => ({
          id: e.id?.trim(),
          nome: e.nome,
        }));
        setEquipamentos(lista);
      } catch (error) {
        console.error('Erro ao carregar equipamentos:', error);
      } finally {
        setLoadingEquip(false);
      }
    }
    fetchEquipamentos();
  }, []);

  // Carregar campos quando equipamento muda
  useEffect(() => {
    if (!equipamentoId) {
      setCampos([]);
      return;
    }
    async function fetchCampos() {
      try {
        setLoadingCampos(true);
        const result = await RegrasLogsService.getCampos(equipamentoId);
        setCampos(result);
      } catch (error) {
        console.error('Erro ao carregar campos:', error);
        setCampos([]);
      } finally {
        setLoadingCampos(false);
      }
    }
    fetchCampos();
  }, [equipamentoId]);

  return (
    <div className="space-y-4">
      <div>
        <Label>Equipamento</Label>
        <Select
          value={equipamentoId}
          onValueChange={onEquipamentoChange}
          disabled={disabled || loadingEquip}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={loadingEquip ? 'Carregando...' : 'Selecione o equipamento'}
            />
          </SelectTrigger>
          <SelectContent>
            {equipamentos.map((eq) => (
              <SelectItem key={eq.id} value={eq.id}>
                {eq.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Campo MQTT</Label>
        <Select
          value={campoJson}
          onValueChange={onCampoChange}
          disabled={disabled || loadingCampos || !equipamentoId}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                loadingCampos
                  ? 'Carregando campos...'
                  : !equipamentoId
                    ? 'Selecione um equipamento primeiro'
                    : campos.length === 0
                      ? 'Nenhum campo disponivel'
                      : 'Selecione o campo'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {campos.map((campo) => (
              <SelectItem key={campo.path} value={campo.path}>
                {campo.path} ({campo.ultimoValor})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
