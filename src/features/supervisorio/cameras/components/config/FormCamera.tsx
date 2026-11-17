import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { chavesCameras } from '../../hooks/chaves';
import type { EquipamentoResumido } from '../../hooks/useEquipamentosPontos';
import { CamerasService } from '../../services/cameras.service';
import type { Agente, Camera, CameraDescoberta, CameraPayload, ClasseAlerta, StreamGravacao } from '../../types';
import { mensagemErro } from '../../utils/erros';
import { NIVEIS_SENSIBILIDADE, nivelSensibilidade, rotuloFabricante, type ValorSensibilidade } from '../../utils/sensibilidade';
import { Campo, NENHUM, TituloBloco } from './Campo';
import { CLIPE_ANTES_PADRAO, CLIPE_DEPOIS_PADRAO, OPCOES_ANTES, OPCOES_DEPOIS, opcaoMaisProxima } from '../../utils/clipe';
import { ClipeEvento } from './ClipeEvento';

interface Estado {
  nome: string;
  ip: string;
  porta_rtsp: string;
  porta_http: string;
  usuario: string;
  senha: string;
  canal: string;
  fabricante: string;
  modelo: string;
  agente_id: string;
  equipamento_id: string;
  ordem: string;
  analise_ativa: boolean;
  sensibilidade: ValorSensibilidade;
  classes_alerta: ClasseAlerta[];
  clipe_ativo: boolean;
  clipe_antes: number;
  clipe_depois: number;
  continuo: boolean;
  gravacao_ativa: boolean;
  gravacao_dias: string;
  gravacao_stream: StreamGravacao;
}

/** Câmera achada na rede pelo aparelho: pré-preenche a conexão (NEXON-108). */
export interface SugestaoCamera {
  descoberta: CameraDescoberta;
  agente: Agente;
}

function estadoInicial(c: Camera | null, proximaOrdem: number, sugestao?: SugestaoCamera): Estado {
  const d = sugestao?.descoberta;
  return {
    nome: c?.nome ?? '',
    ip: c?.ip ?? d?.ip ?? '',
    porta_rtsp: String(c?.porta_rtsp ?? d?.porta_rtsp ?? 554),
    porta_http: String(c?.porta_http ?? d?.porta_http ?? 80),
    usuario: c?.usuario ?? 'admin',
    senha: '',
    canal: String(c?.canal ?? 1),
    fabricante: c?.fabricante ?? d?.fabricante ?? 'intelbras',
    modelo: c?.modelo ?? d?.modelo ?? '',
    agente_id: c?.agente_id ?? sugestao?.agente.id ?? NENHUM,
    equipamento_id: c?.equipamento_id ?? NENHUM,
    ordem: String(c?.ordem ?? proximaOrdem),
    analise_ativa: c?.analise?.ativa ?? true,
    sensibilidade: nivelSensibilidade(c?.analise?.sensibilidade),
    classes_alerta: c?.analise?.classes_alerta?.length ? [...c.analise.classes_alerta] : [...CLASSES_PADRAO],
    clipe_ativo: (c?.analise?.clipe_s ?? CLIPE_DEPOIS_PADRAO) > 0,
    clipe_antes: opcaoMaisProxima(c?.analise?.pre_s, OPCOES_ANTES, CLIPE_ANTES_PADRAO),
    clipe_depois: c?.analise?.clipe_s ? opcaoMaisProxima(c.analise.clipe_s, OPCOES_DEPOIS, CLIPE_DEPOIS_PADRAO) : CLIPE_DEPOIS_PADRAO,
    continuo: c?.stream?.continuo ?? false,
    gravacao_ativa: c?.gravacao?.config.ativa ?? true,
    gravacao_dias: String(c?.gravacao?.config.dias ?? 7),
    gravacao_stream: c?.gravacao?.config.stream ?? 'secundario',
  };
}

/** "Avisar quando aparecer": rótulo na tela → `analise.classes_alerta`. */
const OPCOES_AVISO: { valor: ClasseAlerta; rotulo: string }[] = [
  { valor: 'pessoa', rotulo: 'Pessoas' },
  { valor: 'veiculo', rotulo: 'Veículos' },
  { valor: 'animal', rotulo: 'Animais' },
  { valor: 'movimento', rotulo: 'Qualquer movimento' },
];

/** Câmera nova avisa de pessoas, veículos e animais; "qualquer movimento" é escolha de quem configura. */
const CLASSES_PADRAO: ClasseAlerta[] = ['pessoa', 'veiculo', 'animal'];

