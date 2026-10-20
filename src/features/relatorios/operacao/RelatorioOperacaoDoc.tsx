import type {
  RelatorioConsumo, RelatorioGeracao, RelatorioIrrigacao, RelatorioOperacao, RelatorioRecargas, TipoRelatorioOperacao,
} from './tipos';
import { RelatorioIrrigacaoDoc } from './RelatorioIrrigacaoDoc';
import { RelatorioGeracaoDoc } from './RelatorioGeracaoDoc';
import { RelatorioConsumoDoc } from './RelatorioConsumoDoc';
import { RelatorioRecargasDoc } from './RelatorioRecargasDoc';

/** Folhas A4 do relatório escolhido. */
export function RelatorioOperacaoDoc({ tipo, dados }: { tipo: TipoRelatorioOperacao; dados: RelatorioOperacao }) {
  switch (tipo) {
    case 'irrigacao':
      return <RelatorioIrrigacaoDoc dados={dados as RelatorioIrrigacao} />;
    case 'geracao':
      return <RelatorioGeracaoDoc dados={dados as RelatorioGeracao} />;
    case 'consumo':
      return <RelatorioConsumoDoc dados={dados as RelatorioConsumo} />;
    case 'recargas':
      return <RelatorioRecargasDoc dados={dados as RelatorioRecargas} />;
    default:
      return null;
  }
}
