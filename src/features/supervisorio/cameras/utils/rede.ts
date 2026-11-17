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

/** Regra da Intelbras para a senha do admin: 8 a 32 caracteres, com pelo menos dois tipos (letra, número, símbolo). */
export function senhaForteCamera(senha: string): boolean {
  if (senha.length < 8 || senha.length > 32) return false;
  return [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(senha)).length >= 2;
}
