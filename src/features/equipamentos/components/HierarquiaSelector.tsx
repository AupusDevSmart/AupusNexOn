// src/features/equipamentos/components/HierarquiaSelectorAPI.tsx - CONECTADO À API
import React, { useState, useEffect } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, Factory, Layers, Route, Package, Cog, Wrench, Loader2, AlertCircle } from 'lucide-react';
import { useSelectionData } from '../hooks/useSelectionData';

interface HierarquiaValue {
  proprietarioId: string | null;
  plantaId: string | null;
  areaId: string | null;
  subAreaId: string | null;
  linhaId: string | null;
  conjuntoId: string | null;
  maquinaId: string | null;
}

interface HierarquiaSelectorAPIProps {
  value: HierarquiaValue;
  onChange: (value: HierarquiaValue) => void;
  disabled?: boolean;
  required?: boolean;
  showMaquina?: boolean; // Para equipamentos que precisam de máquina
}

export const HierarquiaSelectorAPI: React.FC<HierarquiaSelectorAPIProps> = ({ 
  value, 
  onChange, 
  disabled = false,
  required = false,
  showMaquina = true
}) => {
  const {
    proprietarios,
    plantas,
    loadingProprietarios,
    loadingPlantas,
    loadingHierarquia,
    fetchPlantas,
    fetchHierarquiaNivel
  } = useSelectionData();

  // Estados para diferentes níveis hierárquicos
  const [areas, setAreas] = useState<any[]>([]);
  const [subAreas, setSubAreas] = useState<any[]>([]);
  const [linhas, setLinhas] = useState<any[]>([]);
  const [conjuntos, setConjuntos] = useState<any[]>([]);
  const [maquinas, setMaquinas] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Garantir que value tem a estrutura correta
  const currentValue: HierarquiaValue = value || {
    proprietarioId: null,
    plantaId: null,
    areaId: null,
    subAreaId: null,
    linhaId: null,
    conjuntoId: null,
    maquinaId: null
  };

  // ============================================================================
  // EFEITOS PARA CARREGAR DADOS EM CASCATA
  // ============================================================================
  
  // Carregar plantas quando proprietário muda
  useEffect(() => {
    if (currentValue.proprietarioId) {
      fetchPlantas(currentValue.proprietarioId);
    }
  }, [currentValue.proprietarioId, fetchPlantas]);

  // Carregar áreas quando planta muda
  useEffect(() => {
    const loadAreas = async () => {
      if (currentValue.plantaId) {
        try {
          const data = await fetchHierarquiaNivel('area', currentValue.plantaId);
          setAreas(data);
        } catch (err) {
          setError('Erro ao carregar áreas');
        }
      } else {
        setAreas([]);
      }
    };
    loadAreas();
  }, [currentValue.plantaId, fetchHierarquiaNivel]);

  // Carregar subáreas quando área muda
  useEffect(() => {
    const loadSubAreas = async () => {
      if (currentValue.areaId) {
        try {
          const data = await fetchHierarquiaNivel('subarea', currentValue.areaId);
          setSubAreas(data);
        } catch (err) {
          setError('Erro ao carregar subáreas');
        }
      } else {
        setSubAreas([]);
      }
    };
    loadSubAreas();
  }, [currentValue.areaId, fetchHierarquiaNivel]);

  // Carregar linhas quando área ou subárea muda
  useEffect(() => {
    const loadLinhas = async () => {
      const parentId = currentValue.subAreaId || currentValue.areaId;
      if (parentId) {
        try {
          const data = await fetchHierarquiaNivel('linha', parentId);
          setLinhas(data);
        } catch (err) {
          setError('Erro ao carregar linhas');
        }
      } else {
        setLinhas([]);
      }
    };
    loadLinhas();
  }, [currentValue.areaId, currentValue.subAreaId, fetchHierarquiaNivel]);

  // Carregar conjuntos quando linha muda
  useEffect(() => {
    const loadConjuntos = async () => {
      if (currentValue.linhaId) {
        try {
          const data = await fetchHierarquiaNivel('conjunto', currentValue.linhaId);
          setConjuntos(data);
        } catch (err) {
          setError('Erro ao carregar conjuntos');
        }
      } else {
        setConjuntos([]);
      }
    };
    loadConjuntos();
  }, [currentValue.linhaId, fetchHierarquiaNivel]);

  // Carregar máquinas quando conjunto muda
  useEffect(() => {
    const loadMaquinas = async () => {
      if (currentValue.conjuntoId && showMaquina) {
        try {
          const data = await fetchHierarquiaNivel('maquina', currentValue.conjuntoId);
          setMaquinas(data);
        } catch (err) {
          setError('Erro ao carregar máquinas');
        }
      } else {
        setMaquinas([]);
      }
    };
    loadMaquinas();
  }, [currentValue.conjuntoId, showMaquina, fetchHierarquiaNivel]);

  // ============================================================================
  // HANDLERS PARA MUDANÇAS DE SELEÇÃO
  // ============================================================================

  const handleProprietarioChange = (proprietarioId: string) => {
    const newProprietarioId = proprietarioId === 'none' ? null : proprietarioId;
    onChange({
      proprietarioId: newProprietarioId,
      plantaId: null,
      areaId: null,
      subAreaId: null,
      linhaId: null,
      conjuntoId: null,
      maquinaId: null
    });
  };

  const handlePlantaChange = (plantaId: string) => {
    const newPlantaId = plantaId === 'none' ? null : plantaId;
    onChange({
      ...currentValue,
      plantaId: newPlantaId,
      areaId: null,
      subAreaId: null,
      linhaId: null,
      conjuntoId: null,
      maquinaId: null
    });
  };

  const handleAreaChange = (areaId: string) => {
    const newAreaId = areaId === 'none' ? null : areaId;
    onChange({
      ...currentValue,
      areaId: newAreaId,
      subAreaId: null,
      linhaId: null,
      conjuntoId: null,
      maquinaId: null
    });
  };

  const handleSubAreaChange = (subAreaId: string) => {
    const newSubAreaId = subAreaId === 'none' ? null : subAreaId;
    onChange({
      ...currentValue,
      subAreaId: newSubAreaId,
      linhaId: null,
      conjuntoId: null,
      maquinaId: null
    });
  };

  const handleLinhaChange = (linhaId: string) => {
    const newLinhaId = linhaId === 'none' ? null : linhaId;
    onChange({
      ...currentValue,
      linhaId: newLinhaId,
      conjuntoId: null,
      maquinaId: null
    });
  };

  const handleConjuntoChange = (conjuntoId: string) => {
    const newConjuntoId = conjuntoId === 'none' ? null : conjuntoId;
    onChange({
      ...currentValue,
      conjuntoId: newConjuntoId,
      maquinaId: null
    });
  };

  const handleMaquinaChange = (maquinaId: string) => {
    const newMaquinaId = maquinaId === 'none' ? null : maquinaId;
    onChange({
      ...currentValue,
      maquinaId: newMaquinaId
    });
  };

  // ============================================================================
  // UTILITÁRIOS PARA OBTER NOMES
  // ============================================================================

  const getProprietarioNome = (id: string | null) => {
    if (!id) return null;
    const proprietario = proprietarios.find(p => p.id === id);
    return proprietario?.nome || null;
  };

  const getPlantaNome = (id: string | null) => {
    if (!id) return null;
    const planta = plantas.find(p => p.id === id);
    return planta?.nome || null;
  };

  const getItemNome = (id: string | null, lista: any[]) => {
    if (!id) return null;
    const item = lista.find(i => i.id === id);
    return item?.nome || null;
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-4">
      {/* Alerta de erro */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Proprietário */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Proprietário {required && <span className="text-red-500">*</span>}
        </label>
        <Select
          value={currentValue.proprietarioId || undefined}
          onValueChange={handleProprietarioChange}
          disabled={disabled || loadingProprietarios}
        >
          <SelectTrigger>
            <SelectValue placeholder={loadingProprietarios ? "Carregando..." : "Selecione um proprietário"} />
          </SelectTrigger>
          <SelectContent>
            {loadingProprietarios ? (
              <div className="flex items-center justify-center p-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              proprietarios.map((prop) => (
                <SelectItem key={prop.id} value={prop.id}>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3 w-3" />
                    <span>{prop.nome}</span>
                    <Badge variant="outline" className="text-xs">
                      {prop.tipo === 'pessoa_juridica' ? 'PJ' : 'PF'}
                    </Badge>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Planta */}
      {currentValue.proprietarioId && (
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Factory className="h-4 w-4" />
            Planta {required && <span className="text-red-500">*</span>}
          </label>
          <Select
            value={currentValue.plantaId || undefined}
            onValueChange={handlePlantaChange}
            disabled={disabled || loadingPlantas}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingPlantas ? "Carregando..." : "Selecione uma planta"} />
            </SelectTrigger>
            <SelectContent>
              {loadingPlantas ? (
                <div className="flex items-center justify-center p-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                plantas.map((planta) => (
                  <SelectItem key={planta.id} value={planta.id}>
                    <div className="flex items-center gap-2">
                      <Factory className="h-3 w-3" />
                      <div>
                        <div>{planta.nome}</div>
                        {planta.localizacao && (
                          <div className="text-xs text-muted-foreground">{planta.localizacao}</div>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Área */}
      {currentValue.plantaId && areas.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Área {required && <span className="text-red-500">*</span>}
          </label>
          <Select
            value={currentValue.areaId || undefined}
            onValueChange={handleAreaChange}
            disabled={disabled || loadingHierarquia}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma área" />
            </SelectTrigger>
            <SelectContent>
              {areas.map((area) => (
                <SelectItem key={area.id} value={area.id}>
                  <div className="flex items-center gap-2">
                    <Layers className="h-3 w-3" />
                    <span>{area.nome}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Sub Área (opcional) */}
      {currentValue.areaId && subAreas.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Sub Área (opcional)
          </label>
          <Select
            value={currentValue.subAreaId || 'none'}
            onValueChange={handleSubAreaChange}
            disabled={disabled || loadingHierarquia}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma sub área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Área direta (sem subárea)</SelectItem>
              {subAreas.map((subArea) => (
                <SelectItem key={subArea.id} value={subArea.id}>
                  <div className="flex items-center gap-2">
                    <Layers className="h-3 w-3" />
                    <span>{subArea.nome}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Linha */}
      {currentValue.areaId && linhas.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Route className="h-4 w-4" />
            Linha {required && <span className="text-red-500">*</span>}
          </label>
          <Select
            value={currentValue.linhaId || undefined}
            onValueChange={handleLinhaChange}
            disabled={disabled || loadingHierarquia}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma linha" />
            </SelectTrigger>
            <SelectContent>
              {linhas.map((linha) => (
                <SelectItem key={linha.id} value={linha.id}>
                  <div className="flex items-center gap-2">
                    <Route className="h-3 w-3" />
                    <span>{linha.nome}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Conjunto */}
      {currentValue.linhaId && conjuntos.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Conjunto {required && <span className="text-red-500">*</span>}
          </label>
          <Select
            value={currentValue.conjuntoId || undefined}
            onValueChange={handleConjuntoChange}
            disabled={disabled || loadingHierarquia}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um conjunto" />
            </SelectTrigger>
            <SelectContent>
              {conjuntos.map((conjunto) => (
                <SelectItem key={conjunto.id} value={conjunto.id}>
                  <div className="flex items-center gap-2">
                    <Package className="h-3 w-3" />
                    <span>{conjunto.nome}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Máquina (se necessário) */}
      {showMaquina && currentValue.conjuntoId && maquinas.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Cog className="h-4 w-4" />
            Máquina {required && <span className="text-red-500">*</span>}
          </label>
          <Select
            value={currentValue.maquinaId || undefined}
            onValueChange={handleMaquinaChange}
            disabled={disabled || loadingHierarquia}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma máquina" />
            </SelectTrigger>
            <SelectContent>
              {maquinas.map((maquina) => (
                <SelectItem key={maquina.id} value={maquina.id}>
                  <div className="flex items-center gap-2">
                    <Cog className="h-3 w-3" />
                    <span>{maquina.nome}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Resumo da seleção */}
      {currentValue.proprietarioId && (
        <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200 dark:from-orange-950 dark:to-amber-950 dark:border-orange-800">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-900 dark:text-orange-100">
              Localização do Equipamento:
            </span>
          </div>
          
          <div className="flex flex-wrap gap-1 text-xs">
            {currentValue.proprietarioId && (
              <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                <Building2 className="h-3 w-3 mr-1" />
                {getProprietarioNome(currentValue.proprietarioId)}
              </Badge>
            )}
            {currentValue.plantaId && (
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                <Factory className="h-3 w-3 mr-1" />
                {getPlantaNome(currentValue.plantaId)}
              </Badge>
            )}
            {currentValue.areaId && (
              <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
                <Layers className="h-3 w-3 mr-1" />
                {getItemNome(currentValue.areaId, areas)}
              </Badge>
            )}
            {currentValue.subAreaId && (
              <Badge variant="outline" className="bg-indigo-100 text-indigo-800 border-indigo-300">
                <Layers className="h-3 w-3 mr-1" />
                {getItemNome(currentValue.subAreaId, subAreas)}
              </Badge>
            )}
            {currentValue.linhaId && (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                <Route className="h-3 w-3 mr-1" />
                {getItemNome(currentValue.linhaId, linhas)}
              </Badge>
            )}
            {currentValue.conjuntoId && (
              <Badge variant="outline" className="bg-pink-100 text-pink-800 border-pink-300">
                <Package className="h-3 w-3 mr-1" />
                {getItemNome(currentValue.conjuntoId, conjuntos)}
              </Badge>
            )}
            {currentValue.maquinaId && (
              <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                <Cog className="h-3 w-3 mr-1" />
                {getItemNome(currentValue.maquinaId, maquinas)}
              </Badge>
            )}
          </div>
          
          {/* Validações visuais */}
          {showMaquina && currentValue.conjuntoId && !currentValue.maquinaId && maquinas.length > 0 && (
            <div className="mt-3 p-2 bg-amber-100 border border-amber-300 rounded text-amber-800 text-xs">
              ⚠️ Selecione uma máquina para vincular o equipamento
            </div>
          )}
          
          {showMaquina && currentValue.maquinaId && (
            <div className="mt-3 p-2 bg-green-100 border border-green-300 rounded text-green-800 text-xs">
              ✅ O equipamento será vinculado à máquina selecionada
            </div>
          )}

          {!showMaquina && currentValue.conjuntoId && (
            <div className="mt-3 p-2 bg-blue-100 border border-blue-300 rounded text-blue-800 text-xs">
              ✅ O equipamento será vinculado ao conjunto selecionado
            </div>
          )}
        </div>
      )}
    </div>
  );
};