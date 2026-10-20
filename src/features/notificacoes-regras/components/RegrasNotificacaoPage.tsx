import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { BaseTable } from '@/components/common/base-table/BaseTable';
import { BaseFilters } from '@/components/common/base-filters/BaseFilters';
import { useGenericModal } from '@/hooks/useGenericModal';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RegraNotificacao, RegraNotificacaoLinha, RegrasNotificacaoService } from '@/services/regras-notificacao.services';
import { useRegrasNotificacao } from '../hooks/useRegrasNotificacao';
import { regrasNotificacaoColumns, regrasNotificacaoFilters } from '../config';
import { RegraNotificacaoModal } from './RegraNotificacaoModal';

/** NEXON-25 — Configurações › Notificações. */
export function RegrasNotificacaoPage() {
  const { regras, total, loading, filters, setFilters, refresh } = useRegrasNotificacao();
  const { modalState, openModal, closeModal } = useGenericModal<RegraNotificacaoLinha>();
  const [paraExcluir, setParaExcluir] = useState<RegraNotificacao | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const excluir = async () => {
    if (!paraExcluir) return;
    setExcluindo(true);
    try {
      await RegrasNotificacaoService.remove(paraExcluir.id);
      toast({ title: 'Regra excluída' });
      refresh();
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    } finally {
      setExcluindo(false);
      setParaExcluir(null);
    }
  };

  return (
    <Layout>
      <Layout.Main>
        <div className="flex flex-col h-full w-full">
          <TitleCard
            title="Notificações"
            description="Quem é avisado, de quê e por qual canal. Os avisos aparecem em Alarmes e Eventos."
          />

          <div className="flex flex-col lg:flex-row gap-3 mb-6 lg:items-start">
            <div className="flex-1">
              <BaseFilters filters={filters} onFilterChange={setFilters} config={regrasNotificacaoFilters} />
            </div>
            <button
              onClick={() => openModal('create')}
              className="btn-minimal-primary flex-1 lg:flex-none whitespace-nowrap"
            >
              <Plus className="mr-2 h-4 w-4" />
              <span>Nova regra</span>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <BaseTable
              data={regras}
              columns={regrasNotificacaoColumns}
              loading={loading}
              pagination={{
                page: filters.page,
                limit: filters.limit,
                total,
                totalPages: Math.ceil(total / filters.limit),
              }}
              onPageChange={(page) => setFilters({ page })}
              onView={(r) => openModal('view', r)}
              onEdit={(r) => openModal('edit', r)}
              onDelete={(r) => setParaExcluir(r)}
              emptyMessage="Nenhuma regra de notificação. Crie a primeira em Nova regra."
            />
          </div>
        </div>

        <RegraNotificacaoModal
          isOpen={modalState.isOpen}
          mode={modalState.mode as 'create' | 'edit' | 'view'}
          regra={modalState.entity}
          onClose={closeModal}
          onSuccess={refresh}
        />

        <AlertDialog open={!!paraExcluir} onOpenChange={(o) => !o && !excluindo && setParaExcluir(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
              <AlertDialogDescription>
                {paraExcluir ? `"${paraExcluir.nome}" deixa de avisar as pessoas dela.` : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={excluir} disabled={excluindo}>
                {excluindo ? 'Excluindo…' : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Layout.Main>
    </Layout>
  );
}
