import { useState } from 'react';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { BaseTable } from '@/components/common/base-table/BaseTable';
import { BaseFilters } from '@/components/common/base-filters/BaseFilters';
import { Plus } from 'lucide-react';
import { useGenericModal } from '@/hooks/useGenericModal';
import { toast } from '@/hooks/use-toast';
import { RegraLogModal } from './regra-log-modal';
import { useRegrasLogs } from '../hooks/useRegrasLogs';
import { regrasLogsTableColumns } from '../config/table-config';
import { regrasLogsFilterConfig } from '../config/filter-config';
import { RegraLog } from '../types';
import { RegrasLogsService } from '@/services/regras-logs.services';
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

export function RegrasLogsPage() {
  const { regras, total, loading, filters, setFilters, refresh } = useRegrasLogs();
  const { modalState, openModal, closeModal } = useGenericModal<RegraLog>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await RegrasLogsService.remove(deleteId);
      toast({ title: 'Regra removida com sucesso' });
      refresh();
    } catch (error: any) {
      toast({ title: 'Erro ao remover regra', variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <Layout>
      <Layout.Main>
        <div className="flex flex-col h-full w-full">
          <TitleCard
            title="Regras de Logs MQTT"
            description="Gerencie as regras de monitoramento MQTT"
          />

          <div className="flex flex-col lg:flex-row gap-3 md:gap-4 mb-4 md:mb-6 lg:items-start">
            <div className="flex-1">
              <BaseFilters
                filters={filters}
                onFilterChange={setFilters}
                config={regrasLogsFilterConfig}
              />
            </div>
            <button
              onClick={() => openModal('create')}
              className="btn-minimal-primary w-full lg:w-auto lg:mt-0 whitespace-nowrap"
            >
              <Plus className="mr-2 h-4 w-4" />
              <span>Nova Regra</span>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <BaseTable
              data={regras as any}
              columns={regrasLogsTableColumns as any}
              loading={loading}
              pagination={{
                page: filters.page,
                limit: filters.limit,
                total,
                totalPages: Math.ceil(total / filters.limit),
              }}
              onPageChange={(page) => setFilters({ page })}
              onView={(regra: any) => openModal('view', regra)}
              onEdit={(regra: any) => openModal('edit', regra)}
              onDelete={(regra: any) => setDeleteId(regra.id)}
              emptyMessage="Nenhuma regra cadastrada"
            />
          </div>
        </div>

        <RegraLogModal
          isOpen={modalState.isOpen}
          mode={modalState.mode}
          regra={modalState.entity}
          onClose={closeModal}
          onSuccess={refresh}
        />

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusao</AlertDialogTitle>
              <AlertDialogDescription>
                Deseja realmente excluir esta regra? Essa acao nao pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Layout.Main>
    </Layout>
  );
}
