import { useState } from 'react';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { BaseTable } from '@/components/common/base-table/BaseTable';
import { BaseFilters } from '@/components/common/base-filters/BaseFilters';
import { Plus, Trash2 } from 'lucide-react';
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
  // Exclusão de uma (ícone da linha) ou várias (seleção) — a mesma confirmação serve às duas.
  const [paraExcluir, setParaExcluir] = useState<string[]>([]);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [excluindo, setExcluindo] = useState(false);

  const handleDelete = async () => {
    if (paraExcluir.length === 0) return;
    setExcluindo(true);
    try {
      if (paraExcluir.length === 1) {
        await RegrasLogsService.remove(paraExcluir[0]);
        toast({ title: 'Regra excluída' });
      } else {
        const r = await RegrasLogsService.removeMany(paraExcluir);
        toast({
          title: `${r.removidas} regra(s) excluída(s)`,
          description: r.falhas.length ? `${r.falhas.length} não puderam ser excluídas (sem permissão ou já removidas).` : undefined,
          variant: r.falhas.length ? 'destructive' : undefined,
        });
      }
      setSelecionadas((sel) => sel.filter((id) => !paraExcluir.includes(id)));
      refresh();
    } catch (error: any) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    } finally {
      setExcluindo(false);
      setParaExcluir([]);
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
            {selecionadas.length > 0 && (
              <button
                onClick={() => setParaExcluir(selecionadas)}
                className="w-full lg:w-auto inline-flex items-center justify-center rounded-md border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 whitespace-nowrap"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Excluir selecionadas ({selecionadas.length})</span>
              </button>
            )}
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
              onDelete={(regra: any) => setParaExcluir([String(regra.id)])}
              selectedIds={selecionadas}
              onSelectionChange={setSelecionadas}
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

        <AlertDialog open={paraExcluir.length > 0} onOpenChange={(o) => { if (!o && !excluindo) setParaExcluir([]); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                {paraExcluir.length > 1
                  ? `Excluir as ${paraExcluir.length} regras selecionadas? Os alarmes delas deixam de ser gerados.`
                  : 'Excluir esta regra? Os alarmes dela deixam de ser gerados.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={excluindo}>
                {excluindo ? 'Excluindo…' : paraExcluir.length > 1 ? `Excluir ${paraExcluir.length}` : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Layout.Main>
    </Layout>
  );
}
