// src/pages/usinas/index.tsx
import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { MetricsCards } from '@/features/usinas/components/metrics-cards';
import { MapaUsinas } from '@/features/usinas/components/mapa-usinas';
import { StatusGeral } from '@/features/usinas/components/status-geral';
import { ModalDetalhesUsina } from '@/features/usinas/components/modal-detalhes-usina';

// Dados simulados das usinas
const usinasData = {
  metricas: {
    tensaoMedia: 223,
    tensaoMaxima: 239,
    tensaoMinima: 210,
    consumo: 450,
    geracao: 125,
    energia: 1280
  },
  statusGeral: {
    ativosOperacao: 22,
    ativosAlerta: 5,
    ativosFalha: 3,
    ultimaSincronizacao: '15:30'
  },
  usinas: [
    { id: 1, nome: 'Usina Solar Sobradinho - BA', lat: -9.4194, lng: -40.8234, status: 'operacao', potencia: 150 },
    { id: 2, nome: 'Usina Solar Pirapora - MG', lat: -17.3553, lng: -44.9306, status: 'alerta', potencia: 120 },
    { id: 3, nome: 'Usina Eólica Caetité - BA', lat: -14.0688, lng: -42.5023, status: 'operacao', potencia: 200 },
    { id: 4, nome: 'Usina Solar Brasília - DF', lat: -15.7975, lng: -47.8919, status: 'falha', potencia: 80 },
    { id: 5, nome: 'Usina Hidrelétrica Itaipu - PR', lat: -25.4075, lng: -54.5886, status: 'operacao', potencia: 300 },
    { id: 6, nome: 'Usina Solar Campinas - SP', lat: -22.9099, lng: -47.0626, status: 'alerta', potencia: 180 },
    { id: 7, nome: 'Usina Eólica Parnaíba - PI', lat: -2.9038, lng: -41.7767, status: 'operacao', potencia: 220 },
    { id: 8, nome: 'Usina Solar Salvador - BA', lat: -12.9714, lng: -38.5014, status: 'falha', potencia: 95 },
    { id: 9, nome: 'Usina Biomassa Ribeirão Preto - SP', lat: -21.1775, lng: -47.8103, status: 'operacao', potencia: 110 },
    { id: 10, nome: 'Usina Solar Belo Horizonte - MG', lat: -19.9167, lng: -43.9345, status: 'alerta', potencia: 160 },
    { id: 11, nome: 'Usina Eólica Osório - RS', lat: -29.8864, lng: -50.2697, status: 'operacao', potencia: 250 },
    { id: 12, nome: 'Usina Solar Goiânia - GO', lat: -16.6869, lng: -49.2648, status: 'operacao', potencia: 140 },
    { id: 13, nome: 'Usina Hidrelétrica Curitiba - PR', lat: -25.4244, lng: -49.2654, status: 'falha', potencia: 280 },
    { id: 14, nome: 'Usina Solar Fortaleza - CE', lat: -3.7319, lng: -38.5267, status: 'operacao', potencia: 170 },
    { id: 15, nome: 'Usina Eólica Recife - PE', lat: -8.0476, lng: -34.8770, status: 'alerta', potencia: 190 }
  ]
};

export function UsinasPage() {
  const [usinaSelecionada, setUsinaSelecionada] = useState<number | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  
  const usina = usinaSelecionada ? 
    usinasData.usinas.find(u => u.id === usinaSelecionada) : 
    null;

  // Função para apenas selecionar usina visualmente (clique na bolinha)
  const handleUsinaSelect = (id: number) => {
    setUsinaSelecionada(id);
    // NÃO abre o modal
  };

  // Função para abrir modal (botão "Ver Detalhes")
  const handleUsinaClick = (id: number) => {
    setUsinaSelecionada(id);
    setModalAberto(true); // Abre o modal
  };

  const handleCloseModal = () => {
    setModalAberto(false);
    // Pequeno delay para que a animação termine antes de limpar a seleção
    setTimeout(() => setUsinaSelecionada(null), 300);
  };

  // Escutar evento customizado para abrir modal via popup do mapa
  useEffect(() => {
    const handleAbrirModal = (event: any) => {
      const { id } = event.detail;
      handleUsinaClick(id);
    };
    
    window.addEventListener('abrirModalUsina', handleAbrirModal);
    
    return () => {
      window.removeEventListener('abrirModalUsina', handleAbrirModal);
    };
  }, []);

  return (
    <Layout>
      <Layout.Main>
        <TitleCard
          title="Controle de Usinas"
          description="Monitoramento e controle das usinas de energia em tempo real"
        />
        
        <div className="space-y-6">
          {/* Primeira linha - Métricas */}
          <div className="grid grid-cols-1">
            <MetricsCards data={usinasData.metricas} />
          </div>

          {/* Segunda linha - Mapa e Status */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Mapa das Usinas */}
            <div className="lg:col-span-3">
              <MapaUsinas 
                usinas={usinasData.usinas}
                onUsinaClick={handleUsinaSelect}
                usinaSelecionada={usinaSelecionada}
              />
            </div>
            
            {/* Status Geral */}
            <div className="lg:col-span-1">
              <StatusGeral data={usinasData.statusGeral} />
            </div>
          </div>
        </div>
        
        {/* Modal de Detalhes */}
        <ModalDetalhesUsina 
          usina={usina}
          isOpen={modalAberto}
          onClose={handleCloseModal}
        />
      </Layout.Main>
    </Layout>
  );
}