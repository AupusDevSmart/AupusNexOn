import { useState, useEffect, useCallback } from 'react';
import unidadesService from '../services/unidadesService';
import {
  UnidadeNexon,
  CreateUnidadeDto,
  UpdateUnidadeDto,
  FilterUnidadeDto,
  PaginatedUnidadeResponse,
  UnidadeStats,
} from '../types/unidades';

// Hook para listagem de unidades
export const useUnidades = (filtros?: FilterUnidadeDto) => {
  const [unidades, setUnidades] = useState<PaginatedUnidadeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregarUnidades = useCallback(async (novosFiltros?: FilterUnidadeDto) => {
    try {
      setLoading(true);
      setError(null);

      const resultado = await unidadesService.listarUnidades(novosFiltros || filtros);
      setUnidades(resultado);
    } catch (err) {
      setError('Erro ao carregar unidades');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    carregarUnidades();
  }, [carregarUnidades]);

  return {
    unidades,
    loading,
    error,
    recarregar: carregarUnidades,
  };
};

// Hook para operações CRUD de unidades
export const useUnidadesCRUD = () => {
  const [loading, setLoading] = useState(false);

  const criarUnidade = async (dados: CreateUnidadeDto): Promise<UnidadeNexon | null> => {
    if (!unidadesService.validarDadosUnidade(dados)) {
      return null;
    }

    try {
      setLoading(true);
      const novaUnidade = await unidadesService.criarUnidade(dados);
      return novaUnidade;
    } catch (error) {
      console.error('Erro ao criar unidade:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const atualizarUnidade = async (
    id: string,
    dados: UpdateUnidadeDto
  ): Promise<UnidadeNexon | null> => {
    if (!unidadesService.validarDadosUnidade(dados)) {
      return null;
    }

    try {
      setLoading(true);
      const unidadeAtualizada = await unidadesService.atualizarUnidade(id, dados);
      return unidadeAtualizada;
    } catch (error) {
      console.error('Erro ao atualizar unidade:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const excluirUnidade = async (id: string): Promise<boolean> => {
    if (!confirm('Tem certeza que deseja excluir esta unidade?')) {
      return false;
    }

    try {
      setLoading(true);
      await unidadesService.excluirUnidade(id);
      return true;
    } catch (error) {
      console.error('Erro ao excluir unidade:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const buscarUnidade = async (id: string): Promise<UnidadeNexon | null> => {
    try {
      setLoading(true);
      const unidade = await unidadesService.buscarUnidade(id);
      return unidade;
    } catch (error) {
      console.error('Erro ao buscar unidade:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    criarUnidade,
    atualizarUnidade,
    excluirUnidade,
    buscarUnidade,
  };
};

// Hook para estatísticas
export const useUnidadesStats = () => {
  const [stats, setStats] = useState<UnidadeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregarStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const estatisticas = await unidadesService.obterEstatisticas();
      setStats(estatisticas);
    } catch (err) {
      setError('Erro ao carregar estatísticas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarStats();
  }, []);

  return {
    stats,
    loading,
    error,
    recarregar: carregarStats,
  };
};

// Hook para importação/exportação
export const useUnidadesImportExport = () => {
  const [loading, setLoading] = useState(false);

  const importarUnidades = async (unidades: CreateUnidadeDto[]) => {
    try {
      setLoading(true);
      const resultado = await unidadesService.importarUnidades(unidades);
      return resultado;
    } catch (error) {
      console.error('Erro na importação:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const exportarCSV = async (filtros?: FilterUnidadeDto) => {
    try {
      setLoading(true);
      await unidadesService.exportarCSV(filtros);
    } catch (error) {
      console.error('Erro na exportação:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    importarUnidades,
    exportarCSV,
  };
};