// src/features/equipamentos/components/PontosSection.tsx
// Componente CONTROLADO de pontos de automacao.
//
// Mantem o estado dos pontos no parent (Modal do equipamento) via props.
// Nao faz fetch nem persiste — os pontos sao enviados junto com o resto do
// equipamento no payload de save (POST/PATCH em /equipamentos).
//
// Layout minimalista, dark/light, sem emojis, profissional.

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { PONTO_TIPOS, type PontoTipo } from '../types';

/**
 * Linha de ponto editavel no modal. id eh opcional: pontos existentes vem do
 * backend com id real; pontos adicionados localmente comecam sem id.
 * Ao salvar o equipamento, o backend sincroniza:
 *  - id existente -> UPDATE
 *  - sem id        -> CREATE
 *  - existente que sumiu -> soft delete
 */
export interface PontoFormItem {
  id?: string;
  tipo: PontoTipo;
  nome: string;
  unidade?: string;
  ordem: number;
  ativo: boolean;
}

interface PontosSectionProps {
  /** Lista atual de pontos (controlada pelo parent). */
  pontos: PontoFormItem[];
  /** Callback para atualizar a lista. */
  onChange: (pontos: PontoFormItem[]) => void;
  /** Modo somente leitura (view) — desabilita add/edit/delete. */
  readOnly?: boolean;
}

const TIPO_LABELS: Record<PontoTipo, string> = {
  comando: 'Comando',
  status: 'Status',
  medicao: 'Medicao',
};

export function PontosSection({ pontos, onChange, readOnly }: PontosSectionProps) {
  // Erros de validacao por linha (chave = index)
  const [erros, setErros] = useState<Record<number, string>>({});

  const handleAdd = () => {
    const novos: PontoFormItem[] = [
      ...pontos,
      {
        tipo: 'comando',
        nome: '',
        unidade: '',
        ordem: pontos.length,
        ativo: true,
      },
    ];
    onChange(novos);
  };

  const handleRemove = (idx: number) => {
    const ponto = pontos[idx];
    if (ponto.id) {
      // Existente no backend — confirmar (sera soft-deletado ao salvar)
      if (
        !window.confirm(
          `Remover o ponto "${ponto.nome}"? A remocao sera efetivada ao salvar o equipamento.`,
        )
      ) {
        return;
      }
    }
    const novos = pontos.filter((_, i) => i !== idx);
    onChange(novos);
    const novosErros = { ...erros };
    delete novosErros[idx];
    setErros(novosErros);
  };

  const handleField = <K extends keyof PontoFormItem>(
    idx: number,
    field: K,
    value: PontoFormItem[K],
  ) => {
    const novos = [...pontos];
    novos[idx] = { ...novos[idx], [field]: value };
    onChange(novos);
  };

  const validarNome = (idx: number, nome: string) => {
    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      setErros((e) => ({ ...e, [idx]: 'Nome obrigatorio' }));
      return;
    }
    // Detecta duplicata local
    const duplicata = pontos.find(
      (p, i) => i !== idx && p.nome.trim().toLowerCase() === nomeTrim.toLowerCase(),
    );
    if (duplicata) {
      setErros((e) => ({ ...e, [idx]: 'Nome duplicado no equipamento' }));
      return;
    }
    setErros((e) => {
      const next = { ...e };
      delete next[idx];
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Pontos de Automacao</h3>
          <p className="text-xs text-muted-foreground">
            Comandos, status e medicoes que esse equipamento expoe para
            integracao com TONs.
          </p>
        </div>
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            className="h-8 rounded dark:bg-black"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Adicionar Ponto
          </Button>
        )}
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium w-32">Tipo</th>
              <th className="text-left px-3 py-2 font-medium">Nome</th>
              <th className="text-left px-3 py-2 font-medium w-28">Unidade</th>
              <th className="text-left px-3 py-2 font-medium w-20">Ativo</th>
              {!readOnly && <th className="w-12" />}
            </tr>
          </thead>
          <tbody>
            {pontos.length === 0 && (
              <tr>
                <td
                  colSpan={readOnly ? 4 : 5}
                  className="px-3 py-6 text-center text-xs text-muted-foreground"
                >
                  Nenhum ponto cadastrado.
                </td>
              </tr>
            )}

            {pontos.map((ponto, idx) => {
              const erro = erros[idx];
              const isMedicao = ponto.tipo === 'medicao';

              if (readOnly) {
                return (
                  <tr
                    key={ponto.id ?? `idx_${idx}`}
                    className="border-t border-border"
                  >
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {TIPO_LABELS[ponto.tipo] ?? ponto.tipo}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{ponto.nome}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {ponto.unidade || '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {ponto.ativo ? 'Sim' : 'Nao'}
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={ponto.id ?? `idx_${idx}`}
                  className="border-t border-border align-top"
                >
                  <td className="px-3 py-2">
                    <Select
                      value={ponto.tipo}
                      onValueChange={(v) => {
                        const tipo = v as PontoTipo;
                        const novos = [...pontos];
                        novos[idx] = {
                          ...novos[idx],
                          tipo,
                          // limpa unidade se sair de medicao
                          unidade: tipo === 'medicao' ? novos[idx].unidade : '',
                        };
                        onChange(novos);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs rounded dark:bg-black">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PONTO_TIPOS.map((t) => (
                          <SelectItem key={t} value={t} className="text-xs">
                            {TIPO_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={ponto.nome}
                      onChange={(e) => handleField(idx, 'nome', e.target.value)}
                      onBlur={(e) => validarNome(idx, e.target.value)}
                      placeholder="ex: abrir, fechar, posicao"
                      className={`h-8 w-full rounded border bg-background dark:bg-black px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring ${
                        erro
                          ? 'border-destructive focus:ring-destructive'
                          : 'border-input'
                      }`}
                    />
                    {erro && (
                      <p className="mt-1 text-[10px] text-destructive">{erro}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={ponto.unidade ?? ''}
                      onChange={(e) =>
                        handleField(idx, 'unidade', e.target.value)
                      }
                      placeholder={isMedicao ? 'A, V, kW' : '-'}
                      disabled={!isMedicao}
                      className="h-8 w-full rounded border border-input bg-background dark:bg-black px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleField(idx, 'ativo', !ponto.ativo)}
                      className={`text-xs px-2 py-0.5 rounded-md border transition-colors ${
                        ponto.ativo
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15'
                          : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      {ponto.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      title="Remover ponto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
