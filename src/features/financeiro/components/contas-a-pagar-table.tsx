// src/features/financeiro/components/contas-a-pagar-table.tsx
import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  ArrowUpDown, 
  HelpCircle, 
  AlertCircle,
  Check,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  X,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// Interfaces TypeScript
interface Despesa {
  id: string;
  fornecedor?: string;
  descricao: string;
  total: number;
  vencimento: string;
  situacao: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  dataEmissao?: string;
  dataPagamento?: string;
  formaPagamento?: string;
  contaBanco?: string;
  valorPago?: number;
  observacoes?: string;
}

interface DespesaModalProps {
  despesa: Despesa | null;
  isOpen: boolean;
  onClose: () => void;
  mode?: 'view' | 'edit';
}

interface ContasAPagarTableProps {
  contas: Despesa[];
  selectedItems: string[];
  onSelectedItemsChange: (selectedIds: string[]) => void;
}

// Modal deslizante para visualizar/editar despesa
function DespesaModal({ despesa, isOpen, onClose, mode = 'view' }: DespesaModalProps) {
  const [editData, setEditData] = useState<Despesa>(despesa || {} as Despesa);
  const [isEditing, setIsEditing] = useState(mode === 'edit');

  React.useEffect(() => {
    if (despesa) {
      setEditData({ ...despesa });
    }
    setIsEditing(mode === 'edit');
  }, [despesa, mode]);

  const handleSave = () => {
    console.log('Salvando despesa:', editData);
    alert('Despesa atualizada com sucesso!');
    onClose();
  };

  const handleChange = (field: keyof Despesa, value: any) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatFormaPagamento = (forma?: string) => {
    const formas: Record<string, string> = {
      'pix': 'PIX',
      'boleto': 'Boleto',
      'cartao': 'Cartão de Crédito',
      'transferencia': 'Transferência',
      'debito_automatico': 'Débito Automático',
      'dinheiro': 'Dinheiro',
      'cheque': 'Cheque'
    };
    return formas[forma || ''] || forma || '-';
  };

  if (!isOpen || !despesa) return null;

  return (
    <>
      {/* Overlay com suporte a tema */}
      <div 
        className="fixed inset-0 bg-black/50 dark:bg-black/70 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal com tema responsivo */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header com tema */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isEditing ? 'Editar Despesa' : 'Visualizar Despesa'}
          </h2>
          <div className="flex items-center space-x-2">
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
            )}
            {isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                className="border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/50"
              >
                <Save className="h-4 w-4 mr-1" />
                Salvar
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content scrollável com tema */}
        <div className="p-6 space-y-8 overflow-y-auto h-full pb-24 bg-white dark:bg-gray-900">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-1 h-6 bg-blue-500 dark:bg-blue-400 rounded-full"></div>
              <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100">
                Informações Básicas
              </h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Fornecedor</label>
                {isEditing ? (
                  <Input
                    value={editData.fornecedor || ''}
                    onChange={(e) => handleChange('fornecedor', e.target.value)}
                    className="w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="Nome do fornecedor"
                  />
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                      {despesa.fornecedor || 'Fornecedor não informado'}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Descrição</label>
                {isEditing ? (
                  <Input
                    value={editData.descricao || ''}
                    onChange={(e) => handleChange('descricao', e.target.value)}
                    className="w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="Descrição da despesa"
                  />
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                      {despesa.descricao || '-'}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Valor</label>
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={editData.total || ''}
                      onChange={(e) => handleChange('total', parseFloat(e.target.value) || 0)}
                      className="w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                      placeholder="0,00"
                    />
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-bold text-green-700 dark:text-green-400">
                        {formatCurrency(despesa.total)}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Status</label>
                  {isEditing ? (
                    <Select
                      value={editData.situacao || ''}
                      onValueChange={(value: 'pendente' | 'pago' | 'atrasado' | 'cancelado') => handleChange('situacao', value)}
                    >
                      <SelectTrigger className="w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                        <SelectItem value="pendente" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">Pendente</SelectItem>
                        <SelectItem value="pago" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">Pago</SelectItem>
                        <SelectItem value="atrasado" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">Atrasado</SelectItem>
                        <SelectItem value="cancelado" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                      {despesa.situacao === 'pendente' && (
                        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                          <Calendar className="h-3 w-3 mr-1" />
                          Pendente
                        </Badge>
                      )}
                      {despesa.situacao === 'atrasado' && (
                        <Badge variant="outline" className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Atrasado
                        </Badge>
                      )}
                      {despesa.situacao === 'pago' && (
                        <Badge variant="outline" className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700">
                          <Check className="h-3 w-3 mr-1" />
                          Pago
                        </Badge>
                      )}
                      {despesa.situacao === 'cancelado' && (
                        <Badge variant="outline" className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600">
                          <X className="h-3 w-3 mr-1" />
                          Cancelado
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Datas Importantes */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-1 h-6 bg-green-500 dark:bg-green-400 rounded-full"></div>
              <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100">
                Datas Importantes
              </h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Data de Emissão</label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={formatDate(editData.dataEmissao)}
                    onChange={(e) => handleChange('dataEmissao', e.target.value)}
                    className="w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {despesa.dataEmissao ? new Date(despesa.dataEmissao).toLocaleDateString('pt-BR') : 'Não informado'}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Vencimento</label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={formatDate(editData.vencimento)}
                    onChange={(e) => handleChange('vencimento', e.target.value)}
                    className="w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                      {despesa.vencimento ? new Date(despesa.vencimento).toLocaleDateString('pt-BR') : '-'}
                    </p>
                    {despesa.situacao === 'atrasado' && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        ⚠️ Vencido há {Math.ceil((Date.now() - new Date(despesa.vencimento).getTime()) / (1000 * 60 * 60 * 24))} dias
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {(despesa.situacao === 'pago' || editData.situacao === 'pago') && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Data de Pagamento</label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={formatDate(editData.dataPagamento)}
                    onChange={(e) => handleChange('dataPagamento', e.target.value)}
                    className="w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg border border-green-200 dark:border-green-700">
                    <p className="text-sm text-green-800 dark:text-green-300 font-medium">
                      ✅ Pago em: {despesa.dataPagamento ? new Date(despesa.dataPagamento).toLocaleDateString('pt-BR') : 'Data não informada'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Informações de Pagamento */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-1 h-6 bg-purple-500 dark:bg-purple-400 rounded-full"></div>
              <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100">
                Informações de Pagamento
              </h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Forma de Pagamento</label>
                {isEditing ? (
                  <Select
                    value={editData.formaPagamento || ''}
                    onValueChange={(value) => handleChange('formaPagamento', value)}
                  >
                    <SelectTrigger className="w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                      <SelectValue placeholder="Selecione a forma de pagamento" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                      <SelectItem value="pix" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">PIX</SelectItem>
                      <SelectItem value="boleto" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">Boleto</SelectItem>
                      <SelectItem value="cartao" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">Cartão de Crédito</SelectItem>
                      <SelectItem value="transferencia" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">Transferência</SelectItem>
                      <SelectItem value="debito_automatico" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">Débito Automático</SelectItem>
                      <SelectItem value="dinheiro" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">Dinheiro</SelectItem>
                      <SelectItem value="cheque" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                      {formatFormaPagamento(despesa.formaPagamento)}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Conta Bancária</label>
                {isEditing ? (
                  <Input
                    value={editData.contaBanco || ''}
                    onChange={(e) => handleChange('contaBanco', e.target.value)}
                    className="w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="Conta bancária para pagamento"
                  />
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {despesa.contaBanco || 'Conta não informada'}
                    </p>
                  </div>
                )}
              </div>

              {(despesa.situacao === 'pago' || editData.situacao === 'pago') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Valor Pago</label>
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={editData.valorPago || ''}
                      onChange={(e) => handleChange('valorPago', parseFloat(e.target.value) || 0)}
                      className="w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                      placeholder="Valor efetivamente pago"
                    />
                  ) : (
                    <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg border border-green-200 dark:border-green-700">
                      <p className="text-sm font-bold text-green-800 dark:text-green-300">
                        {formatCurrency(despesa.valorPago || despesa.total)}
                      </p>
                      {despesa.valorPago && despesa.valorPago !== despesa.total && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Diferença do valor original: {formatCurrency(Math.abs(despesa.total - despesa.valorPago))}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-1 h-6 bg-orange-500 dark:bg-orange-400 rounded-full"></div>
              <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100">
                Observações
              </h3>
            </div>
            
            <div>
              {isEditing ? (
                <Textarea
                  placeholder="Observações sobre a despesa..."
                  value={editData.observacoes || ''}
                  onChange={(e) => handleChange('observacoes', e.target.value)}
                  rows={4}
                  className="w-full resize-none bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
              ) : (
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 min-h-[100px]">
                  <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
                    {despesa.observacoes || 'Nenhuma observação registrada para esta despesa.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Informações do Sistema */}
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-1 h-6 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
              <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100">
                Informações do Sistema
              </h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">ID da Despesa</p>
                <p className="text-sm font-mono text-gray-900 dark:text-gray-100">#{despesa.id}</p>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Última Atualização</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function ContasAPagarTable({ contas, selectedItems, onSelectedItemsChange }: ContasAPagarTableProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Despesa;
    direction: 'asc' | 'desc';
  }>({
    key: 'vencimento',
    direction: 'asc'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    despesa: Despesa | null;
    mode: 'view' | 'edit';
  }>({
    isOpen: false,
    despesa: null,
    mode: 'view'
  });

  const openModal = (despesa: Despesa, mode: 'view' | 'edit' = 'view') => {
    setModalState({
      isOpen: true,
      despesa,
      mode
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      despesa: null,
      mode: 'view'
    });
  };

  const requestSort = (key: keyof Despesa) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedContas = [...contas].sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    
    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const totalPages = Math.ceil(sortedContas.length / itemsPerPage);

  const contasPaginadas = sortedContas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [contas]);

  const handleSelectItem = (id: string) => {
    if (selectedItems.includes(id)) {
      onSelectedItemsChange(selectedItems.filter(itemId => itemId !== id));
    } else {
      onSelectedItemsChange([...selectedItems, id]);
    }
  };

  const handleSelectAllInPage = () => {
    const currentPageIds = contasPaginadas.map(conta => conta.id);
    
    if (currentPageIds.every(id => selectedItems.includes(id))) {
      onSelectedItemsChange(
        selectedItems.filter(id => !currentPageIds.includes(id))
      );
    } else {
      const newSelectedItems = [
        ...selectedItems.filter(id => !currentPageIds.includes(id)),
        ...currentPageIds
      ];
      onSelectedItemsChange(newSelectedItems);
    }
  };

  const areAllInPageSelected = contasPaginadas.length > 0 && 
    contasPaginadas.every(conta => selectedItems.includes(conta.id));

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const renderStatus = (situacao: Despesa['situacao']) => {
    switch (situacao) {
      case 'pendente':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Calendar className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
      case 'atrasado':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Atrasado
          </Badge>
        );
      case 'pago':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Check className="h-3 w-3 mr-1" />
            Pago
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox 
                  checked={areAllInPageSelected}
                  onCheckedChange={handleSelectAllInPage}
                />
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  className="p-0 font-medium text-left flex items-center"
                  onClick={() => requestSort('vencimento')}
                >
                  Vencimento
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  className="p-0 font-medium text-left flex items-center"
                  onClick={() => requestSort('descricao')}
                >
                  Descrição
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <div className="flex items-center">
                  <Button 
                    variant="ghost" 
                    className="p-0 font-medium text-left flex items-center"
                    onClick={() => requestSort('total')}
                  >
                    Total (R$)
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                  <HelpCircle className="ml-1 h-4 w-4 text-muted-foreground" />
                </div>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  className="p-0 font-medium text-left flex items-center"
                  onClick={() => requestSort('situacao')}
                >
                  Situação
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contasPaginadas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhuma conta a pagar encontrada para este período.
                </TableCell>
              </TableRow>
            ) : (
              contasPaginadas.map((conta) => (
                <TableRow key={conta.id}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedItems.includes(conta.id)}
                      onCheckedChange={() => handleSelectItem(conta.id)}
                    />
                  </TableCell>
                  <TableCell>
                    {formatDate(conta.vencimento)}
                  </TableCell>
                  <TableCell>{conta.descricao}</TableCell>
                  <TableCell className="font-medium">
                    {conta.total.toLocaleString('pt-BR', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </TableCell>
                  <TableCell>
                    {renderStatus(conta.situacao)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openModal(conta, 'view')}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openModal(conta, 'edit')}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-muted-foreground">
              Mostrando <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium">{Math.min(currentPage * itemsPerPage, sortedContas.length)}</span> de <span className="font-medium">{sortedContas.length}</span> resultados
            </div>
            
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return page === 1 || 
                           page === totalPages || 
                           Math.abs(page - currentPage) <= 1;
                  })
                  .map((page, index, array) => {
                    if (index > 0 && page - array[index - 1] > 1) {
                      return (
                        <React.Fragment key={`ellipsis-${page}`}>
                          <span className="px-2 text-muted-foreground">...</span>
                          <Button
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => goToPage(page)}
                            className="w-8 h-8 p-0"
                          >
                            {page}
                          </Button>
                        </React.Fragment>
                      );
                    }
                    
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    );
                  })}
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <DespesaModal
        despesa={modalState.despesa}
        isOpen={modalState.isOpen}
        onClose={closeModal}
        mode={modalState.mode}
      />
    </>
  );
}