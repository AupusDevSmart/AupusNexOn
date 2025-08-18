// src/features/financeiro/components/centros-custo-modal.tsx
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CentroCusto, CentroCustoFormData } from '@/types/dtos/financeiro';

interface CentrosCustoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CentroCustoFormData) => void;
  editingItem: CentroCusto | null;
  centrosPai: CentroCusto[];
}

export function CentrosCustoModal({
  isOpen,
  onClose,
  onSave,
  editingItem,
  centrosPai
}: CentrosCustoModalProps): JSX.Element {
  const [formData, setFormData] = useState<CentroCustoFormData>({
    codigo: '',
    nome: '',
    tipo: 'administrativo',
    status: 'ativo',
    centroPai: null,
    responsavel: '',
    email: '',
    orcamentoMensal: 0,
    descricao: ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CentroCustoFormData, string>>>({});

  // Resetar form quando modal abrir/fechar
  useEffect(() => {
    if (isOpen) {
      if (editingItem) {
        setFormData({
          codigo: editingItem.codigo,
          nome: editingItem.nome,
          tipo: editingItem.tipo,
          status: editingItem.status,
          centroPai: editingItem.centroPai,
          responsavel: editingItem.responsavel,
          email: editingItem.email,
          orcamentoMensal: editingItem.orcamentoMensal,
          descricao: editingItem.descricao
        });
      } else {
        setFormData({
          codigo: '',
          nome: '',
          tipo: 'administrativo',
          status: 'ativo',
          centroPai: null,
          responsavel: '',
          email: '',
          orcamentoMensal: 0,
          descricao: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, editingItem]);

  // Validação do formulário
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CentroCustoFormData, string>> = {};

    if (!formData.codigo.trim()) {
      newErrors.codigo = 'Código é obrigatório';
    }

    if (!formData.nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    if (!formData.responsavel.trim()) {
      newErrors.responsavel = 'Responsável é obrigatório';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'E-mail inválido';
    }

    if (formData.orcamentoMensal < 0) {
      newErrors.orcamentoMensal = 'Orçamento deve ser positivo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    
    if (validateForm()) {
      onSave(formData);
    }
  };

  // Handle input changes
  const handleInputChange = (field: keyof CentroCustoFormData, value: any): void => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Limpar erro do campo quando usuário começar a digitar
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
          </DialogTitle>
          <DialogDescription>
            {editingItem 
              ? 'Edite as informações do centro de custo selecionado.'
              : 'Preencha as informações para criar um novo centro de custo.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Código */}
            <div className="space-y-2">
              <Label htmlFor="codigo">Código *</Label>
              <Input
                id="codigo"
                value={formData.codigo}
                onChange={(e) => handleInputChange('codigo', e.target.value)}
                placeholder="Ex: CC001"
                className={errors.codigo ? 'border-red-500' : ''}
              />
              {errors.codigo && (
                <p className="text-sm text-red-500">{errors.codigo}</p>
              )}
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select value={formData.status} onValueChange={(value: CentroCusto['status']) => handleInputChange('status', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Centro *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => handleInputChange('nome', e.target.value)}
              placeholder="Ex: Administração Geral"
              className={errors.nome ? 'border-red-500' : ''}
            />
            {errors.nome && (
              <p className="text-sm text-red-500">{errors.nome}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Tipo */}
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select value={formData.tipo} onValueChange={(value: CentroCusto['tipo']) => handleInputChange('tipo', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrativo">Administrativo</SelectItem>
                  <SelectItem value="operacional">Operacional</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="projeto">Projeto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Centro Pai */}
            <div className="space-y-2">
              <Label htmlFor="centroPai">Centro Pai</Label>
              <Select 
                value={formData.centroPai?.toString() || 'none'} 
                onValueChange={(value) => handleInputChange('centroPai', value === 'none' ? null : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (Centro Principal)</SelectItem>
                  {centrosPai.map((centro) => (
                    <SelectItem key={centro.id} value={centro.id.toString()}>
                      {centro.codigo} - {centro.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Responsável */}
            <div className="space-y-2">
              <Label htmlFor="responsavel">Responsável *</Label>
              <Input
                id="responsavel"
                value={formData.responsavel}
                onChange={(e) => handleInputChange('responsavel', e.target.value)}
                placeholder="Nome do responsável"
                className={errors.responsavel ? 'border-red-500' : ''}
              />
              {errors.responsavel && (
                <p className="text-sm text-red-500">{errors.responsavel}</p>
              )}
            </div>

            {/* E-mail */}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="email@empresa.com"
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email}</p>
              )}
            </div>
          </div>

          {/* Orçamento Mensal */}
          <div className="space-y-2">
            <Label htmlFor="orcamentoMensal">Orçamento Mensal (R$)</Label>
            <Input
              id="orcamentoMensal"
              type="number"
              min="0"
              step="0.01"
              value={formData.orcamentoMensal}
              onChange={(e) => handleInputChange('orcamentoMensal', parseFloat(e.target.value) || 0)}
              placeholder="0,00"
              className={errors.orcamentoMensal ? 'border-red-500' : ''}
            />
            {errors.orcamentoMensal && (
              <p className="text-sm text-red-500">{errors.orcamentoMensal}</p>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => handleInputChange('descricao', e.target.value)}
              placeholder="Descreva o propósito deste centro de custo..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-success hover:bg-success/90">
              {editingItem ? 'Atualizar' : 'Criar'} Centro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}