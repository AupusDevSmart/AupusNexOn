import { BaseModal } from '@/components/common/base-modal/BaseModal';
import { ScrollText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { RegrasLogsService } from '@/services/regras-logs.services';
import { RegraLog } from '../types';
import { regrasLogsFormFields, regrasLogsFormGroups } from '../config/form-config';

interface RegraLogModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'view';
  regra?: RegraLog | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function RegraLogModal({ isOpen, mode, regra, onClose, onSuccess }: RegraLogModalProps) {
  const getModalTitle = () => {
    const titles = {
      create: 'Nova Regra',
      edit: 'Editar Regra',
      view: 'Detalhes da Regra',
    };
    return titles[mode];
  };

  const handleSubmit = async (data: any) => {
    try {
      const payload = {
        equipamento_id: data.equipamento_id?.trim(),
        nome: data.nome,
        campo_json: data.campo_json,
        operador: data.operador || '<',
        valor: Number(data.valor) || 0,
        mensagem: data.mensagem,
        severidade: data.severidade || 'MEDIA',
        cooldown_minutos: Number(data.cooldown_minutos) || 5,
        ativo: data.ativo !== false,
      };

      if (mode === 'create') {
        await RegrasLogsService.create(payload);
        toast({ title: 'Regra criada com sucesso' });
      } else if (mode === 'edit' && regra) {
        await RegrasLogsService.update(regra.id, payload);
        toast({ title: 'Regra atualizada com sucesso' });
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: error.response?.data?.message || 'Erro ao salvar',
        variant: 'destructive',
      });
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      mode={mode}
      entity={regra as any}
      title={getModalTitle()}
      icon={<ScrollText className="h-5 w-5" />}
      formFields={regrasLogsFormFields}
      groups={regrasLogsFormGroups}
      onClose={onClose}
      onSubmit={handleSubmit}
    />
  );
}
