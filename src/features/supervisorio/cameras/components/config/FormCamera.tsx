import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Loader2 } from 'lucide-react';
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
import type { Agente, Camera, CameraDescoberta, CameraPayload } from '../../types';
import { mensagemErro } from '../../utils/erros';
import { NIVEIS_SENSIBILIDADE, nivelSensibilidade, rotuloFabricante, type ValorSensibilidade } from '../../utils/sensibilidade';
import { Campo, NENHUM, TituloBloco } from './Campo';

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
  clipe_s: string;
  continuo: boolean;
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
    clipe_s: String(c?.analise?.clipe_s ?? 12),
    continuo: c?.stream?.continuo ?? false,
  };
}

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
        // Só movimento: as classes de alerta ficam com a API (NEXON-108).
        analise: {
          ativa: f.analise_ativa,
          sensibilidade: f.sensibilidade,
          clipe_s: inteiro(f.clipe_s, 12, 0, 120),
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
    if (!camera && !f.senha) {
      setErro('Informe a senha da câmera.');
      return;
    }
    setErro(null);
    salvar.mutate();
  };

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
        <div className="rounded-lg border border-border bg-muted/40 p-3">
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
            <span className="block text-[11px] text-muted-foreground">Com a usina armada, movimento na imagem gera alerta.</span>
          </span>
          <Switch checked={f.analise_ativa} onCheckedChange={campo('analise_ativa')} aria-label="Detecção de movimento ativa" />
        </label>
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
            <Campo rotulo="Clipe (segundos)" htmlFor={`${idBase}-clipe`} dica="Vídeo guardado em cada alerta. 0 desliga o clipe." className="max-w-[160px]">
              <Input id={`${idBase}-clipe`} value={f.clipe_s} onChange={(e) => campo('clipe_s')(e.target.value)} inputMode="numeric" />
            </Campo>
            <LinhaSwitch
              titulo="Vídeo contínuo"
              dica="Publica sempre, não só quando alguém assiste. Gasta banda da usina."
              marcado={f.continuo}
              onChange={campo('continuo')}
            />
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
