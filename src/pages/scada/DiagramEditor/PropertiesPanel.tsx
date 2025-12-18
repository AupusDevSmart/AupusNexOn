import { Equipment, LabelPosition } from "@/types/equipment";
import React from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";

interface PropertiesPanelProps {
  selectedEquipment?: Equipment;
  onUpdateEquipment: (id: string, updates: Partial<Equipment>) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedEquipment,
  onUpdateEquipment,
}) => {
  console.log("📊 PropertiesPanel render:", {
    hasSelectedEquipment: !!selectedEquipment,
    selectedEquipmentId: selectedEquipment?.id,
    selectedEquipmentType: selectedEquipment?.type,
    selectedEquipmentName: selectedEquipment?.data?.name
  });

  if (!selectedEquipment) {
    console.log("⚠️ PropertiesPanel: Nenhum equipamento selecionado");
    return (
      <div className="bg-gray-800 p-4 border-l border-gray-700 h-full">
        <h3 className="text-white font-bold mb-4">Propriedades</h3>
        <p className="text-gray-400 text-sm">Selecione um equipamento para editar suas propriedades</p>
      </div>
    );
  }

  console.log("✅ PropertiesPanel: Renderizando painel para equipamento:", selectedEquipment.id);

  return (
    <div className="bg-gray-800 p-4 border-l border-gray-700 h-full">
      <h3 className="text-white font-bold mb-4">Propriedades</h3>

      <div className="space-y-4">
        <div>
          <label className="text-gray-300 text-sm">Nome</label>
          <input
            type="text"
            value={selectedEquipment.data.name || ""}
            onChange={(e) =>
              onUpdateEquipment(selectedEquipment.id, {
                data: { ...selectedEquipment.data, name: e.target.value },
              })
            }
            className="w-full mt-1 px-3 py-2 bg-gray-700 text-white rounded"
          />
        </div>

        {/* Seletor de Posição do Label */}
        <div>
          <label className="text-gray-300 text-sm mb-2 block">
            Posição do Nome
          </label>
          <div className="flex flex-col items-center gap-1">
            {/* Linha Superior - Botão TOP */}
            <button
              onClick={() =>
                onUpdateEquipment(selectedEquipment.id, {
                  labelPosition: "top",
                })
              }
              className={`p-2 rounded transition-colors ${
                (selectedEquipment.labelPosition || "top") === "top"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-400 hover:bg-gray-600"
              }`}
              title="Nome acima do equipamento"
            >
              <ArrowUp size={16} />
            </button>

            {/* Linha do Meio - LEFT, CENTER (equipamento), RIGHT */}
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  onUpdateEquipment(selectedEquipment.id, {
                    labelPosition: "left",
                  })
                }
                className={`p-2 rounded transition-colors ${
                  selectedEquipment.labelPosition === "left"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                }`}
                title="Nome à esquerda do equipamento"
              >
                <ArrowLeft size={16} />
              </button>

              {/* Centro - Representação do equipamento */}
              <div className="w-10 h-10 bg-gray-600 rounded flex items-center justify-center">
                <div className="w-6 h-6 bg-gray-500 rounded border border-gray-400" />
              </div>

              <button
                onClick={() =>
                  onUpdateEquipment(selectedEquipment.id, {
                    labelPosition: "right",
                  })
                }
                className={`p-2 rounded transition-colors ${
                  selectedEquipment.labelPosition === "right"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                }`}
                title="Nome à direita do equipamento"
              >
                <ArrowRight size={16} />
              </button>
            </div>

            {/* Linha Inferior - Botão BOTTOM */}
            <button
              onClick={() =>
                onUpdateEquipment(selectedEquipment.id, {
                  labelPosition: "bottom",
                })
              }
              className={`p-2 rounded transition-colors ${
                selectedEquipment.labelPosition === "bottom"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-400 hover:bg-gray-600"
              }`}
              title="Nome abaixo do equipamento"
            >
              <ArrowDown size={16} />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            {selectedEquipment.labelPosition === "top" && "Acima"}
            {selectedEquipment.labelPosition === "bottom" && "Abaixo"}
            {selectedEquipment.labelPosition === "left" && "À esquerda"}
            {selectedEquipment.labelPosition === "right" && "À direita"}
            {!selectedEquipment.labelPosition && "Acima (padrão)"}
          </p>
        </div>

        {selectedEquipment.type === "m300" && (
          <>
            <div>
              <label className="text-gray-300 text-sm">Status</label>
              <select
                value={selectedEquipment.data.status || "online"}
                onChange={(e) =>
                  onUpdateEquipment(selectedEquipment.id, {
                    data: {
                      ...selectedEquipment.data,
                      status: e.target.value as Equipment["data"]["status"],
                    },
                  })
                }
                className="w-full mt-1 px-3 py-2 bg-gray-700 text-white rounded"
              >
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="alarm">Alarme</option>
              </select>
            </div>

            <div>
              <label className="text-gray-300 text-sm">Modo Display</label>
              <select
                value={selectedEquipment.data.displayMode || "all"}
                onChange={(e) =>
                  onUpdateEquipment(selectedEquipment.id, {
                    data: {
                      ...selectedEquipment.data,
                      displayMode: e.target
                        .value as Equipment["data"]["displayMode"],
                    },
                  })
                }
                className="w-full mt-1 px-3 py-2 bg-gray-700 text-white rounded"
              >
                <option value="all">Todos (Rotativo)</option>
                <option value="voltage">Tensão</option>
                <option value="current">Corrente</option>
                <option value="power">Potência</option>
              </select>
            </div>
          </>
        )}

        <div className="pt-4 border-t border-gray-700">
          <p className="text-gray-400 text-sm">
            Posição: X: {Math.round(selectedEquipment.position.x)}, Y:{" "}
            {Math.round(selectedEquipment.position.y)}
          </p>
        </div>
      </div>
    </div>
  );
};
