const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * IPv4 literal de rede privada (10/8, 172.16/12, 192.168/16, 169.254/16). O IP vem do
 * aparelho (descoberta na rede), então só vira link ou formulário se passar aqui:
 * nada de host, porta, caminho, `@`, zero à esquerda ou faixa pública.
 */
export function ipPrivadoValido(ip: unknown): ip is string {
  if (typeof ip !== 'string') return false;
  const m = IPV4.exec(ip);
  if (!m) return false;
  const o = m.slice(1).map((p) => (p.length > 1 && p.startsWith('0') ? NaN : Number(p)));
  if (o.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = o;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}
