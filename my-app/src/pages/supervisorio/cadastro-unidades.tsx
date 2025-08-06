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
  MapPin,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
// Comentado temporariamente - verificar se existe
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";

// Tipos
interface Unidade {
  id: string;
  nome: string;
  tipo: "UFV" | "Carga" | "Motor" | "Inversor" | "Transformador";
  localizacao: {
    estado: string;
    cidade: string;
    latitude: number;
    longitude: number;
  };
  potencia: number;
  status: "ativo" | "inativo";
  pontosMedicao: string[];
  dataCadastro: string;
  ultimaAtualizacao: string;
}

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
  const [unidades, setUnidades] = useState<Unidade[]>([
    {
      id: "1",
      nome: "UFV São Paulo - Unidade 1",
      tipo: "UFV",
      localizacao: {
        estado: "SP",
        cidade: "São Paulo",
        latitude: -23.5505,
        longitude: -46.6333,
      },
      potencia: 25500,
      status: "ativo",
      pontosMedicao: ["Medidor Principal", "Inversor 1", "Inversor 2"],
      dataCadastro: "2024-01-15",
      ultimaAtualizacao: "2024-12-20",
    },
    {
      id: "2",
      nome: "Fábrica ABC - Carga Industrial",
      tipo: "Carga",
      localizacao: {
        estado: "MG",
        cidade: "Belo Horizonte",
        latitude: -19.9167,
        longitude: -43.9345,
      },
      potencia: 12300,
      status: "ativo",
      pontosMedicao: ["Medidor Entrada", "Quadro Geral"],
      dataCadastro: "2024-02-10",
      ultimaAtualizacao: "2024-12-18",
    },
    {
      id: "3",
      nome: "Motor Bomba d'Água - Estação 2",
      tipo: "Motor",
      localizacao: {
        estado: "RJ",
        cidade: "Rio de Janeiro",
        latitude: -22.9068,
        longitude: -43.1729,
      },
      potencia: 500,
      status: "inativo",
      pontosMedicao: ["Medidor Motor"],
      dataCadastro: "2024-03-05",
      ultimaAtualizacao: "2024-11-30",
    },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Estado do formulário
  const [formData, setFormData] = useState<Partial<Unidade>>({
    nome: "",
    tipo: "UFV",
    localizacao: {
      estado: "",
      cidade: "",
      latitude: 0,
      longitude: 0,
    },
    potencia: 0,
    status: "ativo",
    pontosMedicao: [],
  });

  const [novoPontoMedicao, setNovoPontoMedicao] = useState("");

  // Funções auxiliares
  const resetForm = () => {
    setFormData({
      nome: "",
      tipo: "UFV",
      localizacao: {
        estado: "",
        cidade: "",
        latitude: 0,
        longitude: 0,
      },
      potencia: 0,
      status: "ativo",
      pontosMedicao: [],
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (unidade: Unidade) => {
    setFormData(unidade);
    setEditingId(unidade.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (deletingId) {
      setUnidades(unidades.filter((u) => u.id !== deletingId));
      toast({
        title: "Unidade excluída",
        description: "A unidade foi removida com sucesso.",
      });
    }
    setShowDeleteDialog(false);
    setDeletingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      // Editar existente
      setUnidades(
        unidades.map((u) =>
          u.id === editingId
            ? ({
                ...formData,
                id: editingId,
                ultimaAtualizacao: new Date().toISOString().split("T")[0],
              } as Unidade)
            : u
        )
      );
      toast({
        title: "Unidade atualizada",
        description: "As alterações foram salvas com sucesso.",
      });
    } else {
      // Criar nova
      const novaUnidade: Unidade = {
        ...formData,
        id: Date.now().toString(),
        dataCadastro: new Date().toISOString().split("T")[0],
        ultimaAtualizacao: new Date().toISOString().split("T")[0],
      } as Unidade;
      setUnidades([...unidades, novaUnidade]);
      toast({
        title: "Unidade cadastrada",
        description: "A nova unidade foi adicionada com sucesso.",
      });
    }

    resetForm();
  };

  const adicionarPontoMedicao = () => {
    if (novoPontoMedicao.trim()) {
      setFormData({
        ...formData,
        pontosMedicao: [
          ...(formData.pontosMedicao || []),
          novoPontoMedicao.trim(),
        ],
      });
      setNovoPontoMedicao("");
    }
  };

  const removerPontoMedicao = (index: number) => {
    setFormData({
      ...formData,
      pontosMedicao:
        formData.pontosMedicao?.filter((_, i) => i !== index) || [],
    });
  };

  // Filtrar unidades
  const unidadesFiltradas = unidades.filter((unidade) => {
    const matchSearch =
      unidade.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      unidade.localizacao.cidade
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchTipo = filterTipo === "todos" || unidade.tipo === filterTipo;
    return matchSearch && matchTipo;
  });

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case "UFV":
        return <Zap className="h-4 w-4" />;
      case "Carga":
        return <Building2 className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6 h-full overflow-y-auto pb-6">
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
                        tipo: value as Unidade["tipo"],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UFV">
                        UFV - Usina Fotovoltaica
                      </SelectItem>
                      <SelectItem value="Carga">Carga</SelectItem>
                      <SelectItem value="Motor">Motor</SelectItem>
                      <SelectItem value="Inversor">Inversor</SelectItem>
                      <SelectItem value="Transformador">
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
                      checked={formData.status === "ativo"}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          status: checked ? "ativo" : "inativo",
                        })
                      }
                    />
                    <Label htmlFor="status" className="cursor-pointer">
                      {formData.status === "ativo" ? "Ativo" : "Inativo"}
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
                            ...formData.localizacao!,
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
                            ...formData.localizacao!,
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
                            ...formData.localizacao!,
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
                            ...formData.localizacao!,
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
                <Button type="submit">
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
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="UFV">UFV</SelectItem>
                  <SelectItem value="Carga">Carga</SelectItem>
                  <SelectItem value="Motor">Motor</SelectItem>
                  <SelectItem value="Inversor">Inversor</SelectItem>
                  <SelectItem value="Transformador">Transformador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Importar
              </Button>
              <Button variant="outline" size="sm">
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
                {unidadesFiltradas.map((unidade) => (
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
                        {unidade.localizacao.cidade},{" "}
                        {unidade.localizacao.estado}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {unidade.potencia.toLocaleString()} kW
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          unidade.status === "ativo" ? "default" : "secondary"
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
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(unidade.id)}
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
              >
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmDelete}>
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