function inteiro(texto: string, padrao: number, min?: number, max?: number): number {
  const n = Number.parseInt(texto, 10);
  let v = Number.isNaN(n) ? padrao : n;
  if (min !== undefined) v = Math.max(min, v);
  if (max !== undefined) v = Math.min(max, v);
  return v;
}

interface FormCameraProps {
  unidadeId: string;
  /** null = nova câmera. */
  camera: Camera | null;
  /** Nova câmera a partir de uma câmera encontrada na rede. */
  sugestao?: SugestaoCamera;
  agentes: Agente[];
  equipamentos: EquipamentoResumido[];
  proximaOrdem: number;
  onSalvo: () => void;
  onCancelar: () => void;
}

/**
 * Cadastro/edição de câmera. O essencial fica à vista (nome, usuário, senha, detecção de
 * movimento); portas, canal, vínculos, clipe e vídeo contínuo ficam em "Avançado".
 */
export function FormCamera({ unidadeId, camera, sugestao, agentes, equipamentos, proximaOrdem, onSalvo, onCancelar }: FormCameraProps) {
  const [f, setF] = useState<Estado>(() => estadoInicial(camera, proximaOrdem, sugestao));
  const [erro, setErro] = useState<string | null>(null);
  const [avancado, setAvancado] = useState(false);
  const queryClient = useQueryClient();
  const idBase = camera ? `cam-${camera.id}` : 'cam-nova';
  const campo = <K extends keyof Estado>(chave: K) => (valor: Estado[K]) => setF((s) => ({ ...s, [chave]: valor }));
  // Câmera encontrada: IP fixo (validado na descoberta), só leitura. Edição: IP em "Avançado".
  // Cadastro manual: IP à vista.
  const ipNoAvancado = !!camera && !sugestao;
  const agenteNoAvancado = !!sugestao;

  const salvar = useMutation({
    mutationFn: () => {
      const payload: CameraPayload = {
        nome: f.nome.trim(),
        ip: f.ip.trim(),
        usuario: f.usuario.trim(),
        porta_rtsp: inteiro(f.porta_rtsp, 554, 1, 65535),
        porta_http: inteiro(f.porta_http, 80, 1, 65535),
        canal: inteiro(f.canal, 1, 1),
        fabricante: f.fabricante.trim() || null,
        modelo: f.modelo.trim() || null,
        agente_id: f.agente_id === NENHUM ? null : f.agente_id,
        equipamento_id: f.equipamento_id === NENHUM ? null : f.equipamento_id,
        ordem: inteiro(f.ordem, proximaOrdem, 0),
        stream: { continuo: f.continuo },
        gravacao: { ativa: f.gravacao_ativa, dias: inteiro(f.gravacao_dias, 7, 1, 30), stream: f.gravacao_stream },
        analise: {
          ativa: f.analise_ativa,
          sensibilidade: f.sensibilidade,
          classes_alerta: OPCOES_AVISO.map((o) => o.valor).filter((v) => f.classes_alerta.includes(v)),
          clipe_s: f.clipe_ativo ? f.clipe_depois : 0,
          pre_s: f.clipe_antes,
        },
      };
      if (f.senha) payload.senha = f.senha;
      return camera ? CamerasService.editar(camera.id, payload) : CamerasService.criar({ ...payload, unidade_id: unidadeId });
    },
    onSuccess: () => {
      toast.success(camera ? 'Câmera atualizada' : 'Câmera adicionada');
      void queryClient.invalidateQueries({ queryKey: chavesCameras.tudo });
      onSalvo();
    },
    onError: (e) => setErro(mensagemErro(e, 'Não foi possível salvar a câmera')),
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!f.nome.trim() || !f.ip.trim() || !f.usuario.trim()) {
      if (!f.ip.trim() && ipNoAvancado) setAvancado(true);
      setErro('Preencha nome, IP e usuário.');
      return;
    }
    if (f.analise_ativa && f.classes_alerta.length === 0) {
      setErro('Escolha pelo menos um aviso em "Avisar quando aparecer".');
      return;
    }
    if (!camera && !f.senha) {
      setErro('Informe a senha da câmera.');
      return;
    }
    setErro(null);
    salvar.mutate();
  };

  const alternarAviso = (valor: ClasseAlerta) =>
    setF((s) => ({
      ...s,
      classes_alerta: s.classes_alerta.includes(valor) ? s.classes_alerta.filter((v) => v !== valor) : [...s.classes_alerta, valor],
    }));

  const campoIp = (
    <Campo rotulo="IP da câmera" htmlFor={`${idBase}-ip`}>
      <Input id={`${idBase}-ip`} value={f.ip} onChange={(e) => campo('ip')(e.target.value)} placeholder="192.168.0.108" inputMode="decimal" />
    </Campo>
  );

  const campoAgente = (
    <Campo rotulo="Aparelho" dica={agentes.length === 0 ? 'Adicione um aparelho na aba Aparelhos.' : undefined}>
      <Select value={f.agente_id} onValueChange={campo('agente_id')}>
        <SelectTrigger aria-label="Aparelho">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NENHUM}>Sem aparelho</SelectItem>
          {agentes.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Campo>
  );

  const d = sugestao?.descoberta;
  const tituloSugestao = d ? [rotuloFabricante(d.fabricante) ?? 'Câmera', d.modelo].filter(Boolean).join(' ') : null;

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5" aria-label={camera ? `Editar ${camera.nome}` : 'Nova câmera'}>
      {d && sugestao && (
        <div className="rounded-lg border border-border bg-[color-mix(in_srgb,var(--muted)_40%,transparent)] p-3">
          <p className="truncate text-sm font-medium">
            {tituloSugestao} · {d.ip}
          </p>
          <p className="truncate text-xs text-muted-foreground">Encontrada pelo aparelho {sugestao.agente.nome}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <TituloBloco>Câmera</TituloBloco>
        <Campo rotulo="Nome" htmlFor={`${idBase}-nome`}>
          <Input id={`${idBase}-nome`} value={f.nome} onChange={(e) => campo('nome')(e.target.value)} placeholder="Cabine / SSU" autoFocus={!camera} />
        </Campo>
        {sugestao ? (
          <Campo rotulo="IP da câmera" htmlFor={`${idBase}-ip`}>
            <Input id={`${idBase}-ip`} value={f.ip} readOnly className="bg-muted font-mono text-muted-foreground" />
          </Campo>
        ) : (
          !ipNoAvancado && campoIp
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Usuário" htmlFor={`${idBase}-usuario`}>
            <Input id={`${idBase}-usuario`} value={f.usuario} onChange={(e) => campo('usuario')(e.target.value)} autoComplete="off" />
          </Campo>
          <Campo rotulo="Senha" htmlFor={`${idBase}-senha`} dica={camera ? 'Em branco mantém a atual.' : 'A senha criada na câmera.'}>
            <Input
              id={`${idBase}-senha`}
              type="password"
              value={f.senha}
              onChange={(e) => campo('senha')(e.target.value)}
              autoComplete="new-password"
              placeholder={camera ? '••••••••' : ''}
            />
          </Campo>
        </div>
        {!agenteNoAvancado && campoAgente}
      </div>

      <div className="flex flex-col gap-3">
        <TituloBloco>Detecção</TituloBloco>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            Detecção de movimento ativa
            <span className="block text-[11px] text-muted-foreground">Desligada, a câmera só mostra vídeo, sem alertas.</span>
          </span>
          <Switch checked={f.analise_ativa} onCheckedChange={campo('analise_ativa')} aria-label="Detecção de movimento ativa" />
        </label>
        <Campo rotulo="Avisar quando aparecer" dica="Com a usina armada, só o que estiver marcado gera alerta.">
          <div role="group" aria-label="Avisar quando aparecer" className="flex flex-wrap gap-1.5">
            {OPCOES_AVISO.map((o) => {
              const ativo = f.classes_alerta.includes(o.valor);
              return (
                <button
                  key={o.valor}
                  type="button"
                  aria-pressed={ativo}
                  disabled={!f.analise_ativa}
                  onClick={() => alternarAviso(o.valor)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-40 touch:h-10',
                    ativo ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-[color-mix(in_srgb,var(--foreground)_80%,transparent)] mouse:hover:bg-muted',
                  )}
                >
                  {ativo && <Check className="h-3.5 w-3.5" aria-hidden />}
                  {o.rotulo}
                </button>
              );
            })}
          </div>
        </Campo>
        <Campo rotulo="Sensibilidade" dica="Alta pega movimentos menores, mas pode alertar com vento e bichos pequenos.">
          <div role="radiogroup" aria-label="Sensibilidade" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {NIVEIS_SENSIBILIDADE.map((n) => {
              const ativo = f.sensibilidade === n.valor;
              return (
                <button
                  key={n.valor}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => campo('sensibilidade')(n.valor)}
                  className={cn(
                    'h-8 rounded-md text-xs font-semibold transition-colors touch:h-10',
                    ativo ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground mouse:hover:text-foreground',
                  )}
                >
                  {n.rotulo}
                </button>
              );
            })}
          </div>
        </Campo>
      </div>

      <div className="flex flex-col gap-3">
        <TituloBloco>Vídeo do evento</TituloBloco>
        <ClipeEvento
          ativo={f.clipe_ativo}
          antes={f.clipe_antes}
          depois={f.clipe_depois}
          desabilitado={!f.analise_ativa}
          onAtivo={campo('clipe_ativo')}
          onAntes={campo('clipe_antes')}
          onDepois={campo('clipe_depois')}
        />
      </div>

      <Collapsible open={avancado} onOpenChange={setAvancado}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mouse:hover:text-foreground"
          >
            Avançado
            <ChevronDown className={cn('h-4 w-4 transition-transform', avancado && 'rotate-180')} aria-hidden />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-3 pt-3">
            {ipNoAvancado && campoIp}
            <div className="grid grid-cols-3 gap-3">
              <Campo rotulo="Porta RTSP" htmlFor={`${idBase}-rtsp`}>
                <Input id={`${idBase}-rtsp`} value={f.porta_rtsp} onChange={(e) => campo('porta_rtsp')(e.target.value)} inputMode="numeric" />
              </Campo>
              <Campo rotulo="Porta HTTP" htmlFor={`${idBase}-http`}>
                <Input id={`${idBase}-http`} value={f.porta_http} onChange={(e) => campo('porta_http')(e.target.value)} inputMode="numeric" />
              </Campo>
              <Campo rotulo="Canal" htmlFor={`${idBase}-canal`}>
                <Input id={`${idBase}-canal`} value={f.canal} onChange={(e) => campo('canal')(e.target.value)} inputMode="numeric" />
              </Campo>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Fabricante" htmlFor={`${idBase}-fab`}>
                <Input id={`${idBase}-fab`} value={f.fabricante} onChange={(e) => campo('fabricante')(e.target.value)} placeholder="intelbras" />
              </Campo>
              <Campo rotulo="Modelo" htmlFor={`${idBase}-modelo`}>
                <Input id={`${idBase}-modelo`} value={f.modelo} onChange={(e) => campo('modelo')(e.target.value)} placeholder="VIP 1230 B G2" />
              </Campo>
            </div>
            {agenteNoAvancado && campoAgente}
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <Campo rotulo="Equipamento CFTV" dica="Permite abrir chamado para a câmera.">
                <Select value={f.equipamento_id} onValueChange={campo('equipamento_id')}>
                  <SelectTrigger aria-label="Equipamento CFTV">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUM}>Nenhum</SelectItem>
                    {equipamentos.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <Campo rotulo="Ordem" htmlFor={`${idBase}-ordem`}>
                <Input id={`${idBase}-ordem`} value={f.ordem} onChange={(e) => campo('ordem')(e.target.value)} inputMode="numeric" />
              </Campo>
            </div>
            <LinhaSwitch
              titulo="Vídeo contínuo"
              dica="Publica sempre, não só quando alguém assiste. Gasta banda da usina."
              marcado={f.continuo}
              onChange={campo('continuo')}
            />
            <LinhaSwitch
              titulo="Gravação contínua"
              dica="O aparelho grava tudo no próprio disco; veja em Histórico."
              marcado={f.gravacao_ativa}
              onChange={campo('gravacao_ativa')}
            />
            {f.gravacao_ativa && (
              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo="Dias guardados" htmlFor={`${idBase}-dias`} dica="De 1 a 30.">
                  <Input id={`${idBase}-dias`} value={f.gravacao_dias} onChange={(e) => campo('gravacao_dias')(e.target.value)} inputMode="numeric" />
                </Campo>
                <Campo rotulo="Qualidade" dica="Alta ocupa bem mais disco.">
                  <Select value={f.gravacao_stream} onValueChange={(v) => campo('gravacao_stream')(v as StreamGravacao)}>
                    <SelectTrigger aria-label="Qualidade da gravação">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="secundario">Leve</SelectItem>
                      <SelectItem value="principal">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </Campo>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {erro && (
        <p role="alert" className="text-xs text-destructive">
          {erro}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button type="button" variant="ghost" onClick={onCancelar} disabled={salvar.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvar.isPending}>
          {salvar.isPending && <Loader2 className="animate-spin" aria-hidden />}
          {camera ? 'Salvar' : 'Adicionar câmera'}
        </Button>
      </div>
    </form>
  );
}

function LinhaSwitch({ titulo, dica, marcado, onChange }: { titulo: string; dica: ReactNode; marcado: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>
        {titulo}
        <span className="block text-[11px] text-muted-foreground">{dica}</span>
      </span>
      <Switch checked={marcado} onCheckedChange={onChange} aria-label={titulo} />
    </label>
  );
}
