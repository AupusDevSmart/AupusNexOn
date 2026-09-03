// src/features/equipamentos/components/modals/EquipamentoUCModal.tsx - LAYOUT LIMPO
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Badge } from '@/core/components/ui/badge';
import { Button } from '@/core/components/ui/button';
import { Alert, AlertDescription } from '@/core/components/ui/alert';
import { toast } from 'sonner';
import { Separator } from '@/core/components/ui/separator';
import { normalizarTipoEquipamento } from '@/core/features/equipamentos/utils/tipo-equipamento';
import { camposDaCategoria } from '@/core/features/equipamentos/config/campos-por-categoria';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/core/components/ui/tabs';
import { Checkbox } from '@/core/components/ui/checkbox';
import { Combobox } from '@/core/components/ui/combobox';
import { Wrench, Save, X, AlertCircle, Loader2, Eye, Edit2, Plus, Minus, Trash2, Component } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";
import { Equipamento } from '../../types';

type AbaSheet = 'dados' | 'itens' | 'tarefas' | 'historico' | 'anexos';

/**
 * O que o sheet oferece a quem preenche os slots.
 *
 * Em create nao existe equipamento ainda, mas ja da para escolher categoria e
 * plano. O slot registra o que precisa acontecer assim que o id nascer, e o
 * sheet executa antes de fechar — e assim o cadastro sai completo de uma vez,
 * em vez de exigir salvar e reabrir.
 */
export interface ContextoSlot {
  /** Categoria escolhida no formulario; e ela que define quais planos servem. */
  categoriaId: string;
  registrarAcaoPosCriacao: (chave: string, acao: (equipamentoId: string) => Promise<void>) => void;
}
import { ComponenteUARModal } from './ComponenteUARModal';
import { FotoEquipamentoField } from '../FotoEquipamentoField';
import { AnexosEquipamentoField } from '../AnexosEquipamentoField';
import { ItensDoLoteField } from '../ItensDoLoteField';
import type { EquipamentoDoLote } from '@/core/types/contracts';
import { PontosSection, type PontoFormItem } from '../PontosSection';
import { useSelectionData, useEquipamentos, useLocationCascade, useCategorias, useModelos, useHttpClient } from '@/core/context/hooks';

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

// Local type aliases (previously from service imports)
type Unidade = any;
type PlantaResponse = any;
type ProprietarioBasico = any;

interface EquipamentoUCModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'view';
  entity?: Equipamento | null;
  onClose: () => void;
  /**
   * Deve devolver o equipamento criado no modo create — o id novo e o que
   * permite terminar o cadastro (foto, anexos, plano) sem uma segunda visita
   * ao sheet.
   */
  onSubmit: (data: any) => any;
  onDelete?: (equipamento: Equipamento) => void;
  onSaveUARs?: (ucId: string, uars: Equipamento[]) => Promise<void>;
  /**
   * Secao extra injetada pelo consumidor, renderizada antes dos componentes UAR.
   *
   * Existe porque o AupusService precisa de uma secao de plano de manutencao
   * aqui, e planos so existem naquele produto: referenciar o modulo direto faria
   * o AupusNexOn chamar um endpoint que a API dele nao tem. O consumidor que
   * conhece o dominio passa o componente; quem nao conhece nao passa nada.
   */
  renderSecaoExtra?: (
    equipamento: Equipamento | null,
    mode: 'create' | 'edit' | 'view',
    contexto: ContextoSlot,
  ) => React.ReactNode;
  /**
   * Campo extra DENTRO da grade de Dados Básicos, para o consumidor encaixar
   * algo que é dado básico do equipamento — hoje, a escolha do plano de
   * manutenção. Ocupa a linha inteira; a lista de tarefas do plano vai em
   * `renderSecaoExtra`, como seção própria.
   */
  renderCampoDadosBasicos?: (
    equipamento: Equipamento | null,
    mode: 'create' | 'edit' | 'view',
    contexto: ContextoSlot,
  ) => React.ReactNode;
  /** Conteúdo da aba Histórico. Sem este slot a aba não é oferecida. */
  /**
   * MQTT e Automacao sao do supervisorio, nao do cadastro: quem opera no
   * AupusService nao configura topico nem ponto de comando. O consumidor liga
   * quando faz sentido — mesmo padrao dos slots de aba.
   */
  mostrarSupervisorio?: boolean;
  renderHistorico?: (
    equipamento: Equipamento,
    mode: 'create' | 'edit' | 'view',
  ) => React.ReactNode;
  /**
   * Equipamento de origem quando o cadastro é uma duplicação. O formulário
   * nasce igual a ele, sem nome, TAG e número de série, e os anexos são
   * copiados depois de salvar. O plano de manutenção fica de fora: ele é
   * vinculado por equipamento.
   */
  duplicarDe?: Equipamento | null;
  /**
   * Chamado depois de um cadastro em lote. O lote não passa por `onSubmit` —
   * fala direto com o endpoint próprio —, então a página precisa deste aviso
   * para recarregar a lista.
   */
  aoCriarEmLote?: (total: number) => void | Promise<void>;
}

