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
      "peer h-5 w-5 shrink-0 rounded border-2 shadow-sm transition-all duration-200",
      // Unchecked state: fundo branco com borda escura (light) / fundo cinza claro com borda branca (dark)
      "border-gray-500 dark:border-gray-400",
      "bg-white dark:bg-gray-700",
      "ring-offset-white dark:ring-offset-gray-950",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:focus-visible:ring-gray-500 focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      // Checked state: PRETO com check BRANCO (light mode) | BRANCO com check PRETO (dark mode)
      "data-[state=checked]:bg-black dark:data-[state=checked]:bg-white",
      "data-[state=checked]:border-black dark:data-[state=checked]:border-white",
      "data-[state=checked]:text-white dark:data-[state=checked]:text-black",
      // Hover state
      "hover:border-gray-600 dark:hover:border-gray-300",
      "hover:shadow-md",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn(
        "flex items-center justify-center text-current"
      )}
    >
      <CheckIcon className="h-4 w-4 stroke-[3px]" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }