// src/features/equipamentos/components/modals/ComponenteUARModal.tsx - CORRIGIDO PARA API
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/core/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/core/components/ui/sheet';
import { Alert, AlertDescription } from '@/core/components/ui/alert';
import { toast } from 'sonner';
import { Button } from '@/core/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/core/components/ui/popover';
import { Combobox } from '@/core/components/ui/combobox';
import { Component, Save, Wrench, X, AlertCircle, Loader2, Plus, Minus } from 'lucide-react';
import { normalizarTipoEquipamento } from '@/core/features/equipamentos/utils/tipo-equipamento';
import { camposDaCategoria } from '@/core/features/equipamentos/config/campos-por-categoria';
import React, { useEffect, useState } from 'react';
import { Equipamento } from '../../types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/core/components/ui/tabs';
import {
  useCategorias,
  useModelos,
  useSelectionData,
  useHttpClient,
  useEquipamentos,
} from '@/core/context/hooks';
import { FotoEquipamentoField } from '../FotoEquipamentoField';
import { ItensDoLoteField } from '../ItensDoLoteField';
import { AnexosEquipamentoField } from '../AnexosEquipamentoField';
import type { EquipamentoDoLote } from '@/core/types/contracts';

type AbaUAR = 'dados' | 'itens' | 'anexos';

// Local type definitions (previously from @/services/tipos-equipamentos.services)
interface CampoTecnicoSchema {
  campo: string;
  tipo: 'text' | 'number' | 'select' | 'boolean';
  unidade?: string;
  opcoes?: string[];
  obrigatorio?: boolean;
  nome?: string;
}

interface TipoEquipamentoModal {
  value: string;
  label: string;
  categoria: string;
  camposTecnicos: CampoTecnicoSchema[];
}

interface TipoEquipamento {
  id: string;
  codigo: string;
  nome: string;
  fabricante: string;
  categoriaId: string;
  categoria?: { id: string; nome: string };
  propriedadesSchema?: { campos: CampoTecnicoSchema[] };
  propriedades_schema?: { campos: CampoTecnicoSchema[] };
}

interface ComponenteUARModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'view';
  entity?: Equipamento | null;
  equipamentoPai?: Equipamento | null;
  onClose: () => void;
  /**
   * Devolve o componente criado quando houver. A foto escolhida antes de o
   * componente existir precisa do id para subir, e e daqui que ele vem.
   */
  onSubmit: (data: any) => any;
  /** Componente de origem quando o cadastro e uma duplicacao. */
  duplicarDe?: Equipamento | null;
  /**
   * Chamado depois de um cadastro em lote. O lote nao passa por `onSubmit`:
   * ele cria os N de uma vez, por endpoint proprio, e a lista de quem chamou
   * precisa recarregar mesmo assim.
   */
  aoCriarEmLote?: (total: number) => void | Promise<void>;
}

