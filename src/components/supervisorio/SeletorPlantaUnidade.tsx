// src/components/supervisorio/SeletorPlantaUnidade.tsx

import React, { useState, useEffect } from 'react';
import { ChevronRight, Building, Factory, MapPin, Zap } from 'lucide-react';
import { PlantasService, type PlantaResponse } from '@/services/plantas.services';
import { type Unidade } from '@/services/unidades.services';
import { api } from '@/config/api';

interface SeletorPlantaUnidadeProps {
  onUnidadeSelect: (unidadeId: string, planta: PlantaResponse, unidade: Unidade) => void;
  selectedPlantaId?: string;
  selectedUnidadeId?: string;
}

export function SeletorPlantaUnidade({
  onUnidadeSelect,
  selectedPlantaId,
  selectedUnidadeId,
}: SeletorPlantaUnidadeProps) {
  const [plantas, setPlantas] = useState<PlantaResponse[]>([]);
  const [selectedPlanta, setSelectedPlanta] = useState<PlantaResponse | null>(null);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar plantas ao montar
  useEffect(() => {
    loadPlantas();
  }, []);

  // Se tiver plantaId selecionada na prop, carregar suas unidades
  useEffect(() => {
    if (selectedPlantaId) {
      const planta = plantas.find(p => p.id === selectedPlantaId);
      if (planta) {
        setSelectedPlanta(planta);
        loadUnidades(selectedPlantaId);
      }
    }
  }, [selectedPlantaId, plantas]);

  const loadPlantas = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await PlantasService.getAllPlantas({ limit: 100 });
      setPlantas(response.data || []);
    } catch (err: any) {
      console.error('Erro ao carregar plantas:', err);
      setError('Erro ao carregar plantas: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const loadUnidades = async (plantaId: string) => {
    setLoadingUnidades(true);
    setError(null);
    try {
      const response = await api.get(`/plantas/${plantaId}/unidades`);

      // Normalize response - handle nested data structure
      // Backend can return: { success: true, data: { data: [...unidades] } } or { data: [...unidades] }
      const responseData = response.data?.data || response.data;
      const unidadesData = responseData?.data || responseData || [];

      setUnidades(Array.isArray(unidadesData) ? unidadesData : []);
    } catch (err: any) {
      console.error('Erro ao carregar unidades:', err);
      setError('Erro ao carregar unidades: ' + (err.response?.data?.message || err.message));
      setUnidades([]);
    } finally {
      setLoadingUnidades(false);
    }
  };

  const handlePlantaClick = (planta: PlantaResponse) => {
    setSelectedPlanta(planta);
    loadUnidades(planta.id);
  };

  const handleUnidadeClick = (unidade: Unidade) => {
    if (selectedPlanta) {
      // Limpar espaços em branco do ID antes de passar
      const unidadeIdLimpo = unidade.id.trim();
      onUnidadeSelect(unidadeIdLimpo, selectedPlanta, unidade);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-sm text-gray-600">Carregando plantas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={loadPlantas}
          className="mt-2 text-sm text-red-600 underline hover:text-red-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Lista de Plantas */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Building className="w-4 h-4" />
          Plantas
        </h3>
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
          {plantas.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma planta encontrada</p>
          ) : (
            plantas.map((planta) => (
              <button
                key={planta.id}
                onClick={() => handlePlantaClick(planta)}
                className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                  selectedPlanta?.id === planta.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900">{planta.nome}</p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {planta.localizacao}
                    </p>
                  </div>
                  <ChevronRight
                    className={`w-5 h-5 transition-transform ${
                      selectedPlanta?.id === planta.id ? 'text-blue-600' : 'text-gray-400'
                    }`}
                  />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Lista de Unidades */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Factory className="w-4 h-4" />
          Unidades {selectedPlanta && `- ${selectedPlanta.nome}`}
        </h3>
        {!selectedPlanta ? (
          <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-sm text-gray-500">Selecione uma planta</p>
          </div>
        ) : loadingUnidades ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-sm text-gray-600">Carregando unidades...</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {unidades.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma unidade encontrada</p>
            ) : (
              unidades.map((unidade) => (
                <button
                  key={unidade.id}
                  onClick={() => handleUnidadeClick(unidade)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    selectedUnidadeId === unidade.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">{unidade.nome}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {unidade.cidade} / {unidade.estado}
                        </p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {unidade.potencia} kW
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Tipo: {unidade.tipo}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
