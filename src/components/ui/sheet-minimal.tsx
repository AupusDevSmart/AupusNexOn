/**
 * SHEET MINIMAL - Painel lateral profissional
 *
 * Características:
 * - Abre da direita para esquerda
 * - Ocupa 50% da tela por padrão (customizável)
 * - Design minimalista e discreto
 * - Overlay sutil
 */

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      // Overlay muito sutil - preto com 20% opacidade + blur mínimo
      "fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px]",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> {
  size?: "sm" | "default" | "lg" | "full"
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ size = "default", className, children, ...props }, ref) => {
  // Tamanhos discretos
  const sizeClasses = {
    sm: "max-w-[400px]",      // 400px - pequeno
    default: "max-w-[50vw]",  // 50% da tela - padrão
    lg: "max-w-[70vw]",       // 70% da tela - grande
    full: "max-w-full",       // tela inteira
  }

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={ref}
        className={cn(
          // Posicionamento: fixo à direita
          "fixed right-0 top-0 z-50 h-full",
          // Tamanho responsivo
          sizeClasses[size],
          "w-full",
          // Estilo minimalista
          "border-l border-border bg-background",
          // Sombra sutil
          "shadow-2xl",
          // Animações suaves (direita para esquerda)
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          "duration-300",
          // Layout interno
          "flex flex-col",
          className
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
})
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Header fixo no topo
      "flex items-center justify-between",
      // Padding profissional
      "px-6 py-4",
      // Borda sutil
      "border-b border-border",
      // Background levemente diferente
      "bg-muted/30",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Corpo com scroll
      "flex-1 overflow-y-auto",
      // Padding profissional
      "px-6 py-6",
      // Scrollbar customizada
      "scrollbar-minimal",
      className
    )}
    {...props}
  />
)
SheetBody.displayName = "SheetBody"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Footer fixo no bottom
      "flex items-center justify-end gap-3",
      // Padding profissional
      "px-6 py-4",
      // Borda sutil
      "border-t border-border",
      // Background levemente diferente
      "bg-muted/30",
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn(
      // Typography profissional
      "text-lg font-semibold text-foreground",
      className
    )}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn(
      // Texto secundário discreto
      "text-sm text-muted-foreground",
      className
    )}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

const SheetCloseButton = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Close>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Close
    ref={ref}
    className={cn(
      // Botão de fechar minimalista
      "rounded p-1.5",
      // Hover sutil
      "transition-colors hover:bg-muted",
      // Focus discreto
      "focus:outline-none focus:ring-1 focus:ring-ring",
      // Ícone
      "text-muted-foreground hover:text-foreground",
      className
    )}
    {...props}
  >
    <X className="h-4 w-4" />
    <span className="sr-only">Fechar</span>
  </SheetPrimitive.Close>
))
SheetCloseButton.displayName = "SheetCloseButton"

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetCloseButton,
}
