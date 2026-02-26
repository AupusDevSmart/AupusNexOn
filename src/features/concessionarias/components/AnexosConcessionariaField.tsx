// src/features/concessionarias/components/AnexosConcessionariaField.tsx
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Upload,
  File,
  X,
  Download,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConcessionariasService, AnexoConcessionaria } from '@/services/concessionarias.services';
import { toast } from '@/hooks/use-toast';
import { AnexoTemporario, AnexoItem } from '../types';

interface AnexosConcessionariaFieldProps {
  concessionariaId?: string;
  value?: any; // Recebe o valor do formulário
  onChange?: (value: any) => void; // Notifica mudanças para o formulário
  anexosExistentes?: AnexoConcessionaria[];
  disabled?: boolean;
  mode?: 'create' | 'edit' | 'view';
}

export function AnexosConcessionariaField({
  concessionariaId,
  value,
  onChange,
  anexosExistentes = [],
  disabled = false,
  mode = 'create'
}: AnexosConcessionariaFieldProps) {
  const [anexos, setAnexos] = useState<AnexoItem[]>(anexosExistentes);
  const [uploading, setUploading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isViewMode = mode === 'view' || disabled;
  const isCreateMode = mode === 'create' || !concessionariaId;

  // Sincronizar com o valor do formulário
  useEffect(() => {
    if (value) {
      setAnexos(value);
    }
  }, [value]);

  // Ícone baseado no tipo de arquivo
  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) {
      return <File className="h-4 w-4" />;
    }
    if (mimeType.startsWith('image/')) {
      return <ImageIcon className="h-4 w-4" />;
    }
    if (mimeType.includes('pdf')) {
      return <FileText className="h-4 w-4" />;
    }
    if (mimeType.includes('sheet') || mimeType.includes('excel')) {
      return <FileSpreadsheet className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  // Formatar tamanho do arquivo
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Helper para verificar se é anexo temporário
  const isTemporary = (anexo: AnexoItem): anexo is AnexoTemporario => {
    return 'isTemporary' in anexo && anexo.isTemporary === true;
  };

  // Helper para notificar mudanças
  const notifyChange = (novosAnexos: AnexoItem[]) => {
    setAnexos(novosAnexos);
    onChange?.(novosAnexos);
  };

  // Upload de arquivo
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validar tamanho (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 10MB.",
        variant: "destructive",
      });
      return;
    }

    // Validar tipo de arquivo
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Tipo de arquivo não permitido",
        description: "Apenas PDF, PNG, JPG, DOC e XLS são aceitos.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);

      // Se já tem ID (modo edição), fazer upload direto
      if (!isCreateMode && concessionariaId) {
        const novoAnexo = await ConcessionariasService.uploadAnexo(
          concessionariaId,
          file
        );

        const novosAnexos = [...anexos, novoAnexo];
        notifyChange(novosAnexos);

        toast({
          title: "Anexo adicionado!",
          description: `O arquivo "${file.name}" foi enviado com sucesso.`,
          variant: "default",
        });
      } else {
        // Modo criação: criar anexo temporário
        const anexoTemp: AnexoTemporario = {
          id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file: file,
          nome_original: file.name,
          tamanho: file.size,
          mime_type: file.type,
          isTemporary: true
        };

        const novosAnexos = [...anexos, anexoTemp];
        notifyChange(novosAnexos);

        toast({
          title: "Arquivo pronto!",
          description: `"${file.name}" será enviado ao salvar a concessionária.`,
          variant: "default",
        });
      }

      // Limpar input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Erro ao processar arquivo:', error);
      toast({
        title: "Erro ao adicionar arquivo",
        description: error.message || "Não foi possível adicionar o arquivo.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // Download de arquivo
  const handleDownload = async (anexo: AnexoItem) => {
    try {
      // Se for temporário, fazer download do File object
      if (isTemporary(anexo)) {
        const url = URL.createObjectURL(anexo.file);
        const a = document.createElement('a');
        a.href = url;
        a.download = anexo.nome_original;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: "Download iniciado",
          description: `Baixando "${anexo.nome_original}"...`,
          variant: "default",
        });
        return;
      }

      // Se for salvo, fazer download da API
      const blob = await ConcessionariasService.downloadAnexo(anexo.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = anexo.nome_original;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download iniciado",
        description: `Baixando "${anexo.nome_original}"...`,
        variant: "default",
      });
    } catch (error: any) {
      console.error('Erro ao fazer download:', error);
      toast({
        title: "Erro ao baixar arquivo",
        description: error.message || "Não foi possível baixar o arquivo.",
        variant: "destructive",
      });
    }
  };

  // Excluir arquivo
  const handleDelete = async (anexo: AnexoItem) => {
    if (!confirm(`Deseja realmente excluir o arquivo "${anexo.nome_original}"?`)) {
      return;
    }

    try {
      setDeletingIds(prev => new Set(prev).add(anexo.id));

      // Se for temporário, apenas remover do estado
      if (isTemporary(anexo)) {
        const novosAnexos = anexos.filter(a => a.id !== anexo.id);
        notifyChange(novosAnexos);

        toast({
          title: "Arquivo removido",
          description: `"${anexo.nome_original}" foi removido.`,
          variant: "default",
        });
        return;
      }

      // Se for salvo, deletar da API
      await ConcessionariasService.deleteAnexo(anexo.id);

      const novosAnexos = anexos.filter(a => a.id !== anexo.id);
      notifyChange(novosAnexos);

      toast({
        title: "Anexo removido",
        description: `O arquivo "${anexo.nome_original}" foi excluído.`,
        variant: "default",
      });
    } catch (error: any) {
      console.error('Erro ao excluir anexo:', error);
      toast({
        title: "Erro ao excluir arquivo",
        description: error.message || "Não foi possível excluir o arquivo.",
        variant: "destructive",
      });
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(anexo.id);
        return newSet;
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">
          Anexos
          {anexos.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({anexos.length} {anexos.length === 1 ? 'arquivo' : 'arquivos'})
            </span>
          )}
        </Label>

        {!isViewMode && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
              className="hidden"
              disabled={uploading}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-minimal-outline"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isCreateMode ? 'Adicionando...' : 'Enviando...'}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Adicionar Anexo
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Aviso no modo criação sobre anexos temporários */}
      {isCreateMode && anexos.length > 0 && anexos.some(a => isTemporary(a)) && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-800 dark:text-blue-200">
            Os arquivos serão enviados ao servidor quando você salvar a concessionária.
          </p>
        </div>
      )}

      {/* Lista de Anexos */}
      {anexos.length > 0 ? (
        <div className="space-y-2">
          {anexos.map((anexo) => {
            const isDeleting = deletingIds.has(anexo.id);

            return (
              <Card
                key={anexo.id}
                className={cn(
                  'p-3 flex items-center justify-between gap-3',
                  isDeleting && 'opacity-50'
                )}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 text-muted-foreground">
                    {getFileIcon(anexo.mime_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate" title={anexo.nome_original}>
                        {anexo.nome_original}
                      </p>
                      {isTemporary(anexo) && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300 flex-shrink-0">
                          Pendente
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(anexo.tamanho)}
                      {!isTemporary(anexo) && ` • ${new Date(anexo.created_at).toLocaleDateString('pt-BR')}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(anexo)}
                    disabled={isDeleting}
                    title="Baixar arquivo"
                  >
                    <Download className="h-4 w-4" />
                  </Button>

                  {!isViewMode && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(anexo)}
                      disabled={isDeleting}
                      title="Excluir arquivo"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 border-2 border-dashed rounded-lg dark:bg-black dark:border-gray-600">
          <File className="h-8 w-8 text-muted-foreground mx-auto mb-2 dark:text-white" />
          <p className="text-sm text-muted-foreground dark:text-white">
            Nenhum anexo adicionado ainda.
          </p>
          {!isViewMode && (
            <p className="text-xs text-muted-foreground dark:text-gray-300 mt-1">
              Formatos aceitos: PDF, PNG, JPG, DOC, XLS (máx. 10MB)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
