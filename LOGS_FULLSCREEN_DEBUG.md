# 🔍 Guia de Debug - Linhas de Conexão em Fullscreen

## Como Testar

1. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

2. **Abra o navegador e acesse a página do Diagrama Unifilar**

3. **Abra o Console do DevTools** (F12 → Console)

4. **Clique no botão de Fullscreen** no diagrama

5. **Observe os logs no console** seguindo a ordem abaixo

---

## 📋 Ordem Esperada dos Logs

### 1️⃣ **ENTRANDO EM FULLSCREEN**

#### `🟢 [FULLSCREEN] Entrando em fullscreen...`
**O que verificar:**
- `diagramCardRef: true` ✅
- `canvasRef: true` ✅
- `conexoes: <número>` - Deve ser maior que 0
- `componentes: <número>` - Deve ser maior que 0

**❌ Se der erro aqui:**
- Não existem conexões ou componentes no diagrama

---

#### `🟢 [FULLSCREEN] Fullscreen ativado!`
**Significado:** A API de fullscreen foi chamada com sucesso

---

#### `📺 [FULLSCREEN CHANGE EVENT]`
**O que verificar:**
- `isFullscreen: true` ✅
- `fullscreenElement: "DIV"` ✅
- `canvasRef: true` ✅
- `canvasDimensions.width > 0` ✅
- `canvasDimensions.height > 0` ✅
- `boundingRect` - Deve conter coordenadas válidas

**❌ Problemas possíveis:**
- Se `isFullscreen: false` - Fullscreen não foi ativado
- Se `width` ou `height` são 0 - Container não tem dimensões
- Se `canvasRef: false` - Referência ao canvas foi perdida

---

### 2️⃣ **COMPONENTE DE CONEXÕES REAGINDO**

#### `🔄 [CONEXÕES] Fullscreen mudou, recalculando paths...`
**O que verificar:**
- `isFullscreen: true` ✅
- `containerRef: true` ✅
- `connections: <número>` - Deve ser igual ao valor inicial
- `componentes: <número>` - Deve ser igual ao valor inicial
- `containerDimensions.width` - Deve ser a largura da tela
- `containerDimensions.height` - Deve ser a altura da tela menos ~73px

**❌ Problemas possíveis:**
- Se `containerRef: false` - O container foi perdido na mudança para fullscreen
- Se dimensões são pequenas ou 0 - O container não redimensionou

---

#### `⏰ [CONEXÕES] Executando calculatePaths após 100ms...`
**Significado:** Aguardando 100ms para o DOM estabilizar antes de calcular

---

### 3️⃣ **CALCULANDO AS LINHAS**

#### `🎯 [CALCULATE PATHS] Iniciando cálculo...`
**O que verificar:**
- `hasContainer: true` ✅
- `isFullscreen: true` ✅
- `connections: <número>` ✅
- `componentes: <número>` ✅

---

#### `📐 [CALCULATE PATHS] Dimensões do container:`
**O que verificar:**
- `width` - Deve ser a largura da tela (ex: 1920)
- `height` - Deve ser a altura útil (ex: 1007)
- `x: 0` ✅
- `y` - Pode variar
- `isFullscreen: true` ✅

**❌ Problemas possíveis:**
- Se width/height são muito pequenos - Container não expandiu
- Se x não é 0 - Posicionamento incorreto

---

#### `✅ [CALCULATE PATHS] Paths calculados:`
**O que verificar:**
- `totalPaths: <número>` - Deve ser igual ao número de conexões
- `connections: <número>` - Deve ser igual ao número de conexões
- `isFullscreen: true` ✅
- `paths: [...]` - Array com coordenadas dos paths
  - Cada path deve ter `fromX`, `fromY`, `toX`, `toY` válidos
  - Coordenadas devem estar dentro das dimensões do container

**❌ Problemas possíveis:**
- Se `totalPaths: 0` - Nenhum path foi calculado (nós não foram encontrados)
- Se coordenadas são negativas ou muito grandes - Posicionamento incorreto dos componentes

---

### 4️⃣ **RENDERIZANDO O SVG**

#### `🎨 [RENDER SVG] DomAnchoredConnectionsOverlay RENDERIZANDO:`
**O que verificar:**
- `width` e `height` - Devem corresponder às dimensões fullscreen
- `paths: <número>` - Deve ser igual ao número de conexões
- `connections: <número>` - Deve ser igual ao número de conexões
- `isFullscreen: true` ✅
- `containerElement: "DIV"` ✅
- `containerClasses` - Deve conter "overflow-visible"

**❌ Problemas possíveis:**
- Se não aparecer este log - O componente não está renderizando
- Se `paths: 0` - Paths não foram calculados
- Se não tem "overflow-visible" - CSS não foi aplicado

---

#### `🔍 [SVG RENDERIZADO] Status após render:`
**O que verificar:**
- `svgElement: true` ✅
- `svgClasses: "nexon-connections-overlay"` ✅
- `pathsNoState` = `pathsNoDom` ✅ **CRÍTICO!**
- `isFullscreen: true` ✅
- `svgDimensions.width > 0` ✅
- `svgDimensions.height > 0` ✅
- `svgViewBox` - Deve corresponder às dimensões
- `firstPathD: "M..."` - Deve ter um path SVG válido

