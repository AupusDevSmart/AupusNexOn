import { cn } from "@/lib/utils"

// Cor de paleta, não token: as cores do tema são var(--x) sem <alpha-value>, então
// `bg-primary/10` não gerava CSS e o skeleton saía invisível.
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-900/10 dark:bg-white/10", className)}
      {...props}
    />
  )
}

export { Skeleton }
