// src/features/equipamentos/components/ItensDoLoteField.tsx
import { useMemo, useState } from 'react';
import { Button } from '@/core/components/ui/button';
import { Wand2, Trash2, AlertCircle } from 'lucide-react';
import type { EquipamentoDoLote } from '@/core/types/contracts';

interface ItensDoLoteFieldProps {
  itens: EquipamentoDoLote[];
  onChange: (itens: EquipamentoDoLote[]) => void;
  /** Nome sugerido para a numeração — vem da categoria ou do equipamento copiado. */
  nomeBase?: string;
  /** TAG sugerida, sem o número. */
  tagBase?: string;
  /**
   * De onde continuar, consultado no banco. Sem isso a numeração recomeçaria do
   * 1 a cada lote e colidiria com o que já existe.
   */
  consultarSequencial?: (params: { base_nome?: string; base_tag?: string }) => Promise<{
    proximo_nome: number;
    proximo_tag: number;
  }>;
}

type Coluna = keyof EquipamentoDoLote;

const COLUNAS: { chave: Coluna; rotulo: string; obrigatorio?: boolean; placeholder: string }[] = [
  { chave: 'nome', rotulo: 'Nome', obrigatorio: true, placeholder: 'Inversor 01' },
  { chave: 'tag', rotulo: 'TAG', placeholder: 'INV-01' },
  { chave: 'numero_serie', rotulo: 'Número de série', placeholder: 'SN-0001' },
  { chave: 'localizacao_especifica', rotulo: 'Localização específica', placeholder: 'Sala 3' },
];

/** Numera a partir de um padrão, preservando a largura: 01, 02... ou 001, 002... */
const numerar = (prefixo: string, indice: number, inicio: number, digitos: number) =>
  `${prefixo}${String(inicio + indice).padStart(digitos, '0')}`;

/**
 * A grade dos equipamentos de um lote.
 *
 * Só aparece o que muda entre eles. Todo o resto — categoria, modelo, unidade,
 * criticidade, dados técnicos, foto, anexos — é preenchido uma vez na aba de
 * dados e vale para todos.
 *
 * Duas coisas fazem essa tela valer a pena com vinte linhas: a numeração
 * automática, que evita digitar "Inversor 01" até "Inversor 20"; e colar uma
 * coluna inteira, porque quem comissiona tem os números de série numa planilha
 * e digitá-los à mão é onde o cadastro em lote perderia a graça.
 */
