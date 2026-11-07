import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { chavesCameras } from '../../hooks/chaves';
import type { EquipamentoResumido } from '../../hooks/useEquipamentosPontos';
import { CamerasService } from '../../services/cameras.service';
import type { Agente, Camera, CameraPayload, ClasseAlerta } from '../../types';
import { mensagemErro } from '../../utils/erros';
import { Campo, NENHUM, TituloBloco } from './Campo';

const CLASSES: { valor: ClasseAlerta; rotulo: string }[] = [
  { valor: 'pessoa', rotulo: 'Pessoas' },
  { valor: 'veiculo', rotulo: 'Veículos' },
  { valor: 'animal', rotulo: 'Animais' },
  { valor: 'movimento', rotulo: 'Movimento' },
];

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
  sensibilidade: string;
  classes: ClasseAlerta[];
  clipe_s: string;
  continuo: boolean;
}

function estadoInicial(c: Camera | null, proximaOrdem: number): Estado {
  return {
    nome: c?.nome ?? '',
    ip: c?.ip ?? '',
    porta_rtsp: String(c?.porta_rtsp ?? 554),
    porta_http: String(c?.porta_http ?? 80),
    usuario: c?.usuario ?? 'admin',
    senha: '',
    canal: String(c?.canal ?? 1),
    fabricante: c?.fabricante ?? 'intelbras',
    modelo: c?.modelo ?? '',
    agente_id: c?.agente_id ?? NENHUM,
    equipamento_id: c?.equipamento_id ?? NENHUM,
    ordem: String(c?.ordem ?? proximaOrdem),
    analise_ativa: c?.analise?.ativa ?? true,
    sensibilidade: String(c?.analise?.sensibilidade ?? 50),
    classes: c?.analise?.classes_alerta ?? ['pessoa', 'veiculo'],
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
  agentes: Agente[];
  equipamentos: EquipamentoResumido[];
  proximaOrdem: number;
  onSalvo: () => void;
  onCancelar: () => void;
}

/** Cadastro/edição de câmera: conexão, vínculos (agente, CFTV, ordem) e análise. */
export function FormCamera({ unidadeId, camera, agentes, equipamentos, proximaOrdem, onSalvo, onCancelar }: FormCameraProps) {
  const [f, setF] = useState<Estado>(() => estadoInicial(camera, proximaOrdem));
  const [erro, setErro] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const idBase = camera ? `cam-${camera.id}` : 'cam-nova';
  const campo = <K extends keyof Estado>(chave: K) => (valor: Estado[K]) => setF((s) => ({ ...s, [chave]: valor }));

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
        analise: {
          ativa: f.analise_ativa,
          sensibilidade: inteiro(f.sensibilidade, 50, 0, 100),
          classes_alerta: f.classes,
          clipe_s: inteiro(f.clipe_s, 12, 0, 120),
        },
      };
      if (f.senha) payload.senha = f.senha;
      return camera ? CamerasService.editar(camera.id, payload) : CamerasService.criar({ ...payload, unidade_id: unidadeId });
    },
    onSuccess: () => {
      toast.success(camera ? 'Câmera atualizada' : 'Câmera cadastrada');
      void queryClient.invalidateQueries({ queryKey: chavesCameras.tudo });
      onSalvo();
    },
    onError: (e) => setErro(mensagemErro(e, 'Não foi possível salvar a câmera')),
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!f.nome.trim() || !f.ip.trim() || !f.usuario.trim()) {
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

  const alternarClasse = (c: ClasseAlerta) =>
    setF((s) => ({ ...s, classes: s.classes.includes(c) ? s.classes.filter((x) => x !== c) : [...s.classes, c] }));

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5" aria-label={camera ? `Editar ${camera.nome}` : 'Nova câmera'}>
      <div className="flex flex-col gap-3">
        <TituloBloco>Conexão</TituloBloco>
        <Campo rotulo="Nome" htmlFor={`${idBase}-nome`}>
          <Input id={`${idBase}-nome`} value={f.nome} onChange={(e) => campo('nome')(e.target.value)} placeholder="Cabine / SSU" autoFocus={!camera} />
        </Campo>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_96px_96px]">
          <Campo rotulo="IP" htmlFor={`${idBase}-ip`} className="col-span-2 sm:col-span-1">
            <Input id={`${idBase}-ip`} value={f.ip} onChange={(e) => campo('ip')(e.target.value)} placeholder="192.168.0.108" inputMode="decimal" />
          </Campo>
          <Campo rotulo="Porta RTSP" htmlFor={`${idBase}-rtsp`}>
            <Input id={`${idBase}-rtsp`} value={f.porta_rtsp} onChange={(e) => campo('porta_rtsp')(e.target.value)} inputMode="numeric" />
          </Campo>
          <Campo rotulo="Porta HTTP" htmlFor={`${idBase}-http`}>
            <Input id={`${idBase}-http`} value={f.porta_http} onChange={(e) => campo('porta_http')(e.target.value)} inputMode="numeric" />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_96px]">
          <Campo rotulo="Usuário" htmlFor={`${idBase}-usuario`}>
            <Input id={`${idBase}-usuario`} value={f.usuario} onChange={(e) => campo('usuario')(e.target.value)} autoComplete="off" />
          </Campo>
          <Campo rotulo="Senha" htmlFor={`${idBase}-senha`} dica={camera ? 'Em branco mantém a atual.' : undefined}>
            <Input
              id={`${idBase}-senha`}
              type="password"
              value={f.senha}
              onChange={(e) => campo('senha')(e.target.value)}
              autoComplete="new-password"
              placeholder={camera ? '••••••••' : ''}
            />
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
      </div>

      <div className="flex flex-col gap-3">
        <TituloBloco>Vínculos</TituloBloco>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_80px]">
          <Campo rotulo="Agente" dica={agentes.length === 0 ? 'Crie um agente na aba Agentes.' : undefined}>
            <Select value={f.agente_id} onValueChange={campo('agente_id')}>
              <SelectTrigger aria-label="Agente">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUM}>Sem agente</SelectItem>
                {agentes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
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
      </div>

      <div className="flex flex-col gap-3">
        <TituloBloco>Análise</TituloBloco>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            Detecção ativa
            <span className="block text-[11px] text-muted-foreground">O agente analisa o vídeo e gera eventos.</span>
          </span>
          <Switch checked={f.analise_ativa} onCheckedChange={campo('analise_ativa')} aria-label="Detecção ativa" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Sensibilidade (0–100)" htmlFor={`${idBase}-sens`}>
            <Input id={`${idBase}-sens`} value={f.sensibilidade} onChange={(e) => campo('sensibilidade')(e.target.value)} inputMode="numeric" />
          </Campo>
          <Campo rotulo="Clipe (segundos)" htmlFor={`${idBase}-clipe`} dica="0 desliga o clipe.">
            <Input id={`${idBase}-clipe`} value={f.clipe_s} onChange={(e) => campo('clipe_s')(e.target.value)} inputMode="numeric" />
          </Campo>
        </div>
        <Campo rotulo="Classes que geram alerta">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Classes que geram alerta">
            {CLASSES.map((c) => {
              const ativo = f.classes.includes(c.valor);
              return (
                <button
                  key={c.valor}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => alternarClasse(c.valor)}
                  className={cn(
                    'h-8 rounded-full border px-3 text-xs font-semibold transition-colors touch:h-9',
                    ativo ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground/80 mouse:hover:bg-muted',
                  )}
                >
                  {c.rotulo}
                </button>
              );
            })}
          </div>
        </Campo>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            Vídeo contínuo
            <span className="block text-[11px] text-muted-foreground">Publica sempre, não só quando alguém assiste. Gasta banda da usina.</span>
          </span>
          <Switch checked={f.continuo} onCheckedChange={campo('continuo')} aria-label="Vídeo contínuo" />
        </label>
      </div>

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
          {camera ? 'Salvar' : 'Cadastrar'}
        </Button>
      </div>
    </form>
  );
}
