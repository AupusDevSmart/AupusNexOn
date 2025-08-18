import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

interface DetailedViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  loading?: boolean;
  children: React.ReactNode;
  footerContent?: React.ReactNode;
  maxWidth?: string;
}

export function DetailedViewModal({
  isOpen,
  onClose,
  title,
  description,
  loading = false,
  children,
  footerContent,
  maxWidth = "max-w-4xl",
}: DetailedViewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${maxWidth} h-[90vh] flex flex-col`}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-auto my-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">Carregando dados...</p>
            </div>
          ) : (
            <div>{children}</div>
          )}
        </div>

        <DialogFooter className="border-t pt-4 flex-shrink-0">
          {footerContent || (
            <Button onClick={onClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}