export function ItensDoLoteField({
  itens,
  onChange,
  nomeBase,
  tagBase,
  consultarSequencial,
}: ItensDoLoteFieldProps) {
  const [padraoNome, setPadraoNome] = useState(nomeBase || '');
  const [padraoTag, setPadraoTag] = useState(tagBase || '');
  const [numerando, setNumerando] = useState(false);

  const alterar = (indice: number, coluna: Coluna, valor: string) => {
    const copia = [...itens];
    copia[indice] = { ...copia[indice], [coluna]: valor };
    onChange(copia);
  };

  /**
   * Colar preenche a coluna a partir da linha em que se colou. Uma célula só
   * segue o comportamento normal do navegador.
   */
  const colar = (evento: React.ClipboardEvent, indice: number, coluna: Coluna) => {
    const texto = evento.clipboardData.getData('text');
    // Planilhas separam colunas por tab e linhas por quebra. Só interessa a
    // primeira coluna do que veio: a grade preenche uma de cada vez.
    const valores = texto
      .split(/\r?\n/)
      .map((linha) => linha.split('\t')[0].trim())
      .filter((v, i, arr) => v !== '' || i < arr.length - 1);

    if (valores.length <= 1) return;

    evento.preventDefault();

    const copia = [...itens];
    valores.forEach((valor, deslocamento) => {
      const alvo = indice + deslocamento;
      if (alvo < copia.length) copia[alvo] = { ...copia[alvo], [coluna]: valor };
    });
    onChange(copia);
  };

  /**
   * Numera a coluna a partir do padrão.
   *
   * Um número escrito no fim do padrão manda: "INV-005" gera 005, 006, 007, e a
   * largura dele define o preenchimento. Sem número, o ponto de partida vem do
   * banco — quem já tem três inversores e cadastra mais dois espera o quarto e o
   * quinto, e não uma colisão com o que já está lá.
   */
  const aplicarNumeracao = async (coluna: 'nome' | 'tag', padrao: string) => {
    const bruto = padrao.trim();
    if (!bruto) return;

    const casa = bruto.match(/^(.*?)(\d+)$/);
    const prefixo = casa ? casa[1] : `${bruto} `;
    const digitos = casa
      ? casa[2].length
      : String(itens.length).length < 2
        ? 2
        : String(itens.length).length;

    let inicio = casa ? parseInt(casa[2], 10) : 1;

    if (!casa && consultarSequencial) {
      setNumerando(true);
      try {
        const proximo = await consultarSequencial(
          coluna === 'nome' ? { base_nome: prefixo.trim() } : { base_tag: prefixo },
        );
        inicio = coluna === 'nome' ? proximo.proximo_nome : proximo.proximo_tag;
      } finally {
        setNumerando(false);
      }
    }

    onChange(
      itens.map((item, indice) => ({
        ...item,
        [coluna]: numerar(prefixo, indice, inicio, digitos),
      })),
    );
  };

  const remover = (indice: number) => {
    if (itens.length <= 1) return;
    onChange(itens.filter((_, i) => i !== indice));
  };

  /**
   * Os mesmos avisos que o backend daria, só que antes de enviar. Ele recusa o
   * lote inteiro, então descobrir uma TAG repetida depois de preencher vinte
   * linhas seria frustrante.
   */
  const problemas = useMemo(() => {
    const encontrados = new Map<number, string>();
    const vistos: Record<string, Map<string, number>> = { nome: new Map(), tag: new Map(), numero_serie: new Map() };

    itens.forEach((item, indice) => {
      if (!item.nome?.trim()) {
        encontrados.set(indice, 'Nome obrigatório');
        return;
      }

      for (const coluna of ['nome', 'tag', 'numero_serie'] as const) {
        const valor = (item[coluna] || '').trim().toLowerCase();
        if (!valor) continue;

        const anterior = vistos[coluna].get(valor);
        if (anterior !== undefined) {
          const rotulo = COLUNAS.find((c) => c.chave === coluna)!.rotulo;
          encontrados.set(indice, `${rotulo} repetido (linha ${anterior + 1})`);
        } else {
          vistos[coluna].set(valor, indice);
        }
      }
    });

    return encontrados;
  }, [itens]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground pb-2 border-b">
          Equipamentos do lote
        </h3>
        <p className="text-xs text-muted-foreground pt-2">
          Só o que muda entre eles. Categoria, modelo, unidade, dados técnicos e anexos
          valem para todos e ficam na aba de dados. O plano de manutenção é vinculado
          depois, equipamento por equipamento.
        </p>
      </div>

      {/* Numeração: preenche as colunas de uma vez a partir de um padrão. */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-2 flex-1 min-w-0">
          <input
            className="input-minimal"
            value={padraoNome}
            onChange={(e) => setPadraoNome(e.target.value)}
            placeholder={nomeBase ? `${nomeBase} 01` : 'Nome base, ex: Inversor 01'}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                aplicarNumeracao('nome', padraoNome);
              }
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => aplicarNumeracao('nome', padraoNome)}
            disabled={!padraoNome.trim() || numerando}
            title="Numerar os nomes a partir deste padrão"
            aria-label="Numerar os nomes"
          >
            <Wand2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2 flex-1 min-w-0">
          <input
            className="input-minimal"
            value={padraoTag}
            onChange={(e) => setPadraoTag(e.target.value)}
            placeholder="TAG base, ex: INV-UFV1-01"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                aplicarNumeracao('tag', padraoTag);
              }
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => aplicarNumeracao('tag', padraoTag)}
            disabled={!padraoTag.trim() || numerando}
            title="Numerar as TAGs a partir deste padrão"
            aria-label="Numerar as TAGs"
          >
            <Wand2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Cabeçalho só no desktop: no celular cada linha vira um cartão com os
          rótulos junto dos campos. */}
      <div className="hidden sm:grid grid-cols-[2rem_1fr_1fr_1fr_1fr_2rem] gap-2 px-1">
        <span className="text-xs text-muted-foreground">#</span>
        {COLUNAS.map((coluna) => (
          <span key={coluna.chave} className="text-xs text-muted-foreground">
            {coluna.rotulo}
            {coluna.obrigatorio && <span className="text-red-500"> *</span>}
          </span>
        ))}
        <span />
      </div>

      <div className="space-y-2 sm:space-y-1">
        {itens.map((item, indice) => {
          const problema = problemas.get(indice);

          return (
            <div
              key={indice}
              className="rounded border p-3 sm:border-0 sm:p-0 sm:rounded-none sm:grid sm:grid-cols-[2rem_1fr_1fr_1fr_1fr_2rem] sm:gap-2 sm:items-center space-y-2 sm:space-y-0"
            >
              <span className="hidden sm:block text-xs text-muted-foreground text-center">
                {indice + 1}
              </span>

              {COLUNAS.map((coluna) => (
                <div key={coluna.chave} className="space-y-1 sm:space-y-0">
                  <label className="sm:hidden text-xs text-muted-foreground">
                    {coluna.rotulo}
                    {coluna.obrigatorio && <span className="text-red-500"> *</span>}
                  </label>
                  <input
                    className="input-minimal"
                    value={item[coluna.chave] || ''}
                    onChange={(e) => alterar(indice, coluna.chave, e.target.value)}
                    onPaste={(e) => colar(e, indice, coluna.chave)}
                    placeholder={coluna.placeholder}
                  />
                </div>
              ))}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive justify-self-center"
                onClick={() => remover(indice)}
                disabled={itens.length <= 1}
                title="Remover do lote"
                aria-label={`Remover a linha ${indice + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>

              {problema && (
                <p className="sm:col-span-6 flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {problema}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        A numeração continua de onde os equipamentos já cadastrados pararam. Escreva o
        número no fim do padrão para começar de outro ponto. Dá para colar uma coluna
        inteira: copie os valores de uma planilha e cole em qualquer campo — ele
        preenche daquela linha para baixo.
      </p>
    </div>
  );
}
