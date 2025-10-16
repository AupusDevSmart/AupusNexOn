import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useEffect } from "react";

interface DiagramaFullscreenProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  titulo?: string;
}

export function DiagramaFullscreen({
  isOpen,
  onClose,
  children,
  titulo = "Diagrama Unifilar"
}: DiagramaFullscreenProps) {
  // Fechar com ESC
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevenir scroll do body quando fullscreen está aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <Card className="h-full w-full rounded-none border-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h3 className="text-lg font-semibold text-foreground">
            {titulo} - Tela Cheia
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Fechar
          </Button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </Card>
    </div>
  );
}