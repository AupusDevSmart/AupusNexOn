// src/pages/supervisorio/cadastro-unidades.tsx
import { Layout } from "@/components/common/Layout";
import { TitleCard } from "@/components/common/title-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Building2,
  Download,
  Edit,
  Loader2,
  MapPin,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Importar hooks e tipos da API
import {
  useUnidades,
  useUnidadesCRUD,
  useUnidadesImportExport,
  TipoUnidadeNexon,
  StatusUnidadeNexon,
  CreateUnidadeDto,
  UpdateUnidadeDto,
  FilterUnidadeDto,
  UnidadeNexon,
} from "@/services";

// Estados brasileiros
const estados = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

export function CadastroUnidadesPage() {
  // Estados locais para filtros e UI
  const [filtros, setFiltros] = useState<FilterUnidadeDto>({
    search: "",
    tipo: undefined,
    status: undefined,
    estado: undefined,
    page: 1,
    limit: 10,
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Hooks da API
  const { unidades, loading: loadingList, recarregar } = useUnidades(filtros);
  const { loading: loadingCRUD, criarUnidade, atualizarUnidade, excluirUnidade } = useUnidadesCRUD();
  const { loading: loadingImportExport, exportarCSV } = useUnidadesImportExport();

  // Estado do formulário
  const [formData, setFormData] = useState<CreateUnidadeDto>({
    nome: "",
    tipo: TipoUnidadeNexon.UFV,
    localizacao: {
      estado: "",
      cidade: "",
      latitude: 0,
      longitude: 0,
    },
    potencia: 0,
    status: StatusUnidadeNexon.ATIVO,
    pontosMedicao: [],
  });

  const [novoPontoMedicao, setNovoPontoMedicao] = useState("");

  // Atualizar dados quando filtros mudam
  useEffect(() => {
    recarregar(filtros);
  }, [filtros, recarregar]);

  // Funções auxiliares
  const resetForm = () => {
    setFormData({
      nome: "",
      tipo: TipoUnidadeNexon.UFV,
      localizacao: {
        estado: "",
        cidade: "",
        latitude: 0,
        longitude: 0,
      },
      potencia: 0,
      status: StatusUnidadeNexon.ATIVO,
      pontosMedicao: [],
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (unidade: UnidadeNexon) => {
    setFormData({
      nome: unidade.nome,
      tipo: unidade.tipo,
      localizacao: unidade.localizacao,
      potencia: unidade.potencia,
      status: unidade.status,
      pontosMedicao: unidade.pontosMedicao,
    });
    setEditingId(unidade.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (deletingId) {
      const success = await excluirUnidade(deletingId);
      if (success) {
        recarregar(filtros);
      }
    }
    setShowDeleteDialog(false);
    setDeletingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      // Editar existente
      const updateData: UpdateUnidadeDto = { ...formData };
      const result = await atualizarUnidade(editingId, updateData);
      if (result) {
        recarregar(filtros);
        resetForm();
      }
    } else {
      // Criar nova
      const result = await criarUnidade(formData);
      if (result) {
        recarregar(filtros);
        resetForm();
      }
    }
  };

  const adicionarPontoMedicao = () => {
    if (novoPontoMedicao.trim()) {
      setFormData({
        ...formData,
        pontosMedicao: [...formData.pontosMedicao, novoPontoMedicao.trim()],
      });
      setNovoPontoMedicao("");
    }
  };

  const removerPontoMedicao = (index: number) => {
    setFormData({
      ...formData,
      pontosMedicao: formData.pontosMedicao.filter((_, i) => i !== index),
    });
  };

  const handleFilterChange = (key: keyof FilterUnidadeDto, value: any) => {
    setFiltros(prev => ({
      ...prev,
      [key]: value,
      page: 1, // Reset para primeira página quando filtrar
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFiltros(prev => ({ ...prev, page: newPage }));
  };

  const getTipoIcon = (tipo: TipoUnidadeNexon) => {
    switch (tipo) {
      case TipoUnidadeNexon.UFV:
        return <Zap className="h-4 w-4" />;
      case TipoUnidadeNexon.Carga:
        return <Building2 className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  const handleExportCSV = async () => {
    await exportarCSV(filtros);
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6 h-full overflow-y-auto pb-6 m-8">
        <TitleCard title="Cadastro de Unidades" />

        {/* Formulário de Cadastro/Edição */}
        {showForm && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                {editingId ? "Editar Unidade" : "Nova Unidade"}
              </h3>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome da Unidade</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) =>
                      setFormData({ ...formData, nome: e.target.value })
                    }
                    placeholder="Ex: UFV São Paulo - Unidade 1"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        tipo: value as TipoUnidadeNexon,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TipoUnidadeNexon.UFV}>
                        UFV - Usina Fotovoltaica
                      </SelectItem>
                      <SelectItem value={TipoUnidadeNexon.Carga}>Carga</SelectItem>
                      <SelectItem value={TipoUnidadeNexon.Motor}>Motor</SelectItem>
                      <SelectItem value={TipoUnidadeNexon.Inversor}>Inversor</SelectItem>
                      <SelectItem value={TipoUnidadeNexon.Transformador}>
                        Transformador
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="potencia">Potência (kW)</Label>
                  <Input
                    id="potencia"
                    type="number"
                    value={formData.potencia}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        potencia: Number(e.target.value),
                      })
                    }
                    placeholder="Ex: 25500"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    <Switch
                      id="status"
                      checked={formData.status === StatusUnidadeNexon.ATIVO}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          status: checked ? StatusUnidadeNexon.ATIVO : StatusUnidadeNexon.INATIVO,
                        })
                      }
                    />
                    <Label htmlFor="status" className="cursor-pointer">
                      {formData.status === StatusUnidadeNexon.ATIVO ? "Ativo" : "Inativo"}
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Localização</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="estado">Estado</Label>
                    <Select
                      value={formData.localizacao?.estado}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          localizacao: {
                            ...formData.localizacao,
                            estado: value,
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {estados.map((estado) => (
                          <SelectItem key={estado.sigla} value={estado.sigla}>
                            {estado.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      value={formData.localizacao?.cidade}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          localizacao: {
                            ...formData.localizacao,
                            cidade: e.target.value,
                          },
                        })
                      }
                      placeholder="Ex: São Paulo"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="0.0001"
                      value={formData.localizacao?.latitude}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          localizacao: {
                            ...formData.localizacao,
                            latitude: Number(e.target.value),
                          },
                        })
                      }
                      placeholder="Ex: -23.5505"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="0.0001"
                      value={formData.localizacao?.longitude}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          localizacao: {
                            ...formData.localizacao,
                            longitude: Number(e.target.value),
                          },
                        })
                      }
                      placeholder="Ex: -46.6333"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Pontos de Medição</h4>
                <div className="flex gap-2">
                  <Input
                    value={novoPontoMedicao}
                    onChange={(e) => setNovoPontoMedicao(e.target.value)}
                    placeholder="Ex: Medidor Principal"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        adicionarPontoMedicao();
                      }
                    }}
                  />
                  <Button type="button" onClick={adicionarPontoMedicao}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.pontosMedicao?.map((ponto, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="px-3 py-1"
                    >
                      {ponto}
                      <button
                        type="button"
                        onClick={() => removerPontoMedicao(index)}
                        className="ml-2 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loadingCRUD}>
                  {loadingCRUD && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Save className="h-4 w-4 mr-2" />
                  {editingId ? "Salvar Alterações" : "Cadastrar Unidade"}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Filtros e Ações */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="flex flex-1 gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por nome ou cidade..."
                  value={filtros.search || ""}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={filtros.tipo || "todos"}
                onValueChange={(value) => handleFilterChange("tipo", value === "todos" ? undefined : value as TipoUnidadeNexon)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value={TipoUnidadeNexon.UFV}>UFV</SelectItem>
                  <SelectItem value={TipoUnidadeNexon.Carga}>Carga</SelectItem>
                  <SelectItem value={TipoUnidadeNexon.Motor}>Motor</SelectItem>
                  <SelectItem value={TipoUnidadeNexon.Inversor}>Inversor</SelectItem>
                  <SelectItem value={TipoUnidadeNexon.Transformador}>Transformador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={loadingImportExport}>
                <Upload className="h-4 w-4 mr-2" />
                Importar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={loadingImportExport}
              >
                {loadingImportExport && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Unidade
              </Button>
            </div>
          </div>
        </Card>

        {/* Tabela de Unidades */}
        <Card className="p-6">
          {loadingList ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Carregando unidades...</span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Nome</th>
                      <th className="text-left py-3 px-4">Tipo</th>
                      <th className="text-left py-3 px-4">Localização</th>
                      <th className="text-left py-3 px-4">Potência</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Pontos de Medição</th>
                      <th className="text-left py-3 px-4">Última Atualização</th>
                      <th className="text-right py-3 px-4">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unidades?.data.map((unidade) => (
                      <tr
                        key={unidade.id}
                        className="border-b hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="py-3 px-4 font-medium">{unidade.nome}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getTipoIcon(unidade.tipo)}
                            {unidade.tipo}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {unidade.localizacao.cidade}, {unidade.localizacao.estado}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {unidade.potencia.toLocaleString()} kW
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              unidade.status === StatusUnidadeNexon.ATIVO ? "default" : "secondary"
                            }
                          >
                            {unidade.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {unidade.pontosMedicao.length}
                        </td>
                        <td className="py-3 px-4">{unidade.ultimaAtualizacao}</td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(unidade)}
                              disabled={loadingCRUD}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(unidade.id)}
                              disabled={loadingCRUD}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {unidades && unidades.totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(unidades.page - 1)}
                    disabled={unidades.page <= 1 || loadingList}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-gray-500">
                    Página {unidades.page} de {unidades.totalPages}
                    ({unidades.total} itens)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(unidades.page + 1)}
                    disabled={unidades.page >= unidades.totalPages || loadingList}
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Dialog de Confirmação de Exclusão */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar exclusão</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir esta unidade? Esta ação não pode
                ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={loadingCRUD}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={loadingCRUD}
              >
                {loadingCRUD && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}