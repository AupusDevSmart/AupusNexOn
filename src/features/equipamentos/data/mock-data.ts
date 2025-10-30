// src/features/equipamentos/data/mock-data.ts - ESTRUTURA SIMPLIFICADA
import { Equipamento } from '../types';

// ============================================================================
// MOCK DATA SIMPLIFICADO - Proprietário → Planta → Equipamento → Componente
// ============================================================================

// Dados base para relacionamentos
const baseProprietario = {
  id: '1',
  razaoSocial: 'Empresa ABC Ltda',
  cnpjCpf: '12.345.678/0001-90',
  tipo: 'pessoa_juridica' as const
};

const basePlanta = {
  id: '1',
  nome: 'Planta Industrial São Paulo',
  cnpj: '12.345.678/0001-90',
  proprietarioId: '1',
  criadoEm: '2024-01-15T10:30:00Z'
};

const proprietario2 = {
  id: '2',
  razaoSocial: 'João Silva',
  cnpjCpf: '123.456.789-00',
  tipo: 'pessoa_fisica' as const
};

const planta2 = {
  id: '4',
  nome: 'Oficina João Silva',
  cnpj: '55.666.777/0001-88',
  proprietarioId: '2',
  criadoEm: '2024-02-10T16:45:00Z'
};

// ============================================================================
// EQUIPAMENTOS MOCK - ESTRUTURA SIMPLIFICADA
// ============================================================================
export const mockEquipamentos: Equipamento[] = [
  // ============================================================================
  // EQUIPAMENTOS UC (4 equipamentos)
  // ============================================================================
  {
    id: '1',
    criadoEm: '2024-01-15T10:30:00Z',
    nome: 'Sistema de Controle Principal',
    classificacao: 'UC', // ← UC = Equipamento
    unidadeId: '1',
    proprietarioId: '1',
    proprietario: baseProprietario,
    planta: basePlanta,
    fabricante: 'Siemens',
    modelo: 'SIMATIC S7-1500',
    numeroSerie: 'SIE2024001',
    criticidade: '5', // Muito Alta
    dataImobilizacao: '2024-01-15',
    vidaUtil: 10,
    valorImobilizado: 15000.00,
    valorContabil: 13500.00,
    localizacao: 'Produção', // ← NOVA LÓGICA: Campo de texto livre
    tipo: 'Sistema de Controle',
    totalComponentes: 2
  },

  {
    id: '2',
    criadoEm: '2024-01-20T14:15:00Z',
    nome: 'Sistema de Lubrificação',
    classificacao: 'UC', // ← UC = Equipamento
    unidadeId: '1',
    proprietarioId: '1',
    proprietario: baseProprietario,
    planta: basePlanta,
    fabricante: 'SKF',
    modelo: 'SYSTEM 24',
    numeroSerie: 'SKF2024001',
    criticidade: '3', // Média
    valorImobilizado: 5500.00,
    valorContabil: 4812.50,
    localizacao: 'Produção',
    tipo: 'Sistema de Lubrificação',
    totalComponentes: 1
  },

  {
    id: '3',
    criadoEm: '2024-02-10T16:45:00Z',
    nome: 'Compressor de Ar Industrial',
    classificacao: 'UC', // ← UC = Equipamento
    unidadeId: '4',
    proprietarioId: '2',
    proprietario: proprietario2,
    planta: planta2,
    fabricante: 'Atlas Copco',
    modelo: 'GA 22',
    numeroSerie: 'AC2024001',
    criticidade: '4', // Alta
    valorImobilizado: 25000.00,
    valorContabil: 22500.00,
    localizacao: 'Manutenção',
    tipo: 'Compressor',
    totalComponentes: 2
  },

  {
    id: '4',
    criadoEm: '2024-02-25T11:30:00Z',
    nome: 'Esteira Transportadora',
    classificacao: 'UC', // ← UC = Equipamento
    unidadeId: '1',
    proprietarioId: '1',
    proprietario: baseProprietario,
    planta: basePlanta,
    fabricante: 'Conveyor Tech',
    modelo: 'CT-500',
    numeroSerie: 'CT2024001',
    criticidade: '2', // Baixa
    valorImobilizado: 8000.00,
    valorContabil: 7200.00,
    localizacao: 'Logística',
    tipo: 'Esteira',
    totalComponentes: 0
  },


  // ============================================================================
// COMPONENTES UAR (5 componentes)
// ============================================================================
{
 id: '10',
 criadoEm: '2024-01-15T11:00:00Z',
 nome: 'Sensor de Temperatura',
 classificacao: 'UAR', // ← UAR = Componente
 equipamentoPaiId: '1', // ← Pertence ao UC "Sistema de Controle Principal"
 proprietarioId: '1', // Herdado do UC pai
 proprietario: baseProprietario,
 planta: basePlanta,
 equipamentoPai: {
   id: '1',
   nome: 'Sistema de Controle Principal',
   classificacao: 'UC',
   criticidade: '5',
   criadoEm: '2024-01-15T10:30:00Z'
 },
 fabricante: 'Siemens',
 modelo: 'SITRANS T',
 numeroSerie: 'SIE-TEMP-001',
 criticidade: '4', // Alta
 tipo: 'Sensor de Temperatura',
 dataInstalacao: '2024-01-15',
 localizacao: 'Entrada do Motor - Lado Direito',
 totalComponentes: 0
},

{
 id: '11',
 criadoEm: '2024-01-15T11:15:00Z',
 nome: 'Sensor de Vibração',
 classificacao: 'UAR', // ← UAR = Componente
 equipamentoPaiId: '1', // ← Pertence ao UC "Sistema de Controle Principal"
 proprietarioId: '1', // Herdado do UC pai
 proprietario: baseProprietario,
 planta: basePlanta,
 equipamentoPai: {
   id: '1',
   nome: 'Sistema de Controle Principal',
   classificacao: 'UC',
   criticidade: '5',
   criadoEm: '2024-01-15T10:30:00Z'
 },
 fabricante: 'SKF',
 modelo: 'CMSS 2200',
 numeroSerie: 'SKF-VIB-001',
 criticidade: '3', // Média
 tipo: 'Sensor de Vibração',
 dataInstalacao: '2024-01-15',
 localizacao: 'Mancal Principal - Lado de Acionamento',
 totalComponentes: 0
},

{
 id: '12',
 criadoEm: '2024-01-20T15:00:00Z',
 nome: 'Bomba de Óleo',
 classificacao: 'UAR', // ← UAR = Componente
 equipamentoPaiId: '2', // ← Pertence ao UC "Sistema de Lubrificação"
 proprietarioId: '1', // Herdado do UC pai
 proprietario: baseProprietario,
 planta: basePlanta,
 equipamentoPai: {
   id: '2',
   nome: 'Sistema de Lubrificação',
   classificacao: 'UC',
   criticidade: '3',
   criadoEm: '2024-01-20T14:15:00Z'
 },
 fabricante: 'SKF',
 modelo: 'BO-12V',
 numeroSerie: 'SKF-BO-001',
 criticidade: '2', // Baixa
 tipo: 'Bomba de Óleo',
 dataInstalacao: '2024-01-20',
 localizacao: 'Reservatório Principal - Base',
 totalComponentes: 0
},

{
 id: '13',
 criadoEm: '2024-02-10T17:00:00Z',
 nome: 'Filtro de Ar',
 classificacao: 'UAR', // ← UAR = Componente
 equipamentoPaiId: '3', // ← Pertence ao UC "Compressor de Ar Industrial"
 proprietarioId: '2', // Herdado do UC pai
 proprietario: proprietario2,
 planta: planta2,
 equipamentoPai: {
   id: '3',
   nome: 'Compressor de Ar Industrial',
   classificacao: 'UC',
   criticidade: '4',
   criadoEm: '2024-02-10T16:45:00Z'
 },
 fabricante: 'Atlas Copco',
 modelo: 'AF-22',
 numeroSerie: 'AC-FILTER-001',
 criticidade: '3', // Média
 tipo: 'Filtro de Ar',
 dataInstalacao: '2024-02-10',
 localizacao: 'Entrada de Ar - Lateral Esquerda',
 totalComponentes: 0
},

{
 id: '14',
 criadoEm: '2024-02-10T17:15:00Z',
 nome: 'Válvula de Segurança',
 classificacao: 'UAR', // ← UAR = Componente
 equipamentoPaiId: '3', // ← Pertence ao UC "Compressor de Ar Industrial"
 proprietarioId: '2', // Herdado do UC pai
 proprietario: proprietario2,
 planta: planta2,
 equipamentoPai: {
   id: '3',
   nome: 'Compressor de Ar Industrial',
   classificacao: 'UC',
   criticidade: '4',
   criadoEm: '2024-02-10T16:45:00Z'
 },
 fabricante: 'Atlas Copco',
 modelo: 'SV-22',
 numeroSerie: 'AC-VALVE-001',
 criticidade: '5', // Muito Alta (segurança)
 tipo: 'Válvula de Segurança',
 dataInstalacao: '2024-02-10',
 localizacao: 'Reservatório - Saída Principal',
 totalComponentes: 0
}
]