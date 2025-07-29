import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-5 w-5 shrink-0 rounded-sm border-2 shadow-sm transition-colors",
      "border-gray-400 dark:border-gray-500", // Bordas mais visíveis
      "bg-white dark:bg-gray-800", // Fundo claro/escuro mais diferenciado
      "ring-offset-white dark:ring-offset-gray-950", // Offset de ring adaptado ao tema
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400 focus-visible:ring-offset-2", // Focus state mais visível
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500", // Cor quando marcado
      "data-[state=checked]:border-blue-600 dark:data-[state=checked]:border-blue-500", // Borda quando marcado
      "data-[state=checked]:text-white dark:data-[state=checked]:text-white", // Texto do check sempre branco para contraste
      "hover:border-blue-500 dark:hover:border-blue-400", // Efeito hover
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator 
      className={cn(
        "flex items-center justify-center text-current",
        "text-white dark:text-white" // Garantir que o ícone seja branco em ambos os temas quando marcado
      )}
    >
      <CheckIcon className="h-3.5 w-3.5 stroke-[3px]" /> {/* Ícone mais grosso para melhor visibilidade */}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }