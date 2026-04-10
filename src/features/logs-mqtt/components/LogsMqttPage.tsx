import { useState } from 'react';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { BaseTable } from '@/components/common/base-table/BaseTable';
import { BaseFilters } from '@/components/common/base-filters/BaseFilters';
import { RefreshCw } from 'lucide-react';
import { useGenericModal } from '@/hooks/useGenericModal';
import { toast } from '@/hooks/use-toast';
import { LogMqttDetailModal } from './log-mqtt-detail-modal';
import { useLogsMqtt } from '../hooks/useLogsMqtt';
import { logsMqttTableColumns } from '../config/table-config';
import { logsMqttFilterConfig } from '../config/filter-config';
import { LogMqtt } from '../types';
import { LogsMqttService } from '@/services/logs-mqtt.services';
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

export function LogsMqttPage() {
  const { logs, total, loading, filters, setFilters, refresh } = useLogsMqtt();
  const { modalState, openModal, closeModal } = useGenericModal<LogMqtt>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await LogsMqttService.remove(deleteId);
      toast({ title: 'Log removido com sucesso' });
      refresh();
    } catch (error: any) {
      toast({ title: 'Erro ao remover log', variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <Layout>
      <Layout.Main>
        <div className="flex flex-col h-full w-full">
          <TitleCard
            title="Logs MQTT"
            description="Logs gerados pelas regras de monitoramento MQTT"
          />

          <div className="flex flex-col lg:flex-row gap-3 md:gap-4 mb-4 md:mb-6 lg:items-start">
            <div className="flex-1">
              <BaseFilters
                filters={filters}
                onFilterChange={setFilters}
                config={logsMqttFilterConfig}
              />
            </div>
            <button
              onClick={refresh}
              disabled={loading}
              className="btn-minimal-primary w-full lg:w-auto lg:mt-0 whitespace-nowrap"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <BaseTable
              data={logs as any}
              columns={logsMqttTableColumns as any}
              loading={loading}
              pagination={{
                page: filters.page,
                limit: filters.limit,
                total,
                totalPages: Math.ceil(total / filters.limit),
              }}
              onPageChange={(page) => setFilters({ page })}
              onView={(log: any) => openModal('view', log)}
              onDelete={(log: any) => setDeleteId(log.id)}
              emptyMessage="Nenhum log registrado"
            />
          </div>
        </div>

        <LogMqttDetailModal
          isOpen={modalState.isOpen}
          log={modalState.entity}
          onClose={closeModal}
        />

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusao</AlertDialogTitle>
              <AlertDialogDescription>
                Deseja realmente excluir este log?
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