**❌ Problemas possíveis:**
- Se `pathsNoState` ≠ `pathsNoDom` - **PROBLEMA CRÍTICO:** Paths não estão sendo renderizados no DOM
- Se `svgDimensions` são 0 - SVG não tem tamanho
- Se `firstPathD` é vazio - Path não tem dados

---

#### `🎨 [PRIMEIRO PATH] Estilos computados:`
**O que verificar:**
- `stroke: "rgb(59, 130, 246)"` (azul) ou outra cor válida ✅
- `strokeWidth: "3px"` ✅
- `opacity: "1"` ✅
- `display: "block"` ✅
- `visibility: "visible"` ✅
- `fill: "none"` ✅

**❌ Problemas possíveis:**
- Se `stroke: "none"` - Linha não tem cor
- Se `opacity: "0"` - Linha está invisível
- Se `display: "none"` - Linha está oculta
- Se `visibility: "hidden"` - Linha está escondida
- Se `strokeWidth: "0"` - Linha não tem espessura

---

### 5️⃣ **SAINDO DO FULLSCREEN**

#### `🔴 [FULLSCREEN] Saindo do fullscreen...`
**Significado:** Usuário pressionou ESC ou clicou para sair

#### `🔴 [FULLSCREEN] Fullscreen desativado!`
**Significado:** Fullscreen foi desativado com sucesso

---

## 🚨 Cenários de Erro Comuns

### **Erro 1: "pathsNoState ≠ pathsNoDom"**
```
pathsNoState: 5
pathsNoDom: 0
```
**Causa:** Os paths estão no estado React mas não estão sendo renderizados no DOM.
**Solução:** Verificar se há condições no JSX que impedem a renderização.

---

### **Erro 2: "containerRef: false"**
```
containerRef: false
```
**Causa:** A referência ao container foi perdida durante a mudança para fullscreen.
**Solução:** Verificar se o `ref={canvasRef}` está no elemento correto.

---

### **Erro 3: "totalPaths: 0"**
```
totalPaths: 0
connections: 5
```
**Causa:** Nenhum path foi calculado, provavelmente porque os nós não foram encontrados.
**Solução:** Verificar se os componentes têm o atributo `data-node-id`.

---

### **Erro 4: "width: 0, height: 0"**
```
width: 0
height: 0
```
**Causa:** O container não tem dimensões.
**Solução:** Verificar CSS do container, especialmente `overflow` e `display`.

---

### **Erro 5: "display: none" ou "visibility: hidden"**
```
display: "none"
```
**Causa:** CSS está ocultando os paths.
**Solução:** Verificar regras CSS como `:fullscreen *` que podem estar afetando.

---

## ✅ Exemplo de Logs Corretos

```
🟢 [FULLSCREEN] Entrando em fullscreen... { diagramCardRef: true, canvasRef: true, conexoes: 5, componentes: 10 }
🟢 [FULLSCREEN] Fullscreen ativado!
📺 [FULLSCREEN CHANGE EVENT] { isFullscreen: true, fullscreenElement: "DIV", canvasRef: true, ... }
🔄 [CONEXÕES] Fullscreen mudou, recalculando paths... { isFullscreen: true, containerRef: true, ... }
⏰ [CONEXÕES] Executando calculatePaths após 100ms...
🎯 [CALCULATE PATHS] Iniciando cálculo... { hasContainer: true, isFullscreen: true, ... }
📐 [CALCULATE PATHS] Dimensões do container: { width: 1920, height: 1007, x: 0, y: 73, ... }
✅ [CALCULATE PATHS] Paths calculados: { totalPaths: 5, connections: 5, isFullscreen: true, ... }
🎨 [RENDER SVG] DomAnchoredConnectionsOverlay RENDERIZANDO: { width: 1920, height: 1007, paths: 5, ... }
🔍 [SVG RENDERIZADO] Status após render: { pathsNoState: 5, pathsNoDom: 5, isFullscreen: true, ... }
🎨 [PRIMEIRO PATH] Estilos computados: { stroke: "rgb(59, 130, 246)", strokeWidth: "3px", opacity: "1", ... }
```

---

## 🔧 Próximos Passos se os Logs Estiverem Corretos

Se todos os logs acima estiverem corretos mas as linhas ainda não aparecem:

1. **Inspecionar o SVG no DevTools:**
   - Abra as ferramentas de desenvolvedor
   - Selecione o elemento SVG com classe `nexon-connections-overlay`
   - Verifique se os `<path>` estão lá
   - Verifique os estilos computados

2. **Verificar z-index:**
   - O SVG deve ter `z-index: 60` em fullscreen
   - Verificar se há elementos com z-index maior sobrepondo

3. **Verificar cores:**
   - Com fundo preto, linhas azuis (#3b82f6) devem ser visíveis
   - Testar mudar a cor para vermelho (#ff0000) temporariamente

4. **Verificar viewport:**
   - O atributo `viewBox` do SVG deve corresponder às dimensões
   - Os paths devem estar dentro dos limites do viewBox
