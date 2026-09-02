// GERADO a partir de "CADASTRO ATIVOS SERVICE.xlsx", aba "Tipo de Ativo".
// Este arquivo e a fonte para a UI: editar aqui, nao na planilha.

/**
 * Campos tecnicos padrao de cada CATEGORIA de equipamento.
 *
 * Escolher a categoria no sheet ja monta a secao de dados tecnicos. Antes, os
 * campos so apareciam depois de escolher um MODELO, e apenas se aquele tipo
 * tivesse `propriedades_schema` no banco — 18 dos 37 tinham. Quem cadastrava um
 * equipamento de tipo novo nao via campo nenhum.
 *
 * A chave e o NOME da categoria, normalizado (sem acento, sem pontuacao,
 * minusculo) — nao o id. Os ids sao aleatorios por ambiente: um id gravado aqui
 * casaria em dev e falharia em producao.
 *
 * Ha entradas para categorias que ainda NAO existem no banco. E proposital:
 * assim que forem criadas, os campos passam a aparecer sem mexer no codigo.
 */
export interface CampoDaCategoria {
  campo: string;
  rotulo: string;
  tipo: 'text' | 'number' | 'select';
  unidade?: string;
  opcoes?: string[];
}

export const CAMPOS_POR_CATEGORIA: Record<string, CampoDaCategoria[]> = {
  // planilha: MG – Módulo Geral (parte civil e comum à área)
  "MG – Módulo Geral": [
    { campo: "tipo_de_fundacao", rotulo: "Tipo de fundação", tipo: "select", opcoes: ["Abrigo", "Cercamento", "Casa Comando", "Pátio"] },
  ],
  // planilha: Motor de Indução
  "Motor Elétrico": [
    { campo: "potencia", rotulo: "Potência", tipo: "number", unidade: "kW" },
    { campo: "tensao_nominal", rotulo: "Tensão nominal", tipo: "text" },
    { campo: "corrente_nominal", rotulo: "Corrente nominal", tipo: "text" },
    { campo: "fator_de_servico", rotulo: "Fator de serviço", tipo: "text" },
    { campo: "numero_de_polos", rotulo: "Número de polos", tipo: "number" },
    { campo: "grau_de_protecao", rotulo: "Grau de proteção (IP)", tipo: "text" },
    { campo: "classe_de_isolamento", rotulo: "Classe de isolamento", tipo: "text" },
    { campo: "tipo_de_partida", rotulo: "Tipo de partida", tipo: "text" },
  ],
  // planilha: Banco de Capacitor
  "Banco Capacitor": [
    { campo: "potencia_reativa", rotulo: "Potência reativa", tipo: "number", unidade: "kVAr" },
    { campo: "n_serie", rotulo: "N. Serie", tipo: "text" },
    { campo: "tensao_nominal", rotulo: "Tensão nominal", tipo: "text" },
    { campo: "frequencia", rotulo: "Frequência", tipo: "text" },
    { campo: "celula", rotulo: "Célula:", tipo: "text" },
    { campo: "tipo_de_controle", rotulo: "Tipo de controle", tipo: "select", opcoes: ["Fixo", "Automatico"] },
    { campo: "protecao_contra_sobrecorrente", rotulo: "Proteção contra sobrecorrente", tipo: "text" },
  ],
  // planilha: Transformador Força
  "Transformador de Potência": [
    { campo: "potencia_nominal", rotulo: "Potência nominal", tipo: "number", unidade: "kVA" },
    { campo: "n_serie", rotulo: "N. Serie", tipo: "text" },
    { campo: "tensao_primaria_e_secundaria", rotulo: "Tensão primária e secundária", tipo: "text" },
    { campo: "tipo_de_refrigeracao", rotulo: "Tipo de refrigeração (ONAN/ONAF/A SECO)", tipo: "text" },
    { campo: "impedancia", rotulo: "Impedância", tipo: "number", unidade: "%" },
    { campo: "grupo_de_ligacao", rotulo: "Grupo de ligação", tipo: "text" },
    { campo: "nivel_de_isolamento", rotulo: "Nível de isolamento", tipo: "text" },
    { campo: "ct", rotulo: "CT", tipo: "text" },
  ],
  // planilha: PDE (Poste de Distribuição de Energia)
  "PDE": [
    { campo: "altura", rotulo: "Altura", tipo: "number", unidade: "m" },
    { campo: "tipo_de_material", rotulo: "Tipo de material", tipo: "text" },
    { campo: "classe_de_esforco", rotulo: "Classe de esforço", tipo: "text" },
    { campo: "numero_de_fases_atendidas", rotulo: "Número de fases atendidas", tipo: "number" },
    { campo: "tipo_de_estrutura", rotulo: "Tipo de estrutura", tipo: "select", opcoes: ["DT", "CC"] },
  ],
  // planilha: Cabine Blindada ao Tempo
  "Cabine Blindada Medição Proteção": [
    { campo: "tensao_de_operacao", rotulo: "Tensão de operação", tipo: "text" },
    { campo: "n_serie", rotulo: "N. Serie", tipo: "text" },
    { campo: "corrente_nominal", rotulo: "Corrente nominal", tipo: "text" },
    { campo: "grau_de_protecao", rotulo: "Grau de proteção (IP)", tipo: "text" },
    { campo: "tipo_de_ventilacao", rotulo: "Tipo de ventilação", tipo: "text" },
    { campo: "material_da_carcaca", rotulo: "Material da carcaça", tipo: "text" },
    { campo: "sistema_de_intertravamento", rotulo: "Sistema de intertravamento", tipo: "text" },
  ],
  // planilha: Cabine de Alvenaria
  "Cabine de Alvenaria": [
    { campo: "area_interna", rotulo: "Área interna", tipo: "number", unidade: "m²" },
    { campo: "material_de_construcao", rotulo: "Material de construção", tipo: "text" },
    { campo: "espessura_das_paredes", rotulo: "Espessura das paredes", tipo: "text" },
    { campo: "ventilacao", rotulo: "Ventilação (natural/forçada)", tipo: "text" },
    { campo: "numero_de_acessos", rotulo: "Número de acessos", tipo: "number" },
  ],
  // planilha: QGBT – Quadro Geral de Baixa Tensão
  "Quadro Elétrico Baixa Tensão (QGBT)": [
    { campo: "corrente_nominal", rotulo: "Corrente nominal", tipo: "text" },
    { campo: "n_serie", rotulo: "N. Serie", tipo: "text" },
    { campo: "numero_de_barramentos", rotulo: "Número de barramentos", tipo: "number" },
    { campo: "tipo_de_disjuntores", rotulo: "Tipo de disjuntores", tipo: "text" },
    { campo: "grau_de_protecao", rotulo: "Grau de proteção (IP)", tipo: "text" },
    { campo: "forma_de_separacao_interna", rotulo: "Forma de separação interna", tipo: "text" },
    { campo: "capacidade_de_curto_circuito", rotulo: "Capacidade de curto-circuito", tipo: "text" },
  ],
  // planilha: QD – Quadro de Distribuição
  "Quadro Elétrico": [
    { campo: "numero_de_circuitos", rotulo: "Número de circuitos", tipo: "number" },
    { campo: "corrente_maxima_por_circuito", rotulo: "Corrente máxima por circuito", tipo: "text" },
    { campo: "tipo_de_disjuntores", rotulo: "Tipo de disjuntores", tipo: "text" },
    { campo: "grau_de_protecao", rotulo: "Grau de proteção (IP)", tipo: "text" },
    { campo: "numero_de_fases", rotulo: "Número de fases", tipo: "number" },
    { campo: "tipo_de_montagem", rotulo: "Tipo de montagem (embutido/sobrepor)", tipo: "text" },
  ],
  // planilha: Iluminação
  "Iluminação": [
    { campo: "tipo_de_luminaria", rotulo: "Tipo de luminária", tipo: "text" },
    { campo: "potencia_da_lampada", rotulo: "Potência da lâmpada", tipo: "text" },
    { campo: "tipo_de_lampada", rotulo: "Tipo de lâmpada (LED, vapor metálico etc.)", tipo: "text" },
    { campo: "grau_de_protecao", rotulo: "Grau de proteção (IP)", tipo: "text" },
    { campo: "altura_de_instalacao", rotulo: "Altura de instalação", tipo: "text" },
    { campo: "distribuicao_luminosa", rotulo: "Distribuição luminosa", tipo: "text" },
  ],
  // planilha: CFTV – Circuito Fechado de TV
  "CFTV – Circuito Fechado de TV": [
    { campo: "numero_de_cameras", rotulo: "Número de câmeras", tipo: "number" },
    { campo: "tipo_de_camera", rotulo: "Tipo de câmera (bullet, dome, PTZ)", tipo: "text" },
    { campo: "resolucao", rotulo: "Resolução", tipo: "text" },
    { campo: "alcance_infravermelho", rotulo: "Alcance infravermelho", tipo: "text" },
    { campo: "tipo_de_gravacao", rotulo: "Tipo de gravação (local/nuvem)", tipo: "text" },
    { campo: "capacidade_de_armazenamento", rotulo: "Capacidade de armazenamento", tipo: "text" },
  ],
  // planilha: Monitoramento
  "Monitoramento": [
    { campo: "variaveis_monitoradas", rotulo: "Variáveis monitoradas (energia, temperatura, etc.)", tipo: "text" },
    { campo: "tipo_de_sensores", rotulo: "Tipo de sensores", tipo: "text" },
    { campo: "frequencia_de_amostragem", rotulo: "Frequência de amostragem", tipo: "text" },
    { campo: "protocolo_de_comunicacao", rotulo: "Protocolo de comunicação (Modbus, MQTT, etc.)", tipo: "text" },
    { campo: "tipo_de_alimentacao", rotulo: "Tipo de alimentação", tipo: "text" },
    { campo: "nivel_de_precisao", rotulo: "Nível de precisão", tipo: "text" },
  ],
  // planilha: Aterramento / SPDA
  "Aterramento / SPDA": [
    { campo: "tipo_de_sistema", rotulo: "Tipo de sistema (malha, anel, haste)", tipo: "text" },
    { campo: "resistencia_de_aterramento", rotulo: "Resistência de aterramento", tipo: "number", unidade: "Ω" },
    { campo: "numero_de_hastes", rotulo: "Número de hastes", tipo: "number" },
    { campo: "tipo_de_condutor", rotulo: "Tipo de condutor", tipo: "text" },
    { campo: "tipo_de_conectores", rotulo: "Tipo de conectores", tipo: "text" },
  ],
  // planilha: Inversor Solar
  "Inversor PV": [
    { campo: "potencia_nominal", rotulo: "Potência nominal", tipo: "number", unidade: "kW" },
    { campo: "n_serie", rotulo: "N. Serie", tipo: "text" },
    { campo: "tensao_de_entrada", rotulo: "Tensão de entrada (CC)", tipo: "text" },
    { campo: "tensao_de_saida", rotulo: "Tensão de saída (CA)", tipo: "text" },
    { campo: "rendimento", rotulo: "Rendimento", tipo: "number", unidade: "%" },
    { campo: "numero_de_mppts", rotulo: "Número de MPPTs", tipo: "number" },
    { campo: "tipo_de_comunicacao", rotulo: "Tipo de comunicação (RS485, Wi-Fi, etc.)", tipo: "text" },
  ],
  // planilha: String Fotovoltaica
  "Módulos PV": [
    { campo: "qnt_modulo", rotulo: "Qnt Modulo", tipo: "number" },
    { campo: "potencia_nominal", rotulo: "Potência nominal", tipo: "number", unidade: "Wp" },
    { campo: "tensao_e_corrente_de_operacao", rotulo: "Tensão e corrente de operação", tipo: "text" },
    { campo: "tipo_de_celula", rotulo: "Tipo de célula (monocristalina/policristalina)", tipo: "text" },
    { campo: "eficiencia", rotulo: "Eficiência", tipo: "number", unidade: "%" },
    { campo: "numero_de_celulas", rotulo: "Número de células", tipo: "number" },
    { campo: "garantia_do_fabricante", rotulo: "Garantia do fabricante", tipo: "text" },
    { campo: "n_modulo_em_serie", rotulo: "N. modulo em série", tipo: "text" },
  ],
  // planilha: Estrutura Fixa
  "Estrutura Fixa": [
    { campo: "tipo_de_material", rotulo: "Tipo de material (aço galvanizado, alumínio)", tipo: "text" },
    { campo: "inclinacao", rotulo: "Inclinação", tipo: "number", unidade: "graus" },
    { campo: "tipo_de_fixacao", rotulo: "Tipo de fixação (chumbada/estaca)", tipo: "text" },
    { campo: "tratamento_anticorrosivo", rotulo: "Tratamento anticorrosivo", tipo: "text" },
    { campo: "capacidade_de_modulos", rotulo: "Capacidade de módulos", tipo: "text" },
  ],
  // planilha: Estrutura Tracker
  "Estrutura Tracker": [
    { campo: "numero_de_eixos", rotulo: "Número de eixos (1 ou 2)", tipo: "number" },
    { campo: "tipo_de_acionamento", rotulo: "Tipo de acionamento (elétrico/mecânico)", tipo: "text" },
    { campo: "faixa_de_movimento", rotulo: "Faixa de movimento", tipo: "number", unidade: "graus" },
    { campo: "tipo_de_controle", rotulo: "Tipo de controle (centralizado/autônomo)", tipo: "text" },
    { campo: "velocidade_de_rastreamento", rotulo: "Velocidade de rastreamento", tipo: "text" },
  ],
  // planilha: Cercamento
  "Cercamento": [
    { campo: "tipo_de_cerca", rotulo: "Tipo de cerca (alambrado, tela, muro)", tipo: "text" },
    { campo: "altura_total", rotulo: "Altura total", tipo: "number", unidade: "m" },
    { campo: "material_da_cerca", rotulo: "Material da cerca", tipo: "text" },
    { campo: "espessura_dos_postes", rotulo: "Espessura dos postes", tipo: "text" },
    { campo: "distancia_entre_postes", rotulo: "Distância entre postes", tipo: "text" },
    { campo: "sistema_de_fixacao", rotulo: "Sistema de fixação (cimento, estaca metálica etc.)", tipo: "text" },
  ],
  // planilha: Transformador Potencial
  "Transformador de Potencial (TP)": [
    { campo: "tipo", rotulo: "Tipo", tipo: "text" },
    { campo: "n_serie", rotulo: "N. 'Serie", tipo: "text" },
    { campo: "uso", rotulo: "Uso", tipo: "select", opcoes: ["Interno", "Externo"] },
    { campo: "norma", rotulo: "Norma", tipo: "text" },
    { campo: "freq", rotulo: "Freq", tipo: "text" },
    { campo: "pterm", rotulo: "Pterm", tipo: "text" },
    { campo: "fst", rotulo: "Fst", tipo: "text" },
    { campo: "exatidao", rotulo: "Exatidao", tipo: "text" },
    { campo: "n_i", rotulo: "N.I", tipo: "text" },
    { campo: "umax", rotulo: "Umax", tipo: "text" },
    { campo: "uprim", rotulo: "Uprim", tipo: "text" },
    { campo: "usec", rotulo: "Usec", tipo: "text" },
    { campo: "rn", rotulo: "RN", tipo: "text" },
    { campo: "m_total", rotulo: "M. Total", tipo: "text" },
    { campo: "ano", rotulo: "Ano", tipo: "text" },
    { campo: "isol", rotulo: "Isol", tipo: "text" },
  ],
  // planilha: Transformador Corrente
  "Transformador de Corrente (TC)": [
    { campo: "tipo", rotulo: "Tipo", tipo: "text" },
    { campo: "n_serie", rotulo: "N. Serie", tipo: "text" },
    { campo: "ano", rotulo: "Ano", tipo: "text" },
    { campo: "ip", rotulo: "Ip", tipo: "text" },
    { campo: "is", rotulo: "Is", tipo: "text" },
    { campo: "rn", rotulo: "Rn", tipo: "text" },
    { campo: "umax", rotulo: "Umax", tipo: "text" },
    { campo: "exatidao", rotulo: "Exatidao", tipo: "text" },
    { campo: "it_id", rotulo: "It/Id", tipo: "text" },
    { campo: "ni", rotulo: "NI", tipo: "text" },
    { campo: "isol", rotulo: "Isol", tipo: "text" },
    { campo: "ft", rotulo: "Ft", tipo: "text" },
    { campo: "norma", rotulo: "Norma", tipo: "text" },
    { campo: "m_total", rotulo: "M. total", tipo: "text" },
  ],
};

/**
 * Normaliza o nome para o casamento nao depender de grafia.
 *
 * NFD separa o acento numa marca combinante, e a classe abaixo remove tanto a
 * marca quanto espaco e pontuacao: "Transformador de Potência" e
 * "TRANSFORMADOR DE POTENCIA" caem na mesma chave.
 */
const normalizar = (nome: string): string =>
  (nome ?? '')
    .normalize('NFD')
    .replace(/[^A-Za-z0-9]+/g, '')
    .toLowerCase();

const POR_CHAVE = new Map(
  Object.entries(CAMPOS_POR_CATEGORIA).map(([nome, campos]) => [normalizar(nome), campos]),
);

/** Campos padrao de uma categoria, pelo nome. Vazio quando nao ha mapeamento. */
export function camposDaCategoria(nomeCategoria?: string | null): CampoDaCategoria[] {
  if (!nomeCategoria) return [];
  return POR_CHAVE.get(normalizar(nomeCategoria)) ?? [];
}
