/**
 * DIAGRAM HEADER - Header Minimalista do Diagrama
 *
 * Responsabilidades:
 * - Exibir título e subtítulo do diagrama
 * - Botão de voltar
 * - Indicador de alterações não salvas
 * - Toggle de tema (light/dark)
 * - Botão de salvar
 *
 * @author Claude Code
 * @version 2.0.0
 * @date 2026-02-02
 */

import React from 'react';
import { ArrowLeft, Save, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDiagramStore } from '@/features/supervisorio/v2/hooks/useDiagramStore';

interface DiagramHeaderProps {
  title: string;
  subtitle?: string;
  isDirty: boolean;
  onBack: () => void;
  onSave: () => void;
}

/**
 * Header minimalista para o diagrama
 * Inspirado na foto de referência fornecida pelo usuário
 */
export function DiagramHeader({
  title,
  subtitle,
  isDirty,
  onBack,
  onSave,
}: DiagramHeaderProps) {
  const theme = useDiagramStore(state => state.theme);
  const toggleTheme = useDiagramStore(state => state.toggleTheme);

  return (
    <header className="border-b bg-card">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left: Back Button + Title */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            title="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: Indicators + Actions */}
        <div className="flex items-center gap-3">
          {/* Dirty Indicator (Não Salvo) */}
          {isDirty && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20">
              <span className="w-2 h-2 rounded-full bg-amber-500 mr-2 animate-pulse" />
              Não salvo
            </Badge>
          )}

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            title="Alternar tema"
          >
            {theme === 'light' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </Button>

          {/* Save Button */}
          <Button
            onClick={onSave}
            disabled={!isDirty}
            title="Salvar diagrama (Ctrl+S)"
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </div>
      </div>
    </header>
  );
}
