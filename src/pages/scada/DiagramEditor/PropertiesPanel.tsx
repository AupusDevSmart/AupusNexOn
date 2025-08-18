import { Equipment } from "@/types/equipment";
import React from "react";

interface PropertiesPanelProps {
  selectedEquipment?: Equipment;
  onUpdateEquipment: (id: string, updates: Partial<Equipment>) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedEquipment,
  onUpdateEquipment,
}) => {
  if (!selectedEquipment) {
    return (
      <div className="bg-gray-800 p-4 border-l border-gray-700">
        <h3 className="text-white font-bold mb-4">Propriedades</h3>
        <p className="text-gray-400 text-sm">Selecione um equipamento</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-4 border-l border-gray-700">
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
