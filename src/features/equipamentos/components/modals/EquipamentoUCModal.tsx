// src/features/equipamentos/components/modals/EquipamentoUCModal.tsx - LAYOUT LIMPO
import React, { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { Wrench, Save, X, AlertCircle, Loader2, Eye, Edit2, Plus, Trash2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Equipamento } from '../../types';
import { useSelectionData } from '../../hooks/useSelectionData';
import { useEquipamentos } from '../../hooks/useEquipamentos';
import { useLocationCascade } from '../../hooks/useLocationCascade';
import { tiposEquipamentosApi, categoriasEquipamentosApi, type TipoEquipamentoModal, type TipoEquipamento } from '@/services/tipos-equipamentos.services';
import { useCategorias } from '@/hooks/useCategorias';
import { useModelos } from '@/hooks/useModelos';
import { getUnidadeById } from '@/services/unidades.services';
import { PlantasService } from '@/services/plantas.services';
import type { Unidade } from '@/features/unidades/types';
import type { PlantaResponse, ProprietarioBasico } from '@/services/plantas.services';

interface EquipamentoUCModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'view';
  entity?: Equipamento | null;
  onClose: () => void;
  onSubmit: (data: any) => void;
  onDelete?: (equipamento: Equipamento) => void;
}

export const EquipamentoUCModal: React.FC<EquipamentoUCModalProps> = ({
  isOpen,
  mode,
  entity,
  onClose,
  onSubmit,
  onDelete
}) => {
  const { getEquipamento } = useEquipamentos();

  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dadosTecnicos, setDadosTecnicos] = useState<any[]>([]);
  const [dadosTecnicosPersonalizados, setDadosTecnicosPersonalizados] = useState<any[]>([]);

  // Estados para hierarquia completa em modo view/edit
  const [unidadeDetalhes, setUnidadeDetalhes] = useState<Unidade | null>(null);
  const [plantaDetalhes, setPlantaDetalhes] = useState<PlantaResponse | null>(null);
  const [proprietarioDetalhes, setProprietarioDetalhes] = useState<ProprietarioBasico | null>(null);

  // Estados para seleção de categoria e modelo
  const [categoriaIdSelecionada, setCategoriaIdSelecionada] = useState<string>('');
  const [modeloSelecionado, setModeloSelecionado] = useState<TipoEquipamento | null>(null);

  // Hooks para buscar categorias e modelos
  const { categorias, loading: loadingCategorias, refetch: refetchCategorias } = useCategorias();
  const { modelos, loading: loadingModelos, refetch: refetchModelos } = useModelos({
    categoriaId: categoriaIdSelecionada || undefined,
    autoFetch: !!categoriaIdSelecionada,
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

  // Estados para tipos de equipamentos da API (manter para compatibilidade)
  const [tiposEquipamentos, setTiposEquipamentos] = useState<TipoEquipamentoModal[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(false);

  // Hook de seleção cascateada para modo create
  const locationCascade = useLocationCascade();

  const isReadonly = mode === 'view';  // ✅ CORRIGIDO: apenas 'view' é readonly, 'edit' permite edição
  const isCreating = mode === 'create';

  // ============================================================================
  // CARREGAR TIPOS DE EQUIPAMENTOS DA API
  // ============================================================================
  useEffect(() => {
    const loadTiposEquipamentos = async () => {
      setLoadingTipos(true);
      try {
        const tipos = await tiposEquipamentosApi.getAll();
        console.log('🔍 [MODAL] Tipos brutos da API (primeiros 2):', tipos.slice(0, 2));
        console.log('🔍 [MODAL] propriedadesSchema (camelCase) do primeiro tipo:', tipos[0]?.propriedadesSchema);
        console.log('🔍 [MODAL] propriedades_schema (snake_case) do primeiro tipo:', tipos[0]?.propriedades_schema);
        console.log('🔍 [MODAL] campos do primeiro tipo:', tipos[0]?.propriedadesSchema?.campos || tipos[0]?.propriedades_schema?.campos);

        const tiposFormatados = tipos.map(tipo => {
          // ✅ CORRIGIDO: backend retorna "propriedadesSchema" (camelCase), não "propriedades_schema"
          const campos = tipo.propriedadesSchema?.campos || tipo.propriedades_schema?.campos || [];
          console.log(`🔍 [MODAL] Tipo ${tipo.codigo} tem ${campos.length} campos:`, campos);

          return {
            value: tipo.codigo,
            label: tipo.nome,
            categoria: tipo.categoria,
            camposTecnicos: campos.map(campo => ({
              campo: campo.campo || campo.nome, // ✅ CORRIGIDO: aceita ambos campo.campo e campo.nome
              tipo: campo.tipo === 'boolean' ? ('select' as const) : campo.tipo,
              unidade: campo.unidade,
              opcoes: campo.opcoes || (campo.tipo === 'boolean' ? ['Sim', 'Não'] : undefined),
              obrigatorio: campo.obrigatorio,
            })),
          };
        });
        setTiposEquipamentos(tiposFormatados);
        console.log('✅ [MODAL] Tipos de equipamentos carregados da API:', tiposFormatados.length);
        console.log('🔍 [MODAL] Exemplo de tipo formatado:', tiposFormatados[0]);
      } catch (err) {
        console.error('❌ [MODAL] Erro ao carregar tipos de equipamentos:', err);
        setError('Erro ao carregar tipos de equipamentos');
      } finally {
        setLoadingTipos(false);
      }
    };

    if (isOpen) {
      loadTiposEquipamentos();
    }
  }, [isOpen]);

  // Helper para buscar tipo de equipamento
  const getTipoEquipamento = (codigo: string): TipoEquipamentoModal | undefined => {
    return tiposEquipamentos.find(t => t.value === codigo);
  };

  // ============================================================================
  // INICIALIZAÇÃO
  // ============================================================================
  useEffect(() => {
    if (isOpen && !loadingTipos && tiposEquipamentos.length > 0) {
      setError(null);

      if (entity && (mode === 'edit' || mode === 'view')) {
        initializeWithEntity(entity);
      } else if (mode === 'create') {
        initializeForCreate();
      }
    }
  }, [isOpen, entity, mode, loadingTipos, tiposEquipamentos]);

  const initializeWithEntity = async (equipamento: Equipamento) => {
    setLoading(true);

    try {
      console.log('🎯 [MODAL] Entity recebida (equipamento param):', equipamento);
      console.log('🎯 [MODAL] equipamento.id:', equipamento.id);
      console.log('🎯 [MODAL] getEquipamento existe?', !!getEquipamento);

      // Para modo visualização/edição, buscar dados completos se possível
      let dadosCompletos = equipamento;
      if (getEquipamento && equipamento.id) {
        console.log('🔄 [MODAL] Buscando dados completos do equipamento via getEquipamento...');
        dadosCompletos = await getEquipamento(equipamento.id);
        console.log('✅ [MODAL] Dados completos retornados:', dadosCompletos);
      } else {
        console.log('⚠️ [MODAL] NÃO vai buscar dados completos - getEquipamento:', !!getEquipamento, 'equipamento.id:', equipamento.id);
      }

      console.log('📋 [MODAL] Dados completos do equipamento:', dadosCompletos);
      console.log('🔧 [MODAL] Mapeamento - tipo:', dadosCompletos.tipo, 'tipoEquipamento:', dadosCompletos.tipoEquipamento);
      console.log('🔧 [MODAL] Mapeamento - tipoEquipamentoObj:', dadosCompletos.tipoEquipamentoObj);
      console.log('⚡ [MODAL] Mapeamento - mcpse:', dadosCompletos.mcpse, 'mcpseAtivo será:', dadosCompletos.mcpse || dadosCompletos.mcpseAtivo || false);

      // Buscar tipo de equipamento completo do backend para pegar categoria e fabricante
      let tipoCompleto: TipoEquipamento | null = null;
      const codigoTipo = dadosCompletos.tipoEquipamentoObj?.codigo || dadosCompletos.tipoEquipamento || dadosCompletos.tipo;
      if (codigoTipo) {
        try {
          tipoCompleto = await tiposEquipamentosApi.findByCode(codigoTipo);
          console.log('✅ [MODAL] Tipo completo carregado:', tipoCompleto);

          // Setar categoria e modelo selecionados
          if (tipoCompleto) {
            setCategoriaIdSelecionada(tipoCompleto.categoriaId);
            setModeloSelecionado(tipoCompleto);
          }
        } catch (err) {
          console.warn('⚠️ [MODAL] Erro ao carregar tipo completo:', err);
        }
      }

      setFormData({
        nome: dadosCompletos.nome || '',
        fabricante: dadosCompletos.fabricante || '',
        fabricanteCustom: dadosCompletos.fabricante_custom || '',
        modelo: dadosCompletos.modelo || '',
        numeroSerie: dadosCompletos.numeroSerie || '',
        tag: dadosCompletos.tag || '',
        criticidade: dadosCompletos.criticidade || '3',
        tipoEquipamento: codigoTipo || '',
        tipoEquipamentoId: tipoCompleto?.id || '',
        plantaId: dadosCompletos.unidade?.plantaId || '',
        unidadeId: dadosCompletos.unidadeId || dadosCompletos.unidade?.id || '',  // ✅ CORRIGIDO: pegar unidade.id se unidadeId não existir
        proprietarioId: dadosCompletos.proprietarioId || '',
        localizacao: dadosCompletos.localizacao || '',
        valorContabil: dadosCompletos.valorContabil || '',
        dataImobilizacao: dadosCompletos.dataImobilizacao || '',
        emOperacao: dadosCompletos.emOperacao || '',
        // Campos MQTT
        mqttHabilitado: dadosCompletos.mqttHabilitado || dadosCompletos.mqtt_habilitado || false,
        topicoMqtt: dadosCompletos.topicoMqtt || dadosCompletos.topico_mqtt || '',
        // Campos MCPSE
        mcpse: dadosCompletos.mcpse || false,
        mcpseAtivo: dadosCompletos.mcpse || dadosCompletos.mcpseAtivo ||
          // Se tem dados MCPSE preenchidos, considerar ativo
          !!(dadosCompletos.tuc || dadosCompletos.a1 || dadosCompletos.a2 ||
             dadosCompletos.a3 || dadosCompletos.a4 || dadosCompletos.a5 || dadosCompletos.a6),
        tuc: dadosCompletos.tuc || '',
        a1: dadosCompletos.a1 || '',
        a2: dadosCompletos.a2 || '',
        a3: dadosCompletos.a3 || '',
        a4: dadosCompletos.a4 || '',
        a5: dadosCompletos.a5 || '',
        a6: dadosCompletos.a6 || ''
      });

      // Separar dados técnicos em pré-definidos e personalizados
      console.log('🔧 [MODAL] dadosCompletos.dadosTecnicos:', dadosCompletos.dadosTecnicos);
      console.log('🔧 [MODAL] Tipo do equipamento (ID):', dadosCompletos.tipoEquipamento || dadosCompletos.tipo);
      console.log('🔧 [MODAL] Tipo do equipamento (código):', dadosCompletos.tipoEquipamentoObj?.codigo);

      if (dadosCompletos.dadosTecnicos && dadosCompletos.dadosTecnicos.length > 0) {
        const codigoTipo = dadosCompletos.tipoEquipamentoObj?.codigo || dadosCompletos.tipoEquipamento || dadosCompletos.tipo || '';
        const tipoEqp = getTipoEquipamento(codigoTipo);
        console.log('🔧 [MODAL] Tipo encontrado para dados técnicos:', tipoEqp);
        console.log('🔧 [MODAL] Campos técnicos do tipo:', tipoEqp?.camposTecnicos);

        if (tipoEqp) {
          const camposPredefinidos = tipoEqp.camposTecnicos.map(campo => campo.campo);

          // Inicializar campos predefinidos com valores do banco ou vazios
          const predefinidosComValores = tipoEqp.camposTecnicos.map(campo => {
            const dadoExistente = dadosCompletos.dadosTecnicos.find(d => d.campo === campo.campo);
            console.log(`🔧 [MODAL] Campo ${campo.campo}: valor no banco =`, dadoExistente?.valor);
            return {
              campo: campo.campo,
              valor: dadoExistente?.valor || '',
              tipo: campo.tipo,
              unidade: campo.unidade || '',
              obrigatorio: campo.obrigatorio || false
            };
          });

          // Campos personalizados são apenas os que NÃO são predefinidos
          const personalizados = dadosCompletos.dadosTecnicos.filter(dado =>
            !camposPredefinidos.includes(dado.campo)
          );

          console.log('✅ [MODAL] Dados técnicos predefinidos carregados:', predefinidosComValores);
          console.log('✅ [MODAL] Dados técnicos personalizados:', personalizados);

          setDadosTecnicos(predefinidosComValores);
          setDadosTecnicosPersonalizados(personalizados);
        } else {
          console.log('⚠️ [MODAL] Tipo não encontrado, todos dados serão personalizados');
          setDadosTecnicosPersonalizados(dadosCompletos.dadosTecnicos);
        }
      } else {
        console.log('⚠️ [MODAL] Nenhum dado técnico no banco');
      }

      // Buscar hierarquia completa recursivamente (Unidade → Planta → Proprietário)
      if (mode === 'view' || mode === 'edit') {
        console.log('🔍 [MODAL] Carregando hierarquia completa...');

        // 1. Buscar detalhes da Unidade
        if (dadosCompletos.unidadeId) {
          try {
            const unidade = await getUnidadeById(dadosCompletos.unidadeId);
            setUnidadeDetalhes(unidade);
            console.log('✅ [MODAL] Unidade carregada:', unidade.nome);

            // 2. Buscar detalhes da Planta (via unidade.plantaId)
            if (unidade.plantaId) {
              try {
                const planta = await PlantasService.getPlanta(unidade.plantaId);
                setPlantaDetalhes(planta);
                console.log('✅ [MODAL] Planta carregada:', planta.nome);

                // 3. Buscar detalhes do Proprietário (via planta.proprietario)
                if (planta.proprietario) {
                  setProprietarioDetalhes(planta.proprietario);
                  console.log('✅ [MODAL] Proprietário carregado:', planta.proprietario.nome);
                }
              } catch (err) {
                console.warn('⚠️ [MODAL] Erro ao carregar planta:', err);
              }
            }
          } catch (err) {
            console.warn('⚠️ [MODAL] Erro ao carregar unidade:', err);
          }
        }
      }
    } catch (error) {
      setError('Erro ao carregar dados do equipamento');
    } finally {
      setLoading(false);
    }
  };

  const initializeForCreate = () => {
    setFormData({
      nome: '',
      fabricante: '',
      fabricanteCustom: '',
      modelo: '',
      numeroSerie: '',
      tag: '',
      criticidade: '3',
      tipoEquipamento: '',
      tipoEquipamentoId: '',
      unidadeId: '',
      plantaId: '',
      proprietarioId: '',
      localizacao: '',
      valorContabil: '',
      dataImobilizacao: '',
      emOperacao: 'sim',
      // Campos MQTT
      mqttHabilitado: false,
      topicoMqtt: '',
      // Campos MCPSE
      mcpse: false,
      tuc: '',
      a1: '',
      a2: '',
      a3: '',
      a4: '',
      a5: '',
      a6: ''
    });
    setDadosTecnicos([]);
    setDadosTecnicosPersonalizados([]);

    // Limpar hierarquia
    setUnidadeDetalhes(null);
    setPlantaDetalhes(null);
    setProprietarioDetalhes(null);

    // Limpar categoria e modelo
    setCategoriaIdSelecionada('');
    setModeloSelecionado(null);

    // Reset do cascade
    locationCascade.reset();
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================
  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  // Handler para mudança de categoria - reseta modelo
  const handleCategoriaChange = (categoriaId: string) => {
    console.log('🔄 [MODAL] Categoria selecionada:', categoriaId);
    setCategoriaIdSelecionada(categoriaId);
    setModeloSelecionado(null);

    // Buscar nome da categoria para auto-preencher o nome do equipamento
    const categoriaSelecionada = categorias.find(cat => cat.id === categoriaId);
    const nomeAutoPreenchido = categoriaSelecionada ? categoriaSelecionada.nome : '';

    // Limpar tipo de equipamento e auto-preencher nome
    setFormData((prev: any) => ({
      ...prev,
      nome: nomeAutoPreenchido, // Auto-preencher nome do equipamento
      tipoEquipamento: '',
      tipoEquipamentoId: '',
      fabricante: '',
      fabricanteCustom: '',
    }));

    // Limpar dados técnicos
    setDadosTecnicos([]);
  };

  // Handler para mudança de modelo - preenche fabricante automaticamente
  const handleModeloChange = (modeloId: string) => {
    console.log('🔄 [MODAL] Modelo selecionado ID:', modeloId);

    const modelo = modelos.find(m => m.id === modeloId);
    console.log('🔍 [MODAL] Modelo encontrado:', modelo);

    if (modelo) {
      setModeloSelecionado(modelo);

      // Preencher tipo de equipamento e fabricante
      setFormData((prev: any) => ({
        ...prev,
        tipoEquipamento: modelo.codigo,
        tipoEquipamentoId: modelo.id,
        fabricante: modelo.fabricante, // Auto-preencher do modelo
      }));

      // Carregar campos técnicos se existirem
      const tipoFormatado = tiposEquipamentos.find(t => t.value === modelo.codigo);
      if (tipoFormatado && tipoFormatado.camposTecnicos && tipoFormatado.camposTecnicos.length > 0) {
        const dadosIniciais = tipoFormatado.camposTecnicos.map(campo => ({
          campo: campo.campo,
          valor: '',
          tipo: campo.tipo,
          unidade: campo.unidade || '',
          obrigatorio: campo.obrigatorio || false
        }));
        console.log('✅ [MODAL] Dados técnicos inicializados para modelo:', dadosIniciais);
        setDadosTecnicos(dadosIniciais);
      }
    }
  };

  const handleTipoEquipamentoChange = (value: string) => {
    console.log('🔄 [MODAL] Tipo selecionado:', value);
    handleInputChange('tipoEquipamento', value);

    // Quando muda o tipo, carregar campos técnicos pré-definidos
    const tipoEqp = getTipoEquipamento(value);
    console.log('🔍 [MODAL] Tipo encontrado:', tipoEqp);
    console.log('🔍 [MODAL] Campos técnicos do tipo:', tipoEqp?.camposTecnicos);

    if (tipoEqp && tipoEqp.camposTecnicos && tipoEqp.camposTecnicos.length > 0) {
      const dadosIniciais = tipoEqp.camposTecnicos.map(campo => ({
        campo: campo.campo,
        valor: '',
        tipo: campo.tipo,
        unidade: campo.unidade || '',
        obrigatorio: campo.obrigatorio || false
      }));
      console.log('✅ [MODAL] Dados técnicos inicializados:', dadosIniciais);
      setDadosTecnicos(dadosIniciais);

      // Remover campos predefinidos dos personalizados para evitar duplicação
      const camposPredefinidos = tipoEqp.camposTecnicos.map(c => c.campo);
      setDadosTecnicosPersonalizados(prev =>
        prev.filter(p => !camposPredefinidos.includes(p.campo))
      );
    } else {
      console.log('⚠️ [MODAL] Nenhum campo técnico encontrado para este tipo');
      setDadosTecnicos([]);
    }
  };

  const handleDadoTecnicoChange = (index: number, field: string, value: string) => {
    setDadosTecnicos(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const adicionarDadoPersonalizado = () => {
    const novoDado = {
      campo: '',
      valor: '',
      tipo: 'text',
      unidade: ''
    };
    setDadosTecnicosPersonalizados(prev => [...prev, novoDado]);
  };

  const removerDadoPersonalizado = (index: number) => {
    setDadosTecnicosPersonalizados(prev => prev.filter((_, i) => i !== index));
  };

  const handleDadoPersonalizadoChange = (index: number, field: string, value: string) => {
    setDadosTecnicosPersonalizados(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
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

        // Auto-preencher nome do equipamento
        setFormData((prev: any) => ({
          ...prev,
          nome: novaCategoria.nome,
        }));

        // Limpar e fechar popover
        setNovaCategoriaNome('');
        setPopoverCategoriaOpen(false);

        console.log('✅ [MODAL] Nova categoria criada:', novaCategoria);
      }
    } catch (err: any) {
      console.error('❌ [MODAL] Erro ao criar categoria:', err);
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
          tipoEquipamento: novoModelo.codigo,
          tipoEquipamentoId: novoModelo.id,
          fabricante: novoModelo.fabricante,
        }));

        // Limpar e fechar popover
        setNovoModeloNome('');
        setNovoModeloCodigo('');
        setNovoModeloFabricante('');
        setPopoverModeloOpen(false);

        console.log('✅ [MODAL] Novo modelo criado:', novoModelo);
      }
    } catch (err: any) {
      console.error('❌ [MODAL] Erro ao criar modelo:', err);
      setError(err.response?.data?.message || 'Erro ao criar novo modelo');
    } finally {
      setLoadingNovoModelo(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Validações básicas
      if (!formData.nome?.trim()) {
        setError('Nome é obrigatório');
        return;
      }

      // No modo create, validar seleção cascateada
      if (isCreating) {
        if (!locationCascade.selectedProprietarioId) {
          setError('Proprietário é obrigatório');
          return;
        }

        if (!locationCascade.selectedPlantaId) {
          setError('Planta é obrigatória');
          return;
        }

        if (!locationCascade.selectedUnidadeId) {
          setError('Unidade é obrigatória');
          return;
        }
      }

      // Validar MQTT: se habilitado, tópico é obrigatório
      if (formData.mqttHabilitado && !formData.topicoMqtt?.trim()) {
        setError('Tópico MQTT é obrigatório quando MQTT está habilitado');
        return;
      }

      // Combinar dados técnicos sem duplicação
      const dadosPredefinidos = dadosTecnicos.filter(d => d.valor?.trim());
      const dadosPersonalizados = dadosTecnicosPersonalizados.filter(d => d.campo?.trim() && d.valor?.trim());
      
      // Verificar se há duplicação de campos
      const camposPredefinidos = dadosPredefinidos.map(d => d.campo);
      const dadosPersonalizadosUnicos = dadosPersonalizados.filter(d => 
        !camposPredefinidos.includes(d.campo)
      );
      
      const todosDadosTecnicos = [...dadosPredefinidos, ...dadosPersonalizadosUnicos];
      
      console.log('🔧 [MODAL] Dados técnicos organizados:', {
        predefinidos: dadosPredefinidos,
        personalizados: dadosPersonalizados,
        personalizadosUnicos: dadosPersonalizadosUnicos,
        final: todosDadosTecnicos
      });

      // Converter data de imobilização para formato ISO-8601 DateTime se fornecida
      const dataImobilizacaoFormatted = formData.dataImobilizacao 
        ? new Date(formData.dataImobilizacao + 'T00:00:00.000Z').toISOString()
        : null;

      // Debug: verificar estado do locationCascade
      console.log('🔍 [MODAL] Debug locationCascade:', {
        isCreating,
        selectedProprietarioId: locationCascade.selectedProprietarioId,
        selectedPlantaId: locationCascade.selectedPlantaId,
        selectedUnidadeId: locationCascade.selectedUnidadeId,
        formDataUnidadeId: formData.unidadeId
      });

      // Buscar o ID do tipo de equipamento pelo código
      const tipoEqpSelecionado = formData.tipoEquipamento ?
        await tiposEquipamentosApi.findByCode(formData.tipoEquipamento) : null;

      const submitData = {
        // Dados básicos
        nome: formData.nome,
        classificacao: 'UC',
        unidade_id: isCreating ? locationCascade.selectedUnidadeId : formData.unidadeId,
        fabricante: formData.fabricante,
        fabricante_custom: formData.fabricanteCustom || undefined, // ✅ NOVO: Fabricante customizado se divergir do modelo
        modelo: formData.modelo,
        numero_serie: formData.numeroSerie,
        tag: formData.tag,
        criticidade: formData.criticidade,
        tipo_equipamento: formData.tipoEquipamento,  // Código (compatibilidade)
        tipo_equipamento_id: tipoEqpSelecionado?.id,  // ID do tipo (correto)
        em_operacao: formData.emOperacao,
        data_imobilizacao: dataImobilizacaoFormatted,
        valor_contabil: formData.valorContabil ? parseFloat(formData.valorContabil) : undefined,
        localizacao: formData.localizacao,
        // Campos MQTT
        mqtt_habilitado: formData.mqttHabilitado,
        topico_mqtt: formData.topicoMqtt,
        // Campos MCPSE
        mcpse: formData.mcpseAtivo,
        tuc: formData.tuc,
        a1: formData.a1,
        a2: formData.a2,
        a3: formData.a3,
        a4: formData.a4,
        a5: formData.a5,
        a6: formData.a6,
        // Dados técnicos
        dados_tecnicos: todosDadosTecnicos.map(dt => ({
          campo: dt.campo,
          valor: dt.valor,
          tipo: dt.tipo || 'string',
          unidade: dt.unidade
        }))
      };

      console.log('📤 [MODAL] Dados sendo enviados para API:', submitData);
      await onSubmit(submitData);
    } catch (error) {
      setError('Erro ao salvar equipamento');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  const renderHeader = () => {
    const icons = {
      create: <Wrench className="h-5 w-5" />,
      edit: <Edit2 className="h-5 w-5" />,
      view: <Eye className="h-5 w-5" />
    };

    const titles = {
      create: 'Novo Equipamento UC',
      edit: 'Editar Equipamento UC',
      view: 'Detalhes do Equipamento UC'
    };

    return (
      <SheetHeader className="space-y-3">
        <SheetTitle className="flex items-center gap-2 text-lg">
          {icons[mode]}
          {titles[mode]}
          {mode === 'view' && formData.nome && (
            <Badge variant="outline" className="ml-2">
              {formData.nome}
            </Badge>
          )}
        </SheetTitle>
      </SheetHeader>
    );
  };

  const renderDadosBasicos = () => (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground pb-2 border-b">
        Dados Básicos
      </h3>
      
      <div className="grid-equal-cols-2 gap-x-2 gap-y-4">
        {/* Nome */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Nome do Equipamento <span className="text-red-500">*</span>
          </label>
          <input
            className="input-minimal"
            value={formData.nome || ''}
            onChange={(e) => handleInputChange('nome', e.target.value)}
            placeholder="Ex: Sistema de Controle Principal"
            disabled={isReadonly}
          />
        </div>

        {/* Categoria de Equipamento */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Categoria <span className="text-red-500">*</span>
          </label>
          {isReadonly ? (
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
              {modeloSelecionado?.categoria?.nome || 'Não informado'}
            </div>
          ) : (
            <div className="flex gap-2">
              <Combobox
                options={categorias.map(cat => ({ value: cat.id, label: cat.nome }))}
                value={categoriaIdSelecionada}
                onValueChange={handleCategoriaChange}
                placeholder={loadingCategorias ? 'Carregando...' : 'Selecione a categoria'}
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

        {/* Modelo (Tipo de Equipamento) */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Modelo <span className="text-red-500">*</span>
          </label>
          {isReadonly ? (
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
              {modeloSelecionado ? `${modeloSelecionado.nome} (${modeloSelecionado.codigo})` : formData.tipoEquipamento || 'Não informado'}
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
                placeholder={loadingModelos ? 'Carregando...' : 'Selecione o modelo'}
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

        {/* Fabricante (Auto-preenchido do modelo) */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Fabricante
            {modeloSelecionado && (
              <span className="ml-2 text-xs text-muted-foreground">(do modelo)</span>
            )}
          </label>
          <div className="p-2 bg-muted/50 rounded border text-sm">
            {formData.fabricante || 'Selecione um modelo'}
          </div>
        </div>

        {/* Número de Série */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Número de Série</label>
          <input
            className="input-minimal"
            value={formData.numeroSerie || ''}
            onChange={(e) => handleInputChange('numeroSerie', e.target.value)}
            placeholder="Ex: ABC123456"
            disabled={isReadonly}
          />
        </div>

        {/* TAG */}
        <div className="space-y-2">
          <label className="text-sm font-medium">TAG</label>
          <input
            className="input-minimal"
            value={formData.tag || ''}
            onChange={(e) => handleInputChange('tag', e.target.value)}
            placeholder="Ex: TAG-001"
            disabled={isReadonly}
          />
        </div>

        {/* Criticidade */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Criticidade <span className="text-red-500">*</span>
          </label>
          <Select
            value={formData.criticidade || '3'}
            onValueChange={(value) => handleInputChange('criticidade', value)}
            disabled={isReadonly}
          >
            <SelectTrigger>
              <SelectValue />
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
      </div>
    </div>
  );

  const renderLocalizacao = () => (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground pb-2 border-b">
        Localização
      </h3>

      {/* Hierarquia Completa - Apenas em View/Edit */}
      {(mode === 'view' || mode === 'edit') && (proprietarioDetalhes || plantaDetalhes || unidadeDetalhes) && (
        <div className="space-y-3 p-4 bg-muted/40 border border-border/40 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="text-xs">
              Hierarquia
            </Badge>
          </div>

          {/* Proprietário */}
          {proprietarioDetalhes && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Proprietário
              </label>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {proprietarioDetalhes.nome}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {proprietarioDetalhes.tipo === 'pessoa_fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'} • {proprietarioDetalhes.cpf_cnpj}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Planta */}
          {plantaDetalhes && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Planta
              </label>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {plantaDetalhes.nome}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {plantaDetalhes.localizacao}
                    {plantaDetalhes.endereco && ` • ${plantaDetalhes.endereco.cidade}/${plantaDetalhes.endereco.uf}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Unidade */}
          {unidadeDetalhes && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Unidade
              </label>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {unidadeDetalhes.nome}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {unidadeDetalhes.tipo} • Potência: {unidadeDetalhes.potencia} kW
                    {unidadeDetalhes.cidade && ` • ${unidadeDetalhes.cidade}/${unidadeDetalhes.estado}`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Seletores originais - Modo Create */}
      {mode === 'create' && (
        <div className="space-y-4">
          {/* Proprietário */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Proprietário <span className="text-red-500">*</span>
            </label>
            <Select
              value={locationCascade.selectedProprietarioId}
              onValueChange={locationCascade.handleProprietarioChange}
              disabled={locationCascade.loadingProprietarios}
            >
              <SelectTrigger>
                <SelectValue placeholder={locationCascade.loadingProprietarios ? 'Carregando...' : 'Selecione o proprietário'} />
              </SelectTrigger>
              <SelectContent>
                {locationCascade.proprietarios.map((prop) => (
                  <SelectItem key={prop.id} value={prop.id}>
                    {prop.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Planta */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Planta <span className="text-red-500">*</span>
            </label>
            <Select
              value={locationCascade.selectedPlantaId}
              onValueChange={locationCascade.handlePlantaChange}
              disabled={locationCascade.loadingPlantas || !locationCascade.selectedProprietarioId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    locationCascade.loadingPlantas ? 'Carregando plantas...' :
                    !locationCascade.selectedProprietarioId ? 'Primeiro selecione um proprietário' :
                    'Selecione a planta'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {locationCascade.plantas.map((planta) => (
                  <SelectItem key={planta.id} value={planta.id}>
                    {planta.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unidade */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Unidade <span className="text-red-500">*</span>
            </label>
            <Select
              value={locationCascade.selectedUnidadeId}
              onValueChange={locationCascade.handleUnidadeChange}
              disabled={locationCascade.loadingUnidades || !locationCascade.selectedPlantaId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    locationCascade.loadingUnidades ? 'Carregando unidades...' :
                    !locationCascade.selectedPlantaId ? 'Primeiro selecione uma planta' :
                    'Selecione a unidade'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {locationCascade.unidades.map((unidade) => (
                  <SelectItem key={unidade.id} value={unidade.id}>
                    {unidade.nome} - {unidade.tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Localização específica - Sempre visível */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Localização Específica</label>
        <input
          className="input-minimal"
          value={formData.localizacao || ''}
          onChange={(e) => handleInputChange('localizacao', e.target.value)}
          placeholder="Ex: Sala de controle, Painel A, etc."
          disabled={isReadonly}
        />
      </div>
    </div>
  );

  const renderDadosTecnicos = () => {
    const tipoEqp = getTipoEquipamento(formData.tipoEquipamento);
    const temDadosPredefinidos = dadosTecnicos.length > 0;
    const temDadosPersonalizados = dadosTecnicosPersonalizados.length > 0;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground pb-2 border-b">
            Dados Técnicos
          </h3>
          {!isReadonly && (
            <button
              type="button"
              onClick={adicionarDadoPersonalizado}
              className="btn-minimal-outline text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Adicionar Campo
            </button>
          )}
        </div>

        {/* Dados Técnicos Pré-definidos por Tipo */}
        {temDadosPredefinidos && (
          <div className="space-y-4">
            {tipoEqp && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {tipoEqp.label}
                </Badge>
                <span className="text-xs text-gray-500">
                  Campos técnicos padrão
                </span>
              </div>
            )}

            <div className="grid-equal-cols-2 gap-x-2 gap-y-4">
              {dadosTecnicos.map((dado: any, index: number) => (
                <div key={index} className="space-y-2">
                  <label className="text-sm font-medium">
                    {dado.campo}
                    {dado.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                    {dado.unidade && <span className="text-gray-500 text-xs ml-1">({dado.unidade})</span>}
                  </label>
                  {isReadonly ? (
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                      {dado.valor || <span className="text-gray-400">Não informado</span>}
                    </div>
                  ) : (
                    <>
                      {dado.tipo === 'select' && tipoEqp ? (
                        <Select
                          value={dado.valor}
                          onValueChange={(value) => handleDadoTecnicoChange(index, 'valor', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {tipoEqp.camposTecnicos
                              .find(c => c.campo === dado.campo)
                              ?.opcoes?.map(opcao => (
                                <SelectItem key={opcao} value={opcao}>
                                  {opcao}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <input
                          className="input-minimal"
                          type={dado.tipo === 'number' ? 'number' : 'text'}
                          value={dado.valor}
                          onChange={(e) => handleDadoTecnicoChange(index, 'valor', e.target.value)}
                          placeholder={`Digite ${dado.campo ? dado.campo.toLowerCase() : 'o valor'}`}
                        />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dados Técnicos Personalizados */}
        {temDadosPersonalizados && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Personalizados
              </Badge>
              <span className="text-xs text-gray-500">
                Campos específicos adicionais
              </span>
            </div>
            
            <div className="space-y-4">
              {dadosTecnicosPersonalizados.map((dado: any, index: number) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3">
                    <label className="text-sm font-medium">Campo</label>
                    {isReadonly ? (
                      <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                        {dado.campo}
                      </div>
                    ) : (
                      <input
                        className="input-minimal"
                        value={dado.campo}
                        onChange={(e) => handleDadoPersonalizadoChange(index, 'campo', e.target.value)}
                        placeholder="Nome do campo"
                      />
                    )}
                  </div>

                  <div className="col-span-4">
                    <label className="text-sm font-medium">Valor</label>
                    {isReadonly ? (
                      <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                        {dado.valor}
                      </div>
                    ) : (
                      <input
                        className="input-minimal"
                        value={dado.valor}
                        onChange={(e) => handleDadoPersonalizadoChange(index, 'valor', e.target.value)}
                        placeholder="Valor"
                      />
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="text-sm font-medium">Tipo</label>
                    {isReadonly ? (
                      <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                        {dado.tipo}
                      </div>
                    ) : (
                      <Select
                        value={dado.tipo}
                        onValueChange={(value) => handleDadoPersonalizadoChange(index, 'tipo', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Texto</SelectItem>
                          <SelectItem value="number">Número</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="text-sm font-medium">Unidade</label>
                    {isReadonly ? (
                      <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                        {dado.unidade}
                      </div>
                    ) : (
                      <input
                        className="input-minimal"
                        value={dado.unidade}
                        onChange={(e) => handleDadoPersonalizadoChange(index, 'unidade', e.target.value)}
                        placeholder="Ex: V, A"
                      />
                    )}
                  </div>

                  {!isReadonly && (
                    <div className="col-span-1">
                      <button
                        type="button"
                        onClick={() => removerDadoPersonalizado(index)}
                        className="btn-minimal-outline h-9 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estado vazio */}
        {!temDadosPredefinidos && !temDadosPersonalizados && (
          <div className="text-center py-8">
            <div className="text-sm text-gray-500 mb-2">
              Nenhum dado técnico cadastrado
            </div>
            <div className="text-xs text-gray-400">
              {formData.tipoEquipamento ? 
                'Selecione um tipo de equipamento ou adicione campos personalizados' :
                'Adicione campos técnicos personalizados'
              }
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderInformacoesComplementares = () => (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground pb-2 border-b">
        Informações Complementares
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Valor Contábil */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Valor Contábil (R$)</label>
          <input
            className="input-minimal"
            type="number"
            step="0.01"
            value={formData.valorContabil || ''}
            onChange={(e) => handleInputChange('valorContabil', e.target.value)}
            placeholder="0,00"
            disabled={isReadonly}
          />
        </div>

        {/* Data de Imobilização */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Data de Imobilização</label>
          <input
            className="input-minimal"
            type="date"
            value={formData.dataImobilizacao || ''}
            onChange={(e) => handleInputChange('dataImobilizacao', e.target.value)}
            disabled={isReadonly}
          />
        </div>

        {/* Em Operação */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Em Operação</label>
          <Select
            value={formData.emOperacao || 'sim'}
            onValueChange={(value) => handleInputChange('emOperacao', value)}
            disabled={isReadonly}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Seção MCPSE */}
      <div className="space-y-4 pt-4">
        {isReadonly ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Campos MCPSE (Manual de Controle Patrimonial do Setor Elétrico)
            </label>
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
              {formData.mcpseAtivo ? 'Ativado' : 'Não ativado'}
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="mcpseAtivo"
              checked={formData.mcpseAtivo || false}
              onCheckedChange={(checked) => handleInputChange('mcpseAtivo', checked)}
              disabled={isReadonly}
            />
            <label htmlFor="mcpseAtivo" className="text-sm font-medium">
              Campos MCPSE (Manual de Controle Patrimonial do Setor Elétrico)
            </label>
          </div>
        )}

        {formData.mcpseAtivo && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            {/* TUC */}
            <div className="space-y-2">
              <label className="text-sm font-medium">TUC (min)</label>
              <input
                className="input-minimal"
                type="text"
                value={formData.tuc || ''}
                onChange={(e) => handleInputChange('tuc', e.target.value)}
                placeholder="Ex: 120.5"
                disabled={isReadonly}
              />
            </div>

            {/* A1 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">A1</label>
              <input
                className="input-minimal"
                type="text"
                value={formData.a1 || ''}
                onChange={(e) => handleInputChange('a1', e.target.value)}
                placeholder="Ex: 1.0"
                disabled={isReadonly}
              />
            </div>

            {/* A2 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">A2</label>
              <input
                className="input-minimal"
                type="text"
                value={formData.a2 || ''}
                onChange={(e) => handleInputChange('a2', e.target.value)}
                placeholder="Ex: 0.85"
                disabled={isReadonly}
              />
            </div>

            {/* A3 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">A3</label>
              <input
                className="input-minimal"
                type="text"
                value={formData.a3 || ''}
                onChange={(e) => handleInputChange('a3', e.target.value)}
                placeholder="Ex: 2.5"
                disabled={isReadonly}
              />
            </div>

            {/* A4 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">A4</label>
              <input
                className="input-minimal"
                type="text"
                value={formData.a4 || ''}
                onChange={(e) => handleInputChange('a4', e.target.value)}
                placeholder="Ex: 1.2"
                disabled={isReadonly}
              />
            </div>

            {/* A5 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">A5</label>
              <input
                className="input-minimal"
                type="text"
                value={formData.a5 || ''}
                onChange={(e) => handleInputChange('a5', e.target.value)}
                placeholder="Ex: 0.95"
                disabled={isReadonly}
              />
            </div>

            {/* A6 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">A6</label>
              <input
                className="input-minimal"
                type="text"
                value={formData.a6 || ''}
                onChange={(e) => handleInputChange('a6', e.target.value)}
                placeholder="Ex: 3.0"
                disabled={isReadonly}
              />
            </div>
          </div>
        )}
      </div>

      {/* Seção MQTT */}
      <div className="space-y-4 pt-4">
        {isReadonly ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Configuração MQTT
            </label>
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
              {formData.mqttHabilitado ? 'MQTT Habilitado' : 'MQTT Não habilitado'}
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="mqttHabilitado"
              checked={formData.mqttHabilitado || false}
              onCheckedChange={(checked) => handleInputChange('mqttHabilitado', checked)}
              disabled={isReadonly}
            />
            <label htmlFor="mqttHabilitado" className="text-sm font-medium">
              Equipamento possui monitoramento
            </label>
          </div>
        )}

        {formData.mqttHabilitado && (
          <div className="space-y-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <label className="text-sm font-medium">
              Tópico MQTT <span className="text-red-500">*</span>
            </label>
            <input
              className="input-minimal"
              type="text"
              value={formData.topicoMqtt || ''}
              onChange={(e) => handleInputChange('topicoMqtt', e.target.value)}
              placeholder="Ex: solar/medidor/01"
              disabled={isReadonly}
            />
            <p className="text-xs text-gray-500">
              Informe o tópico MQTT associado a este equipamento
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderActions = () => {
    if (loading) {
      return (
        <div className="flex justify-center">
          <button disabled className="btn-minimal-outline h-9">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Carregando...
          </button>
        </div>
      );
    }

    return (
      <div className="flex justify-between gap-2">
        {/* Botão de Excluir à esquerda - apenas em modo edit */}
        <div>
          {mode === 'edit' && entity && onDelete && (
            <button
              onClick={() => {
                onClose(); // Fechar modal primeiro
                onDelete(entity); // Depois abrir AlertDialog
              }}
              disabled={loading}
              className="btn-minimal-outline h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </button>
          )}
        </div>

        {/* Botões de ação à direita */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn-minimal-outline h-9"
          >
            <X className="h-4 w-4 mr-2" />
            {isReadonly ? 'Fechar' : 'Cancelar'}
          </button>

          {!isReadonly && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-minimal-primary h-9"
            >
              <Save className="h-4 w-4 mr-2" />
              {isCreating ? 'Criar Equipamento' : 'Salvar Alterações'}
            </button>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER PRINCIPAL
  // ============================================================================
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-4xl overflow-hidden flex flex-col gap-0 p-0">
        <div className="border-b px-6 py-4">
          {renderHeader()}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <Alert variant="destructive" className="mb-4 rounded-md">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {locationCascade.error && (
            <Alert className="mb-4 rounded-md border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                {locationCascade.error}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-6">
            {renderDadosBasicos()}

            <Separator />

            {renderLocalizacao()}

            <Separator />

            {renderDadosTecnicos()}

            <Separator />

            {renderInformacoesComplementares()}
          </div>
        </div>

        <div className="border-t px-6 py-3 bg-muted/20">
          {renderActions()}
        </div>
      </SheetContent>
    </Sheet>
  );
};