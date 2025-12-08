import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Zap } from 'lucide-react';
import { tiposEquipamentosApi } from '@/services/tipos-equipamentos.services';
import type { EquipamentoApiResponse } from '@/services/equipamentos.services';

interface TipoEquipamento {
  id: string;
  codigo: string;
  nome: string;
  categoria?: string;
}

interface ModalCriarEquipamentoRapidoProps {
  open: boolean;
  onClose: () => void;
  onEquipamentoCriado: (equipamento: EquipamentoApiResponse) => void;
  unidadeId: string;
}

export function ModalCriarEquipamentoRapido({
  open,
  onClose,
  onEquipamentoCriado,
  unidadeId
}: ModalCriarEquipamentoRapidoProps) {
  const [loading, setLoading] = useState(false);
  const [tiposEquipamentos, setTiposEquipamentos] = useState<TipoEquipamento[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(true);

  const [formData, setFormData] = useState({
    tipo_equipamento_id: '',
    nome: '',
    tag: ''
  });

  // Carregar tipos de equipamentos quando modal abre
  useEffect(() => {
    if (open) {
      carregarTipos();
    }
  }, [open]);

  const carregarTipos = async () => {
    try {
      setLoadingTipos(true);
      const tipos = await tiposEquipamentosApi.getAll();
      console.log('✅ Tipos carregados:', tipos);
      setTiposEquipamentos(tipos);
    } catch (error) {
      console.error('❌ Erro ao carregar tipos:', error);
      alert('Erro ao carregar tipos de equipamentos');
    } finally {
      setLoadingTipos(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.tipo_equipamento_id) {
      alert('Selecione o tipo de equipamento');
      return;
    }

    setLoading(true);

    try {
      const { equipamentosApi } = await import('@/services/equipamentos.services');
      const response = await equipamentosApi.criarEquipamentoRapido(
        unidadeId,
        formData.tipo_equipamento_id,
        formData.nome || undefined,
        formData.tag || undefined
      );

      console.log('✅ Equipamento criado:', response.data);

      onEquipamentoCriado(response.data);
      handleClose();
    } catch (error: any) {
      console.error('❌ Erro ao criar equipamento:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Erro desconhecido';
      alert(`Erro ao criar equipamento: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ tipo_equipamento_id: '', nome: '', tag: '' });
    onClose();
  };

  // Agrupar tipos por categoria
  const tiposPorCategoria = tiposEquipamentos.reduce((acc, tipo) => {
    const categoria = tipo.categoria || 'Outros';
    if (!acc[categoria]) {
      acc[categoria] = [];
    }
    acc[categoria].push(tipo);
    return acc;
  }, {} as Record<string, TipoEquipamento[]>);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Zap className="h-5 w-5 text-yellow-500" />
            Criar Equipamento Rápido
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Crie um equipamento com dados mínimos para adicionar ao diagrama agora.
            Você pode completar as informações depois na página de cadastro.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de Equipamento */}
          <div className="space-y-2">
            <Label htmlFor="tipo" className="text-sm font-medium">
              Tipo de Equipamento <span className="text-red-500">*</span>
            </Label>
            {loadingTipos ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando tipos...
              </div>
            ) : (
              <Select
                value={formData.tipo_equipamento_id}
                onValueChange={(value) => setFormData({ ...formData, tipo_equipamento_id: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(tiposPorCategoria).map(([categoria, tipos]) => (
                    <div key={categoria}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {categoria}
                      </div>
                      {tipos.map((tipo) => (
                        <SelectItem key={tipo.id} value={tipo.id}>
                          {tipo.nome} ({tipo.codigo})
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Nome (Opcional) */}
          <div className="space-y-2">
            <Label htmlFor="nome" className="text-sm font-medium">
              Nome (opcional)
            </Label>
            <Input
              id="nome"
              placeholder="Deixe vazio para gerar automaticamente"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Se não preencher, será gerado automaticamente (ex: "Medidor 1")
            </p>
          </div>

          {/* TAG (Opcional) */}
          <div className="space-y-2">
            <Label htmlFor="tag" className="text-sm font-medium">
              TAG (opcional)
            </Label>
            <Input
              id="tag"
              placeholder="Ex: MED-001"
              value={formData.tag}
              onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
              className="w-full"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || loadingTipos || !formData.tipo_equipamento_id}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Criar e Adicionar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
