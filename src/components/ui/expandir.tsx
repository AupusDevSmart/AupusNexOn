import * as React from "react"

import { cn } from "@/lib/utils"

/** Duração padrão de abrir/fechar, igual à dos collapsibles (0.2s). */
export const DURACAO_EXPANDIR_MS = 200

/**
 * Seção que abre e fecha animando a altura, para o padrão
 * `{aberto && <div>...</div>}`. Usa a transição de grid-template-rows
 * (0fr → 1fr), que anima até a altura do conteúdo sem precisar medir nada.
 * O conteúdo continua montado enquanto fecha; depois some da árvore.
 */
export function Expandir({
  aberto,
  children,
  className,
}: {
  aberto: boolean
  children: React.ReactNode
  className?: string
}) {
  const montado = useMontadoAteSair(aberto)
  // Sempre nasce fechado e abre no frame seguinte: é isso que dá à transição
  // um ponto de partida quando o bloco é montado já aberto.
  const [visivel, setVisivel] = React.useState(false)
  React.useEffect(() => {
    if (!aberto) {
      setVisivel(false)
      return
    }
    const id = requestAnimationFrame(() => setVisivel(true))
    return () => cancelAnimationFrame(id)
  }, [aberto])

  if (!montado) return null

  return (
    <div
      aria-hidden={!aberto}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
        visivel ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}

/**
 * Mantém algo montado por `duracao` ms depois de `aberto` virar false, para a
 * animação de saída rodar antes de desmontar.
 */
export function useMontadoAteSair(aberto: boolean, duracao = DURACAO_EXPANDIR_MS) {
  const [montado, setMontado] = React.useState(aberto)
  React.useEffect(() => {
    if (aberto) {
      setMontado(true)
      return
    }
    const id = window.setTimeout(() => setMontado(false), duracao)
    return () => window.clearTimeout(id)
  }, [aberto, duracao])
  return aberto || montado
}

/**
 * Classes para linhas de tabela que entram e saem (<tr> não anima altura):
 * desliza e aparece ao abrir, some ao fechar. `indice` escalona a entrada
 * das linhas filhas em 25 ms cada, até 8 linhas.
 */
export function classesLinhaExpandida(aberto: boolean) {
  return aberto
    ? "animate-in fade-in-0 slide-in-from-top-1 duration-200 fill-mode-both"
    : "animate-out fade-out-0 slide-out-to-top-1 duration-200 fill-mode-forwards"
}

export function atrasoLinha(indice: number): React.CSSProperties {
  return { animationDelay: `${Math.min(indice, 8) * 25}ms` }
}
