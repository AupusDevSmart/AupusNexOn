// src/features/financeiro/components/form-tabs.tsx
import { useRef, useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Paperclip, X, Upload, File } from 'lucide-react';

// Interface para representar um anexo
interface Anexo {
  id: string;
  nome: string;
  tamanho: string;
  tipo: string;
  arquivo?: File;
}

// Propriedades atualizadas do componente
interface FormTabsProps {
  activeTab: string;
  setActiveTab: (value: string) => void;
  observacoes: string;
  onObservacoesChange: (value: string) => void;
  anexos?: Anexo[];
  onAnexosChange?: (anexos: Anexo[]) => void;
}

export function FormTabs({ 
  activeTab, 
  setActiveTab, 
  observacoes, 
  onObservacoesChange,
  anexos = [], 
  onAnexosChange = () => {}
}: FormTabsProps) {
  // Estado local para debug e visualização dos anexos
  const [localAnexos, setLocalAnexos] = useState<Anexo[]>(anexos);
  
  // Atualiza os anexos locais quando os props mudam
  useEffect(() => {
    setLocalAnexos(anexos);
  }, [anexos]);
  
  // Referência para o input de arquivo oculto
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Função para lidar com a seleção de arquivos
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const novosAnexos: Anexo[] = [];
    
    // Converter os arquivos selecionados em objetos Anexo
    Array.from(files).forEach(file => {
      // Formatar o tamanho do arquivo para exibição
      const tamanhoEmKB = file.size / 1024;
      const tamanhoFormatado = tamanhoEmKB < 1024 
        ? `${tamanhoEmKB.toFixed(2)} KB`
        : `${(tamanhoEmKB / 1024).toFixed(2)} MB`;
      
      novosAnexos.push({
        id: `anexo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        nome: file.name,
        tamanho: tamanhoFormatado,
        tipo: file.type,
        arquivo: file
      });
    });
    
    // Atualizar a lista de anexos local
    const updatedAnexos = [...localAnexos, ...novosAnexos];
    setLocalAnexos(updatedAnexos);
    
    // Atualizar através do callback
    onAnexosChange(updatedAnexos);
    
    // Limpar o input para permitir selecionar o mesmo arquivo novamente
    if (event.target) {
      event.target.value = '';
    }
    
    // Automaticamente muda para a aba de anexos para mostrar os arquivos adicionados
    setActiveTab('anexo');
    
    // Debug para verificar os anexos
    console.log('Anexos adicionados:', novosAnexos);
    console.log('Total de anexos:', updatedAnexos);
  };
  
  // Função para remover um anexo
  const handleRemoveAnexo = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const updatedAnexos = localAnexos.filter(anexo => anexo.id !== id);
    
    // Atualizar localmente
    setLocalAnexos(updatedAnexos);
    
    // Atualizar através do callback
    onAnexosChange(updatedAnexos);
    
    // Debug para verificar a remoção
    console.log('Anexo removido:', id);
    console.log('Anexos restantes:', updatedAnexos);
  };
  
  // Função para abrir o seletor de arquivos
  const handleOpenFileSelector = (e: React.MouseEvent) => {
    // Previne a propagação do evento para o formulário
    e.preventDefault();
    e.stopPropagation();
    
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Debug: Verificar os anexos que estão sendo renderizados
  useEffect(() => {
    console.log('Renderizando anexos:', localAnexos);
  }, [localAnexos]);
  
  return (
    <Tabs defaultValue="observacoes" className="w-full" onValueChange={setActiveTab} value={activeTab}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="observacoes">Observações</TabsTrigger>
        <TabsTrigger value="anexo">
          Anexos
          {localAnexos.length > 0 && (
            <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              {localAnexos.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="observacoes" className="space-y-2 pt-4">
        <Textarea 
          placeholder="Descreva observações relevantes sobre esse lançamento financeiro" 
          className="min-h-[100px]"
          value={observacoes}
          onChange={(e) => onObservacoesChange(e.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          Descreva observações relevantes sobre esse lançamento financeiro
        </p>
      </TabsContent>
      
      <TabsContent value="anexo" className="space-y-4 pt-4">
        {/* Input de arquivo oculto */}
        <input 
          type="file" 
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileSelect}
          multiple
          formNoValidate
        />
        
        {/* Área de upload */}
        <div className="border-2 border-dashed rounded-md p-6 text-center">
          <Paperclip className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground mb-2">
            Arraste e solte arquivos aqui ou clique para fazer upload
          </p>
          <Button 
            variant="outline" 
            className="mt-2"
            onClick={handleOpenFileSelector}
            type="button"
          >
            <Upload className="mr-2 h-4 w-4" />
            Selecionar arquivo
          </Button>
        </div>
        
        {/* Debug: Mostrar quantidade de anexos */}
        <div className="text-sm text-muted-foreground">
          Anexos carregados: {localAnexos.length}
        </div>
        
        {/* Lista de anexos */}
        {localAnexos.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Anexos ({localAnexos.length})</h4>
            <div className="space-y-2">
              {localAnexos.map(anexo => (
                <div 
                  key={anexo.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div className="flex items-center space-x-2">
                    <File className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{anexo.nome}</p>
                      <p className="text-xs text-muted-foreground">{anexo.tamanho}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => handleRemoveAnexo(anexo.id, e)}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remover</span>
                  </Button>
                </div>
              ))}
            </div>
            
            {/* Botão para adicionar mais anexos */}
            <Button 
              variant="outline" 
              size="sm"
              className="mt-2"
              onClick={handleOpenFileSelector}
              type="button"
            >
              <Paperclip className="mr-2 h-4 w-4" />
              Adicionar mais anexos
            </Button>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}