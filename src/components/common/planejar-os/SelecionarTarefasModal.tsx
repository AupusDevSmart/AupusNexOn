// src/components/common/planejar-os/SelecionarTarefasModal.tsx
import React, { useState } from 'react';
import { 
  X, 
  CheckSquare, 
  Square, 
  Layers, 
  Tag, 
  Clock, 
  Wrench,
  AlertTriangle,
  User,
  FileText
} from 'lucide-react';

interface TarefaTemplate {
  id: string;
  tagBase: string;
  descricao: string;
  categoria: string;
  tipoManutencao: string;
  frequencia: string;
  criticidade: string;
  duracaoEstimada: number;
  tempoEstimado: number;
  responsavelSugerido?: string;
  observacoesTemplate?: string;
  ativa: boolean;
}

interface PlanoManutencao {
  id: string;
  nome: string;
  categoria: string;
  tarefasTemplate: TarefaTemplate[];
  totalEquipamentos: number;
}

interface SelecionarTarefasModalProps {
  isOpen: boolean;
  plano: PlanoManutencao | null;
  onClose: () => void;
  onConfirm: (tarefasSelecionadas: TarefaTemplate[], equipamentosSelecionados: number[]) => void;
}

export const SelecionarTarefasModal: React.FC<SelecionarTarefasModalProps> = ({
  isOpen,
  plano,
  onClose,
  onConfirm
}) => {
  const [tarefasSelecionadas, setTarefasSelecionadas] = useState<string[]>([]);
  const [equipamentosSelecionados, setEquipamentosSelecionados] = useState<number[]>([]);
  const [selecionarTodas, setSelecionarTodas] = useState(false);

  if (!isOpen || !plano) return null;

  // Mock dos equipamentos associados ao plano
  const equipamentosDisponiveis = [
    { id: 1, nome: 'Motor Elétrico 001', local: 'Planta A' },
    { id: 2, nome: 'Motor Elétrico 002', local: 'Planta A' },
    { id: 3, nome: 'Motor Elétrico 003', local: 'Planta B' }
  ];

  const handleToggleTarefa = (tarefaId: string) => {
    setTarefasSelecionadas(prev => 
      prev.includes(tarefaId) 
        ? prev.filter(id => id !== tarefaId)
        : [...prev, tarefaId]
    );
  };

  const handleToggleTodasTarefas = () => {
    if (selecionarTodas) {
      setTarefasSelecionadas([]);
    } else {
      setTarefasSelecionadas(plano.tarefasTemplate.filter(t => t.ativa).map(t => t.id));
    }
    setSelecionarTodas(!selecionarTodas);
  };

  const handleToggleEquipamento = (equipamentoId: number) => {
    setEquipamentosSelecionados(prev => 
      prev.includes(equipamentoId) 
        ? prev.filter(id => id !== equipamentoId)
        : [...prev, equipamentoId]
    );
  };

  const handleConfirmar = () => {
    const tarefas = plano.tarefasTemplate.filter(t => tarefasSelecionadas.includes(t.id));
    onConfirm(tarefas, equipamentosSelecionados);
  };

  const formatarCategoria = (categoria: string) => {
    const labels: Record<string, string> = {
      'MOTORES_ELETRICOS': 'Motores Elétricos',
      'BOMBAS_CENTRIFUGAS': 'Bombas Centrífugas',
      'TRANSFORMADORES': 'Transformadores',
      'COMPRESSORES': 'Compressores',
      'PAINEIS_ELETRICOS': 'Painéis Elétricos',
      'INSTRUMENTACAO': 'Instrumentação',
      'OUTROS': 'Outros'
    };
    return labels[categoria] || categoria.replace('_', ' ');
  };

  const formatarTipo = (tipo: string) => {
    const labels: Record<string, string> = {
      'PREVENTIVA': 'Preventiva',
      'PREDITIVA': 'Preditiva',
      'CORRETIVA': 'Corretiva',
      'INSPECAO': 'Inspeção',
      'VISITA_TECNICA': 'Visita Técnica'
    };
    return labels[tipo] || tipo;
  };

  const formatarCriticidade = (criticidade: string) => {
    const config: Record<string, { label: string; color: string }> = {
      '1': { label: 'Muito Baixa', color: 'text-gray-600' },
      '2': { label: 'Baixa', color: 'text-green-600' },
      '3': { label: 'Média', color: 'text-yellow-600' },
      '4': { label: 'Alta', color: 'text-orange-600' },
      '5': { label: 'Muito Alta', color: 'text-red-600' }
    };
    return config[criticidade] || { label: criticidade, color: 'text-gray-600' };
  };

  const totalDuracao = plano.tarefasTemplate
    .filter(t => tarefasSelecionadas.includes(t.id))
    .reduce((acc, t) => acc + t.duracaoEstimada, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Selecionar Tarefas para OS
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {plano.nome} • {formatarCategoria(plano.categoria)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col h-[calc(90vh-140px)]">
          <div className="flex-1 overflow-y-auto p-6">
            {/* Resumo */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-blue-900 dark:text-blue-100 font-medium">
                    Tarefas Selecionadas: <span className="font-bold">{tarefasSelecionadas.length}</span>
                  </p>
                </div>
                <div>
                  <p className="text-blue-900 dark:text-blue-100 font-medium">
                    Duração Total: <span className="font-bold">{totalDuracao}h</span>
                  </p>
                </div>
                <div>
                  <p className="text-blue-900 dark:text-blue-100 font-medium">
                    Equipamentos: <span className="font-bold">{equipamentosSelecionados.length}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Seção de Tarefas */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Tag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Tarefas do Plano ({plano.tarefasTemplate.filter(t => t.ativa).length})
                  </h3>
                  <button
                    onClick={handleToggleTodasTarefas}
                    className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    {selecionarTodas ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    Selecionar Todas
                  </button>
                </div>
                
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {plano.tarefasTemplate.filter(t => t.ativa).map((tarefa) => (
                    <div
                      key={tarefa.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        tarefasSelecionadas.includes(tarefa.id)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-400'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                      }`}
                      onClick={() => handleToggleTarefa(tarefa.id)}
                    >
                      <div className="flex items-start gap-3">
                        {tarefasSelecionadas.includes(tarefa.id) ? (
                          <CheckSquare className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                        ) : (
                          <Square className="h-5 w-5 text-gray-400 mt-0.5" />
                        )}
                        
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                              {tarefa.tagBase} - {tarefa.descricao}
                            </h4>
                            <span className={`text-xs px-2 py-1 rounded-full ${formatarCriticidade(tarefa.criticidade).color} bg-current bg-opacity-10`}>
                              {formatarCriticidade(tarefa.criticidade).label}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Wrench className="h-3 w-3" />
                              {formatarCategoria(tarefa.categoria)}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {formatarTipo(tarefa.tipoManutencao)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {tarefa.duracaoEstimada}h
                            </span>
                            {tarefa.responsavelSugerido && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {tarefa.responsavelSugerido}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seção de Equipamentos */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-green-600 dark:text-green-400" />
                  Equipamentos Associados ({equipamentosDisponiveis.length})
                </h3>
                
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {equipamentosDisponiveis.map((equipamento) => (
                    <div
                      key={equipamento.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        equipamentosSelecionados.includes(equipamento.id)
                          ? 'border-green-500 bg-green-50 dark:bg-green-950/30 dark:border-green-400'
                          : 'border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-600'
                      }`}
                      onClick={() => handleToggleEquipamento(equipamento.id)}
                    >
                      <div className="flex items-center gap-3">
                        {equipamentosSelecionados.includes(equipamento.id) ? (
                          <CheckSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <Square className="h-5 w-5 text-gray-400" />
                        )}
                        
                        <div>
                          <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                            {equipamento.nome}
                          </h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {equipamento.local}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {tarefasSelecionadas.length > 0 && equipamentosSelecionados.length > 0 && (
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Será gerada {tarefasSelecionadas.length * equipamentosSelecionados.length} tarefa(s) na OS
                </span>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmar}
                disabled={tarefasSelecionadas.length === 0 || equipamentosSelecionados.length === 0}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar para OS
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};