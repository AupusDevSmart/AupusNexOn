// components/equipment/EquipmentLabel.tsx
import React from "react";
import { LabelPosition } from "@/types/equipment";

interface EquipmentLabelProps {
  name: string;
  position?: LabelPosition;
  children: React.ReactNode;
}

/**
 * Componente que envolve um equipamento e posiciona seu label (nome)
 * de acordo com a posição especificada.
 *
 * @param name - Nome do equipamento a ser exibido
 * @param position - Posição do label: 'top' | 'bottom' | 'left' | 'right' (padrão: 'top')
 * @param children - Componente do equipamento (M300, M160, etc.)
 */
export const EquipmentLabel: React.FC<EquipmentLabelProps> = ({
  name,
  position = "top",
  children,
}) => {
  const labelClasses = "text-white font-bold text-sm whitespace-nowrap";

  // Layout Vertical (TOP ou BOTTOM)
  if (position === "top" || position === "bottom") {
    return (
      <div className="flex flex-col items-center gap-2">
        {position === "top" && <h3 className={labelClasses}>{name}</h3>}
        {children}
        {position === "bottom" && <h3 className={labelClasses}>{name}</h3>}
      </div>
    );
  }

  // Layout Horizontal (LEFT ou RIGHT)
  return (
    <div className="flex items-center gap-3">
      {position === "left" && <h3 className={labelClasses}>{name}</h3>}
      {children}
      {position === "right" && <h3 className={labelClasses}>{name}</h3>}
    </div>
  );
};
