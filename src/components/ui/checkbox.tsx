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
      // Unchecked state: borda neutra
      "border-gray-300 dark:border-gray-600",
      "bg-transparent",
      "ring-offset-white dark:ring-offset-gray-950",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:focus-visible:ring-gray-500 focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      // Checked state: Light mode = fundo preto + sinal branco | Dark mode = fundo branco + sinal preto
      "data-[state=checked]:bg-black dark:data-[state=checked]:bg-white",
      "data-[state=checked]:border-black dark:data-[state=checked]:border-white",
      "data-[state=checked]:text-white dark:data-[state=checked]:text-black",
      // Hover state
      "hover:border-gray-400 dark:hover:border-gray-500",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn(
        "flex items-center justify-center text-current"
      )}
    >
      <CheckIcon className="h-3.5 w-3.5 stroke-[3px]" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }