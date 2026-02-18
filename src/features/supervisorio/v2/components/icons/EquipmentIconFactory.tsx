/**
 * EQUIPMENT ICON FACTORY
 *
 * Factory que retorna o componente de ícone correto baseado na CATEGORIA do equipamento.
 * Centraliza o mapeamento categoria → componente.
 *
 * IMPORTANTE: Agora os ícones são mapeados por CATEGORIA (não por tipo individual)
 */

import React from 'react';
import { InversorIcon } from './InversorIcon';
import { QGBTIcon } from './QGBTIcon';
import { TransformadorIcon } from './TransformadorIcon';
import { MedidorIcon } from './MedidorIcon';
import { DisjuntorIcon } from './DisjuntorIcon';
import { RedeConcessionariaIcon } from './RedeConcessionariaIcon';
import { JunctionPointIcon } from './JunctionPointIcon';
import { BancoCapacitorIcon } from './BancoCapacitorIcon';
import { ChaveIcon } from './ChaveIcon';
import { ModulosPVIcon } from './ModulosPVIcon';
import { MotorEletricoIcon } from './MotorEletricoIcon';
import { PivoIcon } from './PivoIcon';
import { CarregadorEletricoIcon } from './CarregadorEletricoIcon';

// ============================================================================
// TIPOS
// ============================================================================

interface EquipmentIconProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

type IconComponent = React.FC<EquipmentIconProps>;

// ============================================================================
// MAPEAMENTO CATEGORIA → COMPONENTE
// ============================================================================

/**
 * Mapa de CATEGORIAS de equipamento para componentes de ícone
 *
 * Categorias cadastradas no banco (18 no total):
 * 1. Banco Capacitor
 * 2. Carregador Elétrico
 * 3. Chave
 * 4. Disjuntor BT
 * 5. Disjuntor MT
 * 6. Inversor Frequência
 * 7. Inversor PV
 * 8. Medidor SSU
 * 9. Módulos PV
 * 10. Motor Elétrico
 * 11. Pivô
 * 12. Power Meter (PM)
 * 13. Relê Proteção
 * 14. RTU
 * 15. SoftStarter
 * 16. Transformador de Corrente (TC)
 * 17. Transformador de Potência
 * 18. Transformador de Potencial (TP)
 */
const ICON_MAP: Record<string, IconComponent> = {
  // ========================================================================
  // CATEGORIAS (18 categorias do banco de dados)
  // ========================================================================

  // 1. Banco Capacitor
  'BANCO_CAPACITOR': BancoCapacitorIcon,
  'BANCO CAPACITOR': BancoCapacitorIcon,

  // 2. Carregador Elétrico
  'CARREGADOR_ELETRICO': CarregadorEletricoIcon,
  'CARREGADOR ELETRICO': CarregadorEletricoIcon,
  'CARREGADOR_ELÉTRICO': CarregadorEletricoIcon,
  'CARREGADOR ELÉTRICO': CarregadorEletricoIcon,

  // 3. Chave
  'CHAVE': ChaveIcon,

  // 4. Disjuntor BT (Baixa Tensão)
  'DISJUNTOR_BT': DisjuntorIcon,
  'DISJUNTOR BT': DisjuntorIcon,

  // 5. Disjuntor MT (Média Tensão)
  'DISJUNTOR_MT': DisjuntorIcon,
  'DISJUNTOR MT': DisjuntorIcon,

  // 6. Inversor Frequência
  'INVERSOR_FREQUENCIA': InversorIcon,
  'INVERSOR FREQUENCIA': InversorIcon,
  'INVERSOR_FREQUÊNCIA': InversorIcon,
  'INVERSOR FREQUÊNCIA': InversorIcon,

  // 7. Inversor PV (Fotovoltaico)
  'INVERSOR_PV': InversorIcon,
  'INVERSOR PV': InversorIcon,

  // 8. Medidor SSU
  'MEDIDOR_SSU': MedidorIcon,
  'MEDIDOR SSU': MedidorIcon,

  // 9. Módulos PV (Painéis Solares)
  'MODULOS_PV': ModulosPVIcon,
  'MODULOS PV': ModulosPVIcon,
  'MÓDULOS_PV': ModulosPVIcon,
  'MÓDULOS PV': ModulosPVIcon,

  // 10. Motor Elétrico
  'MOTOR_ELETRICO': MotorEletricoIcon,
  'MOTOR ELETRICO': MotorEletricoIcon,
  'MOTOR_ELÉTRICO': MotorEletricoIcon,
  'MOTOR ELÉTRICO': MotorEletricoIcon,

  // 11. Pivô
  'PIVO': PivoIcon,
  'PIVÔ': PivoIcon,

  // 12. Power Meter (PM)
  'POWER_METER_PM': MedidorIcon,
  'POWER METER (PM)': MedidorIcon,
  'POWER_METER': MedidorIcon,
  'POWER METER': MedidorIcon,

  // 13. Relê Proteção (usando MedidorIcon temporariamente)
  'RELE_PROTECAO': MedidorIcon,
  'RELE PROTECAO': MedidorIcon,
  'RELÊ_PROTEÇÃO': MedidorIcon,
  'RELÊ PROTEÇÃO': MedidorIcon,

  // 14. RTU (Remote Terminal Unit) (usando MedidorIcon temporariamente)
  'RTU': MedidorIcon,

  // 15. SoftStarter (usando InversorIcon temporariamente)
  'SOFTSTARTER': InversorIcon,

  // 16. Transformador de Corrente (TC)
  'TRANSFORMADOR_DE_CORRENTE_TC': TransformadorIcon,
  'TRANSFORMADOR DE CORRENTE (TC)': TransformadorIcon,
  'TRANSFORMADOR_DE_CORRENTE': TransformadorIcon,
  'TRANSFORMADOR DE CORRENTE': TransformadorIcon,

  // 17. Transformador de Potência
  'TRANSFORMADOR_DE_POTENCIA': TransformadorIcon,
  'TRANSFORMADOR DE POTENCIA': TransformadorIcon,
  'TRANSFORMADOR_DE_POTÊNCIA': TransformadorIcon,
  'TRANSFORMADOR DE POTÊNCIA': TransformadorIcon,

  // 18. Transformador de Potencial (TP)
  'TRANSFORMADOR_DE_POTENCIAL_TP': TransformadorIcon,
  'TRANSFORMADOR DE POTENCIAL (TP)': TransformadorIcon,
  'TRANSFORMADOR_DE_POTENCIAL': TransformadorIcon,
  'TRANSFORMADOR DE POTENCIAL': TransformadorIcon,

  // ========================================================================
  // RETROCOMPATIBILIDADE - TIPOS ANTIGOS (mapeamento tipo → ícone)
  // ========================================================================

  // Inversores (todos tipos)
  'INVERSOR': InversorIcon,
  'INVERSOR_FRONIUS': InversorIcon,
  'INVERSOR_GROWATT': InversorIcon,
  'INVERSOR_SUNGROW': InversorIcon,
  'INVERSOR_HUAWEI': InversorIcon,
  'INVERSOR_WEG': InversorIcon,
  'INVERSOR_SOFAR': InversorIcon,
  'INVERSOR_ABB': InversorIcon,
  'INVERSOR_SMA': InversorIcon,

  // Disjuntores (tipos antigos)
  'DISJUNTOR': DisjuntorIcon,
  'DISJUNTOR_FECHADO': DisjuntorIcon,  // ← FIX: Usar DisjuntorIcon (mesmo do BT) ao invés de MedidorIcon
  'DISJUNTOR_ABERTO': DisjuntorIcon,   // ← FIX: Usar DisjuntorIcon (mesmo do BT) ao invés de MedidorIcon
  'DISJUNTOR_GERAL': DisjuntorIcon,
  'DISJUNTOR_TERMICO': DisjuntorIcon,
  'DISJUNTOR_MAGNETOTERMICO': DisjuntorIcon,

  // Transformadores (tipos antigos)
  'TRANSFORMADOR': TransformadorIcon,
  'TSA': TransformadorIcon,  // ← FIX: Transformador de Serviço Auxiliar
  'TRANSFORMADOR_DE_SERVICO_AUXILIAR': TransformadorIcon,
  'TRANSFORMADOR_SERVICO_AUXILIAR': TransformadorIcon,
  'TRAFO': TransformadorIcon,
  'TRAFO_REBAIXADOR': TransformadorIcon,
  'TRAFO_ELEVADOR': TransformadorIcon,

  // Medidores (tipos antigos)
  'MEDIDOR': MedidorIcon,
  'MEDIDOR_ENERGIA': MedidorIcon,
  'MEDIDOR_TRIFASICO': MedidorIcon,
  'METER_M160': MedidorIcon,
  'M160': MedidorIcon,
  'METER_M300': MedidorIcon,
  'M300': MedidorIcon,
  'LANDIS_E750': MedidorIcon,
  'A966': MedidorIcon, // Gateway A-966
  'IMS_A966': MedidorIcon,

  // Quadros elétricos (tipos antigos)
  'QGBT': QGBTIcon,
  'QD': QGBTIcon,
  'QUADRO_GERAL': QGBTIcon,
  'QUADRO_DISTRIBUICAO': QGBTIcon,

  // Outros tipos antigos
  'MOTOR': MotorEletricoIcon,
  'PAINEL_SOLAR': ModulosPVIcon,

  // Chaves (tipos antigos)
  'CHAVE_ABERTA': ChaveIcon,
  'CHAVE_FECHADA': ChaveIcon,  // ← FIX: Chave Seccionadora Fechada
  'CHAVE_FUSIVEL': ChaveIcon,

  // Equipamentos genéricos/diversos (sem ícone específico - usando MedidorIcon temporariamente)
  'BARRAMENTO': MedidorIcon,
  'BANCO_BATERIAS': MedidorIcon,
  'BOTOEIRA': MedidorIcon,
  'PAINEL_PMT': MedidorIcon,
  'PONTO': JunctionPointIcon,  // Ponto de junção
  'RETIFICADOR': MedidorIcon,
  'SALA_COMANDO': MedidorIcon,
  'CFTV': MedidorIcon,
  'TELECOM': MedidorIcon,
  'SCADA': MedidorIcon,
  'SKID': MedidorIcon,

  // Rede concessionária (tipos antigos)
  'REDE_CONCESSIONARIA': RedeConcessionariaIcon,
  'REDE': RedeConcessionariaIcon,
  'ENTRADA_ENERGIA': RedeConcessionariaIcon,
  'CONCESSIONARIA': RedeConcessionariaIcon,

  // Ponto de junção (virtual, não é categoria)
  'JUNCTION_POINT': JunctionPointIcon,
  'JP': JunctionPointIcon,
  'JUNCAO': JunctionPointIcon,

  // Fallback genérico
  'EQUIPAMENTO': MedidorIcon,
};

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Retorna o componente de ícone apropriado para uma categoria de equipamento
 *
 * @param categoria - Categoria do equipamento (ex: "Inversor PV", "Chave", "Motor Elétrico")
 * @returns Componente React do ícone
 *
 * @example
 * const IconComponent = getEquipmentIcon("Inversor PV");
 * return <IconComponent width={80} height={80} color="#1F2937" />;
 */
export const getEquipmentIcon = (categoria: string | undefined | null): IconComponent => {
  // Se categoria é undefined, null ou vazio, retornar ícone padrão
  if (!categoria) {
    console.warn('Categoria não fornecida. Usando ícone padrão.');
    return MedidorIcon;
  }

  // Normalizar categoria: uppercase e remover caracteres especiais mantendo espaços
  const categoriaNormalizada = categoria
    .toUpperCase()
    .replace(/[\-()]/g, '_')
    .trim();

  // Buscar ícone no mapa (primeiro tenta com underscores, depois com espaços)
  let IconComponent = ICON_MAP[categoriaNormalizada] || ICON_MAP[categoriaNormalizada.replace(/_/g, ' ')];

  // Se não encontrar, retornar ícone padrão (medidor como fallback)
  if (!IconComponent) {
    console.warn(`Ícone não encontrado para categoria "${categoria}". Usando ícone padrão.`);
    return MedidorIcon;
  }

  return IconComponent;
};

// ============================================================================
// COMPONENTE WRAPPER (OPCIONAL)
// ============================================================================

interface EquipmentIconWrapperProps extends EquipmentIconProps {
  categoria?: string | null;
  tipo?: string | null; // Retrocompatibilidade - usa tipo se categoria não fornecida
}

/**
 * Componente wrapper que automaticamente seleciona e renderiza o ícone correto
 *
 * @example
 * <EquipmentIconWrapper categoria="Inversor PV" width={80} height={80} />
 * <EquipmentIconWrapper tipo="INVERSOR_FRONIUS" width={80} height={80} /> // Retrocompatibilidade
 */
export const EquipmentIconWrapper: React.FC<EquipmentIconWrapperProps> = ({
  categoria,
  tipo,
  ...props
}) => {
  // Usa categoria se fornecida, senão usa tipo (retrocompatibilidade)
  const IconComponent = getEquipmentIcon(categoria || tipo);
  return <IconComponent {...props} />;
};

// ============================================================================
// UTILITÁRIOS
// ============================================================================

/**
 * Retorna lista de todas as categorias de equipamento suportadas
 */
export const getSupportedEquipmentCategories = (): string[] => {
  return Object.keys(ICON_MAP);
};

/**
 * Verifica se uma categoria de equipamento tem ícone disponível
 */
export const hasEquipmentIcon = (categoria: string): boolean => {
  const categoriaNormalizada = categoria
    .toUpperCase()
    .replace(/[\-()]/g, '_')
    .trim();

  return categoriaNormalizada in ICON_MAP || categoriaNormalizada.replace(/_/g, ' ') in ICON_MAP;
};

/**
 * Retorna estatísticas de ícones implementados
 */
export const getIconStats = () => {
  const total = Object.keys(ICON_MAP).length;
  const unique = new Set(Object.values(ICON_MAP)).size;

  return {
    total, // Total de categorias mapeadas
    unique, // Ícones únicos (componentes diferentes)
    categoriasSemIcone: [
      'Relê Proteção (usando MedidorIcon temporariamente)',
      'RTU (usando MedidorIcon temporariamente)',
      'SoftStarter (usando InversorIcon temporariamente)',
    ],
  };
};
