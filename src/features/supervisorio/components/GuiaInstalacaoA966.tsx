// GuiaInstalacaoA966 — o nó "Meter Gateway A966" do editor IoT não gera firmware: ele é o
// GUIA DE INSTALAÇÃO. Junta, na ordem das telas da interface web do A966 (AP 192.168.4.1,
// login IMS/IMS), tudo o que o instalador digita — já com os valores do projeto.
//
// Tópico: o A966 publica em <Tópico>/<ID da SSU>/state. O guia manda configurar
// Tópico = <base>/A966 e ID = SSU → <base>/A966/SSU/state, que é o tópico que o backend
// grava no Medidor Concessionária ligado ao A966 (ensureDeviceEquipamentos).
import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export interface GuiaA966Props {
  valores: Record<string, any>;
  /** Roteador Wi-Fi do projeto (fallback quando o A966 não tem SSID próprio). */
  roteador?: { ssid?: string; password?: string } | null;
  /** Broker do projeto (fallback: broker Aupus). */
  broker?: { ip?: string; port?: number | string } | null;
  /** Nome do Medidor Concessionária ligado ao A966 (null = nenhum ligado). */
  medidorNome?: string | null;
}

const BROKER_PADRAO = '72.60.158.163';
const PORTA_PADRAO = 1883;

/** Tópico que o A966 vai publicar (o backend usa a mesma regra). */
export function topicoA966(valores: Record<string, any>): { topico: string; ssuId: string; publica: string } | null {
  const base = String(valores?.mqtt_topic_base ?? '').trim().replace(/\/+$/, '');
  if (!base) return null;
  const ssuId = String(valores?.ssu_id ?? '').trim() || 'SSU';
  const topico = `${base}/A966`;
  return { topico, ssuId, publica: `${topico}/${ssuId}/state` };
}

function Valor({ rotulo, valor, segredo }: { rotulo: string; valor?: string | number | null; segredo?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const [ver, setVer] = useState(false);
  const txt = valor == null ? '' : String(valor);
  const vazio = txt.trim() === '';
  const copiar = async () => {
    try { await navigator.clipboard.writeText(txt); setCopiado(true); setTimeout(() => setCopiado(false), 1200); } catch { /* sem clipboard */ }
  };
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{rotulo}</span>
      <code
        className={`flex-1 min-w-0 truncate text-xs px-2 py-1 rounded border ${vazio ? 'text-amber-600 border-amber-300' : 'bg-muted/40'}`}
        onClick={() => segredo && setVer((v) => !v)}
        title={segredo ? 'Clique para mostrar/ocultar' : txt}
      >
        {vazio ? 'não preenchido' : segredo && !ver ? '•'.repeat(Math.min(txt.length, 12)) : txt}
      </code>
      {!vazio && (
        <button type="button" onClick={copiar} className="shrink-0 p-1 rounded hover:bg-muted" title="Copiar">
          {copiado ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      )}
    </div>
  );
}

function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold grid place-items-center mt-0.5">{n}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{titulo}</div>
        <div className="mt-1 text-xs text-muted-foreground space-y-0.5">{children}</div>
      </div>
    </li>
  );
}

