// src/features/equipamentos/components/modals/ComponenteUARModal.tsx - CORRIGIDO PARA API
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Combobox } from '@/components/ui/combobox';
import { Component, Save, Wrench, X, AlertCircle, Loader2, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Equipamento } from '../../types';
import { tiposEquipamentosApi, categoriasEquipamentosApi, type TipoEquipamentoModal, type TipoEquipamento } from '@/services/tipos-equipamentos.services';
import { useCategorias } from '@/hooks/useCategorias';
import { useModelos } from '@/hooks/useModelos';

interface ComponenteUARModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'view';
  entity?: Equipamento | null;
  equipamentoPai?: Equipamento | null;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export const ComponenteUARModal: React.FC<ComponenteUARModalProps> = ({
  isOpen,
  mode,
  entity,
  equipamentoPai,
  onClose,
  onSubmit
}) => {
  const [formData, setFormData] = useState<any>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para tipos de equipamentos da API (DEPRECATED - usar hooks)
  const [tiposEquipamentos, setTiposEquipamentos] = useState<TipoEquipamentoModal[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(false);

  // ✅ NOVO: Estados para seleção hierárquica Categoria → Modelo
  const [categoriaIdSelecionada, setCategoriaIdSelecionada] = useState<string>('');
  const [modeloSelecionado, setModeloSelecionado] = useState<TipoEquipamento | null>(null);

  // ✅ NOVO: Hooks para categorias e modelos
  const { categorias, loading: loadingCategorias, refetch: refetchCategorias } = useCategorias();
  const { modelos, loading: loadingModelos, refetch: refetchModelos } = useModelos({
    categoriaId: categoriaIdSelecionada || undefined,
    autoFetch: !!categoriaIdSelecionada
  });

  // ✅ NOVO: Estados para criar categoria/modelo on-the-fly
  const [popoverCategoriaOpen, setPopoverCategoriaOpen] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
  const [loadingNovaCategoria, setLoadingNovaCategoria] = useState(false);

  const [popoverModeloOpen, setPopoverModeloOpen] = useState(false);
  const [novoModeloNome, setNovoModeloNome] = useState('');
  const [novoModeloCodigo, setNovoModeloCodigo] = useState('');
  const [novoModeloFabricante, setNovoModeloFabricante] = useState('');
  const [loadingNovoModelo, setLoadingNovoModelo] = useState(false);

  // Helper para buscar tipo de equipamento
  const getTipoEquipamento = (codigo: string): TipoEquipamentoModal | undefined => {
    return tiposEquipamentos.find(t => t.value === codigo);
  };

  // Carregar tipos de equipamentos da API
  useEffect(() => {
    const loadTiposEquipamentos = async () => {
      setLoadingTipos(true);
      try {
        const tipos = await tiposEquipamentosApi.getAll();
        const tiposFormatados = tipos.map(tipo => ({
          value: tipo.codigo,
          label: tipo.nome,
          categoria: tipo.categoria,
          camposTecnicos: (tipo.propriedades_schema?.campos || []).map(campo => ({
            campo: campo.nome,
            tipo: campo.tipo === 'boolean' ? ('select' as const) : campo.tipo,
            unidade: campo.unidade,
            opcoes: campo.opcoes || (campo.tipo === 'boolean' ? ['Sim', 'Não'] : undefined),
            obrigatorio: campo.obrigatorio,
          })),
        }));
        setTiposEquipamentos(tiposFormatados);
        console.log('✅ [MODAL UAR] Tipos de equipamentos carregados da API:', tiposFormatados.length);
      } catch (err) {
        console.error('❌ [MODAL UAR] Erro ao carregar tipos de equipamentos:', err);
        setError('Erro ao carregar tipos de equipamentos');
      } finally {
        setLoadingTipos(false);
      }
    };

    if (isOpen) {
      loadTiposEquipamentos();
    }
  }, [isOpen]);

  useEffect(() => {
    const initializeFormData = async () => {
      if (entity && mode !== 'create') {
        console.log('📋 [MODAL UAR] Dados completos do componente:', entity);

        // Extrair dados técnicos para o formData
        const dadosTecnicosObj: Record<string, string> = {};
        if (entity.dadosTecnicos && Array.isArray(entity.dadosTecnicos)) {
          entity.dadosTecnicos.forEach((dt: any) => {
            dadosTecnicosObj[dt.campo] = dt.valor;
          });
        }

        // Formatar data de instalação para input type="date" (YYYY-MM-DD)
        const dataInstalacaoFormatted = entity.dataInstalacao
          ? entity.dataInstalacao.split('T')[0] // Extrai apenas YYYY-MM-DD
          : '';

        // ✅ NOVO: Buscar tipo completo com categoria e fabricante
        const codigoTipo = entity.tipoEquipamento || entity.tipo || '';
        let tipoCompleto: TipoEquipamento | null = null;
        if (codigoTipo) {
          try {
            tipoCompleto = await tiposEquipamentosApi.findByCode(codigoTipo);
            if (tipoCompleto) {
              setCategoriaIdSelecionada(tipoCompleto.categoriaId);
              setModeloSelecionado(tipoCompleto);
            }
          } catch (err) {
            console.warn('⚠️ [MODAL UAR] Erro ao buscar tipo completo:', err);
          }
        }

        // Mapear campos para o formData
        setFormData({
          ...entity,
          ...dadosTecnicosObj, // Espalhar dados técnicos como campos individuais
          tipoComponente: codigoTipo,
          tipoEquipamentoId: tipoCompleto?.id || '',
          fabricante: tipoCompleto?.fabricante || entity.fabricante || '',
          fabricanteCustom: entity.fabricante_custom || '',
          dataInstalacao: dataInstalacaoFormatted
        });
      } else {
        setFormData({
          classificacao: 'UAR',
          criticidade: '3',
          equipamentoPaiId: equipamentoPai?.id,
          // Herdar dados do equipamento pai
          plantaId: equipamentoPai?.unidade?.plantaId,
          unidadeId: equipamentoPai?.unidadeId,
          proprietarioId: equipamentoPai?.proprietarioId
        });
      }
      setError(null);
    };

    initializeFormData();
  }, [entity, mode, equipamentoPai]);

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  // ✅ NOVO: Handler para mudança de categoria
  const handleCategoriaChange = (categoriaId: string) => {
    setCategoriaIdSelecionada(categoriaId);
    setModeloSelecionado(null);

    // Buscar nome da categoria para auto-preencher o nome do componente
    const categoriaSelecionada = categorias.find(cat => cat.id === categoriaId);
    const nomeAutoPreenchido = categoriaSelecionada ? categoriaSelecionada.nome : '';

    setFormData((prev: any) => ({
      ...prev,
      nome: nomeAutoPreenchido, // Auto-preencher nome do componente
      tipoComponente: '',
      tipoEquipamentoId: '',
      fabricante: '',
      fabricanteCustom: ''
    }));
  };

  // ✅ NOVO: Handler para mudança de modelo (auto-fill fabricante)
  const handleModeloChange = (modeloId: string) => {
    const modelo = modelos.find(m => m.id === modeloId);
    if (modelo) {
      setModeloSelecionado(modelo);
      setFormData((prev: any) => ({
        ...prev,
        tipoComponente: modelo.codigo,
        tipoEquipamentoId: modelo.id,
        fabricante: modelo.fabricante // ✅ Auto-preenchido do modelo
      }));
    }
  };

  // ✅ NOVO: Handler para criar nova categoria
  const handleCriarCategoria = async () => {
    if (!novaCategoriaNome.trim()) {
      setError('Nome da categoria é obrigatório');
      return;
    }

    try {
      setLoadingNovaCategoria(true);
      setError(null);

      const novaCategoria = await categoriasEquipamentosApi.create(novaCategoriaNome.trim());

      if (novaCategoria) {
        // Atualizar lista de categorias
        await refetchCategorias();

        // Selecionar automaticamente a nova categoria
        setCategoriaIdSelecionada(novaCategoria.id);

        // Auto-preencher nome do componente
        setFormData((prev: any) => ({
          ...prev,
          nome: novaCategoria.nome,
        }));

        // Limpar e fechar popover
        setNovaCategoriaNome('');
        setPopoverCategoriaOpen(false);

        console.log('✅ [MODAL UAR] Nova categoria criada:', novaCategoria);
      }
    } catch (err: any) {
      console.error('❌ [MODAL UAR] Erro ao criar categoria:', err);
      setError(err.response?.data?.message || 'Erro ao criar nova categoria');
    } finally {
      setLoadingNovaCategoria(false);
    }
  };

  // ✅ NOVO: Handler para criar novo modelo
  const handleCriarModelo = async () => {
    if (!novoModeloNome.trim()) {
      setError('Nome do modelo é obrigatório');
      return;
    }

    if (!novoModeloCodigo.trim()) {
      setError('Código do modelo é obrigatório');
      return;
    }

    if (!novoModeloFabricante.trim()) {
      setError('Fabricante é obrigatório');
      return;
    }

    if (!categoriaIdSelecionada) {
      setError('Selecione uma categoria primeiro');
      return;
    }

    try {
      setLoadingNovoModelo(true);
      setError(null);

      const novoModelo = await tiposEquipamentosApi.create({
        codigo: novoModeloCodigo.trim(),
        nome: novoModeloNome.trim(),
        fabricante: novoModeloFabricante.trim(),
        categoriaId: categoriaIdSelecionada,
      });

      if (novoModelo) {
        // Atualizar lista de modelos
        await refetchModelos();

        // Selecionar automaticamente o novo modelo
        setModeloSelecionado(novoModelo);
        setFormData((prev: any) => ({
          ...prev,
          tipoComponente: novoModelo.codigo,
          tipoEquipamentoId: novoModelo.id,
          fabricante: novoModelo.fabricante,
        }));

        // Limpar e fechar popover
        setNovoModeloNome('');
        setNovoModeloCodigo('');
        setNovoModeloFabricante('');
        setPopoverModeloOpen(false);

        console.log('✅ [MODAL UAR] Novo modelo criado:', novoModelo);
      }
    } catch (err: any) {
      console.error('❌ [MODAL UAR] Erro ao criar modelo:', err);
      setError(err.response?.data?.message || 'Erro ao criar novo modelo');
    } finally {
      setLoadingNovoModelo(false);
    }
  };

  // TEMPORÁRIO: Mostrar TODOS os tipos para testar
  // TODO: Restaurar filtro após configurar categorias corretas no backend
  const tiposComponentesUAR = tiposEquipamentos;

  // Filtro original (comentado temporariamente):
  // const tiposComponentesUAR = tiposEquipamentos.filter(tipo =>
  //   ['sensor_temperatura', 'sensor_vibracao', 'bomba_oleo', 'filtro_ar', 'valvula_seguranca',
  //    'rele_protecao', 'disjuntor', 'seccionadora', 'inversor_frequencia', 'clp', 'sensor_pressao',
  //    'medidor_energia', 'analisador_qualidade', 'controlador_temperatura'].includes(tipo.value) ||
  //   ['eletronica', 'instrumentacao', 'protecao'].includes(tipo.categoria)
  // );

  const renderCamposTecnicos = () => {
    if (!formData.tipoComponente) {
      return (
        <div className="p-4 rounded-lg border border-dashed border-border/40 text-center text-muted-foreground/70 text-sm">
          Selecione um tipo de componente para ver os campos técnicos
        </div>
      );
    }

    // Usar configuração dos tipos de equipamentos
    const tipoEqp = getTipoEquipamento(formData.tipoComponente);
    if (!tipoEqp || !tipoEqp.camposTecnicos.length) {
      return (
        <div className="p-4 rounded-lg border border-dashed border-border/40 text-center text-muted-foreground/70 text-sm">
          Nenhum campo técnico definido para este tipo
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {tipoEqp.label}
        </h4>
        <div className="grid-equal-cols-2 gap-x-2 gap-y-4">
          {tipoEqp.camposTecnicos.map((campo) => (
            <div key={campo.campo} className="space-y-1.5">
              <label className="text-sm font-medium">
                {campo.campo}
                {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                {campo.unidade && <span className="text-muted-foreground"> ({campo.unidade})</span>}
              </label>
              {isReadOnly ? (
                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                  {formData[campo.campo] || <span className="text-gray-400">Não informado</span>}
                </div>
              ) : campo.tipo === 'select' && campo.opcoes ? (
                <Select
                  value={formData[campo.campo] || ''}
                  onValueChange={(value) => handleFieldChange(campo.campo, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {campo.opcoes.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <input
                  className="input-minimal"
                  type={campo.tipo === 'number' ? 'number' : 'text'}
                  placeholder={`${campo.campo}${campo.unidade ? ` (${campo.unidade})` : ''}`}
                  value={formData[campo.campo] || ''}
                  onChange={(e) => handleFieldChange(campo.campo, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.nome?.trim()) {
      errors.push('Nome é obrigatório');
    }

    // ✅ ATUALIZADO: Validar categoria e modelo em vez de tipoComponente
    if (!categoriaIdSelecionada) {
      errors.push('Categoria é obrigatória');
    }

    if (!formData.tipoEquipamentoId) {
      errors.push('Modelo é obrigatório');
    }

    // Validar campos técnicos obrigatórios
    if (formData.tipoComponente) {
      const tipoEqp = getTipoEquipamento(formData.tipoComponente);
      if (tipoEqp && tipoEqp.camposTecnicos) {
        tipoEqp.camposTecnicos.forEach(campo => {
          if (campo.obrigatorio && !formData[campo.campo]) {
            errors.push(`${campo.campo} é obrigatório`);
          }
        });
      }
    }

    if (errors.length > 0) {
      setError(errors.join('; '));
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Buscar o ID do tipo de equipamento pelo código
      const tipoEqpSelecionado = formData.tipoComponente ?
        await tiposEquipamentosApi.findByCode(formData.tipoComponente) : null;

      // Coletar dados técnicos do formData
      const tipoEqp = getTipoEquipamento(formData.tipoComponente);
      const dadosTecnicos = tipoEqp?.camposTecnicos
        ?.filter(campo => formData[campo.campo]) // Apenas campos preenchidos
        .map(campo => ({
          campo: campo.campo,
          valor: String(formData[campo.campo]), // Garantir que é string
          tipo: campo.tipo === 'select' ? 'string' : campo.tipo, // Normalizar tipo
          unidade: campo.unidade
        })) || [];

      // Formatar data de instalação para ISO-8601 DateTime se fornecida
      const dataInstalacaoFormatted = formData.dataInstalacao
        ? new Date(formData.dataInstalacao + 'T00:00:00.000Z').toISOString()
        : undefined;

      const submitData = {
        // Dados básicos
        nome: formData.nome,
        classificacao: 'UAR',
        equipamento_pai_id: formData.equipamentoPaiId,
        unidade_id: formData.unidadeId, // Herdado do equipamento pai
        fabricante: formData.fabricante,
        fabricante_custom: formData.fabricanteCustom || undefined, // ✅ NOVO: Fabricante customizado se divergir do modelo
        modelo: formData.modelo,
        numero_serie: formData.numeroSerie,
        criticidade: formData.criticidade,
        tipo_equipamento: formData.tipoComponente,  // Código (compatibilidade)
        tipo_equipamento_id: tipoEqpSelecionado?.id,  // ID do tipo (correto)
        data_instalacao: dataInstalacaoFormatted,
        localizacao_especifica: formData.localizacaoEspecifica,
        fornecedor: formData.fornecedor,
        valor_imobilizado: formData.valorImobilizado ? parseFloat(formData.valorImobilizado) : undefined,
        valor_depreciacao: formData.valorDepreciacao ? parseFloat(formData.valorDepreciacao) : undefined,
        valor_contabil: formData.valorContabil ? parseFloat(formData.valorContabil) : undefined,
        observacoes: formData.observacoes,
        // Herdar do equipamento pai
        planta_id: formData.plantaId,
        proprietario_id: formData.proprietarioId,
        // Dados técnicos
        dados_tecnicos: dadosTecnicos
      };

      console.log('📤 [MODAL UAR] Dados sendo enviados para API:', submitData);
      console.log('🔧 [MODAL UAR] Dados técnicos coletados:', dadosTecnicos);

      await onSubmit(submitData);
    } catch (err) {
      console.error('❌ [MODAL UAR] Erro ao salvar:', err);
      setError('Erro ao salvar componente UAR. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReadOnly = mode === 'view';

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-[1000px] overflow-hidden flex flex-col gap-0 p-0">
        <SheetHeader className="border-b px-6 py-4 space-y-2">
          <SheetTitle className="text-base font-semibold flex items-center gap-2">
            <Component className="h-4 w-4 text-muted-foreground" />
            {mode === 'create' ? 'Novo Componente UAR' :
             mode === 'edit' ? 'Editar Componente UAR' :
             'Visualizar Componente UAR'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Erro de validação */}
          {error && (
            <Alert variant="destructive" className="rounded-md">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Informação do Equipamento Pai */}
          {equipamentoPai && (
            <div className="p-3 bg-muted/40 border border-border/40 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  Equipamento Pai (UC)
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">{equipamentoPai.nome}</div>
                <div className="text-xs text-muted-foreground flex gap-3">
                  {equipamentoPai.fabricante && <span>{equipamentoPai.fabricante}</span>}
                  {equipamentoPai.modelo && <span>{equipamentoPai.modelo}</span>}
                  {equipamentoPai.planta?.nome && <span>• {equipamentoPai.planta.nome}</span>}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================================ */}
          {/* DADOS BÁSICOS DO COMPONENTE UAR */}
          {/* ============================================================================ */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground pb-2 border-b">Dados do Componente</h3>
            <div className="grid-equal-cols-2 gap-x-2 gap-y-4">
              {/* Coluna 1 */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Nome <span className="text-red-500">*</span></label>
                  <input
                    className="input-minimal"
                    value={formData.nome || ''}
                    onChange={(e) => handleFieldChange('nome', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="Nome do componente"
                  />
                </div>

                {/* ✅ NOVO: Categoria Select */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Categoria <span className="text-red-500">*</span></label>
                  {isReadOnly ? (
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                      {modeloSelecionado?.categoria?.nome || 'Não informado'}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Combobox
                        options={categorias.map(cat => ({ value: cat.id, label: cat.nome }))}
                        value={categoriaIdSelecionada}
                        onValueChange={handleCategoriaChange}
                        placeholder={loadingCategorias ? "Carregando..." : "Selecione a categoria"}
                        searchPlaceholder="Buscar categoria..."
                        emptyText="Nenhuma categoria encontrada."
                        disabled={loadingCategorias}
                        className="flex-1"
                      />

                      {/* Botão para criar nova categoria */}
                      <Popover open={popoverCategoriaOpen} onOpenChange={setPopoverCategoriaOpen}>
                        <PopoverTrigger asChild>
                          <button className="btn-minimal-outline h-9 px-3 shrink-0" title="Nova Categoria" type="button">
                            <Plus className="h-4 w-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="end">
                          <div className="space-y-3">
                            <h4 className="font-semibold text-sm">Nova Categoria</h4>
                            <input
                              className="input-minimal"
                              placeholder="Nome da categoria"
                              value={novaCategoriaNome}
                              onChange={(e) => setNovaCategoriaNome(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleCriarCategoria();
                                }
                              }}
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                className="btn-minimal-outline h-8 text-xs"
                                onClick={() => {
                                  setNovaCategoriaNome('');
                                  setPopoverCategoriaOpen(false);
                                }}
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                className="btn-minimal-primary h-8 text-xs"
                                onClick={handleCriarCategoria}
                                disabled={loadingNovaCategoria || !novaCategoriaNome.trim()}
                              >
                                {loadingNovaCategoria ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Criando...
                                  </>
                                ) : (
                                  'Criar'
                                )}
                              </button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>

                {/* ✅ NOVO: Modelo Select (filtered by categoria) */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Modelo <span className="text-red-500">*</span></label>
                  {isReadOnly ? (
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                      {modeloSelecionado?.nome || 'Não informado'}
                    </div>
                  ) : !categoriaIdSelecionada ? (
                    <div className="p-2 bg-muted/50 rounded border text-xs text-muted-foreground flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Selecione uma categoria primeiro
                    </div>
                  ) : loadingModelos ? (
                    <div className="p-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando modelos...
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Combobox
                        options={modelos.map(modelo => ({
                          value: modelo.id,
                          label: `${modelo.nome} | ${modelo.fabricante}`
                        }))}
                        value={formData.tipoEquipamentoId || ''}
                        onValueChange={handleModeloChange}
                        placeholder="Selecione o modelo"
                        searchPlaceholder="Buscar modelo..."
                        emptyText="Nenhum modelo encontrado."
                        disabled={!categoriaIdSelecionada || loadingModelos}
                        className="flex-1"
                      />

                      {/* Botão para criar novo modelo */}
                      <Popover open={popoverModeloOpen} onOpenChange={setPopoverModeloOpen}>
                        <PopoverTrigger asChild>
                          <button className="btn-minimal-outline h-9 px-3 shrink-0" title="Novo Modelo" type="button">
                            <Plus className="h-4 w-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="end">
                          <div className="space-y-3">
                            <h4 className="font-semibold text-sm">Novo Modelo</h4>
                            <div className="space-y-2">
                              <input
                                className="input-minimal"
                                placeholder="Nome do modelo"
                                value={novoModeloNome}
                                onChange={(e) => setNovoModeloNome(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && novoModeloNome.trim() && novoModeloCodigo.trim() && novoModeloFabricante.trim()) {
                                    e.preventDefault();
                                    handleCriarModelo();
                                  }
                                }}
                              />
                              <input
                                className="input-minimal"
                                placeholder="Código (ex: INV-001)"
                                value={novoModeloCodigo}
                                onChange={(e) => setNovoModeloCodigo(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && novoModeloNome.trim() && novoModeloCodigo.trim() && novoModeloFabricante.trim()) {
                                    e.preventDefault();
                                    handleCriarModelo();
                                  }
                                }}
                              />
                              <input
                                className="input-minimal"
                                placeholder="Fabricante"
                                value={novoModeloFabricante}
                                onChange={(e) => setNovoModeloFabricante(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && novoModeloNome.trim() && novoModeloCodigo.trim() && novoModeloFabricante.trim()) {
                                    e.preventDefault();
                                    handleCriarModelo();
                                  }
                                }}
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                className="btn-minimal-outline h-8 text-xs"
                                onClick={() => {
                                  setNovoModeloNome('');
                                  setNovoModeloCodigo('');
                                  setNovoModeloFabricante('');
                                  setPopoverModeloOpen(false);
                                }}
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                className="btn-minimal-primary h-8 text-xs"
                                onClick={handleCriarModelo}
                                disabled={loadingNovoModelo || !novoModeloNome.trim() || !novoModeloCodigo.trim() || !novoModeloFabricante.trim()}
                              >
                                {loadingNovoModelo ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Criando...
                                  </>
                                ) : (
                                  'Criar'
                                )}
                              </button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>

                {/* ✅ NOVO: Fabricante (read-only, auto-filled from modelo) */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Fabricante</label>
                  <input
                    className="input-minimal bg-gray-50 dark:bg-gray-800"
                    value={formData.fabricante || ''}
                    disabled={true}
                    placeholder="Selecionado automaticamente do modelo"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Número de Série</label>
                  <input
                    className="input-minimal"
                    value={formData.numeroSerie || ''}
                    onChange={(e) => handleFieldChange('numeroSerie', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="Número de série"
                  />
                </div>
              </div>

              {/* Coluna 2 */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Data de Instalação</label>
                  <input
                    className="input-minimal"
                    type="date"
                    value={formData.dataInstalacao || ''}
                    onChange={(e) => handleFieldChange('dataInstalacao', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Criticidade</label>
                  <Select value={formData.criticidade || ''} onValueChange={(value) => handleFieldChange('criticidade', value)} disabled={isReadOnly}>
                    <SelectTrigger>
                      <SelectValue placeholder="1 a 5" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 (Muito Baixa)</SelectItem>
                      <SelectItem value="2">2 (Baixa)</SelectItem>
                      <SelectItem value="3">3 (Média)</SelectItem>
                      <SelectItem value="4">4 (Alta)</SelectItem>
                      <SelectItem value="5">5 (Muito Alta)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Localização Específica</label>
                  <input
                    className="input-minimal"
                    value={formData.localizacaoEspecifica || ''}
                    onChange={(e) => handleFieldChange('localizacaoEspecifica', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="Ex: Lado direito, Entrada principal..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Fornecedor</label>
                  <input
                    className="input-minimal"
                    value={formData.fornecedor || ''}
                    onChange={(e) => handleFieldChange('fornecedor', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="Fornecedor do componente"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================================ */}
          {/* DADOS TÉCNICOS DINÂMICOS DO COMPONENTE */}
          {/* ============================================================================ */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground pb-2 border-b">Dados Técnicos</h3>
            {renderCamposTecnicos()}
          </div>

          {/* ============================================================================ */}
          {/* VALORES FINANCEIROS */}
          {/* ============================================================================ */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground pb-2 border-b">Valores Financeiros</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Valor Imobilizado</label>
                <input
                  className="input-minimal"
                  type="number"
                  value={formData.valorImobilizado || ''}
                  onChange={(e) => handleFieldChange('valorImobilizado', parseFloat(e.target.value) || 0)}
                  disabled={isReadOnly}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Valor de Depreciação</label>
                <input
                  className="input-minimal"
                  type="number"
                  value={formData.valorDepreciacao || ''}
                  onChange={(e) => handleFieldChange('valorDepreciacao', parseFloat(e.target.value) || 0)}
                  disabled={isReadOnly}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Valor Contábil</label>
                <input
                  className="input-minimal"
                  type="number"
                  value={formData.valorContabil || ''}
                  onChange={(e) => handleFieldChange('valorContabil', parseFloat(e.target.value) || 0)}
                  disabled={isReadOnly}
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>

          {/* ============================================================================ */}
          {/* OBSERVAÇÕES ADICIONAIS */}
          {/* ============================================================================ */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium block">Observações</label>
            <textarea
              className="textarea-minimal h-20 resize-none w-full"
              value={formData.observacoes || ''}
              onChange={(e) => handleFieldChange('observacoes', e.target.value)}
              disabled={isReadOnly}
              placeholder="Observações adicionais sobre o componente"
            />
          </div>
        </div>

        {/* Footer com botões */}
        <div className="border-t px-6 py-3 flex justify-end gap-2 bg-muted/20">
          <button className="btn-minimal-outline h-9" onClick={onClose} disabled={isSubmitting}>
            <X className="h-4 w-4 mr-2" />
            {isReadOnly ? 'Fechar' : 'Cancelar'}
          </button>
          {mode !== 'view' && (
            <button
              onClick={handleSubmit}
              className="btn-minimal-primary h-9"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {mode === 'create' ? 'Criar Componente' : 'Salvar Alterações'}
                </>
              )}
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
