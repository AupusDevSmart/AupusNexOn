/**
 * DESIGN SYSTEM TEST PAGE
 *
 * Showcase de todos os componentes do design system minimalista
 * Use esta página para:
 * - Visualizar todos os componentes
 * - Testar light/dark mode
 * - Verificar estilos antes de refatorar páginas reais
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetCloseButton,
} from "@/components/ui/sheet-minimal"
import { Combobox } from "@/components/ui/combobox-minimal"
import {
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Moon,
  Sun,
  Plus,
  Search,
  Edit,
  Trash2,
} from "lucide-react"

export function DesignSystemTest() {
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [selectedPlanta, setSelectedPlanta] = useState("")
  const [selectedTipo, setSelectedTipo] = useState("")

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light"
    setTheme(newTheme)
    document.documentElement.classList.toggle("dark")
  }

  // Opções para os Comboboxes
  const plantasOptions = [
    { value: "planta-a", label: "Planta A" },
    { value: "planta-b", label: "Planta B" },
    { value: "planta-c", label: "Planta C" },
    { value: "planta-d", label: "Planta D" },
    { value: "planta-e", label: "Planta E" },
  ]

  const tiposOptions = [
    { value: "ufv", label: "UFV" },
    { value: "carga", label: "Carga" },
    { value: "hibrida", label: "Híbrida" },
  ]

  // Dados mockados para tabela
  const mockData = [
    { id: 1, nome: "Unidade Solar 01", planta: "Planta A", status: "Ativo", energia: "1.245 kWh" },
    { id: 2, nome: "Unidade Solar 02", planta: "Planta B", status: "Manutenção", energia: "987 kWh" },
    { id: 3, nome: "Unidade Solar 03", planta: "Planta A", status: "Ativo", energia: "2.134 kWh" },
    { id: 4, nome: "Unidade Solar 04", planta: "Planta C", status: "Desligado", energia: "0 kWh" },
  ]

  return (
    <div id="design-test-page" className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div id="page-header" className="border-b border-border bg-card">
        <div id="header-container" className="container mx-auto px-6 py-4">
          <div id="header-content" className="flex items-center justify-between">
            <div id="header-title-section">
              <h1 className="text-2xl font-semibold">Design System Test</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Showcase de todos os componentes minimalistas
              </p>
            </div>
            <Button
              id="theme-toggle-btn"
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="h-9 rounded"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <div id="main-content" className="container mx-auto px-6 py-8 space-y-12">

        {/* Section 1: Buttons */}
        <section id="section-buttons" className="component-section">
          <h2 className="text-xl font-semibold mb-4">Buttons</h2>
          <div id="buttons-container" className="flex flex-wrap gap-3">
            <Button className="h-9 rounded">
              <Plus className="h-4 w-4 mr-2" />
              Primary
            </Button>
            <Button variant="outline" className="h-9 rounded">
              Outline
            </Button>
            <Button variant="ghost" className="h-9 rounded">
              Ghost
            </Button>
            <Button variant="destructive" className="h-9 rounded">
              <Trash2 className="h-4 w-4 mr-2" />
              Destructive
            </Button>
            <Button disabled className="h-9 rounded">
              Disabled
            </Button>
          </div>
        </section>

        {/* Section 2: Inputs */}
        <section id="section-inputs" className="component-section">
          <h2 className="text-xl font-semibold mb-4">Inputs</h2>
          <div id="inputs-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div id="input-group-1" className="space-y-2">
              <Label htmlFor="input1">Nome da Instalação</Label>
              <Input
                id="input1"
                className="h-9 rounded"
                placeholder="Ex: Unidade Solar 01"
              />
            </div>
            <div id="input-group-2" className="space-y-2">
              <Label htmlFor="input2">Planta (Select Pesquisável)</Label>
              <Combobox
                options={plantasOptions}
                value={selectedPlanta}
                onValueChange={setSelectedPlanta}
                placeholder="Selecione uma planta"
                searchPlaceholder="Buscar planta..."
                emptyText="Nenhuma planta encontrada"
              />
            </div>
            <div id="input-group-3" className="space-y-2">
              <Label htmlFor="input3">Buscar</Label>
              <div id="search-input-wrapper" className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="input3"
                  className="h-9 rounded pl-9"
                  placeholder="Buscar equipamento..."
                />
              </div>
            </div>
            <div id="input-group-4" className="space-y-2">
              <Label htmlFor="input4">Input Desabilitado</Label>
              <Input
                id="input4"
                className="h-9 rounded"
                placeholder="Desabilitado"
                disabled
              />
            </div>
          </div>
        </section>

        {/* Section 3: Badges */}
        <section id="section-badges" className="component-section">
          <h2 className="text-xl font-semibold mb-4">Badges</h2>
          <div id="badges-container" className="flex flex-wrap gap-3">
            <Badge variant="outline" className="badge-minimal">
              Padrão
            </Badge>
            <Badge variant="outline" className="badge-minimal text-success">
              Ativo
            </Badge>
            <Badge variant="outline" className="badge-minimal text-warning">
              Manutenção
            </Badge>
            <Badge variant="outline" className="badge-minimal text-destructive">
              Desligado
            </Badge>
            <Badge variant="outline" className="badge-minimal text-info">
              Em Teste
            </Badge>
          </div>
        </section>

        {/* Section 4: Alerts */}
        <section id="section-alerts" className="component-section">
          <h2 className="text-xl font-semibold mb-4">Alerts</h2>
          <div id="alerts-container" className="space-y-3 max-w-2xl">
            <Alert className="alert-minimal alert-info">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Informação: Os dados são atualizados a cada 30 segundos
              </AlertDescription>
            </Alert>

            <Alert className="alert-minimal alert-success">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Sucesso: Unidade cadastrada com sucesso!
              </AlertDescription>
            </Alert>

            <Alert className="alert-minimal alert-warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Atenção: Verifique os dados antes de salvar
              </AlertDescription>
            </Alert>

            <Alert className="alert-minimal alert-destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Erro: Falha ao conectar com o equipamento
              </AlertDescription>
            </Alert>
          </div>
        </section>

        {/* Section 5: Table */}
        <section id="section-table" className="component-section">
          <h2 className="text-xl font-semibold mb-4">Table</h2>
          <div id="table-wrapper" className="border border-border rounded">
            <table id="demo-table" className="table-minimal">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Planta</th>
                  <th>Status</th>
                  <th>Energia</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {mockData.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium">{item.nome}</td>
                    <td className="text-muted-foreground">{item.planta}</td>
                    <td>
                      <Badge
                        variant="outline"
                        className={`badge-minimal ${
                          item.status === 'Ativo' ? 'text-success' :
                          item.status === 'Manutenção' ? 'text-warning' :
                          'text-destructive'
                        }`}
                      >
                        {item.status}
                      </Badge>
                    </td>
                    <td>{item.energia}</td>
                    <td className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 ml-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 6: Cards */}
        <section id="section-cards" className="component-section">
          <h2 className="text-xl font-semibold mb-4">Cards</h2>
          <div id="cards-grid" className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div id="card-unidades" className="card-minimal p-6">
              <h3 className="text-lg font-semibold mb-2">
                Total Unidades
              </h3>
              <p className="text-3xl font-bold">24</p>
              <p className="text-sm text-muted-foreground mt-1">
                Instalações ativas
              </p>
            </div>
            <div id="card-energia" className="card-minimal p-6">
              <h3 className="text-lg font-semibold mb-2">
                Energia Hoje
              </h3>
              <p className="text-3xl font-bold">1.245 kWh</p>
              <p className="text-sm text-muted-foreground mt-1">
                Consumo total
              </p>
            </div>
            <div id="card-economia" className="card-minimal p-6">
              <h3 className="text-lg font-semibold mb-2">
                Economia
              </h3>
              <p className="text-3xl font-bold">R$ 890</p>
              <p className="text-sm text-muted-foreground mt-1">
                Mês atual
              </p>
            </div>
          </div>
        </section>

        {/* Section 7: Sheet Demo */}
        <section id="section-sheet" className="component-section">
          <h2 className="text-xl font-semibold mb-4">Sheet Lateral</h2>
          <Button
            id="open-sheet-btn"
            onClick={() => setIsSheetOpen(true)}
            className="h-9 rounded"
          >
            <Plus className="h-4 w-4 mr-2" />
            Abrir Sheet (50% da tela)
          </Button>

          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetContent size="default">
              <SheetHeader>
                <SheetTitle>Nova Unidade</SheetTitle>
                <SheetCloseButton />
              </SheetHeader>

              <SheetBody>
                <div id="sheet-form" className="space-y-4">
                  <div id="sheet-input-nome" className="space-y-2">
                    <Label htmlFor="sheet-nome">Nome da Instalação</Label>
                    <Input
                      id="sheet-nome"
                      className="h-9 rounded"
                      placeholder="Ex: Unidade Solar 01"
                    />
                  </div>

                  <div id="sheet-input-planta" className="space-y-2">
                    <Label htmlFor="sheet-planta">Planta</Label>
                    <Combobox
                      options={plantasOptions}
                      value={selectedPlanta}
                      onValueChange={setSelectedPlanta}
                      placeholder="Selecione uma planta"
                      searchPlaceholder="Buscar planta..."
                    />
                  </div>

                  <div id="sheet-input-tipo" className="space-y-2">
                    <Label htmlFor="sheet-tipo">Tipo</Label>
                    <Combobox
                      options={tiposOptions}
                      value={selectedTipo}
                      onValueChange={setSelectedTipo}
                      placeholder="Selecione um tipo"
                      searchPlaceholder="Buscar tipo..."
                    />
                  </div>

                  <div id="sheet-input-potencia" className="space-y-2">
                    <Label htmlFor="sheet-potencia">Potência (kW)</Label>
                    <Input
                      id="sheet-potencia"
                      type="number"
                      className="h-9 rounded"
                      placeholder="Ex: 50"
                    />
                  </div>

                  <Alert className="alert-minimal alert-info">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Preencha todos os campos obrigatórios antes de salvar
                    </AlertDescription>
                  </Alert>
                </div>
              </SheetBody>

              <SheetFooter>
                <Button
                  id="sheet-cancel-btn"
                  variant="outline"
                  className="h-9 rounded"
                  onClick={() => setIsSheetOpen(false)}
                >
                  Cancelar
                </Button>
                <Button id="sheet-save-btn" className="h-9 rounded">
                  Salvar
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </section>

        {/* Section 8: Typography */}
        <section id="section-typography" className="component-section">
          <h2 className="text-xl font-semibold mb-4">Typography</h2>
          <div id="typography-container" className="space-y-3 max-w-2xl">
            <div>
              <h1 className="text-4xl font-bold">Heading 1</h1>
              <p className="text-sm text-muted-foreground">text-4xl font-bold</p>
            </div>
            <div>
              <h2 className="text-3xl font-semibold">Heading 2</h2>
              <p className="text-sm text-muted-foreground">text-3xl font-semibold</p>
            </div>
            <div>
              <h3 className="text-2xl font-semibold">Heading 3</h3>
              <p className="text-sm text-muted-foreground">text-2xl font-semibold</p>
            </div>
            <div>
              <p className="text-base">Body text regular - Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
              <p className="text-sm text-muted-foreground">text-base</p>
            </div>
            <div>
              <p className="text-sm">Small text - Texto menor para descrições e legendas</p>
              <p className="text-xs text-muted-foreground">text-sm</p>
            </div>
            <div>
              <p className="text-muted-foreground">Muted text - Usado para textos secundários</p>
              <p className="text-xs text-muted-foreground">text-muted-foreground</p>
            </div>
          </div>
        </section>

        {/* Section 9: Colors */}
        <section id="section-colors" className="component-section">
          <h2 className="text-xl font-semibold mb-4">Color Palette</h2>
          <div id="colors-grid" className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="h-20 rounded border border-border bg-background"></div>
              <p className="text-sm mt-2">background</p>
            </div>
            <div>
              <div className="h-20 rounded border border-border bg-foreground"></div>
              <p className="text-sm mt-2">foreground</p>
            </div>
            <div>
              <div className="h-20 rounded border border-border bg-muted"></div>
              <p className="text-sm mt-2">muted</p>
            </div>
            <div>
              <div className="h-20 rounded border border-border bg-primary"></div>
              <p className="text-sm mt-2">primary</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
