/**
 * EQUIPMENT EDIT MODAL - Modal para editar equipamento
 *
 * Funcionalidades:
 * - Editar nome e tag do equipamento
 * - Configurar MQTT (habilitado e tópico)
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { Equipment } from '../types/diagram.types';

interface EquipmentEditModalProps {
  equipment: Equipment | null;
  open: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Equipment>) => void;
}

export const EquipmentEditModal: React.FC<EquipmentEditModalProps> = ({
  equipment,
  open,
  onClose,
  onSave,
}) => {
  const [nome, setNome] = useState('');
  const [tag, setTag] = useState('');
  const [mqttHabilitado, setMqttHabilitado] = useState(false);
  const [topicoMqtt, setTopicoMqtt] = useState('');

  useEffect(() => {
    if (equipment) {
      setNome(equipment.nome);
      setTag(equipment.tag);
      setMqttHabilitado(equipment.mqttHabilitado || false);
      setTopicoMqtt(equipment.topicoMqtt || '');
    }
  }, [equipment]);

  const handleSave = () => {
    if (!equipment) return;

    onSave({
      nome: nome.trim(),
      tag: tag.trim(),
      mqttHabilitado,
      topicoMqtt: topicoMqtt.trim(),
    });

    onClose();
  };

  if (!equipment) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Equipamento</DialogTitle>
          <DialogDescription>
            Altere as propriedades do equipamento {equipment.tipo}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do equipamento"
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tag">Tag/Identificação</Label>
            <Input
              id="tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Ex: INV-001"
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="mqttHabilitado"
                checked={mqttHabilitado}
                onCheckedChange={(checked) => setMqttHabilitado(checked === true)}
              />
              <Label
                htmlFor="mqttHabilitado"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                MQTT Habilitado
              </Label>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="topicoMqtt">Tópico MQTT</Label>
            <Input
              id="topicoMqtt"
              value={topicoMqtt}
              onChange={(e) => setTopicoMqtt(e.target.value)}
              placeholder="Ex: equipamentos/inversor/01"
              disabled={!mqttHabilitado}
            />
          </div>

          <div className="grid gap-2">
            <Label>Tipo</Label>
            <div className="px-3 py-2 bg-muted rounded-md text-sm">
              {equipment.tipo}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!nome.trim() || !tag.trim()}>
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