export const ComponenteUARModal: React.FC<ComponenteUARModalProps> = ({
  isOpen,
  mode,
  entity,
  equipamentoPai,
  onClose,
  onSubmit,
  duplicarDe,
  aoCriarEmLote,
}) => {
  const httpClient = useHttpClient();
  const { fetchTiposEquipamentos, getCamposTecnicosPorTipo } = useSelectionData();
  const {
    createEquipamentosLote,
    proximoSequencial,
    replicarAnexos,
    uploadFoto,
    updateEquipamento,
  } = useEquipamentos();

  /**
   * Cadastro em lote. Um equipamento costuma receber varios componentes iguais
   * de uma vez — doze celulas, oito modulos — e o que muda entre eles e pouco.
   */
  const [quantidade, setQuantidade] = useState(1);
  const [itensDoLote, setItensDoLote] = useState<EquipamentoDoLote[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<AbaUAR>('dados');

  /**
   * Foto escolhida antes de o componente existir. Fica em memoria com preview
   * local e sobe assim que o id nasce — o upload precisa do id, mas quem
   * cadastra ja tem a foto na mao.
   */
  const [fotoPendente, setFotoPendente] = useState<File | null>(null);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);

  /** O que os campos pediram para acontecer assim que o componente nascer. */
  const acoesPosCriacaoRef = React.useRef<Map<string, (id: string) => Promise<void>>>(new Map());
  const registrarAcaoPosCriacao = React.useCallback(
    (chave: string, acao: (id: string) => Promise<void>) => {
      acoesPosCriacaoRef.current.set(chave, acao);
    },
    [],
  );

  const [formData, setFormData] = useState<any>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para tipos de equipamentos da API
  const [tiposEquipamentos, setTiposEquipamentos] = useState<TipoEquipamentoModal[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(false);

  // Estados para seleção hierárquica Categoria -> Modelo
  const [categoriaIdSelecionada, setCategoriaIdSelecionada] = useState<string>('');
  const [modeloSelecionado, setModeloSelecionado] = useState<TipoEquipamento | null>(null);

  // Hooks para categorias e modelos (from context)
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

  // Carregar tipos de equipamentos via context hook
  useEffect(() => {
    const loadTiposEquipamentos = async () => {
      setLoadingTipos(true);
      try {
        const tipos = await fetchTiposEquipamentos();
        const tiposFormatados = tipos.map((tipo: any) => ({
          value: tipo.codigo,
          label: tipo.nome,
          categoria: tipo.categoria,
          camposTecnicos: (tipo.propriedadesSchema?.campos || tipo.propriedades_schema?.campos || []).map((campo: any) => ({
            campo: campo.campo || campo.nome,
            tipo: campo.tipo === 'boolean' ? ('select' as const) : campo.tipo,
            unidade: campo.unidade,
            opcoes: campo.opcoes || (campo.tipo === 'boolean' ? ['Sim', 'Não'] : undefined),
            obrigatorio: campo.obrigatorio,
          })),
        }));
        setTiposEquipamentos(tiposFormatados);
      } catch (err) {
        console.error('[MODAL UAR] Erro ao carregar tipos de equipamentos:', err);
        avisar('Erro ao carregar tipos de equipamentos');
      } finally {
        setLoadingTipos(false);
      }
    };

    if (isOpen) {
      loadTiposEquipamentos();
    }
  }, [isOpen, fetchTiposEquipamentos]);

  useEffect(() => {
    const initializeFormData = async () => {
      // Duplicar reaproveita o caminho da edicao: e a mesma leitura completa
      // do componente, so que sem o que identifica um exemplar — nome, TAG e
      // numero de serie saem em branco para serem preenchidos.
      const molde = entity && mode !== 'create' ? entity : duplicarDe;
      const duplicando = !entity && Boolean(duplicarDe);

      if (molde) {
        const entity = molde;

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

        /**
         * O CODIGO do tipo, e nao o id.
         *
         * `tipoEquipamento` guarda o ID — o transform o monta a partir de
         * `tipo_equipamento_rel.id`. Manda-lo para /codigo/:codigo dava 404 em
         * toda abertura de UAR: "Tipo de equipamento com codigo
         * '01JAQTE1CHAVEFUSIVEL00015' nao encontrado", quando o codigo real
         * daquele registro e CHAVE_FUSIVEL.
         *
         * `tipoEquipamentoObj.codigo` vem do mesmo transform, ja com o valor
         * certo. So se ele faltar e que sobra tentar o campo antigo, que nas
         * linhas anteriores ao relacionamento guardava mesmo um codigo.
         */
        const tipoDaEntidade = (entity as any).tipoEquipamentoObj;
        const codigoTipo = tipoDaEntidade?.codigo || entity.tipo || '';

        // O tipo ja vem junto do equipamento; consultar de novo so faz sentido
        // se ele nao veio. Era esse ida-e-volta que deixava categoria e modelo
        // em branco toda vez que falhava — e ele falhava calado.
        let tipoCompleto: TipoEquipamento | null = normalizarTipoEquipamento(tipoDaEntidade);
        if (!tipoCompleto && codigoTipo) {
          try {
            const resp = await httpClient.get(`/tipos-equipamentos/codigo/${codigoTipo}`);
            tipoCompleto = resp.data?.data || resp.data || null;
          } catch {
            // Sem o tipo, categoria e modelo ficam vazios e o usuario precisa
            // escolher de novo. Avisar e melhor do que a tela mentir que o
            // componente nao tem modelo.
            avisar('Nao foi possivel carregar o modelo deste componente. Selecione novamente antes de salvar.');
          }
        }
        if (tipoCompleto) {
          setCategoriaIdSelecionada(tipoCompleto.categoriaId?.trim() || '');
          setModeloSelecionado(tipoCompleto);
        }

        // Mapear campos para o formData
        setFormData({
          ...entity,
          ...dadosTecnicosObj, // Espalhar dados técnicos como campos individuais
          tipoComponente: codigoTipo?.trim(),
          tipoEquipamentoId: tipoCompleto?.id?.trim() || '',
          fabricante: tipoCompleto?.fabricante || entity.fabricante || '',
          fabricanteCustom: entity.fabricante_custom || '',
          dataInstalacao: dataInstalacaoFormatted,
          // O que identifica um exemplar nao se copia: sai em branco para ser
          // preenchido, e a TAG o backend gera se ficar assim.
          ...(duplicando
            ? { id: undefined, nome: '', tag: '', numeroSerie: '', fotoUrl: undefined }
            : {}),
          equipamentoPaiId: equipamentoPai?.id ?? entity.equipamentoPaiId,
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
  }, [entity, mode, equipamentoPai, duplicarDe]);

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  /**
   * Troca de categoria.
   *
   * A categoria SUGERE o nome, mas nunca sobrescreve o que foi digitado.
   *
   * Antes ela gravava o nome da categoria por cima, sem condicao: quem
   * escrevia "Disjuntor da bomba 3" e depois escolhia a categoria via o nome
   * virar "Disjuntor". O texto sumia sem aviso, e o componente nascia com o
   * nome errado.
   *
   * A sugestao vale enquanto o campo estiver vazio ou ainda contiver a
   * sugestao anterior — ou seja, enquanto ninguem tiver escrito nada proprio.
   */
  const handleCategoriaChange = (categoriaId: string) => {
    const trimmedId = categoriaId?.trim() || '';
    const anterior = categorias.find(cat => cat.id?.trim() === categoriaIdSelecionada);

    setCategoriaIdSelecionada(trimmedId);
    setModeloSelecionado(null);

    const escolhida = categorias.find(cat => cat.id?.trim() === trimmedId);
    const sugestao = escolhida?.nome || '';

    setFormData((prev: any) => {
      const atual = (prev.nome || '').trim();
      const intocado = !atual || atual === (anterior?.nome || '').trim();

      return {
        ...prev,
        nome: intocado ? sugestao : prev.nome,
        tipoComponente: '',
        tipoEquipamentoId: '',
        fabricante: '',
        fabricanteCustom: ''
      };
    });
  };

  /**
   * Os campos tecnicos a exibir: a CATEGORIA define o padrao, o tipo prevalece.
   *
   * A secao dependia so do tipo escolhido, e a maioria das categorias nao tem
   * tipo com `propriedades_schema` — o formulario mostrava "nenhum campo tecnico
   * definido" e quem cadastrava nao tinha como saber o que preencher.
   *
   * Quando o tipo traz schema proprio ele ganha, por ser mais especifico que a
   * categoria; sem isso, vale o padrao da categoria.
   */
  const camposTecnicosVisiveis = (): CampoTecnicoSchema[] => {
    const tipoEqp = getTipoEquipamento(formData.tipoComponente);
    if (tipoEqp?.camposTecnicos?.length) return tipoEqp.camposTecnicos;

    const categoria = categorias.find(c => c.id?.trim() === categoriaIdSelecionada);
    return camposDaCategoria(categoria?.nome).map(c => ({
      campo: c.campo,
      tipo: c.tipo,
      unidade: c.unidade,
      opcoes: c.opcoes,
      obrigatorio: false,
    }));
  };

  /** Titulo da secao: o modelo quando houver, senao a categoria. */
  const rotuloDosCampos = (): string => {
    const tipoEqp = getTipoEquipamento(formData.tipoComponente);
    if (tipoEqp?.camposTecnicos?.length) return tipoEqp.label;
    return categorias.find(c => c.id?.trim() === categoriaIdSelecionada)?.nome || "";
  };

  // ✅ NOVO: Handler para mudança de modelo (auto-fill fabricante)
  const handleModeloChange = (modeloId: string) => {
    const trimmedId = modeloId?.trim();
    const modelo = modelos.find(m => m.id?.trim() === trimmedId);
    if (modelo) {
      setModeloSelecionado(modelo);
      setFormData((prev: any) => ({
        ...prev,
        tipoComponente: modelo.codigo?.trim(),
        tipoEquipamentoId: modelo.id?.trim(),
        fabricante: modelo.fabricante // ✅ Auto-preenchido do modelo
      }));
    }
  };

  // ✅ NOVO: Handler para criar nova categoria
  const handleCriarCategoria = async () => {
    if (!novaCategoriaNome.trim()) {
      avisar('Nome da categoria é obrigatório');
      return;
    }

    try {
      setLoadingNovaCategoria(true);
      setError(null);

      const resp = await httpClient.post('/categorias-equipamentos', { nome: novaCategoriaNome.trim() });
      const novaCategoria = resp.data?.data || resp.data;

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

      }
    } catch (err: any) {
      console.error('❌ [MODAL UAR] Erro ao criar categoria:', err);
      avisar(err.response?.data?.message || 'Erro ao criar nova categoria');
    } finally {
      setLoadingNovaCategoria(false);
    }
  };

  // ✅ NOVO: Handler para criar novo modelo
  const handleCriarModelo = async () => {
    if (!novoModeloNome.trim()) {
      avisar('Nome do modelo é obrigatório');
      return;
    }

    if (!novoModeloCodigo.trim()) {
      avisar('Código do modelo é obrigatório');
      return;
    }

    if (!novoModeloFabricante.trim()) {
      avisar('Fabricante é obrigatório');
      return;
    }

    if (!categoriaIdSelecionada) {
      avisar('Selecione uma categoria primeiro');
      return;
    }

    try {
      setLoadingNovoModelo(true);
      setError(null);

      const respModelo = await httpClient.post('/tipos-equipamentos', {
        codigo: novoModeloCodigo.trim(),
        nome: novoModeloNome.trim(),
        fabricante: novoModeloFabricante.trim(),
        categoriaId: categoriaIdSelecionada,
      });
      const novoModelo = respModelo.data?.data || respModelo.data;

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

      }
    } catch (err: any) {
      console.error('❌ [MODAL UAR] Erro ao criar modelo:', err);
      avisar(err.response?.data?.message || 'Erro ao criar novo modelo');
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

    const campos = camposTecnicosVisiveis();
    if (!campos.length) {
      return (
        <div className="p-4 rounded-lg border border-dashed border-border/40 text-center text-muted-foreground/70 text-sm">
          Nenhum campo técnico definido para esta categoria
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {rotuloDosCampos()}
        </h4>
        <div className="grid-equal-cols-2 gap-x-2 gap-y-4">
          {campos.map((campo) => (
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

    // Validar campos técnicos obrigatórios — os exibidos, pela mesma razao da
    // coleta no submit.
    {
      camposTecnicosVisiveis().forEach(campo => {
        if (campo.obrigatorio && !formData[campo.campo]) {
          errors.push(`${campo.campo} é obrigatório`);
        }
      });
    }

    if (errors.length > 0) {
      // Um toast so, com a lista na descricao. Varios toasts empilhados para o
      // mesmo "Salvar" viram parede e o ultimo cobre os primeiros.
      avisar(
        errors.length === 1 ? errors[0] : 'Preencha os campos obrigatórios',
        errors.length === 1 ? undefined : errors.join(' · '),
      );
      return false;
    }

    setError(null);
    return true;
  };

  /**
   * O lote so existe com um pai JA gravado.
   *
   * Dentro do sheet de um UC novo os componentes sao montados com id
   * temporario (`temp_`) e gravados junto com o UC no fim. Criar N direto pela
   * API ali passaria por fora dessa montagem e os componentes nasceriam orfaos
   * de um pai que ainda nao existe.
   */
  const paiId = String(equipamentoPai?.id ?? '').trim();
  const paiGravado = Boolean(paiId) && !paiId.startsWith('temp_');
  const podeLote = mode === 'create' && paiGravado;
  const modoLote = podeLote && quantidade > 1;

  /**
   * Ajusta a lista junto com a quantidade, preservando o que ja foi digitado.
   * Feito aqui e nao num efeito para a grade nunca renderizar com um numero de
   * linhas diferente do que o campo mostra.
   */
  /**
   * Ajusta a lista junto com a quantidade, sem perder o que ja foi digitado —
   * nem na grade, nem no formulario.
   *
   * Nome, TAG, numero de serie e localizacao especifica somem do formulario no
   * lote, porque ali variam por exemplar e vivem na aba de itens. So que quem
   * cadastra costuma preencher o nome PRIMEIRO e so entao perceber que precisa
   * de tres: sem carregar esse valor para a primeira linha, o que a pessoa
   * acabou de escrever sumia da tela e tinha que ser digitado de novo.
   *
   * Na volta vale o inverso: caindo para um, a primeira linha sobe para o
   * formulario, que e onde os campos reaparecem.
   */
  const mudarQuantidade = (valor: number) => {
    const alvo = Math.max(1, Math.min(50, Math.floor(valor) || 1));
    if (alvo === quantidade) return;

    if (alvo <= 1) {
      const primeiro = itensDoLote[0];
      if (primeiro) {
        setFormData((prev: any) => ({
          ...prev,
          nome: primeiro.nome || prev.nome,
          tag: primeiro.tag || prev.tag,
          numeroSerie: primeiro.numero_serie || prev.numeroSerie,
          localizacaoEspecifica: primeiro.localizacao_especifica || prev.localizacaoEspecifica,
        }));
      }
      setItensDoLote([]);
      setQuantidade(1);
      return;
    }

    const partida: EquipamentoDoLote[] =
      quantidade <= 1
        ? [
            {
              nome: formData.nome || '',
              tag: formData.tag || '',
              numero_serie: formData.numeroSerie || '',
              localizacao_especifica: formData.localizacaoEspecifica || '',
            },
          ]
        : itensDoLote;

    const lista = partida.slice(0, alvo);
    while (lista.length < alvo) lista.push({ nome: '' });

    setItensDoLote(lista);
    setQuantidade(alvo);
  };

  /** "Celula 12" -> "Celula", para a numeracao continuar de onde parou. */
  const baseSemNumero = (texto?: string | null) => {
    const bruto = (texto || '').trim();
    if (!bruto) return undefined;
    return bruto.replace(/[\s-]*\d+$/, '').trim() || undefined;
  };

  /**
   * Em create a foto espera o id; em edit sobe na hora.
   *
   * Sao dois momentos diferentes com a mesma aparencia na tela, e e por isso
   * que o FotoEquipamentoField nao sabe fazer upload: quem decide e aqui.
   */
  const escolherFoto = async (arquivo: File | null) => {
    if (!arquivo) return;

    if (mode === 'create') {
      setFotoPendente(arquivo);
      setPreviewFoto(URL.createObjectURL(arquivo));
      return;
    }

    if (!entity?.id) return;
    try {
      const { fotoUrl } = await uploadFoto(entity.id.trim(), arquivo);
      setFormData((prev: any) => ({ ...prev, fotoUrl }));
    } catch {
      avisar('Nao foi possivel enviar a foto.');
    }
  };

  const removerFoto = () => {
    if (mode === 'create') {
      if (previewFoto) URL.revokeObjectURL(previewFoto);
      setFotoPendente(null);
      setPreviewFoto(null);
      return;
    }
    setFormData((prev: any) => ({ ...prev, fotoUrl: null }));
  };

  /**
   * Cria os N componentes e resolve o que depende de ter um id.
   *
   * A foto sobe uma vez, para o primeiro, e a URL e aplicada aos demais — o
   * arquivo e o mesmo modelo, nao faz sentido subir N vezes. Falha aqui nao
   * desfaz nada: os componentes ja existem, e o que faltou e dito com todas as
   * letras.
   */
  const submeterLote = async (dadosComuns: any) => {
    const { total, equipamentos } = await createEquipamentosLote(dadosComuns, itensDoLote);

    const ids = (equipamentos || []).map((e: any) => e?.id?.trim()).filter(Boolean);

    if (ids.length === 0) {
      await aoCriarEmLote?.(total);
      onClose();
      return;
    }

    const [primeiro, ...demais] = ids;
    const pendencias: string[] = [];

    if (fotoPendente) {
      try {
        const { fotoUrl } = await uploadFoto(primeiro, fotoPendente);
        for (const id of demais) await updateEquipamento(id, { foto_url: fotoUrl });
      } catch {
        pendencias.push('a foto');
      }
    }

    for (const [chave, acao] of acoesPosCriacaoRef.current) {
      try {
        await acao(primeiro);
      } catch {
        pendencias.push(chave);
      }
    }

    // Numa duplicacao os documentos vem do componente de origem, e nao do
    // primeiro criado — que pode nem ter anexo nenhum.
    const origemDosAnexos = duplicarDe?.id?.trim() || primeiro;
    const destinos = duplicarDe?.id ? ids : demais;

    if (destinos.length > 0) {
      try {
        await replicarAnexos(origemDosAnexos, destinos);
      } catch {
        pendencias.push('a copia dos anexos para os demais');
      }
    }

    await aoCriarEmLote?.(total);

    if (pendencias.length > 0) {
      setError(
        `${total} componentes criados, mas nao foi possivel salvar: ${pendencias.join(', ')}. ` +
          'Abra os componentes e complete o que faltou.',
      );
      return;
    }

    onClose();
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // O id do tipo escolhido ja esta em maos: `modeloSelecionado` e o proprio
      // registro vindo do combobox, e `tipoEquipamentoId` e gravado junto.
      //
      // Antes isto era descartado e o id era buscado de novo pelo codigo, com o
      // erro engolido por um `catch` vazio. Quando a busca falhava,
      // `tipo_equipamento_id` saia `undefined`: a tela salvava sem reclamar e o
      // modelo voltava vazio no reload. Nenhum erro em lugar nenhum.
      let tipoEqpId: string | undefined =
        modeloSelecionado?.id?.trim() || formData.tipoEquipamentoId?.trim() || undefined;

      if (!tipoEqpId && formData.tipoComponente) {
        const respTipo = await httpClient.get(`/tipos-equipamentos/codigo/${formData.tipoComponente}`);
        tipoEqpId = (respTipo.data?.data || respTipo.data)?.id?.trim();
      }

      // Modelo escolhido que nao virou id e perda de dado: parar aqui e mais
      // honesto do que gravar o componente sem ele.
      if (formData.tipoComponente && !tipoEqpId) {
        throw new Error('Nao foi possivel identificar o modelo selecionado. Selecione o modelo novamente.');
      }

      // Coletar dados técnicos do formData.
      //
      // Pelos campos EXIBIDOS, nao pelos do tipo. Quando os campos vem da
      // categoria — o caso da maioria — ler do tipo devolvia lista vazia: a
      // pessoa preenchia a secao inteira e nada era gravado, sem erro nenhum.
      const dadosTecnicos = camposTecnicosVisiveis()
        .filter(campo => formData[campo.campo]) // Apenas campos preenchidos
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
        tag: formData.tag || undefined,
        classificacao: 'UAR',
        equipamento_pai_id: formData.equipamentoPaiId,
        unidade_id: formData.unidadeId, // Herdado do equipamento pai
        fabricante: formData.fabricante,
        fabricante_custom: formData.fabricanteCustom || undefined, // ✅ NOVO: Fabricante customizado se divergir do modelo
        modelo: formData.modelo,
        numero_serie: formData.numeroSerie,
        criticidade: formData.criticidade,
        tipo_equipamento: formData.tipoComponente,  // Código (compatibilidade)
        tipo_equipamento_id: tipoEqpId,  // ID do tipo (correto)
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


      // O lote nao passa por onSubmit: ele cria os N de uma vez, por endpoint
      // proprio, e depois resolve foto e anexos com os ids que nasceram.
      if (modoLote) {
        const { nome, tag, numero_serie, localizacao_especifica, ...comuns } = submitData;
        void nome;
        void tag;
        void numero_serie;
        void localizacao_especifica;
        await submeterLote(comuns);
        return;
      }

      const criado = await onSubmit(submitData);

      // Foto escolhida antes de o componente existir: sobe agora que ha id.
      const idCriado = (criado as any)?.id?.trim?.();
      if (mode === 'create' && idCriado) {
        if (fotoPendente) {
          try {
            await uploadFoto(idCriado, fotoPendente);
          } catch {
            avisar('Componente criado, mas a foto nao pode ser enviada.');
          }
        }
        for (const acao of acoesPosCriacaoRef.current.values()) {
          try {
            await acao(idCriado);
          } catch {
            /* o componente existe; o acessorio pode ser refeito na edicao */
          }
        }
      }
    } catch (err) {
      console.error('❌ [MODAL UAR] Erro ao salvar:', err);
      avisar('Erro ao salvar componente UAR. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };


  /**
   * Aviso de validacao vai por toast, nao por faixa no topo do sheet.
   *
   * A faixa aparecia no comeco de um formulario longo: quem apertava "Criar"
   * com o rodape na tela nao via nada acontecer, porque o aviso nascia fora do
   * campo de visao. O toast aparece onde o olho ja esta.
   *
   * A faixa continua existindo para UM caso, e de proposito: o resultado do
   * cadastro em lote, que lista o que ficou pendente e precisa permanecer na
   * tela ate ser lido — um toast sumiria antes.
   */
  const avisar = (mensagem: string, detalhe?: string) => {
    toast.error(mensagem, detalhe ? { description: detalhe } : undefined);
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

          <Tabs value={abaAtiva} onValueChange={(v) => setAbaAtiva(v as AbaUAR)}>
            {/* Retrato à esquerda, fita de abas à direita, na mesma linha —
                empilhados custavam altura demais antes de qualquer conteúdo. */}
            {/* No celular a fita de abas ganha a linha inteira: ao lado do
                retrato ela nao cabe e virava arrasto lateral. */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <FotoEquipamentoField
                fotoUrl={previewFoto || formData.fotoUrl}
                iconeSvg={entity?.tipoEquipamentoObj?.iconeSvg}
                alt={formData.nome || 'Componente'}
                somenteLeitura={isReadOnly}
                onEscolher={escolherFoto}
                onRemover={removerFoto}
              />
              {/* min-w-0 deixa a fita encolher; sem isso ela força a largura do
                  sheet e a linha estoura no celular. */}
              <TabsList className="gap-1 w-full sm:w-auto sm:ml-auto min-w-0 max-w-full overflow-x-auto scrollbar-minimal">
                <TabsTrigger value="dados">Dados técnicos</TabsTrigger>
                {modoLote && <TabsTrigger value="itens">Componentes ({quantidade})</TabsTrigger>}
                <TabsTrigger value="anexos">Anexos</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="dados" className="space-y-6">

          {/* ============================================================================ */}
          {/* DADOS BÁSICOS DO COMPONENTE UAR */}
          {/* ============================================================================ */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground pb-2 border-b">Dados do Componente</h3>
            <div className="grid-equal-cols-2 gap-x-2 gap-y-4">
              {/* Coluna 1 */}
              <div className="space-y-4">
                {!modoLote && (
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
                )}

                {/* Nome e TAG somem no lote: no lote eles variam por exemplar e
                    sao preenchidos na aba "Componentes", um por linha. Deixa-los
                    aqui daria a entender que valem para os N. */}
                {!modoLote && (
                  <div className="space-y-1.5">
                    {/* Rotulo solto, como os vizinhos deste formulario. Dentro
                        de um flex ele pegaria a altura de linha do proprio
                        text-sm (20px) em vez do strut do container (24px), e
                        ficaria 4px acima do rotulo de Nome ao lado. */}
                    <label className="text-sm font-medium">TAG</label>
                    <input
                      className="input-minimal"
                      value={formData.tag || ''}
                      onChange={(e) => handleFieldChange('tag', e.target.value)}
                      disabled={isReadOnly}
                      placeholder={mode === 'create' ? 'Em branco, o sistema gera' : 'Ex.: CEL-001'}
                    />
                  </div>
                )}

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
                        options={categorias.map(cat => ({ value: cat.id?.trim() || '', label: cat.nome }))}
                        value={(categoriaIdSelecionada || '').trim()}
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
                          value: modelo.id?.trim() || '',
                          label: `${modelo.nome} | ${modelo.fabricante}`
                        }))}
                        value={(formData.tipoEquipamentoId || '').trim()}
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

                {!modoLote && (
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
                )}
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
                {!modoLote && (
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
                )}
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

            </TabsContent>

            {modoLote && (
              <TabsContent value="itens">
                <ItensDoLoteField
                  itens={itensDoLote}
                  onChange={setItensDoLote}
                  nomeBase={baseSemNumero(formData.nome || duplicarDe?.nome)}
                  tagBase={baseSemNumero(formData.tag || duplicarDe?.tag)}
                  consultarSequencial={(params) =>
                    proximoSequencial({
                      ...params,
                      // O componente herda a unidade do pai, e é dentro dela
                      // que nome e TAG são contados.
                      unidade_id: formData.unidadeId || equipamentoPai?.unidadeId || undefined,
                    })
                  }
                />
              </TabsContent>
            )}

            <TabsContent value="anexos">
              <AnexosEquipamentoField
                equipamentoId={entity?.id ?? null}
                somenteLeitura={isReadOnly}
                registrarAcaoPosCriacao={registrarAcaoPosCriacao}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer com botões */}
        {/* A quantidade fica junto dos botoes, e nao na grade de dados: ela
            nao e um dado do componente, e sim quantos criar. */}
        {/* flex-wrap: no celular a quantidade mais os dois botoes passam de
            400px e a barra inteira saia da tela. */}
        <div className="border-t px-6 py-3 flex flex-wrap items-center justify-end gap-2 bg-muted/20">
          {podeLote && !isReadOnly && (
            <div className="flex items-center gap-2 mr-1 pr-3 border-r">
              <label className="text-sm text-muted-foreground whitespace-nowrap">Quantidade</label>
              <div className="flex items-center">
                {/* Button com variant ghost, e nao btn-minimal-outline: e o
                    mesmo stepper do sheet de UC, sem borda, e a borda so
                    apareceria de um dos lados do input, que e borderless. Alem
                    disso .btn-minimal-outline venceria o rounded-r-none pela
                    ordem de import do CSS e os cantos nao se juntariam. */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-8 rounded-r-none"
                  onClick={() => mudarQuantidade(quantidade - 1)}
                  disabled={quantidade <= 1}
                  title="Um a menos"
                  aria-label="Diminuir a quantidade"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <input
                  className="campo-passo-a-passo"
                  type="number"
                  min={1}
                  max={50}
                  value={quantidade}
                  onChange={(e) => mudarQuantidade(Number(e.target.value))}
                  aria-label="Quantidade de componentes a criar"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-8 rounded-l-none"
                  onClick={() => mudarQuantidade(quantidade + 1)}
                  disabled={quantidade >= 50}
                  title="Um a mais"
                  aria-label="Aumentar a quantidade"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

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
                  {mode !== 'create'
                    ? 'Salvar Alterações'
                    : modoLote
                      ? `Criar ${quantidade} Componentes`
                      : 'Criar Componente'}
                </>
              )}
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
