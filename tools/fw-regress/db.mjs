// Acesso ao banco (via psql, sem dependência node) e reconstrução dos INPUTS que
// o browser alimenta no gerador:
//   - diagrama  = iot_projetos.diagrama (JSONB) — o mesmo cache que o editor.fromJSON()
//     consome; como o fromJSON só CLONA (components/connections), alimentar o gerador
//     com { components, connections } é byte-fiel ao browser.
//   - bombaIoMap = réplica FIEL de buildBombaIoMap() do iot-diagram.tsx (mesmos regexes
//     de papel), pros tipos bomba/carregador. Só afeta esses componentes.

import { execFileSync } from 'node:child_process';

const PG = {
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || '5433',
  user: process.env.PGUSER || 'postgres',
  db: process.env.PGDATABASE || 'aupus',
  pass: process.env.PGPASSWORD || 'postgres123',
};

const ID_RE = /^[a-z0-9]+$/i; // cuid-like; barra qualquer coisa fora disso (anti-injeção)

function psql(sql) {
  const out = execFileSync(
    'psql',
    ['-h', PG.host, '-p', PG.port, '-U', PG.user, '-d', PG.db, '-tAc', sql],
    { env: { ...process.env, PGPASSWORD: PG.pass }, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );
  return out.trim();
}

/** Roda uma query que retorna UM valor json (via json_agg/to_json) e faz parse. */
function psqlJson(sql) {
  const raw = psql(sql);
  if (!raw) return null;
  return JSON.parse(raw);
}

function assertId(id) {
  const t = String(id || '').trim();
  if (!ID_RE.test(t)) throw new Error(`id inválido (anti-injeção): ${JSON.stringify(id)}`);
  return t;
}

/** Projetos com ao menos um componente TON no diagrama. */
export function listTonProjects() {
  return psqlJson(`
    SELECT COALESCE(json_agg(json_build_object('id', TRIM(p.id), 'nome', COALESCE(p.nome,'(sem nome)'))
             ORDER BY p.nome, TRIM(p.id)), '[]'::json)
    FROM iot_projetos p
    WHERE p.diagrama IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(p.diagrama->'components','[]'::jsonb)) c
        WHERE lower(c->>'type') LIKE 'ton%'
      )`) || [];
}

/** O diagrama (JSONB) de um projeto: { components, connections, ... }. */
export function getDiagrama(projectId) {
  const id = assertId(projectId);
  return psqlJson(`SELECT to_json(p.diagrama) FROM iot_projetos p WHERE TRIM(p.id) = '${id}'`);
}

// --- Réplica de buildBombaIoMap() do iot-diagram.tsx (papéis por nome do ponto) ---
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function boRole(nome) {
  const n = norm(nome);
  if (/deslig/.test(n)) return 'desliga';
  if (/\blig|acion|partid/.test(n)) return 'liga';
  if (/solenoid|valvul|bloque/.test(n)) return 'solenoide';
  if (/desabilit/.test(n)) return 'desabilitar';
  if (/habilit|energiz|carga/.test(n)) return 'habilitar';
  return null;
}
function biRole(nome) {
  const n = norm(nome);
  if (/cart|rfid|leitor|tag/.test(n)) return 'cartao';
  if (/emerg|estop|parad|seg/.test(n)) return 'estop';
  if (/conect|plug|pilot|acoplad/.test(n)) return 'conectado';
  return null;
}
function aiRole(nome) {
  const n = norm(nome);
  if (/nivel|tanque|level|volume/.test(n)) return 'nivel';
  return null;
}

/**
 * FASE 6 — projeção `iot_vinculos` (modbus_bo) → io_config.bo, por equipamento-fonte (relé).
 * Devolve { [relayEquipId]: { [sinal]: { ...params, ponto_id } } } — a MESMA forma que o
 * gerador consome em props.io_config.bo (mas vinda da tabela unificada). Ordenado por `sinal`
 * (cuid ~monotônico = ordem de criação) pra casar a ordem de inserção do io_config original.
 * `_mergeIoBo` lê só coil/func/register/addr/count/value/hold/rearm_ms — tudo preservado em params.
 */
export function getModbusBoByEquip() {
  const rows = psqlJson(`
    SELECT COALESCE(json_agg(json_build_object(
             'relay', TRIM(v.fonte_equipamento_id),
             'sinal', v.sinal,
             'ponto_id', TRIM(v.equipamento_ponto_id),
             'equip_dono', TRIM(p.equipamento_id),
             'params', v.params
           ) ORDER BY TRIM(v.fonte_equipamento_id), v.sinal), '[]'::json)
    FROM iot_vinculos v
    JOIN equipamento_pontos p ON p.id = v.equipamento_ponto_id
    WHERE v.fonte_tipo = 'modbus_bo' AND v.ativo = true AND v.deleted_at IS NULL`) || [];
  const byEquip = {};
  for (const r of rows) {
    const bo = (byEquip[r.relay] ||= {});
    bo[r.sinal] = { ...(r.params || {}), ponto_id: r.ponto_id, ...(r.equip_dono ? { equipamento_id: r.equip_dono } : {}) };
  }
  return byEquip;
}

/**
 * Reconstrói _bombaIoByEquip pros TONs presentes nos componentes do projeto.
 * Chave = equipamento_id do PONTO (a bomba/carregador). Espelha buildBombaIoMap.
 */
export function buildBombaIoMap(components) {
  const map = {};
  const tonEqIds = Array.from(new Set(
    (components || [])
      .filter((c) => typeof c.type === 'string' && c.type.startsWith('ton') && (c.props?.equipamento_id || '').trim())
      .map((c) => String(c.props.equipamento_id).trim()),
  ));
  if (tonEqIds.length === 0) return map;
  const inList = tonEqIds.map(assertId).map((x) => `'${x}'`).join(',');

  const rows = psqlJson(`
    WITH ch AS (
      SELECT 'bo' AS kind, b.bo_numero AS numero, b.ativo, NULL::int AS mv0, NULL::int AS mv100,
             p.nome AS ponto_nome, TRIM(p.equipamento_id) AS ponto_eq
      FROM ton_bo b JOIN equipamento_pontos p ON p.id = b.equipamento_ponto_id
      WHERE TRIM(b.ton_id) IN (${inList}) AND b.deleted_at IS NULL
      UNION ALL
      SELECT 'bi', b.bi_numero, b.ativo, NULL, NULL, p.nome, TRIM(p.equipamento_id)
      FROM ton_bi b JOIN equipamento_pontos p ON p.id = b.equipamento_ponto_id
      WHERE TRIM(b.ton_id) IN (${inList}) AND b.deleted_at IS NULL
      UNION ALL
      SELECT 'ai', a.ai_numero, a.ativo, a.mv_0, a.mv_100, p.nome, TRIM(p.equipamento_id)
      FROM ton_ai a JOIN equipamento_pontos p ON p.id = a.equipamento_ponto_id
      WHERE TRIM(a.ton_id) IN (${inList}) AND a.deleted_at IS NULL
    )
    SELECT COALESCE(json_agg(row_to_json(ch)), '[]'::json) FROM ch`) || [];

  for (const r of rows) {
    if (!r.ativo || !r.ponto_eq) continue;
    const eq = String(r.ponto_eq).trim();
    if (r.kind === 'bo') {
      const role = boRole(r.ponto_nome); if (!role) continue;
      (map[eq] ||= { bo: {}, bi: {}, ai: {} }).bo[role] = r.numero;
    } else if (r.kind === 'bi') {
      const role = biRole(r.ponto_nome); if (!role) continue;
      (map[eq] ||= { bo: {}, bi: {}, ai: {} }).bi[role] = r.numero;
    } else {
      const role = aiRole(r.ponto_nome); if (!role) continue;
      (map[eq] ||= { bo: {}, bi: {}, ai: {} }).ai[role] = { ch: r.numero, mv0: r.mv0, mv100: r.mv100 };
    }
  }
  return map;
}
