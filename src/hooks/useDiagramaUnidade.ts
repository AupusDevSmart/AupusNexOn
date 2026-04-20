// src/hooks/useDiagramaUnidade.ts

import { useState, useEffect, useCallback } from 'react';
import { DiagramasService, type Diagrama } from '@/services/diagramas.services';
import { EquipamentosService, type Equipamento } from '@/services/equipamentos.services';
import { getUnidadeById } from '@/services/unidades.services';
import type { UnidadeNexon as Unidade } from '@/types/unidades';
import type { ComponenteDU } from '@/types/dtos/sinoptico-ativo';

interface UseDiagramaUnidadeResult {
  unidade: Unidade | null;
  diagrama: Diagrama | null;
  equipamentos: Equipamento[];
  componentes: ComponenteDU[];
  loading: boolean;
  error: string | null;
  reloadDiagrama: () => Promise<void>;
  saveDiagrama: (componentes: ComponenteDU[], connections: any[]) => Promise<void>;
}

export function useDiagramaUnidade(unidadeId: string | undefined): UseDiagramaUnidadeResult {
  const [unidade, setUnidade] = useState<Unidade | null>(null);
  const [diagrama, setDiagrama] = useState<Diagrama | null>(null);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [componentes, setComponentes] = useState<ComponenteDU[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Função para mapear equipamentos da API para componentes do diagrama
  const mapEquipamentoToComponente = useCallback((equip: Equipamento, index: number): ComponenteDU => {
    // Se o equipamento já está no diagrama, usar a posição dele
    const posicao = equip.posicao_x !== undefined && equip.posicao_y !== undefined
      ? { x: equip.posicao_x, y: equip.posicao_y }
      : { x: 100 + (index % 5) * 150, y: 100 + Math.floor(index / 5) * 150 }; // Grid automático

    return {
      id: equip.id,
      tipo: equip.tipoEquipamento?.codigo || 'MEDIDOR', // Usar código do tipo
      nome: equip.nome,
      tag: equip.tag,
      posicao,
      rotacao: equip.rotacao || 0,
      status: (equip.status as any) || 'NORMAL',
      dados: equip.propriedades || {},
      equipamentoId: equip.id,
      fabricante: equip.fabricante,
      modelo: equip.modelo,
      numeroSerie: equip.numero_serie,
    };
  }, []);

  // Carregar dados da unidade
  const loadData = useCallback(async () => {
    if (!unidadeId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('📡 Loading data for unidade:', unidadeId);

      // Carregar unidade
      const unidadeData = await getUnidadeById(unidadeId);
      setUnidade(unidadeData);
      console.log('✅ Unidade loaded:', unidadeData.nome);

      // Tentar carregar diagrama ativo
      let diagramaData: Diagrama | null = null;
      try {
        diagramaData = await DiagramasService.getActiveDiagrama(unidadeId);
        setDiagrama(diagramaData);
        if (diagramaData) {
          console.log('✅ Diagrama ativo loaded:', diagramaData.nome);
        } else {
          console.log('⚠️ Nenhum diagrama ativo encontrado');
        }
      } catch (err) {
        console.warn('⚠️ Erro ao carregar diagrama, continuando sem ele:', err);
      }

      // Carregar equipamentos da unidade
      const equipamentosResponse = await EquipamentosService.getEquipamentosByUnidade(unidadeId, {
        limit: 100,
      });
      const equipamentosData = equipamentosResponse.data || [];
      setEquipamentos(equipamentosData);
      console.log('✅ Equipamentos loaded:', equipamentosData.length);

      // Mapear equipamentos para componentes do diagrama
      let componentesData: ComponenteDU[];

      if (diagramaData && diagramaData.equipamentos && diagramaData.equipamentos.length > 0) {
        // Se temos diagrama salvo, usar as posições dele
        componentesData = diagramaData.equipamentos
          .map((diagEquip) => {
            const equip = equipamentosData.find(e => e.id === diagEquip.equipamento_id);
            if (!equip) return null;

            return {
              id: equip.id,
              tipo: equip.tipoEquipamento?.codigo || 'MEDIDOR',
              nome: equip.nome,
              tag: equip.tag,
              posicao: { x: diagEquip.posicao_x, y: diagEquip.posicao_y },
              rotacao: diagEquip.rotacao || 0,
              status: (equip.status as any) || 'NORMAL',
              dados: equip.propriedades || {},
              equipamentoId: equip.id,
              fabricante: equip.fabricante,
              modelo: equip.modelo,
              numeroSerie: equip.numero_serie,
            };
          })
          .filter(Boolean) as ComponenteDU[];

        console.log('✅ Componentes carregados do diagrama salvo:', componentesData.length);
      } else {
        // Se não tem diagrama, criar componentes em grid
        componentesData = equipamentosData.map((equip, index) =>
          mapEquipamentoToComponente(equip, index)
        );
        console.log('✅ Componentes criados em grid automático:', componentesData.length);
      }

      setComponentes(componentesData);
    } catch (err: any) {
      console.error('❌ Error loading unidade data:', err);
      setError(err.message || 'Erro ao carregar dados da unidade');
    } finally {
      setLoading(false);
    }
  }, [unidadeId, mapEquipamentoToComponente]);

  // Recarregar diagrama
  const reloadDiagrama = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // Salvar diagrama no backend
  const saveDiagrama = useCallback(async (
    componentesAtuais: ComponenteDU[],
    connectionsAtuais: any[]
  ) => {
    if (!unidadeId || !unidade) {
      throw new Error('Unidade não carregada');
    }

    try {
      console.log('💾 Salvando diagrama...');

      // Se já existe diagrama, atualizar
      if (diagrama) {
        await DiagramasService.updateDiagrama(diagrama.id, {
          svg_data: {
            componentes: componentesAtuais,
            conexoes: connectionsAtuais,
          },
        });
        console.log('✅ Diagrama atualizado');
      } else {
        // Se não existe, criar novo
        const novoDiagrama = await DiagramasService.createDiagrama({
          unidade_id: unidadeId,
          nome: `Diagrama - ${unidade.nome}`,
          versao: '1.0',
          ativo: true,
          svg_data: {
            componentes: componentesAtuais,
            conexoes: connectionsAtuais,
          },
        });
        setDiagrama(novoDiagrama);
        console.log('✅ Novo diagrama criado');
      }

      // Atualizar posições dos equipamentos no banco
      for (const comp of componentesAtuais) {
        if (comp.equipamentoId) {
          try {
            await EquipamentosService.updateEquipamento(comp.equipamentoId, {
              // Atualizar posição no equipamento (se necessário)
            });
          } catch (err) {
            console.warn(`⚠️ Erro ao atualizar equipamento ${comp.equipamentoId}:`, err);
          }
        }
      }
    } catch (err: any) {
      console.error('❌ Erro ao salvar diagrama:', err);
      throw err;
    }
  }, [unidadeId, unidade, diagrama]);

  // Carregar dados quando unidadeId mudar
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    unidade,
    diagrama,
    equipamentos,
    componentes,
    loading,
    error,
    reloadDiagrama,
    saveDiagrama,
  };
}