export const EquipamentoUCModal: React.FC<EquipamentoUCModalProps> = ({
  duplicarDe,
  aoCriarEmLote,
  isOpen,
  mode,
  entity,
  onClose,
  onSubmit,
  onDelete,
  onSaveUARs,
  renderSecaoExtra,
  renderCampoDadosBasicos,
  renderHistorico,
  mostrarSupervisorio = false
}) => {
  const httpClient = useHttpClient();
  const { fetchTiposEquipamentos } = useSelectionData();
  const duplicandoDeId = duplicarDe?.id?.trim() || null;

  const {
    getEquipamento,
    fetchComponentesParaGerenciar,
    createEquipamento,
    updateEquipamento,
    uploadFoto,
    removeFoto,
    createEquipamentosLote,
    replicarAnexos,
    proximoSequencial,
  } = useEquipamentos();

  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Abas do sheet.
  //
  // Em create as abas continuam ali: dá para escolher plano e anexar arquivos
  // antes de o equipamento existir, e o que depende do id sai assim que ele
  // nasce. A exceção é o Histórico — equipamento recém-criado não tem passado,
  // e uma aba que só sabe dizer "nada aqui" é ruído.
  /**
   * Cadastro em lote. Uma unidade costuma receber dezenas do mesmo modelo de
   * uma vez, e o que muda entre eles é pouco — nome, TAG, número de série e
   * onde exatamente está.
   */
  const [quantidade, setQuantidade] = useState(1);
  const [itensDoLote, setItensDoLote] = useState<EquipamentoDoLote[]>([]);
  const modoLote = mode === 'create' && quantidade > 1;

  /**
   * Ajusta a lista junto com a quantidade, preservando o que já foi digitado.
   * Feito aqui e não num efeito para a grade nunca renderizar com um número de
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

  const temAbaTarefas = Boolean(renderSecaoExtra);
  const temAbaHistorico = Boolean(renderHistorico && entity && mode !== 'create');
  // Anexos e nativo: o backend vive no api-shared e os dois produtos falam com
  // ele, entao nao ha o que particularizar por app.
  const temAbaAnexos = true;
  const usarAbas = temAbaTarefas || temAbaHistorico || temAbaAnexos || modoLote;
  const [abaAtiva, setAbaAtiva] = useState<AbaSheet>('dados');

  /**
   * Foto escolhida antes de o equipamento existir. Fica em memoria com um
   * preview local e sobe assim que o id nasce — o upload precisa do id, mas
   * quem cadastra ja tem a foto na mao e nao deveria ter que voltar depois.
   */
  const [fotoPendente, setFotoPendente] = useState<File | null>(null);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);

  /**
   * O que os slots pediram para acontecer assim que o equipamento nascer.
   * Ref e nao estado: e lido uma vez no submit e nao deve provocar render.
   */
  const acoesPosCriacaoRef = useRef<Map<string, (equipamentoId: string) => Promise<void>>>(new Map());

  /**
   * A identidade muda junto com o modo, de propósito: quem continua montado se
   * registra de novo, e quem saiu de cena não. É assim que o plano escolhido
   * com quantidade 1 deixa de estar registrado quando o campo some no lote.
   */
  const registrarAcaoPosCriacao = useCallback(
    (chave: string, acao: (equipamentoId: string) => Promise<void>) => {
      acoesPosCriacaoRef.current.set(chave, acao);
    },
    [modoLote],
  );

  // Limpa durante o render, e não num efeito: os efeitos dos filhos rodam antes
  // do efeito do pai, então limpar depois apagaria o registro que eles acabaram
  // de refazer.
  const modoLoteAnteriorRef = useRef(modoLote);
  if (modoLoteAnteriorRef.current !== modoLote) {
    modoLoteAnteriorRef.current = modoLote;
    acoesPosCriacaoRef.current.clear();
  }

  // Sempre abrir em Dados técnicos: é onde estão os campos obrigatórios, e
  // abrir noutra aba esconderia o que o usuário veio editar.
  useEffect(() => {
    setAbaAtiva('dados');
    setQuantidade(1);
    setItensDoLote([]);
  }, [isOpen, entity?.id]);

  const [dadosTecnicos, setDadosTecnicos] = useState<any[]>([]);
  const [dadosTecnicosPersonalizados, setDadosTecnicosPersonalizados] = useState<any[]>([]);
  /** Pontos de automacao (PR3) — gerenciado localmente, persistido junto com equipamento. */
  const [pontos, setPontos] = useState<PontoFormItem[]>([]);

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

  // Estados para componentes UAR
  const [uarsLista, setUarsLista] = useState<Equipamento[]>([]);
  const [loadingUARs, setLoadingUARs] = useState(false);
  const [modalUARDetalhes, setModalUARDetalhes] = useState({
    isOpen: false,
    mode: 'view' as 'create' | 'edit' | 'view',
    entity: null as Equipamento | null
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

  /**
   * O texto sem o número do fim: "Inversor 03" vira "Inversor".
   *
   * Duplicar sugere o padrão a partir do equipamento copiado, mas o número dele
   * não serve de ponto de partida — quem copia o primeiro de três espera o
   * quarto, não o segundo. Quem diz de onde continuar é o banco.
   */
  const baseSemNumero = (texto?: string | null) => {
    const bruto = (texto || '').trim();
    if (!bruto) return undefined;
    return bruto.replace(/[\s-]*\d+$/, '').trim() || undefined;
  };

  /**
   * Ativo por padrão. O select só mostra texto quando o valor bate exatamente
   * com uma das opções — vazio, 'ativo' minúsculo ou 'Ativo ' com espaço
   * sobrando davam um campo em branco, sem opção nenhuma marcada.
   */
  const statusAtual =
    String(formData.status || '').trim().toLowerCase() === 'inativo' ? 'Inativo' : 'Ativo';

  // ============================================================================
  // CARREGAR TIPOS DE EQUIPAMENTOS DA API
  // ============================================================================
  useEffect(() => {
    const loadTiposEquipamentos = async () => {
      setLoadingTipos(true);
      try {
        const tipos = await fetchTiposEquipamentos();

        const tiposFormatados = tipos.map((tipo: any) => {
          const campos = tipo.propriedadesSchema?.campos || tipo.propriedades_schema?.campos || [];

          return {
            value: tipo.codigo,
            label: tipo.nome,
            categoria: tipo.categoria,
            camposTecnicos: campos.map((campo: any) => ({
              campo: campo.campo || campo.nome,
              tipo: campo.tipo === 'boolean' ? ('select' as const) : campo.tipo,
              unidade: campo.unidade,
              opcoes: campo.opcoes || (campo.tipo === 'boolean' ? ['Sim', 'Nao'] : undefined),
              obrigatorio: campo.obrigatorio,
            })),
          };
        });
        setTiposEquipamentos(tiposFormatados);
      } catch (err) {
        console.error('[MODAL] Erro ao carregar tipos de equipamentos:', err);
        avisar('Erro ao carregar tipos de equipamentos');
      } finally {
        setLoadingTipos(false);
      }
    };

    if (isOpen) {
      loadTiposEquipamentos();
    }
  }, [isOpen, fetchTiposEquipamentos]);

  // Helper para buscar tipo de equipamento
  const getTipoEquipamento = (codigo: string): TipoEquipamentoModal | undefined => {
    return tiposEquipamentos.find(t => t.value === codigo);
  };

  // ============================================================================
  // INICIALIZAÇÃO
  // ============================================================================
  /**
   * O que já foi inicializado nesta abertura do sheet.
   *
   * Sem isso o efeito abaixo roda mais de uma vez por abertura: `tiposEquipamentos`
   * está nas dependências e troca de identidade quando a lista termina de
   * carregar. A segunda passagem chamava `initializeForCreate` de novo, que
   * termina em `locationCascade.reset()` — apagando a localização que a cascata
   * já tinha pré-selecionado. Era por isso que o proprietário aparecia vazio
   * mesmo com o filtro preenchido: ele chegava a ser selecionado e era limpo
   * meio segundo depois, quando os tipos respondiam.
   */
  const inicializadoRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      inicializadoRef.current = null;
      return;
    }

    if (entity && (mode === 'edit' || mode === 'view')) {
      // Edição depende da lista: é dela que sai o código do tipo do
      // equipamento e a lista de campos técnicos.
      if (loadingTipos || tiposEquipamentos.length === 0) return;

      const chave = `${mode}:${entity.id}`;
      if (inicializadoRef.current === chave) return;
      inicializadoRef.current = chave;

      setError(null);
      initializeWithEntity(entity);
      return;
    }

    if (mode === 'create') {
      // Duplicar reaproveita o caminho da edição: é a mesma leitura completa do
      // equipamento, só que sem o que identifica um exemplar — nome, TAG e
      // número de série saem em branco para serem preenchidos.
      if (duplicarDe?.id) {
        if (loadingTipos || tiposEquipamentos.length === 0) return;

        const chave = `duplicar:${duplicarDe.id}`;
        if (inicializadoRef.current === chave) return;
        inicializadoRef.current = chave;

        setError(null);
        initializeWithEntity(duplicarDe, true);
        return;
      }

      // Chave pelo conteúdo, não pela identidade: em create o `entity` é um
      // objeto novo montado a cada abertura, então comparar referência nunca
      // acusaria "já inicializado".
      const chave = [
        'create',
        (entity as any)?.proprietarioId ?? '',
        (entity as any)?.plantaId ?? '',
        (entity as any)?.unidadeId ?? '',
      ].join(':');
      if (inicializadoRef.current === chave) return;
      inicializadoRef.current = chave;

      // Cadastro não depende: a lista só serve aos campos técnicos, que só
      // aparecem depois de escolher o modelo. Esperar por ela significava que
      // uma falha na chamada deixava o formulário como objeto vazio — sem
      // status, sem criticidade, sem nenhum padrão.
      setError(null);
      initializeForCreate();
    }
  }, [isOpen, entity, mode, loadingTipos, tiposEquipamentos, duplicarDe?.id]);

  /**
   * Preenche a cascata de localização quando o sheet abre em modo create já
   * sabendo proprietário/planta/unidade — o caso de "Novo Equipamento" clicado
   * de dentro da lista de equipamentos filtrada por uma instalação. Sem isso,
   * quem já estava dentro da instalação tinha que escolher de novo os três
   * campos que o clique já tinha dito.
   *
   * Declarado DEPOIS do efeito acima de propósito: `initializeForCreate` roda
   * `locationCascade.reset()` no fim, e esse reset precisa acontecer antes da
   * seleção, não depois — efeitos rodam na ordem em que são declarados.
   *
   * A seleção é sequencial porque cada nível só existe depois que o anterior
   * carrega a lista dele: escolher o proprietário dispara o carregamento das
   * plantas dele, e só então dá para escolher a planta; o mesmo vale para
   * planta → unidade. `pendenteLocalizacaoRef` guarda o que ainda falta
   * selecionar enquanto a lista correspondente não chega.
   */
  const pendenteLocalizacaoRef = useRef<{ plantaId?: string; unidadeId?: string } | null>(null);

  useEffect(() => {
    if (!isOpen || mode !== 'create') return;

    const proprietarioId = (entity as any)?.proprietarioId?.trim();
    const plantaId = (entity as any)?.plantaId?.trim();
    const unidadeId = (entity as any)?.unidadeId?.trim();
    if (!proprietarioId && !plantaId && !unidadeId) return;

    let cancelado = false;

    (async () => {
      // Quem filtra a lista por uma instalação normalmente não seleciona
      // proprietário nenhum — a instalação sozinha já basta para a tela. Mas a
      // cascata do modal começa no proprietário: sem ele nada seria
      // pré-selecionado e o usuário teria que escolher de novo os três campos
      // que o filtro já dizia. Então o que falta é descoberto subindo a
      // hierarquia a partir do que se sabe.
      let proprietario = proprietarioId;
      let planta = plantaId;

      try {
        if (!planta && unidadeId) {
          const resp = await httpClient.get(`/unidades/${unidadeId}`);
          const unidade = resp.data?.data || resp.data;
          planta = unidade?.plantaId?.trim() || unidade?.planta_id?.trim();
          proprietario =
            proprietario ||
            unidade?.proprietarioId?.trim() ||
            unidade?.planta?.proprietarioId?.trim();
        }

        if (!proprietario && planta) {
          const resp = await httpClient.get(`/plantas/${planta}`);
          const dados = resp.data?.data || resp.data;
          proprietario = dados?.proprietarioId?.trim() || dados?.proprietario?.id?.trim();
        }
      } catch {
        // Falhar aqui custa só a pré-seleção — o formulário continua utilizável
        // com escolha manual. Não vale interromper a abertura do sheet.
      }

      if (cancelado || !proprietario) return;

      pendenteLocalizacaoRef.current = { plantaId: planta, unidadeId };
      locationCascade.handleProprietarioChange(proprietario);
    })();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, (entity as any)?.proprietarioId, (entity as any)?.plantaId, (entity as any)?.unidadeId]);

  useEffect(() => {
    const pendente = pendenteLocalizacaoRef.current;
    if (!pendente?.plantaId) return;

    // Comparação por id aparado: os ids são CHAR(26) e voltam da API com
    // espaços à direita em parte das rotas. Comparar cru faz a planta certa
    // "não existir" na lista e a cascata para no meio, em silêncio.
    const planta = locationCascade.plantas.find((p) => p.id?.trim() === pendente.plantaId);
    if (!planta) return;

    locationCascade.handlePlantaChange(planta.id);
    pendenteLocalizacaoRef.current = pendente.unidadeId ? { unidadeId: pendente.unidadeId } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationCascade.plantas]);

  useEffect(() => {
    const pendente = pendenteLocalizacaoRef.current;
    if (!pendente?.unidadeId) return;

    const unidade = locationCascade.unidades.find((u) => u.id?.trim() === pendente.unidadeId);
    if (!unidade) return;

    locationCascade.handleUnidadeChange(unidade.id);
    pendenteLocalizacaoRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationCascade.unidades]);

  const initializeWithEntity = async (equipamento: Equipamento, paraDuplicar = false) => {
    setLoading(true);

    try {

      // Para modo visualização/edição, buscar dados completos se possível
      let dadosCompletos = equipamento;
      if (getEquipamento && equipamento.id) {
        dadosCompletos = await getEquipamento(equipamento.id);
      } else {
      }


      // O tipo ja vem junto do equipamento. Consultar de novo so faz sentido se
      // ele nao veio — e `tipoEquipamento` aqui guarda o ID, entao manda-lo para
      // a rota /codigo/:codigo era 404 garantido, com o erro engolido.
      const tipoDaEntidade = dadosCompletos.tipoEquipamentoObj;
      let tipoCompleto: TipoEquipamento | null = normalizarTipoEquipamento(tipoDaEntidade);
      const codigoTipo = tipoDaEntidade?.codigo;
      if (!tipoCompleto && codigoTipo) {
        try {
          const respTipo = await httpClient.get(`/tipos-equipamentos/codigo/${codigoTipo}`);
          tipoCompleto = respTipo.data?.data || respTipo.data || null;
        } catch {
          avisar('Nao foi possivel carregar o modelo deste equipamento. Selecione novamente antes de salvar.');
        }
      }
      if (tipoCompleto) {
        setCategoriaIdSelecionada(tipoCompleto.categoriaId?.trim() || '');
        setModeloSelecionado(tipoCompleto);
      }

      setFormData({
        // Duplicar copia tudo menos o que identifica o exemplar: dois
        // equipamentos não dividem nome, TAG nem número de série.
        nome: paraDuplicar ? '' : dadosCompletos.nome || '',
        fabricante: dadosCompletos.fabricante || '',
        fabricanteCustom: dadosCompletos.fabricante_custom || '',
        modelo: dadosCompletos.modelo || '',
        numeroSerie: paraDuplicar ? '' : dadosCompletos.numeroSerie || '',
        tag: paraDuplicar ? '' : dadosCompletos.tag || '',
        criticidade: dadosCompletos.criticidade || '3',
        tipoEquipamento: codigoTipo?.trim() || '',
        tipoEquipamentoId: tipoCompleto?.id?.trim() || '',
        plantaId: dadosCompletos.unidade?.plantaId || '',
        unidadeId: dadosCompletos.unidadeId || dadosCompletos.unidade?.id || '',  // ✅ CORRIGIDO: pegar unidade.id se unidadeId não existir
        proprietarioId: dadosCompletos.proprietarioId || '',
        localizacao: dadosCompletos.localizacao || '',
        valorContabil: dadosCompletos.valorContabil || '',
        dataImobilizacao: dadosCompletos.dataImobilizacao || '',
        status: dadosCompletos.status || 'Ativo',
        emOperacao: dadosCompletos.emOperacao || '',
        // Campos MQTT
        mqttHabilitado: dadosCompletos.mqttHabilitado || dadosCompletos.mqtt_habilitado || false,
        topicoMqtt: dadosCompletos.topicoMqtt || dadosCompletos.topico_mqtt || '',
        // Automacao (PR3) — pontos sao gerenciados via PontosSection (chamadas REST proprias)
        automacao: dadosCompletos.automacao ?? false,
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
        a6: dadosCompletos.a6 || '',
        fotoUrl: dadosCompletos.fotoUrl || ''
      });

      // Hidratar pontos de automacao (PR3) — dadosCompletos.equipamento_pontos vem do backend findOne
      const pontosRaw =
        (dadosCompletos as any).equipamento_pontos ??
        (dadosCompletos as any).pontos ??
        [];
      setPontos(
        Array.isArray(pontosRaw)
          ? pontosRaw.map((p: any, idx: number) => ({
              id: p.id?.trim?.() ?? p.id,
              tipo: p.tipo,
              nome: p.nome ?? '',
              unidade: p.unidade ?? '',
              ordem: typeof p.ordem === 'number' ? p.ordem : idx,
              ativo: p.ativo !== false,
            }))
          : [],
      );

      // Separar dados técnicos em pré-definidos e personalizados

      if (dadosCompletos.dadosTecnicos && dadosCompletos.dadosTecnicos.length > 0) {
        const codigoTipo = dadosCompletos.tipoEquipamentoObj?.codigo || dadosCompletos.tipoEquipamento || dadosCompletos.tipo || '';
        const tipoEqp = getTipoEquipamento(codigoTipo);

        if (tipoEqp) {
          const camposPredefinidos = tipoEqp.camposTecnicos.map(campo => campo.campo);

          // Inicializar campos predefinidos com valores do banco ou vazios
          const predefinidosComValores = tipoEqp.camposTecnicos.map(campo => {
            const dadoExistente = dadosCompletos.dadosTecnicos.find(d => d.campo === campo.campo);
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


          setDadosTecnicos(predefinidosComValores);
          setDadosTecnicosPersonalizados(personalizados);
        } else {
          setDadosTecnicosPersonalizados(dadosCompletos.dadosTecnicos);
        }
      } else {
      }

      // Buscar hierarquia completa recursivamente (Unidade → Planta → Proprietário)
      if (mode === 'view' || mode === 'edit') {

        // 1. Buscar detalhes da Unidade
        if (dadosCompletos.unidadeId) {
          try {
            const respUnidade = await httpClient.get(`/unidades/${dadosCompletos.unidadeId}`);
            const unidade = respUnidade.data?.data || respUnidade.data;
            setUnidadeDetalhes(unidade);

            // 2. Buscar detalhes da Planta (via unidade.plantaId)
            if (unidade.plantaId) {
              try {
                const respPlanta = await httpClient.get(`/plantas/${unidade.plantaId}`);
                const planta = respPlanta.data?.data || respPlanta.data;
                setPlantaDetalhes(planta);

                // 3. Buscar detalhes do Proprietário (via planta.proprietario)
                if (planta.proprietario) {
                  setProprietarioDetalhes(planta.proprietario);
                }
              } catch (err) {
              }
            }
          } catch (err) {
          }
        }

        // 4. Carregar componentes UAR
        if (dadosCompletos.id) {
          try {
            setLoadingUARs(true);
            const result = await fetchComponentesParaGerenciar(dadosCompletos.id);
            setUarsLista(result.componentes || []);
          } catch (err: any) {
            setUarsLista([]);
            // Falhar calado aqui produz o pior sintoma possivel: a secao diz
            // "Componentes UAR (0)" e o equipamento parece nao ter nenhum,
            // quando na verdade a consulta nem completou. O 403 e o caso
            // comum -- a rota exige equipamentos.manage, que o operador nao
            // tem -- e sem aviso ninguem descobre isso pela tela.
            const status = err?.response?.status;
            avisar(
              status === 403
                ? 'Sem permissão para ver os componentes deste equipamento'
                : 'Não foi possível carregar os componentes',
              status === 403
                ? 'A lista exige a permissão equipamentos.manage.'
                : undefined,
            );
          } finally {
            setLoadingUARs(false);
          }
        }
      }
    } catch (error) {
      avisar('Erro ao carregar dados do equipamento');
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
      status: 'Ativo',
      emOperacao: 'sim',
      // Campos MQTT
      mqttHabilitado: false,
      topicoMqtt: '',
      // Automacao (PR3)
      automacao: false,
      // Campos MCPSE
      mcpse: false,
      tuc: '',
      a1: '',
      a2: '',
      a3: '',
      a4: '',
      a5: '',
      a6: '',
      fotoUrl: ''
    });
    setDadosTecnicos([]);
    setDadosTecnicosPersonalizados([]);
    setPontos([]);

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

  const [fotoUploading, setFotoUploading] = useState(false);

  const contextoSlot: ContextoSlot = {
    categoriaId: categoriaIdSelecionada,
    registrarAcaoPosCriacao,
  };

  const handleFotoChange = async (file: File | null) => {
    if (!file) return;
    if (!file.type.match(/^image\/(jpe?g|png|webp)$/)) {
      avisar('Formato invalido. Use JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      avisar('Arquivo maior que 2MB.');
      return;
    }

    // Em create ainda nao ha id para onde subir. Guarda o arquivo e mostra um
    // preview local; o envio sai logo depois de salvar. Quem cadastra ja esta
    // com a foto na mao e nao deveria ter que voltar ao sheet so por causa
    // dela.
    if (!entity?.id) {
      setError(null);
      setFotoPendente(file);
      setPreviewFoto((anterior) => {
        if (anterior) URL.revokeObjectURL(anterior);
        return URL.createObjectURL(file);
      });
      return;
    }

    try {
      setFotoUploading(true);
      setError(null);
      const result = await uploadFoto(entity.id.trim(), file);
      setFormData((prev: any) => ({ ...prev, fotoUrl: result.fotoUrl }));
    } catch {
      avisar('Falha ao enviar foto. Tente novamente.');
    } finally {
      setFotoUploading(false);
    }
  };

  const descartarFotoPendente = () => {
    setFotoPendente(null);
    setPreviewFoto((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior);
      return null;
    });
  };

  const handleFotoRemove = async () => {
    if (!entity?.id) return;
    try {
      setFotoUploading(true);
      setError(null);
      await removeFoto(entity.id.trim());
      setFormData((prev: any) => ({ ...prev, fotoUrl: '' }));
    } catch {
      avisar('Falha ao remover foto.');
    } finally {
      setFotoUploading(false);
    }
  };

  /**
   * Troca de categoria — reseta o modelo e SUGERE o nome.
   *
   * A sugestao nunca sobrescreve o que foi digitado: quem escreve
   * "Transformador da subestacao 2" e depois escolhe a categoria via o nome
   * virar "Transformador", sem aviso.
   *
   * Vale enquanto o campo estiver vazio ou ainda contiver a sugestao anterior —
   * isto e, enquanto ninguem tiver escrito nada proprio.
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
        tipoEquipamento: '',
        tipoEquipamentoId: '',
        fabricante: '',
        fabricanteCustom: '',
      };
    });

    // Os campos tecnicos padrao da categoria.
    //
    // Antes isto limpava a secao e pronto: os campos so viriam depois de
    // escolher um MODELO, e apenas se aquele tipo tivesse `propriedades_schema`
    // no banco. Para categoria sem tipo cadastrado — a maioria — a secao ficava
    // vazia e nao havia como saber o que preencher.
    //
    // O mapeamento por categoria nao depende de tipo nenhum existir.
    const padrao = camposDaCategoria(escolhida?.nome);
    setDadosTecnicos(
      padrao.map(c => ({
        campo: c.campo,
        rotulo: c.rotulo,
        valor: "",
        tipo: c.tipo,
        unidade: c.unidade || "",
        opcoes: c.opcoes,
        obrigatorio: false,
      })),
    );
  };

  // Handler para mudança de modelo - preenche fabricante automaticamente
  const handleModeloChange = (modeloId: string) => {

    const trimmedId = modeloId?.trim();
    const modelo = modelos.find(m => m.id?.trim() === trimmedId);

    if (modelo) {
      setModeloSelecionado(modelo);

      // Preencher tipo de equipamento e fabricante
      setFormData((prev: any) => ({
        ...prev,
        tipoEquipamento: modelo.codigo?.trim(),
        tipoEquipamentoId: modelo.id?.trim(),
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
        setDadosTecnicos(dadosIniciais);
      }
    }
  };

  const handleTipoEquipamentoChange = (value: string) => {
    handleInputChange('tipoEquipamento', value);

    // Quando muda o tipo, carregar campos técnicos pré-definidos
    const tipoEqp = getTipoEquipamento(value);

    if (tipoEqp && tipoEqp.camposTecnicos && tipoEqp.camposTecnicos.length > 0) {
      const dadosIniciais = tipoEqp.camposTecnicos.map(campo => ({
        campo: campo.campo,
        valor: '',
        tipo: campo.tipo,
        unidade: campo.unidade || '',
        obrigatorio: campo.obrigatorio || false
      }));
      setDadosTecnicos(dadosIniciais);

      // Remover campos predefinidos dos personalizados para evitar duplicação
      const camposPredefinidos = tipoEqp.camposTecnicos.map(c => c.campo);
      setDadosTecnicosPersonalizados(prev =>
        prev.filter(p => !camposPredefinidos.includes(p.campo))
      );
    } else {
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
      avisar('Nome da categoria é obrigatório');
      return;
    }

    try {
      setLoadingNovaCategoria(true);
      setError(null);

      const respCat = await httpClient.post('/categorias-equipamentos', { nome: novaCategoriaNome.trim() });
      const novaCategoria = respCat.data?.data || respCat.data;

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

      }
    } catch (err: any) {
      console.error('❌ [MODAL] Erro ao criar categoria:', err);
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
          tipoEquipamento: novoModelo.codigo,
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
      console.error('❌ [MODAL] Erro ao criar modelo:', err);
      avisar(err.response?.data?.message || 'Erro ao criar novo modelo');
    } finally {
      setLoadingNovoModelo(false);
    }
  };

  /**
   * Cria o lote e resolve o que depende de ter um id.
   *
   * A foto sobe uma vez, para o primeiro equipamento, e a URL resultante é
   * aplicada aos demais — o arquivo é o mesmo modelo, não faz sentido subir N
   * vezes. Os anexos seguem a mesma lógica, mas com endpoint próprio: os
   * registros são independentes e apontam para o mesmo arquivo.
   *
   * Falha aqui não desfaz nada: os equipamentos já existem. O erro é dito com
   * todas as letras para que a pessoa saiba o que ainda falta.
   */
  const submeterLote = async (submitData: any) => {
    const { total, equipamentos } = await createEquipamentosLote(submitData, itensDoLote);

    const ids = (equipamentos || [])
      .map((e: any) => e?.id?.trim())
      .filter(Boolean);

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
        for (const id of demais) {
          await updateEquipamento(id, { foto_url: fotoUrl });
        }
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

    // Numa duplicacao em lote os documentos vem do equipamento de origem, e
    // nao do primeiro criado — que pode nem ter anexo nenhum.
    const origemDosAnexos = duplicandoDeId || primeiro;
    const destinosDosAnexos = duplicandoDeId ? ids : demais;

    if (destinosDosAnexos.length > 0 && !pendencias.includes('os anexos')) {
      try {
        await replicarAnexos(origemDosAnexos, destinosDosAnexos);
      } catch {
        pendencias.push('a cópia dos anexos para os demais');
      }
    }

    // Avisa antes de decidir se fecha: os equipamentos existem mesmo quando
    // algo acessório falhou, e a lista precisa mostrá-los de qualquer forma.
    await aoCriarEmLote?.(total);

    if (pendencias.length > 0) {
      setError(
        `${total} equipamentos criados, mas não foi possível salvar: ${pendencias.join(', ')}. ` +
          'Abra os equipamentos e complete o que faltou.',
      );
      return;
    }

    onClose();
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Validações básicas. No lote o nome é por item, e a grade cobra cada um.
      if (!modoLote && !formData.nome?.trim()) {
        avisar('Nome é obrigatório');
        return;
      }

      if (modoLote) {
        const semNome = itensDoLote.findIndex((item) => !item.nome?.trim());
        if (semNome >= 0) {
          setAbaAtiva('itens');
          avisar(`Informe o nome do equipamento da linha ${semNome + 1}`);
          return;
        }
      }

      // No modo create, validar seleção cascateada
      if (isCreating) {
        if (!locationCascade.selectedProprietarioId) {
          avisar('Proprietário é obrigatório');
          return;
        }

        if (!locationCascade.selectedPlantaId) {
          avisar('Planta é obrigatória');
          return;
        }

        if (!locationCascade.selectedUnidadeId) {
          avisar('Unidade é obrigatória');
          return;
        }
      }

      // Validar MQTT: se habilitado, tópico é obrigatório
      if (formData.mqttHabilitado && !formData.topicoMqtt?.trim()) {
        avisar('Tópico MQTT é obrigatório quando MQTT está habilitado');
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
      

      // Converter data de imobilização para formato ISO-8601 DateTime se fornecida
      const dataImobilizacaoFormatted = formData.dataImobilizacao 
        ? new Date(formData.dataImobilizacao + 'T00:00:00.000Z').toISOString()
        : null;

      // Debug: verificar estado do locationCascade

      // O id do modelo escolhido ja esta em maos.
      //
      // Antes era descartado e reconsultado pelo codigo — so que
      // `formData.tipoEquipamento` carrega o ID quando o sheet foi aberto a
      // partir de um equipamento existente. A rota /codigo/:codigo devolvia 404,
      // o `catch` vazio abafava, e `tipo_equipamento_id` saia `undefined`. Num
      // update isso deixa a coluna intacta (parece que nao houve troca); ao
      // duplicar, o novo equipamento nascia sem tipo nenhum.
      let tipoEqpId: string | undefined =
        modeloSelecionado?.id?.trim() || formData.tipoEquipamentoId?.trim() || undefined;

      if (!tipoEqpId && formData.tipoEquipamento) {
        try {
          const respTipo = await httpClient.get(`/tipos-equipamentos/codigo/${formData.tipoEquipamento}`);
          tipoEqpId = (respTipo.data?.data || respTipo.data)?.id?.trim();
        } catch {
          tipoEqpId = undefined;
        }
      }

      if (formData.tipoEquipamento && !tipoEqpId) {
        throw new Error('Nao foi possivel identificar o modelo selecionado. Selecione o modelo novamente.');
      }

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
        tipo_equipamento_id: tipoEqpId,  // ID do tipo (correto)
        status: statusAtual,
        em_operacao: formData.emOperacao,
        data_imobilizacao: dataImobilizacaoFormatted,
        valor_contabil: formData.valorContabil ? parseFloat(formData.valorContabil) : undefined,
        localizacao: formData.localizacao,
        // Campos MQTT
        mqtt_habilitado: formData.mqttHabilitado,
        topico_mqtt: formData.topicoMqtt,
        // Automacao (PR3)
        automacao: formData.automacao ?? false,
        // Pontos sao enviados junto na mesma transacao do backend.
        // Sync seletivo: id existente -> UPDATE; sem id -> CREATE; ausente do payload -> soft delete.
        pontos: formData.automacao
          ? pontos.map((p, idx) => ({
              ...(p.id ? { id: p.id } : {}),
              tipo: p.tipo,
              nome: p.nome.trim(),
              unidade: p.tipo === 'medicao' ? (p.unidade?.trim() || undefined) : undefined,
              ordem: typeof p.ordem === 'number' ? p.ordem : idx,
              ativo: p.ativo,
            }))
          : [],
        // Campos MCPSE
        mcpse: formData.mcpseAtivo,
        tuc: formData.tuc,
        a1: formData.a1,
        a2: formData.a2,
        a3: formData.a3,
        a4: formData.a4,
        a5: formData.a5,
        a6: formData.a6,
        // Foto (atualizada via endpoint separado de upload, mas incluida aqui pra garantir consistencia na resposta do update)
        foto_url: formData.fotoUrl || undefined,
        // Dados técnicos
        dados_tecnicos: todosDadosTecnicos.map(dt => ({
          campo: dt.campo,
          valor: dt.valor,
          tipo: dt.tipo || 'string',
          unidade: dt.unidade
        }))
      };

      // Lote tem caminho próprio: o backend cria os N numa transação só, e o
      // que depende do id — foto e anexos — é resolvido depois, uma vez, e
      // replicado. O plano fica de fora por decisão de produto.
      if (modoLote) {
        await submeterLote(submitData);
        return;
      }

      const criado = await onSubmit(submitData);

      // Cadastro em uma visita so: com o id em maos, sobe a foto escolhida
      // antes de existir equipamento e executa o que os slots registraram
      // (vincular plano, enviar anexos). Falha aqui nao invalida o
      // equipamento, que ja foi criado — por isso o erro e avisado sem
      // desfazer nada.
      const novoId = mode === 'create' ? (criado as any)?.id?.trim() : null;
      if (novoId) {
        const pendencias: string[] = [];

        if (fotoPendente) {
          try {
            await uploadFoto(novoId, fotoPendente);
          } catch {
            pendencias.push('a foto');
          }
        }

        for (const [chave, acao] of acoesPosCriacaoRef.current) {
          try {
            await acao(novoId);
          } catch {
            pendencias.push(chave);
          }
        }

        // Duplicar leva junto os documentos: manual e datasheet sao os mesmos
        // entre equipamentos iguais, e refaze-los a mao seria o trabalho que a
        // duplicacao existe para evitar.
        if (duplicandoDeId) {
          try {
            await replicarAnexos(duplicandoDeId, [novoId]);
          } catch {
            pendencias.push(`os anexos copiados de ${duplicarDe?.nome || "origem"}`);
          }
        }

        if (pendencias.length > 0) {
          setError(
            `Equipamento criado, mas não foi possível salvar: ${pendencias.join(', ')}. ` +
              'Abra o equipamento e tente de novo.',
          );
          return;
        }
      }

      onClose();
    } catch (error) {
      // Volta para Dados técnicos: o erro e os campos que o causaram estão lá,
      // e salvar de outra aba mostraria um alerta sobre algo fora da vista.
      setAbaAtiva('dados');
      avisar('Erro ao salvar equipamento');
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
      create: 'Novo Equipamento',
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
  const renderFoto = () => (
    <FotoEquipamentoField
      fotoUrl={previewFoto || formData.fotoUrl}
      iconeSvg={formData.tipoEquipamentoObj?.iconeSvg || entity?.tipoEquipamentoObj?.iconeSvg}
      alt={formData.nome || 'Equipamento'}
      somenteLeitura={isReadonly}
      enviando={fotoUploading}
      onEscolher={(arquivo) => handleFotoChange(arquivo)}
      onRemover={mode === 'create' ? descartarFotoPendente : handleFotoRemove}
    />
  );

  const renderDadosBasicos = () => (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground pb-2 border-b">
        Dados Básicos
      </h3>
      
      <div className="grid-equal-cols-2 gap-x-2 gap-y-4">
        {/* Nome — no lote ele é por item e vive na aba Equipamentos. */}
        {!modoLote && (
        <div className="space-y-2">
          <div className="linha-rotulo">
            <label className="text-sm font-medium">
              Nome do Equipamento <span className="text-red-500">*</span>
            </label>
          </div>
          <input
            className="input-minimal"
            value={formData.nome || ''}
            onChange={(e) => handleInputChange('nome', e.target.value)}
            placeholder="Ex: Sistema de Controle Principal"
            disabled={isReadonly}
          />
        </div>
        )}

        {/* TAG — ao lado do Nome: as duas são como o equipamento é chamado, uma
            por extenso e outra em código. Estava lá embaixo, entre número de
            série e criticidade, longe de quem procura por ela. */}
        {!modoLote && (
        <div className="space-y-2">
          <div className="linha-rotulo">
            <label className="text-sm font-medium">TAG</label>
          </div>
          <input
            className="input-minimal"
            value={formData.tag || ''}
            onChange={(e) => handleInputChange('tag', e.target.value)}
            placeholder="Ex: TAG-001"
            disabled={isReadonly}
          />
        </div>
        )}



        {/* Categoria de Equipamento */}
        <div className="space-y-2">
          {/* O botão de criar sobe para a linha do rótulo. Ao lado do campo ele
              encurtava a caixa, e a coluna deixava de alinhar com os campos de
              cima e de baixo — a assimetria que mais pesava aqui.
              O -my-0.5 impede que ele estique a linha do rótulo e empurre o
              campo alguns pixels para baixo, o que só mudaria o desalinhamento
              de lugar. */}
          <div className="linha-rotulo">
            <label className="text-sm font-medium">
              Categoria <span className="text-red-500">*</span>
            </label>

            {!isReadonly && (
              <Popover open={popoverCategoriaOpen} onOpenChange={setPopoverCategoriaOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 -my-0.5 shrink-0"
                    title="Nova Categoria"
                    aria-label="Nova Categoria"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
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
            )}
          </div>

          {isReadonly ? (
            <div className="campo-estatico text-sm">
              <span className="truncate">
                {modeloSelecionado?.categoria?.nome || 'Não informado'}
              </span>
            </div>
          ) : (
            <Combobox
              options={categorias
                // TON é gerenciado pelo IoT (domínio 'iot'): não oferecer no cadastro de
                // equipamentos. Exceção: se já for a categoria selecionada (edição de um
                // TON existente), mantém pra não quebrar a tela.
                .filter(cat => {
                  const isTon = String(cat.nome || '').trim().toUpperCase() === 'TON';
                  return !isTon || cat.id?.trim() === (categoriaIdSelecionada || '').trim();
                })
                .map(cat => ({ value: cat.id?.trim() || '', label: cat.nome }))}
              value={(categoriaIdSelecionada || '').trim()}
              onValueChange={handleCategoriaChange}
              placeholder={loadingCategorias ? 'Carregando...' : 'Selecione a categoria'}
              searchPlaceholder="Buscar categoria..."
              emptyText="Nenhuma categoria encontrada."
              disabled={loadingCategorias}
            />
          )}
        </div>

        {/* Modelo (Tipo de Equipamento) */}
        <div className="space-y-2">
          <div className="linha-rotulo">
            <label className="text-sm font-medium">
              Modelo <span className="text-red-500">*</span>
            </label>

            {/* Criar modelo depende da categoria, então o botão só aparece com
                ela escolhida — antes ele vivia dentro do ramo em que o combo já
                estava habilitado, e o efeito era o mesmo. */}
            {!isReadonly && !!categoriaIdSelecionada && (
              <Popover open={popoverModeloOpen} onOpenChange={setPopoverModeloOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 -my-0.5 shrink-0"
                    title="Novo Modelo"
                    aria-label="Novo Modelo"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
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
            )}
          </div>

          {/* Os três estados intermediários também ocupam uma caixa de altura
              inteira. Como texto solto, o campo encolhia enquanto a categoria
              não estava escolhida e a linha inteira dançava ao escolher. */}
          {isReadonly ? (
            <div className="campo-estatico text-sm">
              <span className="truncate">
                {modeloSelecionado ? `${modeloSelecionado.nome} (${modeloSelecionado.codigo})` : formData.tipoEquipamento || 'Não informado'}
              </span>
            </div>
          ) : !categoriaIdSelecionada ? (
            <div className="campo-estatico text-sm text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Selecione uma categoria primeiro</span>
            </div>
          ) : loadingModelos ? (
            <div className="campo-estatico text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              <span className="truncate">Carregando modelos...</span>
            </div>
          ) : (
            <Combobox
              options={modelos.map(modelo => ({
                value: modelo.id?.trim() || '',
                label: `${modelo.nome} | ${modelo.fabricante}`
              }))}
              value={(formData.tipoEquipamentoId || '').trim()}
              onValueChange={handleModeloChange}
              placeholder={loadingModelos ? 'Carregando...' : 'Selecione o modelo'}
              searchPlaceholder="Buscar modelo..."
              emptyText="Nenhum modelo encontrado."
              disabled={!categoriaIdSelecionada || loadingModelos}
            />
          )}
        </div>

        {/* Fabricante (Auto-preenchido do modelo) */}
        <div className="space-y-2">
          <div className="linha-rotulo">
            <label className="text-sm font-medium">
              Fabricante
              {modeloSelecionado && (
                <span className="ml-2 text-xs text-muted-foreground">(do modelo)</span>
              )}
            </label>
          </div>
          <input
            className="input-minimal cursor-default focus:ring-0 focus:border-border"
            value={formData.fabricante || ''}
            placeholder="Selecione um modelo"
            readOnly
            tabIndex={-1}
          />
        </div>

        {/* Número de Série — no lote ele é por item. */}
        {!modoLote && (
          <div className="space-y-2">
            <div className="linha-rotulo">
              <label className="text-sm font-medium">Número de Série</label>
            </div>
            <input
              className="input-minimal"
              value={formData.numeroSerie || ''}
              onChange={(e) => handleInputChange('numeroSerie', e.target.value)}
              placeholder="Ex: ABC123456"
              disabled={isReadonly}
            />
          </div>
        )}

        {/* Criticidade */}
        <div className="space-y-2">
          <div className="linha-rotulo">
            <label className="text-sm font-medium">
              Criticidade <span className="text-red-500">*</span>
            </label>
          </div>
          <Select
            value={formData.criticidade || '3'}
            onValueChange={(value) => handleInputChange('criticidade', value)}
            disabled={isReadonly}
          >
            <SelectTrigger className="rounded">
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

        {/* Campo do consumidor (o plano de manutenção, no AupusService). Ocupa
            uma coluna como os demais, caindo ao lado da criticidade.
            Em create não há equipamento ainda, então nada que dependa do id
            pode ser renderizado. */}
        {/* O plano não é replicado: vinculá-lo cria uma cópia própria dele, com
            tarefas e datas por equipamento, e isso não se faz no atacado. No
            lote o campo some, e o vínculo é feito depois, um a um. */}
        {!modoLote && renderCampoDadosBasicos && renderCampoDadosBasicos(entity ?? null, mode, contextoSlot)}

        {modoLote && (
          <div className="space-y-2">
            <div className="linha-rotulo">
              <label className="text-sm font-medium">Plano de Manutenção</label>
            </div>
            <div className="campo-estatico text-sm text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Vincule depois, equipamento por equipamento.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderLocalizacao = () => (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground pb-2 border-b">
        Localização
      </h3>

      {/* Proprietário, planta e unidade numa linha só.
          Antes cada um era um cartão empilhado dentro de uma caixa rotulada
          "Hierarquia", com tipo de pessoa, CPF/CNPJ, endereço e potência
          junto. Três linhas de moldura e um rótulo para dizer o que a ordem
          dos campos já dizia. Quem abre o sheet quer saber de quem é, em que
          planta e em que instalação — o resto está na tela de cada um. */}
      {(mode === 'view' || mode === 'edit') && (proprietarioDetalhes || plantaDetalhes || unidadeDetalhes) && (
        // Mesma moldura dos demais campos do sheet.
        // Como texto solto (rotulo 12px + paragrafo, sem caixa) estes tres
        // destoavam de tudo em volta e pareciam legenda, nao campo. Sao
        // apenas nao editaveis — que e o que .campo-estatico comunica, com a
        // mesma altura, borda e nitidez dos editaveis.
        <div className="grid-equal-cols-3 gap-x-2 gap-y-4">
          <div className="space-y-1.5 min-w-0">
            <div className="linha-rotulo">
              <label className="text-sm font-medium">Proprietário</label>
            </div>
            <div className="campo-estatico text-sm" title={proprietarioDetalhes?.nome}>
              <span className="truncate">{proprietarioDetalhes?.nome || 'Não informado'}</span>
            </div>
          </div>

          <div className="space-y-1.5 min-w-0">
            <div className="linha-rotulo">
              <label className="text-sm font-medium">Planta</label>
            </div>
            <div className="campo-estatico text-sm" title={plantaDetalhes?.nome}>
              <span className="truncate">{plantaDetalhes?.nome || 'Não informado'}</span>
            </div>
          </div>

          <div className="space-y-1.5 min-w-0">
            <div className="linha-rotulo">
              <label className="text-sm font-medium">Instalação</label>
            </div>
            <div className="campo-estatico text-sm" title={unidadeDetalhes?.nome}>
              <span className="truncate">{unidadeDetalhes?.nome || 'Não informado'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Seletores originais - Modo Create */}
      {mode === 'create' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Proprietário */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Proprietário <span className="text-red-500">*</span>
            </label>
            <Combobox
              options={locationCascade.proprietarios.map((prop) => ({
                value: prop.id,
                label: prop.nome || 'Sem nome',
              }))}
              value={locationCascade.selectedProprietarioId}
              onValueChange={locationCascade.handleProprietarioChange}
              placeholder={locationCascade.loadingProprietarios ? 'Carregando...' : 'Selecione o proprietário'}
              searchPlaceholder="Buscar proprietário..."
              emptyText="Nenhum proprietário encontrado."
              disabled={locationCascade.loadingProprietarios}
            />
          </div>

          {/* Planta */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Planta <span className="text-red-500">*</span>
            </label>
            <Combobox
              options={locationCascade.plantas.map((planta) => ({
                value: planta.id,
                label: planta.nome,
              }))}
              value={locationCascade.selectedPlantaId}
              onValueChange={locationCascade.handlePlantaChange}
              placeholder={
                locationCascade.loadingPlantas ? 'Carregando plantas...' :
                !locationCascade.selectedProprietarioId ? 'Primeiro selecione um proprietário' :
                'Selecione a planta'
              }
              searchPlaceholder="Buscar planta..."
              emptyText="Nenhuma planta encontrada."
              disabled={locationCascade.loadingPlantas || !locationCascade.selectedProprietarioId}
            />
          </div>

          {/* Unidade */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Unidade <span className="text-red-500">*</span>
            </label>
            <Combobox
              options={locationCascade.unidades.map((unidade) => ({
                value: unidade.id,
                label: `${unidade.nome} - ${unidade.tipo}`,
              }))}
              value={locationCascade.selectedUnidadeId}
              onValueChange={locationCascade.handleUnidadeChange}
              placeholder={
                locationCascade.loadingUnidades ? 'Carregando unidades...' :
                !locationCascade.selectedPlantaId ? 'Primeiro selecione uma planta' :
                'Selecione a unidade'
              }
              searchPlaceholder="Buscar unidade..."
              emptyText="Nenhuma unidade encontrada."
              disabled={locationCascade.loadingUnidades || !locationCascade.selectedPlantaId}
            />
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
              className="btn-minimal-ghost"
              title="Adicionar campo"
              aria-label="Adicionar campo"
            >
              <Plus className="h-4 w-4" />
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
                    {/* O rotulo legivel quando existe. Os campos vindos da
                        categoria tem chave em snake_case — mostrar `campo` cru
                        poria "potencia_nominal" na tela. Campos vindos do tipo
                        nao trazem rotulo e seguem exibindo `campo`, que la ja e
                        um texto legivel. */}
                    {dado.rotulo || dado.campo}
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
                <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:items-end">
                  <div className="sm:col-span-3">
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

                  <div className="sm:col-span-4">
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

                  <div className="sm:col-span-2">
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

                  <div className="sm:col-span-2">
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
                    <div className="sm:col-span-1">
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
          <div className="py-3">
            <div className="text-sm text-muted-foreground">
              Nenhum dado técnico cadastrado.
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

        {/* Status */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <Select
            value={statusAtual}
            onValueChange={(value) => handleInputChange('status', value)}
            disabled={isReadonly}
          >
            <SelectTrigger className="rounded dark:bg-black">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Ativo">Ativo</SelectItem>
              <SelectItem value="Inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* "Em Operação" saiu: dizia a mesma coisa que Status, com outras
            palavras. O valor continua sendo enviado com o default para não
            mudar o contrato da API. */}
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

      {/* MQTT e Automacao: so no supervisorio. */}
      {mostrarSupervisorio && (
      <>
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

      {/* Secao Automacao — expoe pontos (comando/status/medicao) para integracao com TONs */}
      <div className="space-y-4 pt-4 border-t border-border">
        {isReadonly ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">Automacao</label>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {formData.automacao ? 'Automacao habilitada' : 'Sem automacao'}
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="automacao"
              checked={formData.automacao || false}
              onCheckedChange={(checked) => handleInputChange('automacao', checked)}
              disabled={isReadonly}
            />
            <label htmlFor="automacao" className="text-sm font-medium cursor-pointer">
              Equipamento possui automacao
            </label>
          </div>
        )}

        {formData.automacao && (
          <PontosSection
            pontos={pontos}
            onChange={setPontos}
            readOnly={isReadonly}
          />
        )}
      </div>
      </>
      )}
    </div>
  );

  // ============================================================================
  // HANDLERS UAR
  // ============================================================================
  const handleSubmitUARModal = async (data: any) => {
    if (modalUARDetalhes.mode === 'create') {
      const novoUAR: Equipamento = {
        id: `temp_${Date.now()}`,
        nome: data.nome,
        classificacao: 'UAR',
        tipo: data.tipo_equipamento || data.tipoEquipamento,
        tipoEquipamento: data.tipo_equipamento || data.tipoEquipamento,
        modelo: data.modelo,
        fabricante: data.fabricante,
        numeroSerie: data.numero_serie,
        criticidade: data.criticidade,
        dataInstalacao: data.data_instalacao,
        localizacaoEspecifica: data.localizacao_especifica,
        dadosTecnicos: data.dados_tecnicos,
        equipamentoPaiId: entity!.id,
        unidade: entity!.unidade,
        proprietarioId: entity!.proprietarioId,
        planta: entity!.planta,
        proprietario: entity!.proprietario,
        criadoEm: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalComponentes: 0
      };
      setUarsLista(prev => [...prev, novoUAR]);
    } else if (modalUARDetalhes.mode === 'edit') {
      // O sheet devolve o componente inteiro; guardar so quatro campos aqui
      // apagava todo o resto da edicao.
      //
      // Era assim que a troca de modelo se perdia: o usuario escolhia categoria
      // e modelo, o sheet fechava mostrando o novo valor, e a lista que vai para
      // o lote continuava com o tipo antigo. Nenhum erro em lugar nenhum — a
      // escolha simplesmente nao existia mais no momento de salvar.
      setUarsLista(prev => prev.map(uar => {
        if (uar.id !== modalUARDetalhes.entity?.id) return uar;

        const codigoNovo = data.tipo_equipamento || (uar as any).tipo;
        const trocouTipo = codigoNovo !== (uar as any).tipo;

        return {
          ...uar,
          ...data,
          id: uar.id, // o sheet nao muda a identidade do item na lista
          // Enquanto nao foi salvo, o componente carrega o CODIGO do tipo: e o
          // que o backend aceita nos dois formatos e o que permite reabrir o
          // sheet ja com categoria e modelo certos.
          tipo: codigoNovo,
          tipoEquipamento: codigoNovo,
          // Objeto do tipo antigo com codigo novo mostraria o modelo errado.
          tipoEquipamentoObj: trocouTipo ? undefined : (uar as any).tipoEquipamentoObj,
          updatedAt: new Date().toISOString(),
        };
      }));
    }
    setModalUARDetalhes({ isOpen: false, mode: 'view', entity: null });
  };

  const handleRemoverUAR = (uarId: string) => {
    if (confirm('Tem certeza que deseja remover este componente UAR?')) {
      setUarsLista(prev => prev.filter(uar => uar.id !== uarId));
    }
  };

  const handleSalvarUARs = async () => {
    if (!entity || !onSaveUARs) return;
    try {
      await onSaveUARs(entity.id, uarsLista);
    } catch (err) {
      console.error('Erro ao salvar UARs:', err);
    }
  };

  const renderComponentesUAR = () => {
    if (mode === 'create') return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b">
          <h3 className="text-sm font-semibold text-foreground">
            Componentes UAR ({uarsLista.length})
          </h3>
          {!isReadonly && (
            <button
              type="button"
              onClick={() => setModalUARDetalhes({ isOpen: true, mode: 'create', entity: null })}
              className="btn-minimal-ghost h-8 px-2"
              title="Adicionar componente UAR"
              aria-label="Adicionar componente UAR"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>

        {loadingUARs && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin mr-2 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Carregando componentes...</span>
          </div>
        )}

        {!loadingUARs && uarsLista.length === 0 && (
          <div className="py-3">
            <p className="text-sm text-muted-foreground">Nenhum componente UAR.</p>
          </div>
        )}

        {!loadingUARs && uarsLista.length > 0 && (
          <div className="space-y-1.5">
            {uarsLista.map((uar) => (
              <div key={uar.id} className="flex items-center justify-between gap-3 p-3 rounded-md border bg-card transition-shadow hover:shadow-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium truncate">{uar.nome}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      Crit. {uar.criticidade}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {/* Fabricante e modelo, que e o que identifica a peca.
                        O `tipo` saiu: ele guarda o CODIGO do tipo de
                        equipamento — algo como "disjuntor_bt" —, e codigo interno
                        no lugar onde se espera o modelo confunde mais do que
                        informa. */}
                    {uar.fabricante && <span>{uar.fabricante}</span>}
                    {uar.modelo && <span>{uar.modelo}</span>}
                  </div>
                </div>

                {/* O mesmo `Button` de todo icone de acao do projeto, e nao um
                    `<button>` cru com `btn-minimal-ghost`.

                    Aquela classe vem do CSS do shared-pages, que o consumidor
                    importa DEPOIS do proprio globals.css — entao ela vence as
                    utilitarias aplicadas no mesmo elemento (`h-7 w-7 p-0`
                    perdiam para o `h-9 px-4` de dentro dela). Um botao que
                    depende dessa ordem para ter tamanho e cor e um botao que
                    some quando a ordem muda.

                    `Button` traz o proprio tamanho e a propria cor, e nao
                    depende de nenhuma folha externa. */}
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setModalUARDetalhes({ isOpen: true, mode: 'view', entity: uar })}
                    title="Visualizar"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {!isReadonly && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setModalUARDetalhes({ isOpen: true, mode: 'edit', entity: uar })}
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoverUAR(uar.id)}
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Botão salvar UARs - apenas em modo edit com alterações */}
        {!isReadonly && uarsLista.length > 0 && onSaveUARs && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSalvarUARs}
              className="btn-minimal-outline h-8 text-xs gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              Salvar Componentes
            </button>
          </div>
        )}
      </div>
    );
  };

  /** Tudo que descreve o equipamento em si. As tarefas e o histórico saíram
   *  daqui para abas próprias. */
  const renderConteudoDados = () => (
    <div className="space-y-6">
      {renderDadosBasicos()}

      <Separator />

      {renderLocalizacao()}

      <Separator />

      {renderDadosTecnicos()}

      <Separator />

      {renderInformacoesComplementares()}

      <Separator />

      {renderComponentesUAR()}
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
      // flex-wrap: no celular a quantidade mais os dois botoes passam de
      // 400px e a barra inteira saia da tela. Envolvendo, a quantidade cai
      // para a linha de cima em vez de empurrar o resto para fora.
      <div className="flex flex-wrap justify-between gap-2">
        {/* Botão de Excluir à esquerda - apenas em modo edit */}
        <div>
          {mode === 'edit' && entity && onDelete && (
            <button
              onClick={() => {
                onClose(); // Fechar modal primeiro
                onDelete(entity); // Depois abrir AlertDialog
              }}
              disabled={loading}
              className="btn-minimal-outline h-9 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </button>
          )}
        </div>

        {/* Botões de ação à direita. A quantidade vem junto: ela não é um dado
            do equipamento, e sim quantos criar — pertence ao botão de criar, e
            não à grade de Dados Básicos, onde era só mais um campo no meio de
            outros sem relação visível com o que muda. */}
        <div className="flex items-center gap-2">
          {mode === 'create' && !isReadonly && (
            <div className="flex items-center gap-2 mr-1 pr-3 border-r">
              <label className="text-sm text-muted-foreground whitespace-nowrap">
                Quantidade
              </label>
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-8 rounded-r-none"
                  onClick={() => mudarQuantidade(quantidade - 1)}
                  disabled={quantidade <= 1}
                  title="Uma a menos"
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
                  aria-label="Quantidade de equipamentos a criar"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-8 rounded-l-none"
                  onClick={() => mudarQuantidade(quantidade + 1)}
                  disabled={quantidade >= 50}
                  title="Uma a mais"
                  aria-label="Aumentar a quantidade"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

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
              {modoLote
                ? `Criar ${quantidade} Equipamentos`
                : isCreating
                  ? 'Criar Equipamento'
                  : 'Salvar Alterações'}
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

          {/* Sem abas o sheet virava uma rolagem só, e as tarefas ficavam
              soterradas entre localização e dados técnicos. As abas só
              aparecem quando há para onde alternar: em create não existe
              equipamento ainda, e o NexOn não passa nenhum dos slots. */}
          {/* A foto fica ACIMA das abas, não dentro de Dados técnicos: é a
              identificação visual do equipamento e vale para tudo que se olha
              nas outras abas. */}

          {usarAbas ? (
            <Tabs value={abaAtiva} onValueChange={(v) => setAbaAtiva(v as AbaSheet)}>
              {/* Retrato à esquerda, toggle à direita, na mesma linha.
                  Empilhados, os dois custavam altura demais antes de qualquer
                  conteúdo aparecer. */}
              {/* No celular a fita de abas ganha a linha inteira: ao lado do
                  retrato ela nao cabe e virava arrasto lateral. */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {renderFoto()}
                {/* min-w-0 deixa a fita encolher; sem isso ela força a largura
                    do sheet e a linha inteira estoura no celular. */}
                <TabsList className="gap-1 w-full sm:w-auto sm:ml-auto min-w-0 max-w-full overflow-x-auto scrollbar-minimal">
                  <TabsTrigger value="dados">Dados técnicos</TabsTrigger>
                  {modoLote && <TabsTrigger value="itens">Equipamentos ({quantidade})</TabsTrigger>}
                  {temAbaTarefas && <TabsTrigger value="tarefas">Tarefas</TabsTrigger>}
                  {temAbaHistorico && <TabsTrigger value="historico">Histórico</TabsTrigger>}
                  {temAbaAnexos && <TabsTrigger value="anexos">Anexos</TabsTrigger>}
                </TabsList>
              </div>

              <TabsContent value="dados">{renderConteudoDados()}</TabsContent>

              {modoLote && (
                <TabsContent value="itens">
                  <ItensDoLoteField
                    itens={itensDoLote}
                    onChange={setItensDoLote}
                    nomeBase={baseSemNumero(formData.nome || duplicarDe?.nome)}
                    tagBase={baseSemNumero(duplicarDe?.tag)}
                    consultarSequencial={(params) =>
                      proximoSequencial({
                        ...params,
                        // Nome se repete entre unidades sem problema, então a
                        // contagem é dentro desta. A TAG é global e o backend
                        // ignora a unidade nela.
                        unidade_id:
                          locationCascade.selectedUnidadeId || formData.unidadeId || undefined,
                      })
                    }
                  />
                </TabsContent>
              )}

              {temAbaTarefas && (
                <TabsContent value="tarefas">
                  {renderSecaoExtra!(entity ?? null, mode, contextoSlot)}
                </TabsContent>
              )}

              {temAbaHistorico && (
                <TabsContent value="historico">{renderHistorico!(entity!, mode)}</TabsContent>
              )}

              {temAbaAnexos && (
                <TabsContent value="anexos">
                  <AnexosEquipamentoField
                    equipamentoId={entity?.id ?? null}
                    somenteLeitura={isReadonly}
                    registrarAcaoPosCriacao={registrarAcaoPosCriacao}
                  />
                </TabsContent>
              )}
            </Tabs>
          ) : (
            <>
              <div className="mb-6">{renderFoto()}</div>
              {renderConteudoDados()}
            </>
          )}
        </div>

        <div className="border-t px-6 py-3 bg-muted/20">
          {renderActions()}
        </div>
      </SheetContent>

      {/* Modal aninhado para detalhes de UAR */}
      <ComponenteUARModal
        isOpen={modalUARDetalhes.isOpen}
        mode={modalUARDetalhes.mode}
        entity={modalUARDetalhes.entity}
        equipamentoPai={entity ? { id: entity.id, nome: entity.nome } as Equipamento : undefined}
        onClose={() => setModalUARDetalhes({ isOpen: false, mode: 'view', entity: null })}
        onSubmit={handleSubmitUARModal}
        aoCriarEmLote={async () => {
          setModalUARDetalhes({ isOpen: false, mode: 'view', entity: null });
          if (entity?.id) {
            const result = await fetchComponentesParaGerenciar(entity.id);
            setUarsLista(result.componentes || []);
          }
        }}
      />
    </Sheet>
  );
};