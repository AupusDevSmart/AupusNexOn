// src/features/equipamentos/components/AnexosEquipamentoField.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/core/components/ui/button';
import {
  Upload,
  File,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Download,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useHttpClient } from '@/core/context/hooks';
import { toast } from '@/core/hooks/use-toast';

export interface AnexoEquipamento {
  id: string;
  equipamento_id: string;
  nome_original: string;
  nome_arquivo: string;
  mime_type: string;
  tamanho: number;
  descricao?: string | null;
  created_at: string;
}

interface AnexosEquipamentoFieldProps {
  /** Nulo enquanto o equipamento nao foi criado. */
  equipamentoId: string | null;
  somenteLeitura?: boolean;
  /**
   * Permite enviar os arquivos escolhidos antes de o equipamento existir,
   * assim que o id nascer. Sem isso, cadastrar com manual em maos exigiria
   * salvar, reabrir o sheet e anexar.
   */
  registrarAcaoPosCriacao?: (
    chave: string,
    acao: (equipamentoId: string) => Promise<void>,
  ) => void;
}

const iconePorTipo = (mimeType?: string) => {
  if (!mimeType) return <File className="h-4 w-4" />;
  if (mimeType.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
  if (mimeType.includes('pdf')) return <FileText className="h-4 w-4" />;
  if (mimeType.includes('sheet') || mimeType.includes('excel'))
    return <FileSpreadsheet className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
};

const formatarTamanho = (bytes: number): string => {
  if (!bytes) return '0 B';
  const unidades = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round((bytes / Math.pow(1024, i)) * 10) / 10} ${unidades[i]}`;
};

const formatarData = (valor: string) => {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleDateString('pt-BR');
};

/**
 * Manuais, datasheets e documentos do equipamento.
 *
 * Nativo do sheet, e não injetado pelo consumidor: o backend vive no
 * api-shared e os dois produtos falam com ele, então não há o que
 * particularizar por app.
 *
 * O download passa pelo controller (`/equipamentos/anexos/:id/download`) e não
 * por URL estática. Isso evita a armadilha da foto do equipamento, que depende
 * de uma rota no UploadsController duplicada nos dois backends — e sem ela
 * responde 404 sem aparecer nos logs.
 */
export function AnexosEquipamentoField({
  equipamentoId,
  somenteLeitura = false,
  registrarAcaoPosCriacao,
}: AnexosEquipamentoFieldProps) {
  const httpClient = useHttpClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [anexos, setAnexos] = useState<AnexoEquipamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  /** Escolhidos antes de existir equipamento; sobem depois de salvar. */
  const [pendentes, setPendentes] = useState<File[]>([]);

  const id = equipamentoId?.trim();

  const carregar = useCallback(async () => {
    if (!id) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    try {
      const resposta = await httpClient.get(`/equipamentos/${id}/anexos`);
      // A resposta pode vir embrulhada em { success, data } pelo interceptor.
      const lista = resposta.data?.data ?? resposta.data ?? [];
      setAnexos(Array.isArray(lista) ? lista : []);
    } catch (error: any) {
      console.error('[ANEXOS] Erro ao listar anexos:', error);
      toast({
        title: 'Erro ao carregar anexos',
        description: error?.response?.data?.message || error?.message,
        variant: 'destructive',
      });
      setAnexos([]);
    } finally {
      setCarregando(false);
    }
  }, [httpClient, id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // O sheet executa isto assim que o equipamento nasce.
  useEffect(() => {
    if (!registrarAcaoPosCriacao) return;

    registrarAcaoPosCriacao('os anexos', async (novoId: string) => {
      for (const arquivo of pendentes) {
        const form = new FormData();
        form.append('file', arquivo);
        await httpClient.post(`/equipamentos/${novoId}/anexos`, form, {
          // O Content-Type vai explicito: a instancia do axios define
          // application/json por padrao, e sem sobrescrever aqui o multer nao
          // reconhece o corpo como multipart — o arquivo chega vazio e o
          // backend recusa com "Nenhum arquivo enviado".
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
    });
  }, [pendentes, registrarAcaoPosCriacao, httpClient]);

  const enviarArquivos = async (arquivos: FileList) => {
    // Sem equipamento ainda: guarda os arquivos e sobe depois de salvar.
    if (!id) {
      setPendentes((atuais) => [...atuais, ...Array.from(arquivos)]);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setEnviando(true);
    try {
      // Um de cada vez: o backend valida tipo e tamanho por arquivo, e assim o
      // erro aponta qual deles foi recusado em vez de derrubar o lote inteiro.
      for (const arquivo of Array.from(arquivos)) {
        const form = new FormData();
        form.append('file', arquivo);
        try {
          await httpClient.post(`/equipamentos/${id}/anexos`, form, {
            // O Content-Type vai explicito: a instancia do axios define
            // application/json por padrao, e sem sobrescrever aqui o multer nao
            // reconhece o corpo como multipart — o arquivo chega vazio e o
            // backend recusa com "Nenhum arquivo enviado".
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (error: any) {
          toast({
            title: `Não foi possível enviar "${arquivo.name}"`,
            description: error?.response?.data?.message || error?.message,
            variant: 'destructive',
          });
        }
      }
      await carregar();
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const baixar = async (anexo: AnexoEquipamento) => {
    try {
      const resposta = await httpClient.get(`/equipamentos/anexos/${anexo.id.trim()}/download`, {
        responseType: 'blob',
      });

      const url = URL.createObjectURL(new Blob([resposta.data], { type: anexo.mime_type }));
      const link = document.createElement('a');
      link.href = url;
      link.download = anexo.nome_original;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: 'Erro ao baixar anexo',
        description: error?.response?.data?.message || error?.message,
        variant: 'destructive',
      });
    }
  };

  const remover = async (anexo: AnexoEquipamento) => {
    if (!confirm(`Remover "${anexo.nome_original}"?`)) return;

    setRemovendo(anexo.id);
    try {
      await httpClient.delete(`/equipamentos/anexos/${anexo.id.trim()}`);
      toast({ title: 'Anexo removido' });
      await carregar();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover anexo',
        description: error?.response?.data?.message || error?.message,
        variant: 'destructive',
      });
    } finally {
      setRemovendo(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Anexos</h3>

        {!somenteLeitura && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.txt,.zip"
              onChange={(e) => e.target.files?.length && enviarArquivos(e.target.files)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => inputRef.current?.click()}
              disabled={enviando}
              title={enviando ? 'Enviando...' : 'Adicionar anexo'}
              aria-label="Adicionar anexo"
            >
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
            </Button>
          </>
        )}
      </div>

      {/* Escolhidos antes de o equipamento existir. Aparecem na mesma lista,
          marcados como pendentes, para quem cadastra ver que já estão ali. */}
      {pendentes.length > 0 && (
        <div>
          {pendentes.map((arquivo, indice) => (
            <div key={`${arquivo.name}-${indice}`} className="flex items-center gap-3 py-2">
              <span className="text-muted-foreground flex-shrink-0">
                {iconePorTipo(arquivo.type)}
              </span>

              <p className="min-w-0 flex-1 text-sm text-foreground truncate" title={arquivo.name}>
                {arquivo.name}
              </p>

              <span className="hidden sm:block w-20 flex-shrink-0 text-xs text-muted-foreground">
                {formatarTamanho(arquivo.size)}
              </span>

              <span className="w-24 flex-shrink-0 text-xs text-muted-foreground">ao salvar</span>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => setPendentes((atuais) => atuais.filter((_, i) => i !== indice))}
                title="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : anexos.length === 0 && pendentes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum anexo. Manuais, datasheets e documentos deste equipamento ficam aqui.
        </p>
      ) : (
        <div>
          {anexos.map((anexo) => (
            <div key={anexo.id} className="flex items-center gap-3 py-2">
              <span className="text-muted-foreground flex-shrink-0">
                {iconePorTipo(anexo.mime_type)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate" title={anexo.nome_original}>
                  {anexo.nome_original}
                </p>
                {anexo.descricao && (
                  <p className="text-xs text-muted-foreground truncate">{anexo.descricao}</p>
                )}
              </div>

              <span className="hidden sm:block w-20 flex-shrink-0 text-xs text-muted-foreground">
                {formatarTamanho(anexo.tamanho)}
              </span>

              <span className="hidden md:block w-24 flex-shrink-0 text-xs text-muted-foreground">
                {formatarData(anexo.created_at)}
              </span>

              <div className="flex items-center gap-0.5 flex-shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => baixar(anexo)}
                  title="Baixar"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>

                {!somenteLeitura && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remover(anexo)}
                    disabled={removendo === anexo.id}
                    title="Remover"
                  >
                    {removendo === anexo.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