export const GuiaInstalacaoA966: React.FC<GuiaA966Props> = ({ valores, roteador, broker, medidorNome }) => {
  const t = topicoA966(valores);
  const ssid = String(valores?.wifi_ssid ?? '').trim() || String(roteador?.ssid ?? '').trim();
  const senhaWifi = String(valores?.wifi_senha ?? '').trim() || String(roteador?.password ?? '').trim();
  const brokerIp = String(broker?.ip ?? '').trim() || BROKER_PADRAO;
  const brokerPorta = Number(broker?.port) || PORTA_PADRAO;
  // ID de cliente ÚNICO no broker: dois aparelhos com o mesmo ID (ex.: o "ClientID" de
  // fábrica) se derrubam em loop. Automático = derivado da base da instalação.
  const clientId = String(valores?.client_id ?? '').trim()
    || (t ? `A966-${t.topico.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`.slice(0, 64) : '');
  const ipFixo = String(valores?.ip_modo ?? 'estatico') !== 'dhcp';

  const pendencias = [
    !t && 'Preencha o "Tópico base da instalação".',
    !ssid && 'Informe o Wi-Fi do local (aqui ou num Roteador Wi-Fi do projeto).',
    !medidorNome && 'Ligue o Medidor Concessionária a este A966 no diagrama (é ele que recebe a leitura no NexON).',
    ipFixo && !String(valores?.ip ?? '').trim() && 'IP fixo: escolha um IP livre da rede do local e preencha o campo IP fixo.',
    ipFixo && !String(valores?.gateway ?? '').trim() && 'IP fixo: preencha o Gateway (IP do roteador do local).',
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-3">
      {pendencias.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs text-amber-800 dark:text-amber-200 space-y-0.5">
          {pendencias.map((p) => <div key={p}>• {p}</div>)}
        </div>
      )}
      <ol className="space-y-3">
        <Passo n={1} titulo="Rede (ícone do avião) → Wi-Fi, Ethernet e IP">
          <p>Wi-Fi <b>ligado</b>:</p>
          <Valor rotulo="SSID" valor={ssid} />
          <Valor rotulo="Senha" valor={senhaWifi} segredo />
          <p>Ethernet <b>desligado</b>. IP: {ipFixo ? <><b>DHCP desligado</b> e um IP livre da rede:</> : <><b>DHCP ligado</b> (o roteador dá o IP).</>}</p>
          {ipFixo && (
            <>
              <Valor rotulo="IP" valor={valores?.ip} />
              <Valor rotulo="Máscara" valor={valores?.mascara || '255.255.255.0'} />
              <Valor rotulo="Gateway" valor={valores?.gateway} />
            </>
          )}
          <p>Toque em <b>Salvar</b>.</p>
        </Passo>
        <Passo n={2} titulo="Rede → MQTT Usuário">
          <Valor rotulo="Plataforma" valor="Personalizado" />
          <p>Usuário e senha: pode deixar como estão (o broker Aupus aceita conexão sem login).</p>
          <Valor rotulo="ID Cliente" valor={clientId} />
          <p>Não use o "ClientID" de fábrica: dois aparelhos com o mesmo ID se derrubam no broker. <b>Salvar</b>.</p>
        </Passo>
        <Passo n={3} titulo="Rede → MQTT">
          <p>TLS <b>desligado</b>.</p>
          <Valor rotulo="Broker" valor={brokerIp} />
          <Valor rotulo="Porta" valor={brokerPorta} />
          <Valor rotulo="Tópico" valor={t?.topico} />
          <p><b>Salvar</b>.</p>
        </Passo>
        <Passo n={4} titulo="Interfaces (ícone das chaves) → SSU e Relógio">
          <p>SSU <b>ligado</b>, com o ID:</p>
          <Valor rotulo="ID" valor={t?.ssuId ?? (String(valores?.ssu_id ?? '').trim() || 'SSU')} />
          <p>PULSOS e RS-485 não precisam ser alterados para o medidor da concessionária. Em <b>Relógio</b>, ajuste a hora atual. <b>Salvar</b>.</p>
        </Passo>
        <Passo n={5} titulo="Usuário (ícone da pessoa) → trocar a senha padrão">
          <p>Recomendado: troque o login IMS/IMS (senha antiga <b>IMS</b>, novo usuário e senha) e anote no campo Observação. Só use "Desativar AP" depois de confirmar que os dados chegam no NexON — o AP é o caminho para reconfigurar.</p>
        </Passo>
        <Passo n={6} titulo="Conferir no NexON">
          <p>O A966 publica a cada ~15 min em:</p>
          <Valor rotulo="Tópico final" valor={t?.publica} />
          <p>{medidorNome ? <>A leitura entra no medidor <b>{medidorNome}</b> (o tópico é gravado nele ao salvar o diagrama).</> : 'Ligue o Medidor Concessionária ao A966 para a leitura entrar no NexON.'}</p>
          <p>Firmware de referência do A966: 1.2.3.2466.</p>
        </Passo>
      </ol>
    </div>
  );
};

export default GuiaInstalacaoA966;
