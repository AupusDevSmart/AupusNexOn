// src/features/plantas/data/mock-data.ts - ESTRUTURA SIMPLIFICADA
import { Planta } from '../types';

export const mockPlantas: Planta[] = [
  {
    id: "1",
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    criadoEm: '2024-01-15T10:30:00Z',
    atualizadoEm: '2024-01-15T10:30:00Z',
    nome: 'Planta Industrial São Paulo',
    cnpj: '12.345.678/0001-90',
    localizacao: 'Zona Sul - Galpão Principal',
    horarioFuncionamento: '06:00 às 22:00',
    endereco: {
      logradouro: 'Av. Industrial, 1000',
      bairro: 'Distrito Industrial',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01234-567'
    },
    proprietarioId: "1",
    proprietario: {
      id: "1",
      nome: 'Empresa ABC Ltda',
      cpf_cnpj: '12.345.678/0001-90',
      tipo: 'pessoa_juridica'
    }
  },
  {
    id: "2",
    createdAt: '2024-01-20T14:15:00Z',
    updatedAt: '2024-01-20T14:15:00Z',
    criadoEm: '2024-01-20T14:15:00Z',
    atualizadoEm: '2024-01-20T14:15:00Z',
    nome: 'Centro de Distribuição Rio',
    cnpj: '98.765.432/0001-10',
    localizacao: 'Porto - Armazém 3',
    horarioFuncionamento: '24 horas',
    endereco: {
      logradouro: 'Rua do Porto, 500',
      bairro: 'Porto Maravilha',
      cidade: 'Rio de Janeiro',
      uf: 'RJ',
      cep: '20000-123'
    },
    proprietarioId: "3",
    proprietario: {
      id: "3",
      nome: 'Maria Santos Consultoria ME',
      cpf_cnpj: '98.765.432/0001-10',
      tipo: 'pessoa_juridica'
    }
  },
  {
    id: "3",
    createdAt: '2024-02-05T09:20:00Z',
    updatedAt: '2024-02-05T09:20:00Z',
    criadoEm: '2024-02-05T09:20:00Z',
    atualizadoEm: '2024-02-05T09:20:00Z',
    nome: 'Unidade Administrativa BH',
    cnpj: '11.222.333/0001-44',
    localizacao: 'Centro - Edifício Comercial',
    horarioFuncionamento: '08:00 às 18:00',
    endereco: {
      logradouro: 'Av. Afonso Pena, 3000',
      bairro: 'Centro',
      cidade: 'Belo Horizonte',
      uf: 'MG',
      cep: '30000-456'
    },
    proprietarioId: "4",
    proprietario: {
      id: "4",
      nome: 'Tech Solutions Ltda',
      cpf_cnpj: '11.222.333/0001-44',
      tipo: 'pessoa_juridica'
    }
  },
  {
    id: "4",
    createdAt: '2024-02-10T16:45:00Z',
    updatedAt: '2024-02-10T16:45:00Z',
    criadoEm: '2024-02-10T16:45:00Z',
    atualizadoEm: '2024-02-10T16:45:00Z',
    nome: 'Oficina João Silva',
    cnpj: '55.666.777/0001-88',
    localizacao: 'Zona Norte - Oficina Principal',
    horarioFuncionamento: '07:00 às 17:00',
    endereco: {
      logradouro: 'Rua das Oficinas, 200',
      bairro: 'Vila Industrial',
      cidade: 'Campinas',
      uf: 'SP',
      cep: '13000-789'
    },
    proprietarioId: "2",
    proprietario: {
      id: "2",
      nome: 'João Silva',
      cpf_cnpj: '123.456.789-00',
      tipo: 'pessoa_fisica'
    }
  },
  {
    id: "5",
    createdAt: '2024-02-18T15:10:00Z',
    updatedAt: '2024-02-18T15:10:00Z',
    criadoEm: '2024-02-18T15:10:00Z',
    atualizadoEm: '2024-02-18T15:10:00Z',
    nome: 'Depósito Ana Costa',
    cnpj: '77.888.999/0001-22',
    localizacao: 'Subúrbio - Galpão B',
    horarioFuncionamento: '08:00 às 18:00',
    endereco: {
      logradouro: 'Estrada do Depósito, 1500',
      bairro: 'Jardim Industrial',
      cidade: 'Guarulhos',
      uf: 'SP',
      cep: '07000-321'
    },
    proprietarioId: "5",
    proprietario: {
      id: "5",
      nome: 'Ana Costa',
      cpf_cnpj: '987.654.321-00',
      tipo: 'pessoa_fisica'
    }
  },
  {
    id: "6",
    createdAt: '2024-02-25T11:30:00Z',
    updatedAt: '2024-02-25T11:30:00Z',
    criadoEm: '2024-02-25T11:30:00Z',
    atualizadoEm: '2024-02-25T11:30:00Z',
    nome: 'Fábrica Indústria XYZ',
    cnpj: '33.444.555/0001-66',
    localizacao: 'Distrito Industrial - Setor A',
    horarioFuncionamento: '05:00 às 23:00',
    endereco: {
      logradouro: 'Av. das Indústrias, 2500',
      bairro: 'Distrito Industrial',
      cidade: 'São Bernardo do Campo',
      uf: 'SP',
      cep: '09000-654'
    },
    proprietarioId: "6",
    proprietario: {
      id: "6",
      nome: 'Indústria XYZ S.A.',
      cpf_cnpj: '55.666.777/0001-88',
      tipo: 'pessoa_juridica'
    }
  },
  {
    id: "7",
    createdAt: '2024-03-01T08:45:00Z',
    updatedAt: '2024-03-01T08:45:00Z',
    criadoEm: '2024-03-01T08:45:00Z',
    atualizadoEm: '2024-03-01T08:45:00Z',
    nome: 'Unidade Logística Porto Alegre',
    cnpj: '99.111.222/0001-33',
    localizacao: 'Zona Portuária - Terminal 2',
    horarioFuncionamento: '24 horas',
    endereco: {
      logradouro: 'Av. Mauá, 800',
      bairro: 'Centro Histórico',
      cidade: 'Porto Alegre',
      uf: 'RS',
      cep: '90000-987'
    },
    proprietarioId: "1",
    proprietario: {
      id: "1",
      nome: 'Empresa ABC Ltda',
      cpf_cnpj: '12.345.678/0001-90',
      tipo: 'pessoa_juridica'
    }
  },
  {
    id: "8",
    createdAt: '2024-03-10T13:20:00Z',
    updatedAt: '2024-03-10T13:20:00Z',
    criadoEm: '2024-03-10T13:20:00Z',
    atualizadoEm: '2024-03-10T13:20:00Z',
    nome: 'Filial Administrativa Brasília',
    cnpj: '44.555.666/0001-77',
    localizacao: 'Asa Sul - SCS Quadra 2',
    horarioFuncionamento: '08:00 às 18:00',
    endereco: {
      logradouro: 'SCS Quadra 2, Bloco A',
      bairro: 'Asa Sul',
      cidade: 'Brasília',
      uf: 'DF',
      cep: '70000-456'
    },
    proprietarioId: "4",
    proprietario: {
      id: "4",
      nome: 'Tech Solutions Ltda',
      cpf_cnpj: '11.222.333/0001-44',
      tipo: 'pessoa_juridica'
    }
  }
];
