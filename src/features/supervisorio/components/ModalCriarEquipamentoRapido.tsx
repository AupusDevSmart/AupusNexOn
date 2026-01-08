import { useState, useEffect, useMemo } from 'react';
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
import { Loader2, Zap, Info } from 'lucide-react';
import { useCategorias } from '@/hooks/useCategorias';
import { useModelos } from '@/hooks/useModelos';
import type { EquipamentoApiResponse } from '@/services/equipamentos.services';

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
  const [categoriaId, setCategoriaId] = useState<string>('');

  const [formData, setFormData] = useState({
    tipo_equipamento_id: '',
    nome: '',
    tag: ''
  });

  // Buscar categorias
  const { categorias, loading: loadingCategorias } = useCategorias();

  // Buscar modelos filtrados pela categoria selecionada
  const { modelos, loading: loadingModelos } = useModelos({
    categoriaId: categoriaId || undefined,
    autoFetch: !!categoriaId,
  });

  // Reset do form quando modal abre/fecha
  useEffect(() => {
    if (!open) {
      setCategoriaId('');
      setFormData({ tipo_equipamento_id: '', nome: '', tag: '' });
    }
  }, [open]);

  // Modelo selecionado
  const modeloSelecionado = useMemo(() => {
    return modelos.find(m => m.id === formData.tipo_equipamento_id);
  }, [modelos, formData.tipo_equipamento_id]);

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
    onClose();
  };

  // Handler para mudança de categoria - reseta o modelo selecionado
  const handleCategoriaChange = (value: string) => {
    setCategoriaId(value);
    setFormData({ ...formData, tipo_equipamento_id: '' }); // Reset modelo
  };

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
          {/* Categoria de Equipamento */}
          <div className="space-y-2">
            <Label htmlFor="categoria" className="text-sm font-medium">
              Categoria <span className="text-red-500">*</span>
            </Label>
            {loadingCategorias ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando categorias...
              </div>
            ) : (
              <Select value={categoriaId} onValueChange={handleCategoriaChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Modelo (Tipo de Equipamento) */}
          <div className="space-y-2">
            <Label htmlFor="modelo" className="text-sm font-medium">
              Modelo <span className="text-red-500">*</span>
            </Label>
            {!categoriaId ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 px-3 bg-muted/50 rounded-md">
                <Info className="h-3.5 w-3.5" />
                Selecione uma categoria primeiro
              </div>
            ) : loadingModelos ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando modelos...
              </div>
            ) : (
              <Select
                value={formData.tipo_equipamento_id}
                onValueChange={(value) => setFormData({ ...formData, tipo_equipamento_id: value })}
                disabled={!categoriaId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o modelo" />
                </SelectTrigger>
                <SelectContent>
                  {modelos.map((modelo) => (
                    <SelectItem key={modelo.id} value={modelo.id}>
                      {modelo.nome} | {modelo.fabricante}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Fabricante (Auto-preenchido) */}
          {modeloSelecionado && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Fabricante</Label>
              <div className="px-3 py-2 bg-muted/50 rounded-md text-sm">
                {modeloSelecionado.fabricante}
              </div>
            </div>
          )}

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
              disabled={loading || loadingCategorias || loadingModelos || !categoriaId || !formData.tipo_equipamento_id}
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
