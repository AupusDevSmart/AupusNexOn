/**
 * IoT NexOn - Firmware Generator v2.0
 * Gera projetos PlatformIO a partir do diagrama IoT.
 * Baseado no firmware real TON v1.3.0 testado em hardware.
 *
 * Fluxo: Diagrama → analyze() → generateProject() → ZIP download
 */

// ================================================================
// CAPACIDADES POR TIPO DE TON — desacopla "papel na malha" do "tipo".
// O número da TON é só um atalho pro combo de capacidades; toda a
// lógica de LoRa/role/roteamento lê estas FLAGS, nunca o número.
//   lora    -> participa da malha LoRa (repassa/recebe por rádio)
//   comando -> aciona saídas (relé/BO)
//   (uplink -> tem internet; é derivado da rede, não do tipo)
// ================================================================
var TON_CAPS = {
    ton1: { lora: false, comando: false },
    ton2: { lora: true,  comando: false },
    ton3: { lora: false, comando: true  },
    ton4: { lora: true,  comando: true  },
};
function tonCaps(type) { return TON_CAPS[type] || { lora: false, comando: false }; }

// TTL inicial das mensagens LoRa (numero maximo de saltos). 4 cobre topologias
// realistas (gateway -> 3 hops). Old/ausente no envelope -> tratado como direto.
var LORA_DEFAULT_TTL = 4;

var FirmwareGenerator = class FirmwareGenerator {
    constructor(diagramEditor) {
        this.editor = diagramEditor;
    }

    // ================================================================
    // ANALYZE — Percorre o diagrama e extrai specs de cada TON
    // ================================================================
    analyze() {
        const components = this.editor.components;
        const connections = this.editor.connections;
        const tonTypes = ['ton1', 'ton2', 'ton3', 'ton4'];
        const tons = components.filter(c => tonTypes.includes(c.type));
        const specs = tons.map(ton => this._analyzeTon(ton, components, connections));
        // ADITIVO: calcula a malha LoRa global e anexa a tabela de rotas
        // (next_hop por destino) em cada spec LoRa. Roda DEPOIS de todos os
        // specs porque precisa do grafo inteiro (todas as arestas lora_radio).
        // Nao toca em specs sem LoRa -> firmware deles continua byte-identico.
        this._buildLoraRoutes(specs, components, connections);
        return specs;
    }

    // ================================================================
    // MALHA LoRa MULTI-HOP — grafo global + next_hop por BFS (defined-path).
    // ----------------------------------------------------------------
    // Constroi o grafo nao-direcionado de TODAS as arestas 'lora_radio' entre
    // TONs com capacidade LoRa. Para CADA no, roda BFS e descobre o MAC do
    // vizinho direto (next_hop) em direcao a cada outro no alcancavel. O
    // resultado vira spec.lora_routes = [{dst, nh}] (so destinos alcancaveis,
    // sem o proprio no). 1-salto e' o caso onde nh == dst (vizinho direto).
    //
    // MAC de cada no: props.mac_address, senao extraido do sufixo
    // '/satellite/<MAC>' do mqtt_topic_base (convencao ja usada no projeto).
    // No sem MAC conhecido (ex: gateway, que so' aprende MACs em runtime) NAO
    // vira destino na tabela dos outros — mas ainda roteia (o no de borda
    // aprende o gateway pelo 'from' e roteia o ACK de volta pelo next_hop).
    // ================================================================
    _loraNodeMac(comp) {
        if (!comp || !comp.props) return '';
        const explicit = (comp.props.mac_address || '').trim();
        if (explicit) return explicit;
        // Extrai do mqtt_topic_base: .../satellite/<MAC>
        const tb = comp.props.mqtt_topic_base || '';
        const m = tb.match(/\/satellite\/([0-9A-Fa-f]{2}(?:[:\-][0-9A-Fa-f]{2}){5})/);
        return m ? m[1] : '';
    }

    _buildLoraRoutes(specs, components, connections) {
        // 1) Nos LoRa = TONs com capacidade LoRa que participam de >=1 aresta lora_radio.
        // 2) Arestas = pares (a,b) de lora_radio onde ambos tem cap LoRa.
        const adj = {};       // tonId -> Set(tonId vizinho)
        const macOf = {};     // tonId -> MAC (string, pode ser '')
        const compOf = {};    // tonId -> component
        for (const c of components) {
            if (TON_CAPS[c.type] && TON_CAPS[c.type].lora) {
                compOf[c.id] = c;
                macOf[c.id] = this._loraNodeMac(c);
                adj[c.id] = adj[c.id] || new Set();
            }
        }
        for (const conn of connections) {
            if (conn.style !== 'lora_radio') continue;
            const a = conn.from.componentId, b = conn.to.componentId;
            if (!adj[a] || !adj[b]) continue;  // alguma ponta nao e' no LoRa
            if (a === b) continue;
            adj[a].add(b);
            adj[b].add(a);
        }

        // 3) BFS por no -> next_hop[dst] (vizinho direto em direcao a dst).
        const idToSpec = {};
        for (const s of specs) idToSpec[s.tonId] = s;

        for (const srcId of Object.keys(adj)) {
            const spec = idToSpec[srcId];
            if (!spec) continue;
            // BFS guardando o PRIMEIRO salto que levou a cada no.
            const firstHop = {};   // dstId -> neighborId (primeiro salto)
            const visited = new Set([srcId]);
            const queue = [];
            for (const nb of adj[srcId]) {
                firstHop[nb] = nb;  // vizinho direto: primeiro salto e' ele mesmo
                visited.add(nb);
                queue.push(nb);
            }
            while (queue.length) {
                const cur = queue.shift();
                for (const nb of adj[cur]) {
                    if (visited.has(nb)) continue;
                    visited.add(nb);
                    firstHop[nb] = firstHop[cur];  // herda o salto inicial do caminho
                    queue.push(nb);
                }
            }
            // 4) Emite linhas {dst, nh} so' p/ destinos com MAC conhecido E
            //    cujo next_hop tambem tem MAC conhecido (precisa enderecar o salto).
            const routes = [];
            for (const dstId of Object.keys(firstHop)) {
                const dstMac = macOf[dstId];
                const nhMac = macOf[firstHop[dstId]];
                if (!dstMac || !nhMac) continue;
                routes.push({ dst: dstMac, nh: nhMac });
            }
            spec.lora_routes = routes;
        }

        // 5) POLL TARGETS (modo MESTRE-PUXA) — pro role gateway, lista os satelites
        //    com device que ele deve POLLar (round-robin). Um satelite e' alvo se:
        //      - participa da malha LoRa deste gateway (BFS o alcanca);
        //      - tem MAC conhecido (precisa enderecar o POLL);
        //      - NAO e' o proprio gateway (tem peer mas sem internet -> satellite);
        //      - tem >=1 device pra ler (rs485/tcp/pivo) — so' faz sentido pollar quem
        //        produz telemetria. I/O puro continua edge-triggered (nao entra aqui).
        //    A lista vai pro spec.poll_targets do gateway; o orquestrador C++ a usa.
        //    Nos sem device (ou sem MAC) ficam de fora -> nao sao pollados.
        for (const srcId of Object.keys(adj)) {
            const spec = idToSpec[srcId];
            if (!spec) continue;
            if ((spec.lora_role || 'tx') !== 'gateway') continue;  // so' o mestre orquestra
            // BFS p/ achar TODOS os nos LoRa alcancaveis a partir do gateway.
            const reachable = new Set();
            const visited = new Set([srcId]);
            const queue = [...adj[srcId]];
            queue.forEach(n => { visited.add(n); reachable.add(n); });
            while (queue.length) {
                const cur = queue.shift();
                for (const nb of adj[cur]) {
                    if (visited.has(nb)) continue;
                    visited.add(nb);
                    reachable.add(nb);
                    queue.push(nb);
                }
            }
            const targets = [];
            for (const nodeId of reachable) {
                const ns = idToSpec[nodeId];
                if (!ns) continue;
                if ((ns.lora_role || 'tx') !== 'satellite') continue;  // so' satelite reativo
                const mac = macOf[nodeId];
                if (!mac) continue;                                    // sem MAC -> nao enderecavel
                if (!this._satelliteHasDevice(ns)) continue;           // sem device -> nada a pollar
                targets.push({ mac, name: ns.name || nodeId });
            }
            // Ordena por MAC pra round-robin deterministico (independe da ordem do grafo).
            targets.sort((a, b) => a.mac.localeCompare(b.mac));
            spec.poll_targets = targets;
        }

        // 6) gw_direct: o no alcanca o gateway em 1 salto (vizinho direto)?
        //    A telemetria BINARIA ("$B$") so' roteia 1-salto (sem to/ttl); se um
        //    satelite com device binario estiver a 2+ saltos, o firmware avisa em
        //    build/Serial (sem falha silenciosa). 1-salto -> nenhuma mudanca.
        const gwIds = new Set(Object.keys(adj).filter(id =>
            idToSpec[id] && (idToSpec[id].lora_role || 'tx') === 'gateway'));
        for (const nodeId of Object.keys(adj)) {
            const ns = idToSpec[nodeId];
            if (!ns) continue;
            ns.lora_gw_direct = [...adj[nodeId]].some(nb => gwIds.has(nb));
        }
    }

    // Um satelite e' "pollavel" (tem device a ler) se tem Modbus RS485, Modbus TCP
    // ou um pivo. I/O digital puro NAO conta — ele e' edge-triggered e o satelite
    // continua publicando on-change. Usado pra montar a lista poll_targets do gateway
    // e pra decidir se o satelite emite o handler reativo de POLL.
    _satelliteHasDevice(spec) {
        if (!spec) return false;
        return (spec.rs485_devices && spec.rs485_devices.length > 0) ||
               (spec.tcp_devices && spec.tcp_devices.length > 0) ||
               !!spec.pivo ||
               !!spec.bomba ||
               !!spec.carregador;
    }

    _analyzeTon(ton, components, connections) {
        const def = COMPONENT_TYPES[ton.type];
        const result = {
            tonId: ton.id,
            tonType: ton.type,
            name: ton.props.name || def.label,
            hostname: ton.props.ota_hostname || ton.props.name || def.label,
            topicBase: ton.props.mqtt_topic_base || '',
            // Vínculo opcional com equipamento NexOn — usado pelo botão
            // "Implantar OTA" no modal Firmware. Sem este ID o frontend
            // mostra mensagem orientativa em vez de chamar o backend.
            equipamentoId: (ton.props.equipamento_id || '').trim(),
            // Mapa de entradas corrigido (DIN1-6 = GP0-GP5) — opcional, so' TONs novas (ver generateProject)
            din_gp0: !!(ton.props.din_gp0 === true || ton.props.din_gp0 === 'true' || ton.props.din_gp0 === 1 || ton.props.din_gp0 === '1'),
            has_lora: def.has_lora || false,
            has_relays: def.has_relays || false,
            wifi: null,
            mqtt: null,
            rs485_devices: [],
            tcp_devices: [],
            lora: null,
            warnings: [],
        };

        const tonConns = connections.filter(
            c => c.from.componentId === ton.id || c.to.componentId === ton.id
        );

        for (const conn of tonConns) {
            const otherId = conn.from.componentId === ton.id
                ? conn.to.componentId : conn.from.componentId;
            const other = components.find(c => c.id === otherId);
            if (!other) continue;

            if (conn.style === 'wifi' || conn.style === 'ethernet') {
                this._processNetwork(ton, other, result, components, connections);
            } else if (other.type === 'pivo') {
                // Pivô conecta como 'rs485' (fio de relés/entradas), mas NÃO é um
                // device Modbus: a TON é o cérebro e controla o painel "burro" via
                // BO (relés) lendo o painel via BI (entradas). Roteia pra cá ANTES
                // do _processRS485 (que o ignoraria de qualquer forma).
                this._processPivo(ton, other, result);
            } else if (other.type === 'bomba') {
                // Bomba de combustivel: a TON e o cerebro (le cartao/estop pelas BI,
                // nivel pela AI, aciona contator pelas BO). Roteia pra ca antes do RS485.
                this._processBomba(ton, other, result);
            } else if (other.type === 'carregador') {
                // Carregador eletrico: a TON habilita a recarga (BO) e le "conectado" (BI).
                this._processCarregador(ton, other, result);
            } else if (conn.style === 'rs485') {
                this._processRS485(ton, other, result, components, connections);
            } else if (conn.style === 'tcp') {
                this._processTCP(ton, other, result, components, connections);
            } else if (conn.style === 'lora_radio') {
                this._processLoRa(ton, other, result);
            }
        }

        // MQTT config (from broker component or defaults)
        if (result.wifi && result.mqtt) {
            if (!result.mqtt.topic_base && result.topicBase) {
                result.mqtt.topic_base = result.topicBase;
            }
        } else if (result.wifi) {
            result.mqtt = {
                server: '72.60.158.163',
                port: 1883,
                topic_base: result.topicBase || result.name,
            };
        }

        // Determina role LoRa baseado no LAYOUT (internet + peers).
        // Roda DEPOIS de processar todas as conexoes pra ter wifi e lora_peers populados.
        result.lora_role = this._resolveLoraRole(ton, result);

        // Warnings
        if (!result.wifi && !result.lora) {
            result.warnings.push('Sem WiFi nem LoRa — não conseguirá enviar dados');
        }
        if (result.rs485_devices.length === 0 && result.tcp_devices.length === 0) {
            result.warnings.push('Sem dispositivos de medição conectados');
        }
        if (result.lora_role === 'satellite' && !result.wifi && (result.lora_peers || []).length === 0) {
            result.warnings.push('Satellite sem peer LoRa configurado — não conseguirá comunicar');
        }

        return result;
    }

    _processNetwork(ton, other, result, components, connections) {
        if (other.type === 'wifi_router') {
            // Multi-WiFi (até 4): rede 1 = ssid/password; extras = ssid2..4/password2..4.
            // Fallback automático + lista persistida em NVS (comando /cmd/wifi troca sem reflash).
            const nets = [];
            for (const suf of ['', '2', '3', '4']) {
                const s = (other.props['ssid' + suf] || '').trim();
                if (s) nets.push({ ssid: s, password: other.props['password' + suf] || '' });
            }
            result.wifi = {
                ssid: nets[0] ? nets[0].ssid : (other.props.ssid || ''),        // compat (1ª rede)
                password: nets[0] ? nets[0].password : (other.props.password || ''),
                networks: nets,                                                  // lista completa (até 4)
            };
            // Check if router connects to broker
            const brokerConns = connections.filter(c =>
                (c.from.componentId === other.id || c.to.componentId === other.id)
            );
            for (const bc of brokerConns) {
                const brokerId = bc.from.componentId === other.id ? bc.to.componentId : bc.from.componentId;
                const broker = components.find(c => c.id === brokerId);
                if (broker && broker.type === 'mqtt_broker') {
                    result.mqtt = {
                        server: broker.props.ip || '72.60.158.163',
                        port: broker.props.port || 1883,
                        topic_base: result.topicBase || result.name,
                    };
                }
            }
        } else if (other.type === 'mqtt_broker') {
            result.mqtt = {
                server: other.props.ip || '72.60.158.163',
                port: other.props.port || 1883,
                topic_base: result.topicBase || result.name,
            };
        }
    }

    // O comando de relé vem POR INSTÂNCIA do io_config (editor IoT → Configurar I/O):
    // cada entrada `io_config.bo[cmd] = { coil, func }` vira um comando. O catálogo NÃO
    // define mais coil (só lista bo_outputs); a amarração comando→BO é da instalação.
    // Merge = catálogo (base, ex: comandos compostos/steps de outros relés) + io_config
    // (ADICIONA/sobrescreve por chave). O cmd_id passa a ser a chave do io_config — o
    // frontend usa o ponto_id do equipamento, então o comando fica definido por
    // "ponto do equipamento → BO", sem sinal fixo de catálogo no meio.
    /**
     * Seleciona a variante do mapa do catalogo conforme o TRANSPORTE que o device
     * realmente fala.
     *
     * POR QUE ISSO EXISTE: o mesmo rele tem mapas Modbus DIFERENTES por transporte.
     * No 7SR5111, em TCP o status do disjuntor e' UM ponto DOUBLE_BIT
     * ("CB-1 Status", 10013); em RTU sao DOIS bits separados (CB Open 10568 /
     * CB Closed 10562). Nao e' o mesmo mapa com outro transporte — e' outro mapa.
     * Por isso o catalogo aceita `por_transporte: { rtu: {...}, tcp: {...} }` como
     * OVERLAY sobre a base comum (so' entra no overlay o que difere).
     *
     * ⚠️ GOTCHA: 'rtu_tcp' (bridge transparente, ex. conversor USR) conta como
     * **RTU**. O meio e' TCP, mas quem responde e' o rele falando RTU — vale o mapa
     * dele, nao o do MBAP nativo. Usar o mapa TCP nesse caso le' endereco errado.
     */
    _catTransporte(cat, transporte) {
        if (!cat || typeof cat !== 'object') return cat;
        const overlay = cat.por_transporte && cat.por_transporte[transporte];
        if (!overlay || typeof overlay !== 'object') return cat;   // sem overlay: base comum
        const out = Object.assign({}, cat, overlay);
        delete out.por_transporte;   // ja' resolvido — evita o resto do gerador se confundir
        out._transporte = transporte;
        console.log(`[gen] ${cat.modelo || cat.catalog_id || 'device'}: mapa "${transporte}" aplicado`);
        return out;
    }

    _mergeIoBo(dev, props) {
        if (!dev || !props) return dev;
        const io = props.io_config;
        if (!io || !io.bo) return dev;
        const boMap = Object.assign({}, dev.bo_map || {});
        for (const cid in io.bo) {
            const ov = io.bo[cid];
            if (!ov) continue;
            const entry = Object.assign({}, boMap[cid] || {});   // ADD (não exige existir no catálogo)
            if (ov.coil != null && ov.coil !== '') entry.coil = Number(ov.coil);
            if (ov.func != null && ov.func !== '') entry.func = Number(ov.func);
            if (ov.register != null && ov.register !== '') entry.register = Number(ov.register);
            // FC15 (DPC double-bit, ex: CB-1 do 7SR5111): addr/count/value do io_config
            if (ov.addr != null && ov.addr !== '') entry.addr = Number(ov.addr);
            if (ov.count != null && ov.count !== '') entry.count = Number(ov.count);
            if (ov.value != null && ov.value !== '') entry.value = Number(ov.value);
            if (ov.hold === true || ov.hold === 'true') entry.hold = true;   // coil de ESTADO: nao rearma (nao escreve 0)
            if (ov.rearm_ms != null && ov.rearm_ms !== '') entry.rearm_ms = Number(ov.rearm_ms); // duracao do pulso (coil=1) antes do rearme
            boMap[cid] = entry;
        }
        return Object.assign({}, dev, { bo_map: boMap });
    }

    _processRS485(ton, other, result, components, connections) {
        const deviceTypes = ['inversor', 'power_meter', 'medidor_comum', 'rele_protecao'];
        if (!deviceTypes.includes(other.type)) return;
        if (result.rs485_devices.find(d => d.componentId === other.id)) return;

        const catalogId = other.props.catalog_id;
        const dev = catalogId && typeof getCatalogDevice === 'function' ? getCatalogDevice(catalogId) : null;

        result.rs485_devices.push({
            componentId: other.id,
            name: other.props.name || COMPONENT_TYPES[other.type].label,
            type: other.type,
            modbus_address: other.props.modbus_address || 1,
            catalog_id: catalogId || null,
            catalog_device: this._mergeIoBo(this._catTransporte(dev, 'rtu'), other.props),
            registros: dev ? dev.registros : [],
            current_scale_override: this._parseScaleOverride(other.props.current_scale_override),
            voltage_scale_override: this._parseScaleOverride(other.props.voltage_scale_override),
            tc_ratio: this._parseScaleOverride(other.props.tc_ratio),
            tp_ratio: this._parseScaleOverride(other.props.tp_ratio),
        });

        // Daisy-chain
        const chainConns = connections.filter(c =>
            (c.from.componentId === other.id || c.to.componentId === other.id) &&
            c.style === 'rs485'
        );
        for (const cc of chainConns) {
            const nextId = cc.from.componentId === other.id ? cc.to.componentId : cc.from.componentId;
            if (nextId === ton.id) continue;
            const next = components.find(c => c.id === nextId);
            if (next && deviceTypes.includes(next.type)) {
                this._processRS485(ton, next, result, components, connections);
            }
        }
    }

    _processTCP(ton, other, result, components, connections) {
        const deviceTypes = ['inversor', 'power_meter', 'medidor_comum', 'rele_protecao'];

        // Caso 1: TON ↔ Datalogger (TCP)
        // O datalogger agrupa inversores via RS485. Gerar tcp_devices para cada inversor.
        if (other.type === 'inverter_datalogger') {
            const gateway = {
                name: other.props.name || 'Datalogger',
                modelo: other.props.modelo || 'generico-tcp',
                ip: other.props.ip || '',
                port: other.props.tcp_port || 502,
                timeout_ms: other.props.timeout_ms || 2000,
                mode: 'datalogger',   // transporte Modbus TCP (MBAP)
            };

            // Descobrir inversores ligados ao datalogger via RS485
            if (connections) {
                const dlConns = connections.filter(c =>
                    (c.from.componentId === other.id || c.to.componentId === other.id) &&
                    c.style === 'rs485'
                );
                for (const cc of dlConns) {
                    const invId = cc.from.componentId === other.id ? cc.to.componentId : cc.from.componentId;
                    const inv = components.find(c => c.id === invId);
                    if (!inv || !deviceTypes.includes(inv.type)) continue;
                    if (result.tcp_devices.find(d => d.componentId === inv.id)) continue;

                    const catalogId = inv.props.catalog_id;
                    const dev = catalogId && typeof getCatalogDevice === 'function' ? getCatalogDevice(catalogId) : null;

                    result.tcp_devices.push({
                        componentId: inv.id,
                        name: inv.props.name || COMPONENT_TYPES[inv.type].label,
                        type: inv.type,
                        modbus_address: inv.props.modbus_address || 1,
                        catalog_id: catalogId || null,
                        catalog_device: this._mergeIoBo(this._catTransporte(dev, 'tcp'), inv.props),
                        registros: dev ? dev.registros : [],
                        gateway: gateway,
                        current_scale_override: this._parseScaleOverride(inv.props.current_scale_override),
                        voltage_scale_override: this._parseScaleOverride(inv.props.voltage_scale_override),
                        tc_ratio: this._parseScaleOverride(inv.props.tc_ratio),
                        tp_ratio: this._parseScaleOverride(inv.props.tp_ratio),
                    });
                }
            }
            return;
        }

        // Caso 1b: TON ↔ Conversor serial->TCP (ex: USR-W610 em modo transparente).
        // Diferente do datalogger: os devices atras dele falam Modbus RTU puro, entao
        // o transporte e' RTU-sobre-TCP + CRC16 (gateway.mode='rtu_tcp'), nao MBAP.
        if (other.type === 'conversor') {
            const gateway = {
                name: other.props.name || 'Conversor',
                modelo: other.props.modelo || 'usr-w610',
                ip: other.props.ip || '',
                port: other.props.tcp_port || 502,
                timeout_ms: other.props.timeout_ms || 3000,
                mode: 'rtu_tcp',   // Modbus RTU sobre TCP + CRC16 (bridge transparente)
            };

            if (connections) {
                const cvConns = connections.filter(c =>
                    (c.from.componentId === other.id || c.to.componentId === other.id) &&
                    c.style === 'rs485'
                );
                for (const cc of cvConns) {
                    const devId = cc.from.componentId === other.id ? cc.to.componentId : cc.from.componentId;
                    const dev = components.find(c => c.id === devId);
                    if (!dev || !deviceTypes.includes(dev.type)) continue;
                    if (result.tcp_devices.find(d => d.componentId === dev.id)) continue;

                    const catalogId = dev.props.catalog_id;
                    const catDev = catalogId && typeof getCatalogDevice === 'function' ? getCatalogDevice(catalogId) : null;

                    result.tcp_devices.push({
                        componentId: dev.id,
                        name: dev.props.name || COMPONENT_TYPES[dev.type].label,
                        type: dev.type,
                        modbus_address: dev.props.modbus_address || 1,
                        catalog_id: catalogId || null,
                        // bridge transparente (rtu_tcp): o rele fala RTU — vale o mapa RTU.
                        catalog_device: this._mergeIoBo(this._catTransporte(catDev, 'rtu'), dev.props),
                        registros: catDev ? catDev.registros : [],
                        gateway: gateway,
                        current_scale_override: this._parseScaleOverride(dev.props.current_scale_override),
                        voltage_scale_override: this._parseScaleOverride(dev.props.voltage_scale_override),
                        tc_ratio: this._parseScaleOverride(dev.props.tc_ratio),
                        tp_ratio: this._parseScaleOverride(dev.props.tp_ratio),
                    });
                }
            }
            return;
        }

        // Caso 2: TON ↔ Dispositivo TCP direto (sem datalogger/conversor).
        // O device e' o proprio endpoint Modbus TCP (ex: Siemens 7SR5111 com Ethernet
        // nativa, porta 502). O IP vem de props.ip do componente (campo no modal);
        // porta de props.tcp_port > default_port do catalogo > 502. Transporte MBAP
        // (mode 'datalogger') — device TCP nativo fala Modbus TCP puro, nao RTU+CRC.
        if (!deviceTypes.includes(other.type)) return;

        const catalogId = other.props.catalog_id;
        const dev = catalogId && typeof getCatalogDevice === 'function' ? getCatalogDevice(catalogId) : null;

        const directIp = (other.props.ip || '').trim();
        const directPort = Number(other.props.tcp_port) || (dev && Number(dev.default_port)) || 502;
        if (!directIp) {
            // Sem IP o firmware nao teria endereco pra conectar — device seria
            // silenciosamente descartado no filtro `d.gateway` do _genInverterTcpCpp.
            // Warning explicito pro usuario ver o motivo no console/validacao.
            const nm = other.props.name || COMPONENT_TYPES[other.type].label;
            console.warn(`[gen] ${nm}: conexao TCP direta SEM IP — preencha "IP (Modbus TCP direto)" no modal do componente. Device ignorado no firmware.`);
            if (result.warnings) result.warnings.push(`${nm}: conexao TCP direta sem IP — leitura nao sera gerada`);
        }

        result.tcp_devices.push({
            componentId: other.id,
            name: other.props.name || COMPONENT_TYPES[other.type].label,
            type: other.type,
            modbus_address: other.props.modbus_address || 1,
            catalog_id: catalogId || null,
            catalog_device: this._mergeIoBo(this._catTransporte(dev, 'tcp'), other.props),
            registros: dev ? dev.registros : [],
            gateway: directIp ? {
                name: (other.props.name || 'direct') + '_tcp',
                ip: directIp,
                port: directPort,
                timeout_ms: 2000,     // mesmo default dos gateways datalogger/conversor
                mode: 'datalogger',   // MBAP nativo
            } : null,
            current_scale_override: this._parseScaleOverride(other.props.current_scale_override),
            voltage_scale_override: this._parseScaleOverride(other.props.voltage_scale_override),
            tc_ratio: this._parseScaleOverride(other.props.tc_ratio),
            tp_ratio: this._parseScaleOverride(other.props.tp_ratio),
        });
    }

    _processLoRa(ton, other, result) {
        if (!tonCaps(other.type).lora) return;   // só nós com capacidade LoRa entram na malha
        // Acumula peers — TON2 pode ter varios TON4s satelites.
        if (!result.lora_peers) result.lora_peers = [];
        if (result.lora_peers.find(p => p.peer_id === other.id)) return;
        result.lora_peers.push({
            peer_name: other.props.name || other.type.toUpperCase(),
            peer_id: other.id,
            peer_mac: other.props.mac_address || '',  // populado depois via BD/auto-discovery
            peer_type: other.type,
        });
        // Backward-compat: mantem result.lora pro codigo antigo que olha pra peer unico.
        // (lora.mode aqui e' deprecated — half-duplex sempre na pratica.)
        if (!result.lora) {
            result.lora = {
                mode: 'duplex',  // half-duplex RX+TX sempre, mantido pro legacy
                peer_name: result.lora_peers[0].peer_name,
                peer_id: result.lora_peers[0].peer_id,
            };
        }
    }

    // Pivô (Cenário B): painel "burro", a TON é o cérebro. Anexa a config do
    // pivô ao spec da TON (espelha como _processLoRa/_processDevice anexam seus
    // dados). Apenas UMA TON controla o pivô (regra do diagrama). BI=entradas
    // digitais (1-6, 0=não usa), BO=relés (1-6, 0=não usa). A máquina de estados
    // e o parser de comando só são emitidos quando result.pivo existe.
    _processPivo(ton, other, result) {
        if (result.pivo) return;  // só um pivô por TON
        const p = other.props || {};
        const num = (v) => {
            const n = parseInt(v, 10);
            return Number.isFinite(n) && n >= 1 && n <= 6 ? n : 0;  // 0 = não usa
        };
        result.pivo = {
            componentId: other.id,
            name: p.name || COMPONENT_TYPES[other.type].label,
            equipamento_id: (p.equipamento_id || '').trim(),
            bi_pressostato:    num(p.bi_pressostato),
            bi_emergencia:     num(p.bi_emergencia),
            bi_desalinhamento: num(p.bi_desalinhamento),
            bi_fim_curso:      num(p.bi_fim_curso),
            bo_movimento:      num(p.bo_movimento),
            bo_sentido_dir:    num(p.bo_sentido_dir),
            bo_sentido_esq:    num(p.bo_sentido_esq),
            bo_canhao:         num(p.bo_canhao),
            tempo_pressao_s:   (() => { const t = parseInt(p.tempo_pressao_s, 10); return Number.isFinite(t) && t > 0 ? t : 120; })(),
        };
        // O controle do pivô depende de relés (BO). TON1/TON2 não têm relés —
        // sem eles a máquina de estados não consegue acionar o painel.
        if (!result.has_relays) {
            result.warnings.push('Pivô conectado a uma TON sem relés (BO) — controle do pivô não será gerado. Use TON3/TON4.');
        } else if (!result.pivo.bo_movimento) {
            result.warnings.push('Pivô sem BO Movimento configurado — máquina de estados não terá como acionar o pivô.');
        }
    }


    // Carregador eletrico: a TON habilita a recarga (BO mantido) e detecta desconexao
    // (BI Conectado) -> corta + encerra. Espelha _processBomba (BO/BI vem do ton_bo/bi).
    _processCarregador(ton, other, result) {
        if (result.carregador) return;
        const p = other.props || {};
        const num = (v, max) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 1 && n <= (max || 8) ? n : 0; };
        const eqId = (p.equipamento_id || '').trim();
        const io  = (this._carregadorIoByEquip && eqId && this._carregadorIoByEquip[eqId]) || {};
        const iob = io.bo || {}, ioi = io.bi || {};
        result.carregador = {
            componentId: other.id,
            name: p.name || COMPONENT_TYPES[other.type].label,
            equipamento_id: eqId,
            bo_habilitar:   iob.habilitar   || num(p.bo_habilitar, 8),
            bo_desabilitar: iob.desabilitar || num(p.bo_desabilitar, 8),
            bi_conectado:   ioi.conectado   || num(p.bi_conectado),
            modo_leitor:    (p.modo_leitor || 'desativado'),
            uid_teste:      (p.uid_teste || 'AABBCCDD').trim().toUpperCase(),
        };
        if (!result.has_relays) {
            result.warnings.push('Carregador conectado a uma TON sem relés (BO) — não pode habilitar a recarga. Use TON3/TON4.');
        } else if (!result.carregador.bo_habilitar) {
            result.warnings.push('Carregador sem BO "Habilitar" mapeado — configure na TON: Configurar BOs (Habilitar / Desabilitar) e Configurar BIs (Conectado).');
        }
    }


    // Determina o papel da TON na topologia LoRa puramente pelo LAYOUT, nao
    // pelo tipo (ton2/ton4) nem por config manual de modo. Toda TON com LoRa
    // e' RX+TX (half-duplex bidirecional). O role apenas determina COMO ela
    // roteia mensagens:
    //   - tem internet (WiFi/Eth) E tem peer LoRa -> gateway (faz ponte MQTT<->LoRa)
    //   - sem internet E tem peer LoRa            -> satellite (publica via LoRa)
    //   - tem LoRa mas sem peer no diagrama       -> 'tx' (modo solo, sem roteamento)
    // Override manual: ton.props.lora_role tem prioridade (escape hatch).
    _resolveLoraRole(ton, result) {
        if (ton.props.lora_role) return ton.props.lora_role;  // override manual
        const hasInternet = !!result.wifi;  // wifi flag cobre WiFi+Ethernet
        const hasPeers = (result.lora_peers || []).length > 0;
        if (hasInternet && hasPeers) return 'gateway';
        if (!hasInternet && hasPeers) return 'satellite';
        return 'tx';  // tem LoRa mas sem peer no layout — modo solo
    }

    // ================================================================
    // CODE GENERATION
    // ================================================================

    generateProject(spec) {
        // Start with base files
        const files = {};
        for (const [path, content] of Object.entries(FIRMWARE_BASE)) {
            files[path] = content;
        }

        // Add/override generated files
        files['include/config.h'] = this._genConfigH(spec);
        files['src/mqtt.h'] = this._genMqttH();
        files['src/mqtt.cpp'] = this._genMqttCpp(spec);
        files['include/eth.h'] = this._genEthH();
        files['src/eth.cpp'] = this._genEthCpp();
        files['include/diag.h'] = this._genDiagH();
        files['src/diag.cpp'] = this._genDiagCpp(spec);
        files['src/main.cpp'] = this._genMainCpp(spec);

        // Modbus RTU (RS485) se ha dispositivos RS485
        if (spec.rs485_devices.length > 0) {
            files['include/modbus_meter.h'] = this._genModbusH(spec);
            files['src/modbus_meter.cpp'] = this._genModbusCpp(spec);
        }

        // Modbus TCP (via Datalogger/Gateway) se ha dispositivos TCP
        if (spec.tcp_devices.length > 0) {
            files['include/inverter_tcp.h'] = this._genInverterTcpH(spec);
            files['src/inverter_tcp.cpp'] = this._genInverterTcpCpp(spec);
        }

        // LoRa if enabled
        if (spec.has_lora) {
            files['src/lora.cpp'] = this._genLoraCpp(spec);
            files['include/lora.h'] = this._genLoraH();
        }

        // Posto de combustivel: lib pura + glue (so' com bomba no diagrama e TON com reles)
        if (spec.bomba && spec.has_relays) {
            files['include/bomba_posto.h'] = this._genBombaLibH();
            files['src/bomba_posto.cpp'] = this._genBombaLibCpp();
            files['include/bomba.h'] = this._genBombaH(spec);
            files['src/bomba.cpp'] = this._genBombaCpp(spec);
        }

        // Placa v1a com o mapa de entradas CORRIGIDO (DIN1-6 = GP0-GP5 do MCP 0x26).
        // O base V1 le GP1-GP6 (off-by-one historico) e assim fica pros TONs ja' em campo;
        // TONs novas (ex.: posto) ligam `din_gp0` na TON e passam a ler as 6 entradas fisicas.
        if (spec.din_gp0) {
            files['src/inputs.cpp'] = files['src/inputs.cpp'].replace('bool val = !_mcp.digitalRead(i + 1);', 'bool val = !_mcp.digitalRead(i);   // din_gp0: DIN1-6 = GP0-GP5 (mapa da placa v1a)');
        }

        // OTA depende de WiFi + MQTT_TOPIC_BASE. Sem WiFi, remove do projeto.
        if (!spec.wifi) {
            delete files['src/ota.cpp'];
            delete files['include/ota.h'];
        }

        return { name: spec.name, files, warnings: spec.warnings, spec };
    }

    // ---- inverter_tcp.h ----
    _genInverterTcpH(spec) {
        // Tipos lidos via Modbus TCP (espelha _processTCP.deviceTypes).
        // Antes só 'inversor' entrava — bug fazia power_meter atrás de datalogger ser silenciosamente ignorado.
        const TCP_READABLE_TYPES = ['inversor', 'power_meter', 'medidor_comum', 'rele_protecao'];
        const count = spec.tcp_devices.filter(d => TCP_READABLE_TYPES.includes(d.type)).length;
        return `#ifndef INVERTER_TCP_H
#define INVERTER_TCP_H
#include <stdint.h>

// Callback de publicacao: subtopic relativo a MQTT_TOPIC_BASE, payload JSON.
typedef void (*tcp_publish_fn)(const char* subtopic, const char* payload);

// Inicializa cliente TCP do datalogger e imprime configuracao.
void inverter_tcp_init();

// Round-robin: le UM inversor por chamada e acumula amostras (avg) +
// salva ultima leitura (last) + snapshot inicial de delta. Chamar a cada
// READ_INTERVAL_MS (no loop principal). Distribui carga no datalogger.
void inverter_tcp_sample_one();

// Calcula medias/deltas acumulados e publica JSON por inversor.
// Chamar a cada PUBLISH_INTERVAL_MS. Zera acumuladores apos publicar.
void inverter_tcp_publish_all(tcp_publish_fn publish);

// Executa comando (bo_map) de um device TCP direto pelo nome — write de coil
// (FC05) ou registrador (FC06) via MBAP. Retorna false se o device/cmd nao
// existir no lado TCP (o chamador tenta RS485 primeiro; este e' o fallback).
bool inverter_tcp_exec_command(const char* device_name, const char* cmd_id);

// SOE: drena a fila de eventos (EVENTCOUNT + EVENT via FC04) dos devices TCP
// cujo catalogo tem a chave 'eventos'. Publica evento cru no subtopico "evt".
void inverter_tcp_events_poll(tcp_publish_fn publish);

#define TCP_INVERTER_COUNT ${count}
extern const uint8_t TCP_INVERTER_IDS[];

#endif
`;
    }

    // ---- inverter_tcp.cpp ----
    // Gera reader dinamico a partir de cat.ai_blocks/ai_map de cada inversor.
    // Estrutura espelha _genDeviceReader (RS485): sample acumula, publish consolida.
    // Diferenca chave vs RS485: transporte e' MBAP/TCP em vez de ModbusMaster RTU.
    _genInverterTcpCpp(spec) {
        // Aceita qualquer device-com-catalogo conectado via gateway (datalogger).
        // Antes só 'inversor' entrava — power_meter atrás de datalogger não era gerado.
        const TCP_READABLE_TYPES = ['inversor', 'power_meter', 'medidor_comum', 'rele_protecao'];
        const invs = spec.tcp_devices.filter(d => TCP_READABLE_TYPES.includes(d.type) && d.gateway);
        if (invs.length === 0) {
            return `#include "inverter_tcp.h"
void inverter_tcp_init() {}
void inverter_tcp_sample_one() {}
void inverter_tcp_publish_all(tcp_publish_fn) {}
bool inverter_tcp_exec_command(const char*, const char*) { return false; }
void inverter_tcp_events_poll(tcp_publish_fn) {}
const uint8_t TCP_INVERTER_IDS[] = {};
`;
        }

        // Gateway (todos os inversores TCP via datalogger compartilham o mesmo gateway)
        const gw = invs[0].gateway;
        const ids = invs.map(i => i.modbus_address).join(', ');

        let cpp = `#include "inverter_tcp.h"
#include "config.h"
#include "eth.h"
#include <WiFi.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>
#include <esp_task_wdt.h>
#include <string.h>
#include <math.h>
#include <time.h>

// Gateway (Datalogger) — compartilhado por todos os inversores TCP
#define GATEWAY_IP      "${gw.ip}"
#define GATEWAY_PORT    ${gw.port}
#define GATEWAY_TIMEOUT ${gw.timeout_ms}

const uint8_t TCP_INVERTER_IDS[] = {${ids}};

static WiFiClient _wifiTcpClient;
static uint16_t _txId = 0;

// Motivo da ultima falha de leitura TCP (timeout/exception/id_fc/bytecount/incomplete).
// Publicado no payload no_samples pra diagnostico REMOTO (sem serial).
static const char* _tcp_last_fail_reason = "none";

// Helpers locais — duplicados do modbus_meter.cpp para escopo deste arquivo.
// Mantemos copia local porque _publish_tcp_inv_<idx> (gerada abaixo) os usa
// quando o tipo do catalogo declara publish.timestamp_format='datetime' ou
// tem campo work_state no grupo 'status'.

// Timestamp formatado "DD/MM/YYYY HH:MM:SS" no timezone local.
// Fallback "0" (epoch zero) se o relogio nao estiver sincronizado — o ingestion
// trata como timestamp numerico valido e usa now do server como timestamp_dados.
static String _format_timestamp_str() {
    time_t now = time(nullptr);
    if (now < 1700000000) return String("0");
    struct tm* t = localtime(&now);
    char buf[24];
    sprintf(buf, "%02d/%02d/%04d %02d:%02d:%02d",
            t->tm_mday, t->tm_mon + 1, t->tm_year + 1900,
            t->tm_hour, t->tm_min, t->tm_sec);
    return String(buf);
}

// Mapeia codigo de work_state Sungrow -> texto.
static const char* _work_state_text(uint16_t s) {
    switch (s) {
        case 0x0000: return "Run";
        case 0x8000: return "Stop";
        case 0x1300: return "Key Stop";
        case 0x1500: return "Emergency Stop";
        case 0x1400: return "Standby";
        case 0x1200: return "Initial Standby";
        case 0x1600: return "Starting";
        case 0x9100: return "Alarm Run";
        case 0x8100: return "Derating Run";
        case 0x8200: return "Dispatch Run";
        case 0x5500: return "Fault";
        case 0x2500: return "Communication Fault";
        case 0x1111: return "Uninitialized";
        default:               return "Unknown";
    }
}

// Retorna ponteiro pro Client correto baseado na interface ativa.
// Antes usava WiFiClient fixo + check WiFi.isConnected() — quebrava quando rodando
// so' por Ethernet (WiFi.mode(OFF) -> isConnected() == false -> retornava sempre falha
// sem nem tentar conectar TCP). Agora funciona em ambas as interfaces.
static Client* _active_tcp_client() {
    if (eth_connected()) return &eth_get_client();
    if (WiFi.isConnected()) return &_wifiTcpClient;
    return nullptr;
}

// 10^e por inteiro (e pode ser negativo). Evita pull de powf; deterministico em FPU/no-FPU.
static inline float _pow10i(int e){ float r=1.0f; if(e>=0){ for(int i=0;i<e;i++) r*=10.0f; } else { for(int i=0;i<-e;i++) r/=10.0f; } return r; }

void inverter_tcp_init() {
    Serial.printf("[TCP-INV] Gateway: %s:%d (timeout %dms)\\n",
        GATEWAY_IP, GATEWAY_PORT, GATEWAY_TIMEOUT);
    Serial.printf("[TCP-INV] Inversores: ");
    for (uint8_t i = 0; i < sizeof(TCP_INVERTER_IDS); i++) {
        Serial.printf("ID%d ", TCP_INVERTER_IDS[i]);
    }
    Serial.println();
}

// Gerencia a conexao TCP compartilhada. Reconecta se cair OU se o alvo (ip:port)
// mudou — permite datalogger (MBAP) e conversor (RTU) em IPs distintos na mesma
// TON com um unico Client. Retorna o Client conectado (ou nullptr).
static char     _tcp_cur_ip[40] = "";
static uint16_t _tcp_cur_port = 0;
static Client* _tcp_ensure_conn(const char* ip, uint16_t port, uint32_t timeout) {
    Client* tcp = _active_tcp_client();
    if (!tcp) return nullptr;
    bool targetChanged = (strcmp(_tcp_cur_ip, ip) != 0) || (_tcp_cur_port != port);
    if (tcp->connected() && targetChanged) {
        tcp->stop();
    }
    if (!tcp->connected()) {
        tcp->setTimeout(timeout / 1000);
        if (!tcp->connect(ip, port)) {
            Serial.printf("[TCP-INV] Falha ao conectar em %s:%d\\n", ip, port);
            _tcp_cur_ip[0] = 0;
            return nullptr;
        }
        strncpy(_tcp_cur_ip, ip, sizeof(_tcp_cur_ip) - 1);
        _tcp_cur_ip[sizeof(_tcp_cur_ip) - 1] = 0;
        _tcp_cur_port = port;
    }
    return tcp;
}

// CRC16 Modbus (poly 0xA001) — transporte RTU-sobre-TCP do conversor.
static uint16_t _modbus_crc16(const uint8_t* buf, uint16_t len) {
    uint16_t crc = 0xFFFF;
    for (uint16_t i = 0; i < len; i++) {
        crc ^= buf[i];
        for (uint8_t b = 0; b < 8; b++) {
            if (crc & 0x0001) { crc >>= 1; crc ^= 0xA001; }
            else crc >>= 1;
        }
    }
    return crc;
}

// Helper Modbus TCP (MBAP) — datalogger. Comportamento identico ao anterior;
// so' passou a receber ip/port/timeout e usar o gerenciador de conexao.
// Ultimo codigo de excecao Modbus visto pelo _modbus_tcp_read (0 = nenhum).
// Necessario pro SOE: excecao (tip. 2) na leitura do EVENT = fila vazia (NORMAL, nao erro).
static uint8_t _tcp_last_exc = 0;
// SOE seta true em volta da leitura do EVENT: excecao esperada (fila vazia) nao loga —
// senao o Serial seria inundado com "Excecao 0x02" a cada poll de fila vazia (~2s).
static bool _tcp_quiet_exc = false;

static bool _modbus_tcp_read(const char* ip, uint16_t port, uint32_t timeout,
                             uint8_t slave, uint8_t func, uint16_t addr, uint16_t count, uint16_t *out) {
    _tcp_last_exc = 0;
    Client* tcp = _tcp_ensure_conn(ip, port, timeout);
    if (!tcp) return false;

    _txId++;
    uint8_t req[12];
    // MBAP Header
    req[0] = _txId >> 8; req[1] = _txId & 0xFF;
    req[2] = 0; req[3] = 0;      // Protocol ID = 0
    req[4] = 0; req[5] = 6;      // Length = 6
    req[6] = slave;              // Unit ID
    // PDU
    req[7] = func;
    req[8] = addr >> 8; req[9] = addr & 0xFF;
    req[10] = count >> 8; req[11] = count & 0xFF;

    tcp->write(req, 12);
    tcp->flush();

    uint32_t t0 = millis();
    while (tcp->available() < 9 && millis() - t0 < timeout) {
        delay(5);
        esp_task_wdt_reset();
    }
    if (tcp->available() < 9) {
        Serial.printf("[TCP-INV] Timeout slave=%d func=%d addr=%d\\n", slave, func, addr);
        _tcp_last_fail_reason = "timeout";
        return false;
    }

    uint8_t hdr[9];
    tcp->readBytes(hdr, 9);
    if (hdr[7] & 0x80) {
        _tcp_last_exc = hdr[8];
        if (!_tcp_quiet_exc) Serial.printf("[TCP-INV] Excecao Modbus slave=%d: 0x%02X\\n", slave, hdr[8]);
        while (tcp->available()) tcp->read();
        _tcp_last_fail_reason = "exception";
        return false;
    }

    uint8_t byteCount = hdr[8];
    uint8_t buf[256];
    tcp->readBytes(buf, byteCount);

    for (uint16_t i = 0; i < count; i++) {
        out[i] = (buf[i*2] << 8) | buf[i*2+1];
    }
    return true;
}

// Helper Modbus TCP (MBAP) para BITS — FC02 (discrete inputs) / FC01 (coils).
// Resposta empacota bits em bytes (LSB primeiro), diferente dos registradores.
// out deve ter ceil(count/8) bytes. Usado pelos blocos BI dos reles (protecoes).
static bool _modbus_tcp_read_bits(const char* ip, uint16_t port, uint32_t timeout,
                                  uint8_t slave, uint8_t func, uint16_t addr, uint16_t count, uint8_t *out) {
    Client* tcp = _tcp_ensure_conn(ip, port, timeout);
    if (!tcp) return false;

    _txId++;
    uint8_t req[12];
    req[0] = _txId >> 8; req[1] = _txId & 0xFF;
    req[2] = 0; req[3] = 0;
    req[4] = 0; req[5] = 6;
    req[6] = slave;
    req[7] = func;
    req[8] = addr >> 8; req[9] = addr & 0xFF;
    req[10] = count >> 8; req[11] = count & 0xFF;

    tcp->write(req, 12);
    tcp->flush();

    uint32_t t0 = millis();
    while (tcp->available() < 9 && millis() - t0 < timeout) {
        delay(5);
        esp_task_wdt_reset();
    }
    if (tcp->available() < 9) {
        Serial.printf("[TCP-INV] Timeout(bits) slave=%d func=%d addr=%d\\n", slave, func, addr);
        _tcp_last_fail_reason = "timeout_bits";
        return false;
    }

    uint8_t hdr[9];
    tcp->readBytes(hdr, 9);
    if (hdr[7] & 0x80) {
        Serial.printf("[TCP-INV] Excecao Modbus(bits) slave=%d: 0x%02X\\n", slave, hdr[8]);
        while (tcp->available()) tcp->read();
        _tcp_last_fail_reason = "exception_bits";
        return false;
    }

    uint8_t byteCount = hdr[8];
    uint8_t expected = (count + 7) / 8;
    if (byteCount > 250 || byteCount < expected) {
        Serial.printf("[TCP-INV] byteCount(bits) invalido: %d (esperado %d)\\n", byteCount, expected);
        while (tcp->available()) tcp->read();
        _tcp_last_fail_reason = "bytecount_bits";
        return false;
    }
    tcp->readBytes(out, expected);
    // Drena bytes excedentes (byteCount > esperado nao deveria ocorrer, mas nao trava)
    for (uint8_t i = expected; i < byteCount; i++) tcp->read();
    return true;
}

// Helper Modbus TCP (MBAP) para ESCRITA — FC05 (write single coil) / FC06 (write
// single register). Usado pelos comandos (bo_map) de reles TCP diretos (trip/close/
// reset). Resposta de sucesso e' o eco do request (12 bytes); excecao vem com 0x80.
static bool _modbus_tcp_write(const char* ip, uint16_t port, uint32_t timeout,
                              uint8_t slave, uint8_t func, uint16_t addr, uint16_t value) {
    Client* tcp = _tcp_ensure_conn(ip, port, timeout);
    if (!tcp) return false;

    _txId++;
    uint8_t req[12];
    req[0] = _txId >> 8; req[1] = _txId & 0xFF;
    req[2] = 0; req[3] = 0;
    req[4] = 0; req[5] = 6;
    req[6] = slave;
    req[7] = func;
    req[8] = addr >> 8; req[9] = addr & 0xFF;
    req[10] = value >> 8; req[11] = value & 0xFF;

    tcp->write(req, 12);
    tcp->flush();

    uint32_t t0 = millis();
    while (tcp->available() < 9 && millis() - t0 < timeout) {
        delay(5);
        esp_task_wdt_reset();
    }
    if (tcp->available() < 9) {
        Serial.printf("[TCP-INV] Timeout(write) slave=%d func=%d addr=%d\\n", slave, func, addr);
        _tcp_last_fail_reason = "timeout_write";
        return false;
    }
    uint8_t resp[12];
    uint8_t got = tcp->readBytes(resp, 9);
    if (resp[7] & 0x80) {
        Serial.printf("[TCP-INV] Excecao Modbus(write) slave=%d func=%d: 0x%02X\\n", slave, func, resp[8]);
        while (tcp->available()) tcp->read();
        return false;
    }
    while (tcp->available()) tcp->read();   // resto do eco
    return got >= 9 && resp[7] == func;
}

// Helper Modbus TCP (MBAP) — FC15 (write multiple coils), ate 8 bits num byte.
// Necessario para comandos DPC (double-bit, ex: CB-1 do 7SR5): manual manda
// escrever o PAR de bits via FC15 com valor 01 (Off/abre) ou 10 (On/fecha).
static bool _modbus_tcp_write_coils(const char* ip, uint16_t port, uint32_t timeout,
                                    uint8_t slave, uint16_t addr, uint16_t count, uint8_t bits) {
    if (count == 0 || count > 8) return false;
    Client* tcp = _tcp_ensure_conn(ip, port, timeout);
    if (!tcp) return false;

    _txId++;
    uint8_t req[14];
    req[0] = _txId >> 8; req[1] = _txId & 0xFF;
    req[2] = 0; req[3] = 0;
    req[4] = 0; req[5] = 8;          // length: unit(1)+fc(1)+addr(2)+cnt(2)+bytecount(1)+data(1)
    req[6] = slave;
    req[7] = 0x0F;
    req[8] = addr >> 8; req[9] = addr & 0xFF;
    req[10] = count >> 8; req[11] = count & 0xFF;
    req[12] = 1;                     // byte count
    req[13] = bits;                  // LSB = primeiro coil

    tcp->write(req, 14);
    tcp->flush();

    uint32_t t0 = millis();
    while (tcp->available() < 9 && millis() - t0 < timeout) {
        delay(5);
        esp_task_wdt_reset();
    }
    if (tcp->available() < 9) {
        Serial.printf("[TCP-INV] Timeout(fc15) slave=%d addr=%d\\n", slave, addr);
        return false;
    }
    uint8_t resp[12];
    uint8_t got = tcp->readBytes(resp, 9);
    if (resp[7] & 0x80) {
        Serial.printf("[TCP-INV] Excecao Modbus(fc15) slave=%d: 0x%02X\\n", slave, resp[8]);
        while (tcp->available()) tcp->read();
        return false;
    }
    while (tcp->available()) tcp->read();
    return got >= 9 && resp[7] == 0x0F;
}

// Helper Modbus RTU-sobre-TCP + CRC16 — conversor (USR transparente). Espelha o
// readModbusBlock antigo: frame RTU com CRC, valida ID/FC/byteCount/CRC e REJEITA
// frame corrompido (em link instavel nao deixa passar 0xFFFF/lixo como dado).
static bool _modbus_rtu_tcp_read(const char* ip, uint16_t port, uint32_t timeout,
                                 uint8_t slave, uint8_t func, uint16_t addr, uint16_t count, uint16_t *out) {
    Client* tcp = _tcp_ensure_conn(ip, port, timeout);
    if (!tcp) return false;

    uint8_t req[8];
    req[0] = slave;
    req[1] = func;
    req[2] = addr >> 8; req[3] = addr & 0xFF;
    req[4] = count >> 8; req[5] = count & 0xFF;
    uint16_t crc = _modbus_crc16(req, 6);
    req[6] = crc & 0xFF; req[7] = (crc >> 8) & 0xFF;   // CRC little-endian

    while (tcp->available()) tcp->read();   // flush anti-dessincronizacao
    tcp->write(req, 8);
    tcp->flush();

    // Resposta RTU: [ID][FC][ByteCount][dados...][CRC_L][CRC_H] — minimo 5 bytes.
    uint32_t t0 = millis();
    while (tcp->available() < 5 && millis() - t0 < timeout) {
        delay(5);
        esp_task_wdt_reset();
    }
    if (tcp->available() < 5) {
        Serial.printf("[TCP-INV] Timeout(rtu) slave=%d func=%d addr=%d\\n", slave, func, addr);
        _tcp_last_fail_reason = "timeout";
        return false;
    }

    uint8_t hdr[3];
    tcp->readBytes(hdr, 3);   // ID + FC + ByteCount
    if (hdr[1] & 0x80) {
        Serial.printf("[TCP-INV] Excecao Modbus(rtu) slave=%d: 0x%02X\\n", slave, hdr[1]);
        while (tcp->available()) tcp->read();
        _tcp_last_fail_reason = "exception";
        return false;
    }
    if (hdr[0] != slave || hdr[1] != func) {
        Serial.printf("[TCP-INV] ID/FC invalido(rtu) slave=%d\\n", slave);
        while (tcp->available()) tcp->read();
        _tcp_last_fail_reason = "id_fc";
        return false;
    }
    uint8_t byteCount = hdr[2];
    if (byteCount != count * 2) {
        Serial.printf("[TCP-INV] byteCount invalido(rtu) slave=%d: %d\\n", slave, byteCount);
        while (tcp->available()) tcp->read();
        _tcp_last_fail_reason = "bytecount";
        return false;
    }

    t0 = millis();
    while (tcp->available() < (byteCount + 2) && millis() - t0 < timeout) {
        delay(2);
        esp_task_wdt_reset();
    }
    if (tcp->available() < (byteCount + 2)) {
        Serial.printf("[TCP-INV] Resposta(rtu) incompleta slave=%d\\n", slave);
        _tcp_last_fail_reason = "incomplete";
        return false;
    }

    uint8_t data[256];
    tcp->readBytes(data, byteCount);
    uint8_t crcBytes[2];
    tcp->readBytes(crcBytes, 2);

    uint8_t full[3 + 256];
    memcpy(full, hdr, 3);
    memcpy(full + 3, data, byteCount);
    uint16_t rxCRC = crcBytes[0] | (crcBytes[1] << 8);
    uint16_t calcCRC = _modbus_crc16(full, 3 + byteCount);
    if (rxCRC != calcCRC) {
        Serial.printf("[TCP-INV] CRC invalido(rtu) slave=%d — frame descartado\\n", slave);
        _tcp_last_fail_reason = "crc";   // frame chegou completo mas corrompido (ruido/baud/paridade) — distinguivel remoto
        return false;
    }

    for (uint16_t i = 0; i < count; i++) {
        out[i] = (data[i*2] << 8) | data[i*2+1];
    }
    return true;
}

`;

        // Gera state + sample + publish por inversor
        invs.forEach((inv, idx) => {
            cpp += this._genTcpInverterReader(inv, idx);
            cpp += this._genTcpDeviceEventPoll(inv, idx);   // SOE (so se cat.eventos + MBAP)
        });

        // Round-robin sample (1 inversor por chamada)
        cpp += `
// =============================================================================
// Despacho publico: round-robin sample + broadcast publish
// =============================================================================
static int _rr_tcp_idx = 0;
static const int _tcp_inv_count = ${invs.length};

void inverter_tcp_sample_one() {
    switch (_rr_tcp_idx) {
`;
        invs.forEach((_, idx) => {
            cpp += `        case ${idx}: _sample_tcp_inv_${idx}(); break;\n`;
        });
        cpp += `    }
    _rr_tcp_idx = (_rr_tcp_idx + 1) % _tcp_inv_count;
}

void inverter_tcp_publish_all(tcp_publish_fn publish) {
    if (!publish) return;
`;
        invs.forEach((_, idx) => {
            cpp += `    _publish_tcp_inv_${idx}(publish);\n`;
        });
        cpp += `}

// Comandos (bo_map) de devices TCP diretos — write FC05/FC06 via MBAP.
// Espelha modbus_exec_command (RS485): match por nome do device + cmd_id;
// steps[] = multi-write sequencial (SBO). So devices MBAP (datalogger/direto);
// rele atras de conversor rtu_tcp nao entra (write RTU+CRC nao implementado).
bool inverter_tcp_exec_command(const char* device_name, const char* cmd_id) {
    if (!device_name || !cmd_id) return false;
`;
        invs.forEach((dev) => {
            const bo = (dev.catalog_device && dev.catalog_device.bo_map) || {};
            const cmds = Object.entries(bo);
            const gwd = dev.gateway || {};
            if (cmds.length === 0 || gwd.mode === 'rtu_tcp') return;
            const wArgs = `"${gwd.ip || ''}", ${gwd.port || 502}, ${gwd.timeout_ms || 2000}, ${dev.modbus_address}`;
            cpp += `    if (strcmp(device_name, "${this._escStr(dev.name)}") == 0) {\n`;
            // Um "step" vira uma chamada _modbus_tcp_write / _modbus_tcp_write_coils:
            //   { func: 0x05, coil: N }               -> FC05, valor 0xFF00 (ON)
            //   { func: 0x06, register: N, value: V }  -> FC06
            //   { func: 0x0F, addr: N, count: C, value: V } -> FC15 (DPC double-bit:
            //       value 1 = Off/abre [bits 01], value 2 = On/fecha [bits 10])
            const emitTcpStep = (step) => {
                const sFunc = step.func || 0x06;
                if (sFunc === 0x05) {
                    if (step.coil === undefined) { console.warn('[gen] step tcp func 0x05 exige coil'); return null; }
                    const cv = (step.value === 0 || step.value === false) ? '0x0000' : '0xFF00';
                    return `            if (!_modbus_tcp_write(${wArgs}, 0x05, ${step.coil}, ${cv})) return false;\n`;
                } else if (sFunc === 0x06) {
                    if (step.register === undefined) { console.warn('[gen] step tcp func 0x06 exige register'); return null; }
                    const v = (step.value !== undefined) ? step.value : 1;
                    return `            if (!_modbus_tcp_write(${wArgs}, 0x06, ${step.register}, ${v})) return false;\n`;
                } else if (sFunc === 0x0F) {
                    if (step.addr === undefined) { console.warn('[gen] step tcp func 0x0F exige addr'); return null; }
                    const cnt = Number(step.count) || 2;
                    const bits = Number(step.value) || 1;
                    return `            if (!_modbus_tcp_write_coils(${wArgs}, ${step.addr}, ${cnt}, ${bits})) return false;\n`;
                }
                console.warn(`[gen] step tcp func 0x${sFunc.toString(16)} nao suportada`);
                return null;
            };
            cmds.forEach(([cid, m]) => {
                if (Array.isArray(m.steps)) {
                    cpp += `        if (strcmp(cmd_id, "${this._escStr(cid)}") == 0) {\n`;
                    const delayMs = m.delay_ms || 0;
                    let valid = 0;
                    m.steps.forEach((step, sIdx) => {
                        if (sIdx > 0 && delayMs > 0) cpp += `            delay(${delayMs});\n`;
                        const line = emitTcpStep(step);
                        if (line) { cpp += line; valid++; }
                    });
                    cpp += valid > 0 ? `            return true;\n        }\n` : `        }\n`;
                } else {
                    const line = emitTcpStep(m);
                    if (line) {
                        cpp += `        if (strcmp(cmd_id, "${this._escStr(cid)}") == 0) {\n`;
                        cpp += line;
                        cpp += `            return true;\n        }\n`;
                    }
                }
            });
            cpp += `        return false;   // device achado mas cmd_id desconhecido\n    }\n`;
        });
        cpp += `    return false;
}

// SOE: drena a fila de eventos dos devices TCP que tem buffer no catalogo (MBAP).
void inverter_tcp_events_poll(tcp_publish_fn publish) {
    if (!publish) return;
`;
        invs.forEach((dev, idx) => {
            const gwd = dev.gateway || {};
            if (dev.catalog_device && dev.catalog_device.eventos && gwd.mode !== 'rtu_tcp') {
                cpp += `    _tcp_evt_poll_dev_${idx}(publish);\n`;
            }
        });
        cpp += `}
`;
        return cpp;
    }

    // Gera estado, _sample_tcp_inv_<idx>() e _publish_tcp_inv_<idx>(publish) para um inversor TCP.
    // Espelha _genDeviceReader (RS485): mesma classificacao avg/last/delta, mesmo _decodeExpr,
    // mesmas convencoes de state. Diferenca: transporte e' _modbus_tcp_read em vez de _mb.*.
    _genTcpInverterReader(inv, idx) {
        const cat = inv.catalog_device || {};
        const blocks = cat.ai_blocks || [];
        // Aplica overrides do diagrama (props.current_scale_override / voltage_scale_override)
        // antes de processar o ai_map — escalas dos campos i*/v* podem ser sobrescritas
        // por dispositivo sem mexer no catalogo.
        const aiMap = this._applyScaleOverrides(cat.ai_map || {}, inv);
        const scales = cat.scales || {};
        const wordOrder = cat.word_order || 'high_first';
        // BI (protecoes/status de rele) via FC02: suportado no transporte MBAP
        // (datalogger/direto). No modo rtu_tcp (conversor USR) ainda nao — o parse
        // de bits RTU+CRC nao foi implementado; rele atras de conversor le so AI.
        //
        // Dois esquemas de catalogo:
        //   legado: bi_block {start,count} unico + bi_map {pid:{coil}} (coil rel. ao start)
        //   novo:   bi_blocks [{start,count},...] + bi_map {pid:{block,bit}}
        // O novo existe porque o mapa do 7SR5 tem bits ESPARSOS (enderecos nao
        // mapeados entre eles dao excecao 2) — cada cluster mapeado vira um bloco.
        const biMapAll = cat.bi_map || {};
        const biMbap = inv.gateway && inv.gateway.mode !== 'rtu_tcp';
        const biBlocks = Array.isArray(cat.bi_blocks) && cat.bi_blocks.length > 0
            ? cat.bi_blocks
            : (cat.bi_block ? [cat.bi_block] : []);
        // Normaliza: legado {coil} -> {block:0, bit:coil}
        const biEntries = (biBlocks.length > 0 && biMbap)
            ? Object.entries(biMapAll)
                .map(([pid, m]) => [pid, (m.bit !== undefined && m.block !== undefined)
                    ? m : (m.coil !== undefined ? { block: 0, bit: m.coil } : null)])
                .filter(([, m]) => m && m.block < biBlocks.length)
            : [];
        const biCount = biEntries.length;
        if (biBlocks.length > 0 && !biMbap && Object.keys(biMapAll).length > 0) {
            console.warn(`[gen] ${inv.name}: bi via conversor (rtu_tcp) nao suportado — protecoes/BI nao serao lidas`);
        }
        const slave = inv.modbus_address;
        const name = inv.name || `inv_${slave}`;
        const nameEsc = this._escStr(name);
        // Topico inclui addr Modbus como sufixo — espelha _genDeviceReader (RS485)
        // para consistencia: "Inversor_1/data", "Power_Meter_1/data" etc.
        const topicName = `${name}_${slave}`;
        const subtopicEsc = this._escStr(`${topicName}/data`);

        if (blocks.length === 0) {
            return `
// =============================================================================
// ${name} (slave ${slave}) — cadastro sem ai_blocks. Reader vazio.
// =============================================================================
static void _sample_tcp_inv_${idx}() {
    Serial.println("[TCP-INV] ${nameEsc}: cadastro sem ai_blocks — skip");
}
static void _publish_tcp_inv_${idx}(tcp_publish_fn publish) {
    publish("${subtopicEsc}", "{\\"error\\":\\"no_ai_blocks\\"}");
}

`;
        }

        // Offsets cumulativos pra mapear (block, offset_local) -> indice no buffer concatenado
        const blockOffsets = [];
        let acc = 0;
        for (const b of blocks) { blockOffsets.push(acc); acc += b.count; }
        const totalRegs = Math.max(acc, 1);

        // Classificacao por modo (igual RS485)
        const avgFields = [];
        const lastFields = [];
        const deltaFields = [];

        for (const [pid, m] of Object.entries(aiMap)) {
            if (m.block === undefined || m.offset === undefined) continue;
            if (m.block >= blocks.length) continue;
            const base = blockOffsets[m.block];
            const i0 = base + m.offset;
            const scale = this._resolveScale(m.scale, scales);
            let decoder = this._decodeExpr(m.dataType || 'U16', 'buf', i0, scale, m, wordOrder);
            if (!decoder) continue;
            // Casa decimal por campo (espelha apply_factor). Aplicado ANTES do TP/TC.
            // Multiplicacao comuta, mas a ordem casa com a semantica e com o RS485.
            if (m.decimal_src && cat.decimal_regs && !this._tpTcDisabled()) {
                const _dv = m.decimal_src === 'dpt' ? '_fDPT'
                          : m.decimal_src === 'dct' ? '_fDCT'
                          : m.decimal_src === 'dpq' ? '_fDPQ' : null;
                if (_dv) decoder = `(${decoder}) * ${_dv}`;
            }
            // Fator TP/TC (mesma logica do RS485): _fTP/_fTC/_fatorEnergia computados em _sample_tcp_inv.
            if (m.apply_factor && cat.tp_tc && !this._tpTcDisabled()) {
                const _fv = m.apply_factor === 'tp' ? '_fTP'
                          : m.apply_factor === 'tc' ? '_fTC'
                          : m.apply_factor === 'tp_tc' ? '_fatorEnergia' : null;
                if (_fv) decoder = `(${decoder}) * ${_fv}`;
            }
            const entry = { pid, decoder, format: m.format || null };
            const mode = m.mode || 'avg';
            if (mode === 'last') lastFields.push(entry);
            else if (mode === 'delta') deltaFields.push(entry);
            else avgFields.push(entry);
        }

        const totalFields = avgFields.length + lastFields.length + deltaFields.length;

        let cpp = `
// =============================================================================
// ${name} — ${cat.fabricante || '?'} ${cat.modelo || cat.tipo || '?'} (slave ${slave})
// ${blocks.length} blocos | ${totalFields} pontos AI (${avgFields.length} avg, ${lastFields.length} last, ${deltaFields.length} delta)${biCount > 0 ? ` | ${biCount} pontos BI (FC02)` : ''}
// word_order: ${wordOrder}
// =============================================================================
struct _TcpDs${idx}State {
    double sum_[${Math.max(avgFields.length, 1)}];
    int samples;
    float last_[${Math.max(totalFields, 1)}];
    float first_delta_[${Math.max(deltaFields.length, 1)}];
    bool has_first_delta;
    bool valid;
    int fail_streak;
    unsigned long cooldown_until;  // millis() ate quando pular este device (back-off)
    uint32_t tcp_reconnects;       // reconexoes forcadas apos falha (diagnostico remoto)
${biCount > 0 ? `    uint8_t bi_[${biCount}];               // bits de protecao/status (FC02)
    bool bi_valid;                 // ja houve >=1 leitura boa de BI (evita publicar 0 falso)
` : ''}};
static _TcpDs${idx}State _tds${idx} = {};

// Le todos os blocos do inversor e popula buf concatenado.
// Retorna false se qualquer bloco falhar (timeout, excecao, slave invalido).
static bool _read_tcp_inv_${idx}_raw(uint16_t *buf) {
`;
        // Despacha por gateway: datalogger -> MBAP; conversor -> RTU+CRC. ip/port/
        // timeout inline (cada device carrega seu gateway — suporta 2 na mesma TON).
        // Declarado fora do bloco sim/real porque o leitor TP/TC (em _sample_tcp_inv)
        // tambem usa _readFn/_gwArgs.
        const gw = inv.gateway || {};
        const _readFn = (gw.mode === 'rtu_tcp') ? '_modbus_rtu_tcp_read' : '_modbus_tcp_read';
        const _gwArgs = `"${gw.ip || ''}", ${gw.port || 502}, ${gw.timeout_ms || 2000}`;
        if (this._simMode()) {
            cpp += this._genSimFill(aiMap, blocks, blockOffsets);
            cpp += `}\n`;
        } else {
        blocks.forEach((b, bi) => {
            const off = blockOffsets[bi];
            const fnHex = '0x' + b.func.toString(16).padStart(2, '0');
            cpp += `    // Bloco ${bi}: regs ${b.start + 1}-${b.start + b.count}, func ${fnHex}${b.label ? ' — ' + b.label : ''}
    {
        uint16_t tmp${bi}[${b.count}];
        if (!${_readFn}(${_gwArgs}, ${slave}, ${fnHex}, ${b.start}, ${b.count}, tmp${bi})) {
            Serial.printf("[TCP-INV] ${nameEsc}(id${slave}) bloco ${bi} FAIL (reg=${b.start} count=${b.count})\\n");
            return false;
        }
        for (uint16_t i = 0; i < ${b.count}; i++) buf[${off} + i] = tmp${bi}[i];
    }
`;
            if (bi < blocks.length - 1) {
                cpp += `    delay(50);  // espacamento entre blocos pro datalogger respirar
`;
            }
        });

        cpp += `    return true;
}
`;
        }  // fim do else (caminho de leitura TCP real — pulado em sim mode)

        cpp += `
// Le + acumula. Chamar a cada READ_INTERVAL_MS (round-robin em inverter_tcp_sample_one).
static void _sample_tcp_inv_${idx}() {
    // Back-off: device TCP que nao responde fica em cooldown — pula a leitura
    // (que bloquearia o loop ~GATEWAY_TIMEOUT no _modbus_tcp_read) ate expirar.
    // Espelha o leitor RS485; sem isso um device morto (ex: Power_Meter ausente)
    // starva o keepalive do MQTT e a conexao fica flapando.
    if (_tds${idx}.cooldown_until && (long)(millis() - _tds${idx}.cooldown_until) < 0) return;

    uint16_t buf[${totalRegs}];
    if (!_read_tcp_inv_${idx}_raw(buf)) {
        // Falha: fecha o socket p/ o PROXIMO tick reconectar. Reconectar resincroniza
        // o stream RTU-sobre-TCP e faz o conversor resetar o bridge RS485 — e' o que o
        // reboot faz p/ dar 1 leitura boa, aqui a cada falha (e apos cada cooldown, pois
        // o socket fica fechado). Leitura UNICA no ciclo (sem retry) pra nao dobrar o
        // bloqueio do loop se o device estiver mudo — a recuperacao vem no proximo tick.
        Client* _rc = _active_tcp_client();
        if (_rc) _rc->stop();
        _tcp_cur_ip[0] = 0; _tcp_cur_port = 0;   // forca _tcp_ensure_conn a reconectar
        _tds${idx}.tcp_reconnects++;
        _tds${idx}.fail_streak++;
        Serial.printf("[TCP-INV] ${nameEsc}(id${slave}): falha leitura (consecutivas: %d)\\n", _tds${idx}.fail_streak);
        if (_tds${idx}.fail_streak >= MODBUS_FAIL_COOLDOWN_N) {
            _tds${idx}.cooldown_until = millis() + MODBUS_COOLDOWN_MS;
            if (_tds${idx}.cooldown_until == 0) _tds${idx}.cooldown_until = 1;  // 0 = sentinela "sem cooldown"
            Serial.printf("[TCP-INV] ${nameEsc}(id${slave}): cooldown %lus (nao responde) — loop liberado p/ MQTT/cmd\\n", (unsigned long)(MODBUS_COOLDOWN_MS/1000));
        }
        return;
    }
    _tds${idx}.cooldown_until = 0;
    if (_tds${idx}.fail_streak > 0) {
        Serial.printf("[TCP-INV] ${nameEsc}(id${slave}): OK (apos %d falhas)\\n", _tds${idx}.fail_streak);
        _tds${idx}.fail_streak = 0;
    }

`;
        // TP/TC: le reg do medidor via o gateway do device (MBAP ou RTU+CRC) e aplica
        // override do diagrama. Espelha o leitor RS485. So' pra devices com cat.tp_tc.
        if (cat.tp_tc && !this._tpTcDisabled()) {
            const _t = cat.tp_tc;
            const _sTp = (Number(_t.scale_tp) || 1).toFixed(1);
            const _sTc = (Number(_t.scale_tc) || 1).toFixed(1);
            const _tcOv = this._parseScaleOverride(inv.tc_ratio);
            const _tpOv = this._parseScaleOverride(inv.tp_ratio);
            cpp += `    // TP/TC para escalonamento (le reg ${_t.register} via gateway; override do diagrama prevalece)
    float _fTP = 1.0f, _fTC = 1.0f, _fatorEnergia = 1.0f;
    {
        uint16_t _tptc[${_t.count}];
        if (${_readFn}(${_gwArgs}, ${slave}, 0x03, ${_t.register}, ${_t.count}, _tptc)) {
            _fTP = (float)_tptc[${_t.tp_offset}] / ${_sTp}f;
            _fTC = (float)_tptc[${_t.tc_offset}] / ${_sTc}f;
            Serial.printf("[M160] medidor reporta TP=%.0f TC=%.0f\\n", _fTP, _fTC);
        } else {
            Serial.println("[M160] leitura TP/TC FALHOU (rc!=0)");
        }
${_tpOv ? `        _fTP = ${_tpOv.toFixed(1)}f;  // override tp_ratio (diagrama)\n` : ''}${_tcOv ? `        _fTC = ${_tcOv.toFixed(1)}f;  // override tc_ratio (diagrama) — deterministico\n` : ''}        _fatorEnergia = _fTP * _fTC;
        Serial.printf("[M160] usando TP=%.0f TC=%.0f -> fatorEnergia=%.0f\\n", _fTP, _fTC, _fatorEnergia);
    }
`;
        }
        // DPT/DCT/DPQ (casa decimal dinamica, M160): le reg35/36 via gateway e calcula
        // fatores _fDPT/_fDCT/_fDPQ como DELTA do expoente lido vs baseline do scale fixo.
        if (cat.decimal_regs && !this._tpTcDisabled()) {
            const d = cat.decimal_regs, L = d.layout || {};
            const ext = (s) => {
                const cfg = L[s]; if (!cfg) return null;
                const w = cfg.word || 0, base = (cfg.baseline ?? 4);
                const expr = cfg.byte === 'hi' ? `(_dec[${w}] >> 8) & 0xFF` : `_dec[${w}] & 0xFF`;
                return { expr, base, var: `_f${s.toUpperCase()}` };
            };
            const dpt = ext('dpt'), dct = ext('dct'), dpq = ext('dpq');
            cpp += `    // Casas decimais (reg ${d.register}: DPT/DCT/DPQ). value = raw*10^(exp-baseline).
    // Cache do ultimo valor bom (init=baseline => fator 1.0): expoentes mudam raro, entao
    // se a leitura falhar usa o ultimo lido em vez de cair pra 1.0. Retry 3x (flush interno do _readFn).
    static uint8_t _lDPT = ${dpt ? dpt.base : 4}, _lDCT = ${dct ? dct.base : 4}, _lDPQ = ${dpq ? dpq.base : 4};
    float _fDPT = 1.0f, _fDCT = 1.0f, _fDPQ = 1.0f;
    {
        uint16_t _dec[${d.count}];
        bool _okDec = false;
        for (int _t = 0; _t < 3 && !_okDec; _t++) _okDec = ${_readFn}(${_gwArgs}, ${slave}, 0x03, ${d.register}, ${d.count}, _dec);
        if (_okDec) {
${dpt ? `            _lDPT = ${dpt.expr};\n` : ''}${dct ? `            _lDCT = ${dct.expr};\n` : ''}${dpq ? `            _lDPQ = ${dpq.expr};\n` : ''}            uint8_t _sign = _dec[${(d.sign && d.sign.word) || 1}] & 0xFF;
            Serial.printf("[M160] DPT=%u DCT=%u DPQ=%u SIGN=0x%02X (raw r35=0x%04X r36=0x%04X)\\n", _lDPT, _lDCT, _lDPQ, _sign, _dec[0], _dec[${d.count > 1 ? 1 : 0}]);
        } else {
            Serial.printf("[M160] reg35 falhou — usando ultimo bom DPT=%u DCT=%u DPQ=%u\\n", _lDPT, _lDCT, _lDPQ);
        }
${dpt ? `        _fDPT = _pow10i((int)_lDPT - ${dpt.base});\n` : ''}${dct ? `        _fDCT = _pow10i((int)_lDCT - ${dct.base});\n` : ''}${dpq ? `        _fDPQ = _pow10i((int)_lDPQ - ${dpq.base});\n` : ''}    }
`;
        }
        // Decode + acumulacao avg
        avgFields.forEach((f, i) => {
            cpp += `    float v_${f.pid} = ${f.decoder};\n`;
            cpp += `    _tds${idx}.sum_[${i}] += v_${f.pid};\n`;
        });
        lastFields.forEach((f) => {
            cpp += `    float v_${f.pid} = ${f.decoder};\n`;
        });
        deltaFields.forEach((f, i) => {
            cpp += `    float v_${f.pid} = ${f.decoder};\n`;
            cpp += `    if (!_tds${idx}.has_first_delta) { _tds${idx}.first_delta_[${i}] = v_${f.pid}; }\n`;
        });
        if (deltaFields.length > 0) {
            cpp += `    if (!_tds${idx}.has_first_delta) _tds${idx}.has_first_delta = true;\n`;
        }

        // Salvar last_ em ordem (avg + last + delta)
        let lastIdx = 0;
        [...avgFields, ...lastFields, ...deltaFields].forEach(f => {
            cpp += `    _tds${idx}.last_[${lastIdx++}] = v_${f.pid};\n`;
        });
        cpp += `    _tds${idx}.samples++;\n`;
        cpp += `    _tds${idx}.valid = true;\n`;

        // BI: protecoes/status via FC02 (discrete inputs), MBAP. Falha de BI NAO
        // invalida o ciclo AI — mantem o ultimo estado; bi_valid so vira true apos
        // TODOS os blocos lerem bem no ciclo (gate na publicacao: nunca publica 0
        // "chutado"). Blocos separados porque bits nao-mapeados dao excecao 2.
        if (biCount > 0) {
            cpp += `
    // BI ${biCount} pontos em ${biBlocks.length} bloco(s) FC02
    {
        bool _biOk = true;
`;
            biBlocks.forEach((b, bIdx) => {
                const biFunc = '0x' + (b.func || 0x02).toString(16).padStart(2, '0');
                const biBytes = Math.ceil(b.count / 8);
                cpp += `        uint8_t _bits${bIdx}[${biBytes}];  // start=${b.start} count=${b.count}${b.label ? ' — ' + b.label : ''}
        if (!_modbus_tcp_read_bits(${_gwArgs}, ${slave}, ${biFunc}, ${b.start}, ${b.count}, _bits${bIdx})) _biOk = false;
`;
            });
            cpp += `        if (_biOk) {
`;
            biEntries.forEach(([pid, m], k) => {
                const off = m.bit;
                cpp += `            _tds${idx}.bi_[${k}] = (_bits${m.block}[${Math.floor(off / 8)}] >> ${off % 8}) & 1;  // ${pid}\n`;
            });
            cpp += `            _tds${idx}.bi_valid = true;
        }
    }
`;
        }

        // Log de debug — espelha a lista do RS485 _genDeviceReader.
        // Antes so' listava campos de inversor — power_meter ia silencioso (sem log de sample).
        const preferredOrder = ['vab', 'vbc', 'vca', 'va', 'vb', 'vc',
                                'ia', 'ib', 'ic',
                                'potencia_ativa', 'pa_total', 'dc_total_power',
                                'freq_rede', 'freq', 'fator_potencia', 'fp', 'fp_total',
                                'mppt1_voltage', 'mppt1_v', 'temp_interna',
                                'daily_yield', 'total_yield', 'work_state',
                                'geracao_diaria', 'geracao_total', 'estado_operacao',
                                'energia_ativa_imp', 'consumo_ativa_imp'];
        const logFields = [];
        for (const pid of preferredOrder) {
            if (aiMap[pid] && logFields.length < 7) {   // 7 pra caber V trifasico + I trifasico + freq
                if (avgFields.find(f => f.pid === pid) ||
                    lastFields.find(f => f.pid === pid) ||
                    deltaFields.find(f => f.pid === pid)) {
                    logFields.push(pid);
                }
            }
        }
        if (logFields.length > 0) {
            cpp += `    Serial.printf("[TCP-INV] ${nameEsc}(id${slave}) #%d: ", _tds${idx}.samples);\n`;
            logFields.forEach((pid, i) => {
                cpp += `    Serial.printf("${pid}=%.2f${i < logFields.length - 1 ? ' ' : ''}", v_${pid});\n`;
            });
            cpp += `    Serial.println();\n`;
        }

        cpp += `}

// Publica medias (avg) + last + delta. Zera acumuladores apos publish.
// Estrutura aninhada espelha _genDeviceReader (RS485): usa tipo.ai/bi do catalogo
// para resolver json paths, agrupar por top-level key, e respeitar tipo.group_order.
static void _publish_tcp_inv_${idx}(tcp_publish_fn publish) {
    if (!_tds${idx}.valid || _tds${idx}.samples == 0) {
        // Enriquecido p/ diagnostico REMOTO: motivo da ultima falha + nº de reconexoes.
        char _nsbuf[112];
        snprintf(_nsbuf, sizeof(_nsbuf),
                 "{\\"error\\":\\"no_samples\\",\\"last_fail\\":\\"%s\\",\\"reconnects\\":%lu}",
                 _tcp_last_fail_reason, (unsigned long)_tds${idx}.tcp_reconnects);
        publish("${subtopicEsc}", _nsbuf);
        return;
    }

    int n = _tds${idx}.samples;
    // JSON e payload na HEAP (nao na stack). loopTask tem 8KB de stack;
    // alocar 3KB+3KB na stack aqui causava overflow + Panic em ~67s no projeto
    // Chimarrao com Power_Meter + 2 inversores. Heap fica em ~280KB livres,
    // sobra de sobra pra os 3KB do doc+payload.
    DynamicJsonDocument d(3072);
`;

        // --- Resolver path JSON para cada pid (usa DEVICE_POINTS[tipo]) ---
        const tipo = (typeof DEVICE_POINTS !== 'undefined' && cat.tipo) ? DEVICE_POINTS[cat.tipo] : null;
        const tipoAi = tipo ? (tipo.ai || []) : [];
        const tipoBi = tipo ? (tipo.bi || []) : [];

        // Config de publicacao: timestamp_format, timestamp_position, meta_fields
        const pubCfg = (tipo && tipo.publish) || {};
        const tsFormat   = pubCfg.timestamp_format   || 'epoch';
        const tsPosition = pubCfg.timestamp_position || 'first';
        const metaFields = pubCfg.meta_fields || ['inverter_id', 'samples'];
        const tsExpr = (tsFormat === 'datetime')
            ? '_format_timestamp_str()'
            : '(long)time(nullptr)';

        if (tsPosition === 'first') {
            cpp += `    d["timestamp"] = ${tsExpr};\n`;
        }
        if (metaFields.includes('inverter_id')) {
            cpp += `    d["inverter_id"] = ${slave};\n`;
        }
        if (metaFields.includes('samples')) {
            cpp += `    d["samples"] = n;\n`;
        }
        cpp += `\n`;

        const resolveJsonPath = (pid) => {
            const exactAi = tipoAi.find(a => a.id === pid);
            if (exactAi && exactAi.json) return exactAi.json;
            const exactBi = tipoBi.find(a => a.id === pid);
            if (exactBi && exactBi.json) return exactBi.json;
            for (const a of tipoAi) {
                if (a.per_instance && a.prefix && a.suffix) {
                    const re = new RegExp(`^${a.prefix}\\d+${a.suffix}$`);
                    if (re.test(pid)) return `${a.group || 'dc'}.${pid}`;
                }
            }
            return pid;
        };

        // --- Coleta expressoes fonte para cada pid ---
        const fieldSources = {}; // pid -> { expr, format }
        avgFields.forEach((f, i) => {
            fieldSources[f.pid] = { expr: `(float)(_tds${idx}.sum_[${i}] / n)`, format: f.format, raw: false };
        });
        let lastRunIdx2 = avgFields.length;
        lastFields.forEach((f) => {
            fieldSources[f.pid] = { expr: `_tds${idx}.last_[${lastRunIdx2++}]`, format: f.format, raw: false };
        });
        const deltaExprs = {}; // pid -> { lastI, deltaIdx, clamp, format }
        deltaFields.forEach((f, i) => {
            const lastI = avgFields.length + lastFields.length + i;
            deltaExprs[f.pid] = { lastI, deltaIdx: i, clamp: !!f.clamp, format: f.format };
            // Placeholder — real expr resolvido ao emitir (usa variavel local dv_pid)
            fieldSources[f.pid] = { expr: `dv_${f.pid}`, format: f.format, raw: false };
        });
        // BI (FC02): publica so apos primeira leitura boa (flag bi na fonte -> guarda
        // _tds.bi_valid na emissao). Espelha o formato do RS485 (0/1 flat por pid).
        biEntries.forEach(([pid], k) => {
            fieldSources[pid] = { expr: `_tds${idx}.bi_[${k}]`, format: null, raw: false, bi: true };
        });

        // --- Agrupar por top-level key do json path ---
        // Pre-popular groups na ordem definida pelo tipo
        const groups = {}; // topKey -> [{ subKey, pid, src }]
        for (const a of [...tipoAi, ...tipoBi]) {
            if (a.json && a.json.includes('.')) {
                const top = a.json.split('.')[0];
                if (!groups[top]) groups[top] = [];
            } else if (a.group) {
                if (!groups[a.group]) groups[a.group] = [];
            }
        }
        const topLevelFields = []; // flat fields
        for (const [pid, src] of Object.entries(fieldSources)) {
            const path = resolveJsonPath(pid);
            const parts = path.split('.');
            if (parts.length === 1) {
                topLevelFields.push({ key: parts[0], pid, src });
            } else {
                const top = parts[0];
                const rest = parts.slice(1).join('.');
                if (!groups[top]) groups[top] = [];
                groups[top].push({ subKey: rest, pid, src });
            }
        }

        // --- Emitir delta (precisa calcular dv_<pid> antes de usar) ---
        Object.entries(deltaExprs).forEach(([pid, de]) => {
            cpp += `    float dv_${pid} = _tds${idx}.last_[${de.lastI}] - _tds${idx}.first_delta_[${de.deltaIdx}];\n`;
            if (de.clamp) {
                cpp += `    if (dv_${pid} < 0 || fabsf(dv_${pid}) < 1e-6f) dv_${pid} = 0;\n`;
            }
        });

        // --- Ordenar topLevelFields pela ordem do tipo.ai/bi (saida flat consistente) ---
        const aiOrder = new Map();
        [...tipoAi, ...tipoBi].forEach((a, i) => aiOrder.set(a.id, i));
        topLevelFields.sort((a, b) => {
            const ia = aiOrder.has(a.pid) ? aiOrder.get(a.pid) : 999 + a.pid.localeCompare('');
            const ib = aiOrder.has(b.pid) ? aiOrder.get(b.pid) : 999 + b.pid.localeCompare('');
            return ia - ib;
        });

        // --- Emitir top-level fields ---
        // Campos BI ganham guarda _tds.bi_valid: nunca publica 0 "chutado" antes da
        // primeira leitura boa de FC02 (estado de protecao/DJ errado e' pior que ausente).
        topLevelFields.forEach(({ key, src }) => {
            const guard = src.bi ? `if (_tds${idx}.bi_valid) ` : '';
            if (src.format === 'hex') {
                cpp += `    ${guard}{ char _h[8]; snprintf(_h, sizeof(_h), "%x", (uint16_t)(${src.expr})); d["${this._escStr(key)}"] = String(_h); }\n`;
            } else {
                cpp += `    ${guard}d["${this._escStr(key)}"] = ${src.expr};\n`;
            }
        });

        // --- Reordenar groups conforme tipo.group_order (se definido) ---
        if (tipo && Array.isArray(tipo.group_order)) {
            const ordered = {};
            for (const g of tipo.group_order) if (groups[g]) ordered[g] = groups[g];
            for (const g of Object.keys(groups)) if (!ordered[g]) ordered[g] = groups[g];
            Object.keys(groups).forEach(k => delete groups[k]);
            Object.assign(groups, ordered);
        }

        // --- Emitir grupos aninhados (pula grupos vazios, exceto 'status') ---
        for (const [groupKey, fields] of Object.entries(groups)) {
            if (fields.length === 0 && groupKey !== 'status') continue;
            const gvar = `g_${groupKey.replace(/[^a-zA-Z0-9_]/g, '_')}`;
            cpp += `    JsonObject ${gvar} = d.createNestedObject("${this._escStr(groupKey)}");\n`;
            fields.forEach(({ subKey, src }) => {
                const guard = src.bi ? `if (_tds${idx}.bi_valid) ` : '';
                if (src.format === 'hex') {
                    cpp += `    ${guard}{ char _h[8]; snprintf(_h, sizeof(_h), "%x", (uint16_t)(${src.expr})); ${gvar}["${this._escStr(subKey)}"] = String(_h); }\n`;
                } else {
                    cpp += `    ${guard}${gvar}["${this._escStr(subKey)}"] = ${src.expr};\n`;
                }
            });
            // status.work_state_text: se o grupo for 'status' e tivermos work_state, adiciona o texto
            if (groupKey === 'status' && fieldSources['work_state']) {
                cpp += `    ${gvar}["work_state_text"] = _work_state_text((uint16_t)${fieldSources['work_state'].expr});\n`;
            }
        }

        // --- Timestamp no fim, se configurado ---
        if (tsPosition === 'last') {
            cpp += `    d["timestamp"] = ${tsExpr};\n`;
        }

        cpp += `
    // Payload na HEAP (evita estouro de stack). Liberado ao sair do escopo.
    char* payload = (char*)malloc(3072);
    if (!payload) {
        Serial.println("[TCP-INV] OOM ao alocar payload");
        return;
    }
    size_t sz = serializeJson(d, payload, 3072);
    if (sz > 0) {
        publish("${subtopicEsc}", payload);
        Serial.printf("\\n===== PUBLICADO: ${nameEsc} (%d amostras) =====\\n", n);
        Serial.println(payload);
        Serial.println();
    }
    free(payload);

    // Reset do ciclo (preserva 'first_delta' da ultima amostra para o proximo intervalo)
`;
        if (deltaFields.length > 0) {
            deltaFields.forEach((_, i) => {
                const lastI = avgFields.length + lastFields.length + i;
                cpp += `    _tds${idx}.first_delta_[${i}] = _tds${idx}.last_[${lastI}];\n`;
            });
        }
        cpp += `    for (int i = 0; i < ${Math.max(avgFields.length, 1)}; i++) _tds${idx}.sum_[i] = 0;
    _tds${idx}.samples = 0;
}

`;
        return cpp;
    }

    // ---- config.h (variável por projeto) ----
    _genConfigH(spec) {
        let h = `#ifndef CONFIG_H
#define CONFIG_H
#include <stdint.h>

// ============================================================
// CONFIG - ${spec.name} (${spec.tonType.toUpperCase()})
// Gerado pelo NexOn IoT
// ============================================================

#define DEVICE_MODEL        "${spec.tonType.toUpperCase()}"
#define DEVICE_ID           "${spec.hostname}"
#define FIRMWARE_VERSION    "${(() => { const d = new Date(); const p = n => String(n).padStart(2,'0'); return `1.8.0-build${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`; })()}"

// I2C
#define I2C_ADDR_RTC        0x68
#define I2C_ADDR_MUX_IN     0x26
#define I2C_ADDR_MUX_OUT    0x27
#define I2C_CLOCK_HZ        100000

// SPI
#define SPI_CLOCK_HZ        8000000

// RS485
#define RS485_UART_NUM      1
#define RS485_BAUD          9600
#define RS485_CONFIG        SERIAL_8N1
`;

        if (spec.has_lora) {
            // LORA_MODE removido — half-duplex bidirecional sempre (RX+TX).
            // Role (gateway/satellite/tx) e' resolvido pelo layout, nao por config manual.
            h += `
// LoRa (E220-900T30D — modo transparente, half-duplex RX+TX)
#define LORA_UART_NUM       2
#define LORA_BAUD           9600
#define LORA_CONFIG         SERIAL_8N1
#define LORA_ROLE           "${(spec.lora_role || 'tx').toUpperCase()}"
`;
        }

        // WiFi (multi-rede até 4: lista em NVS semeada por esta; /cmd/wifi troca sem reflash)
        if (spec.wifi) {
            const _nets = (spec.wifi.networks && spec.wifi.networks.length)
                ? spec.wifi.networks.slice(0, 4)
                : (spec.wifi.ssid ? [{ ssid: spec.wifi.ssid, password: spec.wifi.password || '' }] : []);
            const _escc = (x) => String(x || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            const _ssidArr = _nets.map(n => `"${_escc(n.ssid)}"`).join(', ') || '""';
            const _passArr = _nets.map(n => `"${_escc(n.password)}"`).join(', ') || '""';
            let _hash = 0x811c9dc5;
            const _hstr = _nets.map(n => `${n.ssid}\u0000${n.password || ''}`).join('\u0001');
            for (let i = 0; i < _hstr.length; i++) { _hash ^= _hstr.charCodeAt(i); _hash = (_hash * 0x01000193) >>> 0; }
            h += `
// WiFi (multi-rede: ate 4)
#define WIFI_SSID           "${_escc(_nets[0] ? _nets[0].ssid : '')}"
#define WIFI_PASSWORD       "${_escc(_nets[0] ? _nets[0].password : '')}"
#define WIFI_TIMEOUT_MS     10000
#define WIFI_MAX_NETS       4
#define WIFI_TRY_MS         20000UL
#define WIFI_CONFIG_HASH    ${_hash}u
static const char* WIFI_DEF_SSID[] = { ${_ssidArr} };
static const char* WIFI_DEF_PASS[] = { ${_passArr} };
static const int   WIFI_DEF_COUNT  = ${_nets.length};
`;
        }

        // MQTT
        if (spec.mqtt) {
            h += `
// MQTT
#define MQTT_SERVER         "${spec.mqtt.server}"
#define MQTT_PORT           ${spec.mqtt.port}
#define MQTT_USER           ""
#define MQTT_PASS           ""
// MQTT_CLIENT_ID e' montado em runtime usando o MAC do hardware (unico por placa).
// Formato: "TON-XXXXXXXXXXXX" (12 hex chars do MAC, sem separador).
// Substitui versao compile-time que colidia quando duas TONs compartilhavam hostname
// (ex: 10 IPs reais em campo conectavam com "TON1-TON1" simultaneamente, derrubando
// uns aos outros no broker - 26k+ desconexoes/dia). Veja docs/IOT-MQTT-CLIENTID-UNICO.md.
extern char MQTT_CLIENT_ID[20];
#define MQTT_TOPIC_BASE     "${this._simMode() ? 'TESTE/' : ''}${spec.mqtt.topic_base}"
#define MQTT_TOPIC_CMD      MQTT_TOPIC_BASE "/cmd"
#define MQTT_TOPIC_RELAYS   MQTT_TOPIC_BASE "/relays"
#define MQTT_TOPIC_INPUTS   MQTT_TOPIC_BASE "/inputs"
#define MQTT_TOPIC_OUTPUTS  MQTT_TOPIC_BASE "/outputs"
#define MQTT_TOPIC_METER    MQTT_TOPIC_BASE "/meter"
#define MQTT_BUFFER_SIZE    4096
#define DIAG_INTERVAL_MS    60000   // publica diagnostico a cada 60s
#define MQTT_STATUS_MS      60000
#define OTA_DOWNLOAD_TIMEOUT_MS 60000
`;
        } else {
            // Sem broker/WiFi (ex: TON4 satellite — só LoRa). O firmware ainda
            // gera funcoes que referenciam MQTT_TOPIC_BASE (ex: _publish_cmd_ack
            // do caminho de comando via Serial). Define um base a partir do
            // topico configurado pra compilar — a TON satellite nao publica em
            // MQTT (telemetria/ack vao por LoRa), entao o valor e' so identidade.
            h += `
// MQTT ausente (LoRa-only). MQTT_TOPIC_BASE definido apenas pra compilar os
// helpers de comando — nenhuma publicacao MQTT real ocorre nesta TON.
#define MQTT_TOPIC_BASE     "${this._simMode() ? 'TESTE/' : ''}${spec.topicBase || spec.name || 'TON'}"
#define DIAG_INTERVAL_MS    60000
`;
        }

        // Ethernet
        h += `
// Ethernet W5500
#define ETH_MAC             { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0x01 }
#define ETH_DHCP_TIMEOUT_MS 4000    // B3: era 10 s bloqueando o laco a cada 30 s
#define ETH_STATIC_IP       "192.168.1.200"
#define ETH_GATEWAY         "192.168.1.1"
#define ETH_SUBNET          "255.255.255.0"
#define ETH_DNS             "8.8.8.8"
`;

        // SD Card
        h += `
// SD Card
#define SD_BUFFER_FILE      "/datalog.csv"
#define SD_MAX_FILE_SIZE    (1024 * 1024)

// PWM
#define PWM_CHANNEL         0
#define PWM_FREQ_HZ         1000
#define PWM_RESOLUTION      8

// ADC
#define ADC_RESOLUTION_BITS 12
#define ADC_ATTEN           ADC_11db
#define ADC_DIVIDER         8.01

// MCP23008 pin mapping
#define MCP_INPUT_COUNT     6

// Timing
#define INPUT_SCAN_MS       50
#define WATCHDOG_TIMEOUT_S  60      // Watchdog mais generoso (60s) para lidar com Modbus lento
`;

        // Modbus devices (RS485 ou TCP)
        if (spec.rs485_devices.length > 0 || spec.tcp_devices.length > 0) {
            h += `
// Medidores Modbus
#define METER_CYCLE_MS      4000
#define PUBLISH_INTERVAL_MS 60000
#define MAX_READINGS        35
// Back-off de device Modbus que nao responde: apos N falhas consecutivas, para
// de ler por COOLDOWN_MS. Cada leitura falha bloqueia ~2-4s no timeout do
// ModbusMaster; sem back-off, um device morto deixa a TON surda a comandos
// (critico no satellite LoRa — precisa sempre acionar a bomba). Durante o
// cooldown o loop fica livre pra LoRa/MQTT.
#define MODBUS_FAIL_COOLDOWN_N   3
#define MODBUS_COOLDOWN_MS       30000UL
`;
        }

        h += `
#endif
`;
        return h;
    }

    // ---- mqtt.h ----
    _genMqttH() {
        return `#ifndef MQTT_H
#define MQTT_H

typedef void (*mqtt_cmd_callback_t)(const char* payload);

void mqtt_init(mqtt_cmd_callback_t callback);
void mqtt_loop();
bool mqtt_publish(const char* topic, const char* payload);
// Publica direto, sem fallback de SD (usado p/ diagnostics — nao faz sentido enfileirar).
bool mqtt_publish_raw(const char* topic, const char* payload);
bool mqtt_connected();
// Retorna nome da interface de rede ativa: "wifi" | "eth" | "none"
const char* mqtt_active_iface();
// Auto-recuperacao (watchdog de conectividade) e reinicio remoto:
// agenda um reinicio em delay_ms (so' executa se for seguro: sem OTA / posto ocioso).
void mqtt_request_restart(const char* reason, unsigned long delay_ms);
bool mqtt_restart_permitido();
// Motivo do ULTIMO reinicio pedido pelo proprio firmware ("" = nao foi o firmware).
const char* mqtt_restart_cause();
// Ha quanto tempo a sessao MQTT atual esta de pe (ms). Protege o 'reboot' contra comando RETIDO.
unsigned long mqtt_conn_age_ms();

#endif
`;
    }

    // ---- diag.h ----
    _genDiagH() {
        return `#ifndef DIAG_H
#define DIAG_H
#include <stdint.h>

// Contadores globais de diagnostico (extern). Outros modulos incrementam estes diretamente.
extern uint32_t      diag_modbus_ok;
extern uint32_t      diag_modbus_err;
extern uint32_t      diag_mqtt_pub;
extern uint32_t      diag_publish_fails;
extern uint32_t      diag_wifi_disconnects;
extern uint32_t      diag_mqtt_disconnects;
extern uint32_t      diag_tcp_retries;
extern uint32_t      diag_sd_writes;
extern uint32_t      diag_sd_resends;
extern uint32_t      diag_sd_write_errors;
extern uint32_t      diag_min_free_heap;
extern bool          diag_sd_available;
extern bool          diag_tcp_connected;
extern unsigned long diag_last_successful_read_ms;
extern unsigned long diag_boot_time_ms;

void        diag_init();                  // chamar uma vez no setup()
void        diag_tick();                  // chamar todo loop (atualiza min_free_heap)
const char* diag_reset_reason();          // texto do esp_reset_reason()
void        diag_publish_periodic();      // publica em DIAG_TOPIC se passou DIAG_INTERVAL_MS

#endif
`;
    }

    // ---- diag.cpp ----
    _genDiagCpp(spec) {
        if (!spec.wifi) {
            return `#include "diag.h"
// Sem WiFi: stubs vazios.
uint32_t diag_modbus_ok = 0;          uint32_t diag_modbus_err = 0;
uint32_t diag_mqtt_pub = 0;           uint32_t diag_publish_fails = 0;
uint32_t diag_wifi_disconnects = 0;   uint32_t diag_mqtt_disconnects = 0;
uint32_t diag_tcp_retries = 0;
uint32_t diag_sd_writes = 0;          uint32_t diag_sd_resends = 0;          uint32_t diag_sd_write_errors = 0;
uint32_t diag_min_free_heap = 0xFFFFFFFFu;
bool     diag_sd_available = false;   bool     diag_tcp_connected = false;
unsigned long diag_last_successful_read_ms = 0;  unsigned long diag_boot_time_ms = 0;
void diag_init() {}
void diag_tick() {}
const char* diag_reset_reason() { return "Unknown"; }
void diag_publish_periodic() {}
`;
        }

        return `#include "diag.h"
#include "config.h"
#include "mqtt.h"
#include "ota.h"
#include "sd_buffer.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include <esp_system.h>

uint32_t diag_modbus_ok = 0;
uint32_t diag_modbus_err = 0;
uint32_t diag_mqtt_pub = 0;
uint32_t diag_publish_fails = 0;
uint32_t diag_wifi_disconnects = 0;
uint32_t diag_mqtt_disconnects = 0;
uint32_t diag_tcp_retries = 0;
uint32_t diag_sd_writes = 0;
uint32_t diag_sd_resends = 0;
uint32_t diag_sd_write_errors = 0;
uint32_t diag_min_free_heap = 0xFFFFFFFFu;
bool     diag_sd_available = false;
bool     diag_tcp_connected = false;
unsigned long diag_last_successful_read_ms = 0;
unsigned long diag_boot_time_ms = 0;

static unsigned long _lastDiagPub = 0;

void diag_init() {
    diag_boot_time_ms = millis();
    diag_min_free_heap = ESP.getFreeHeap();
}

// D1: maior volta do laco desde o ultimo diagnostico (base para calibrar o watchdog).
static uint32_t _loopMaxMs = 0;
static unsigned long _loopLastMs = 0;
extern uint32_t diag_i2c_resets __attribute__((weak));
void diag_tick() {
    uint32_t f = ESP.getFreeHeap();
    if (f < diag_min_free_heap) diag_min_free_heap = f;
    unsigned long now = millis();
    if (_loopLastMs && now - _loopLastMs > _loopMaxMs) _loopMaxMs = now - _loopLastMs;
    _loopLastMs = now;
}

const char* diag_reset_reason() {
    switch (esp_reset_reason()) {
        case ESP_RST_POWERON:  return "Power-on";
        case ESP_RST_SW:       return "Software";
        case ESP_RST_PANIC:    return "Panic";
        case ESP_RST_INT_WDT:
        case ESP_RST_TASK_WDT:
        case ESP_RST_WDT:      return "Watchdog";
        case ESP_RST_BROWNOUT: return "Brownout";
        case ESP_RST_DEEPSLEEP: return "DeepSleep";
        default:               return "Unknown";
    }
}

void diag_publish_periodic() {
    if (!mqtt_connected()) return;
    if (millis() - _lastDiagPub < DIAG_INTERVAL_MS) return;
    _lastDiagPub = millis();

    StaticJsonDocument<1024> doc;
    doc["device"]            = DEVICE_MODEL;
    doc["mac"]               = WiFi.macAddress();
    // IP reportado e' o da interface ATIVA no MQTT (wifi ou eth)
    {
        const char* iface = mqtt_active_iface();
        doc["iface"] = iface;
        if (strcmp(iface, "eth") == 0) {
            extern IPAddress eth_local_ip();
            doc["ip"] = eth_local_ip().toString();
        } else {
            doc["ip"] = WiFi.localIP().toString();
        }
    }
    doc["uptime_sec"]        = (uint32_t)((millis() - diag_boot_time_ms) / 1000);
    doc["free_heap"]         = ESP.getFreeHeap();
    doc["wifi_rssi"]         = WiFi.RSSI();
    doc["tcp_connected"]     = diag_tcp_connected;
    doc["tcp_retries"]       = diag_tcp_retries;
    doc["modbus_ok"]         = diag_modbus_ok;
    doc["modbus_err"]        = diag_modbus_err;
    doc["mqtt_pub"]          = diag_mqtt_pub;
    doc["publish_fails"]     = diag_publish_fails;
    doc["wifi_disconnects"]  = diag_wifi_disconnects;
    doc["mqtt_disconnects"]  = diag_mqtt_disconnects;
    doc["sd_available"]      = diag_sd_available;
    doc["sd_writes"]         = diag_sd_writes;
    doc["sd_resends"]        = diag_sd_resends;
    doc["sd_write_errors"]   = diag_sd_write_errors;
    doc["sd_estado"]         = sd_buffer_state();      // ok | sem_cartao | falha
    doc["sd_pendentes"]      = sd_buffer_pending();
    doc["sd_descartadas"]    = sd_buffer_discarded();  // cartao cheio: mais antigas
    doc["loop_max_ms"]       = _loopMaxMs;             // maior volta do laco desde o ultimo diag
    doc["i2c_resets"]        = (&diag_i2c_resets) ? diag_i2c_resets : 0;
    doc["min_free_heap"]     = diag_min_free_heap;
    doc["reset_reason"]      = diag_reset_reason();
    doc["restart_cause"]     = mqtt_restart_cause();   // "" | sem_broker | comando
    if (diag_last_successful_read_ms > 0) {
        doc["silence_sec"] = (uint32_t)((millis() - diag_last_successful_read_ms) / 1000);
    } else {
        doc["silence_sec"] = 0;
    }

    char json[1024];
    size_t sz = serializeJson(doc, json, sizeof(json));
    if (sz == 0) return;

    char topic[160];
    snprintf(topic, sizeof(topic), "%s/diagnostics", MQTT_TOPIC_BASE);
    if (mqtt_publish_raw(topic, json)) {
        _loopMaxMs = 0;
        // Diagnostic gerado e publicado pelo firmware NOVO ao vivo: prova que
        // WiFi+MQTT+JSON+counters estao funcionando. Conta como validacao OTA
        // (cobre o caso patologico de TON sem telemetria periodica via mqtt_publish).
        ota_confirm_valid_if_needed();
        // Heartbeat visual no serial: confirma que o pipe MQTT esta vivo.
        Serial.printf("[MQTT] diag publicado em %s/diagnostics (iface=%s, total_pubs=%lu)\\n",
                      MQTT_TOPIC_BASE, mqtt_active_iface(), (unsigned long)diag_mqtt_pub);
    } else {
        Serial.printf("[MQTT] FALHA ao publicar diagnostics (iface=%s)\\n", mqtt_active_iface());
    }
}
`;
    }

    // ---- mqtt.cpp ----
    _genMqttCpp(spec) {
        if (!spec.wifi) {
            return `#include "mqtt.h"
void mqtt_init(mqtt_cmd_callback_t cb) {}
void mqtt_loop() {}
bool mqtt_publish(const char* t, const char* p) { return false; }
bool mqtt_connected() { return false; }
#include <Arduino.h>
bool mqtt_restart_permitido() { return true; }
void mqtt_request_restart(const char* reason, unsigned long delay_ms) { Serial.printf("[SYS] reinicio (%s)\\n", reason); delay(delay_ms > 3000 ? 3000 : delay_ms); ESP.restart(); }
const char* mqtt_restart_cause() { return ""; }
unsigned long mqtt_conn_age_ms() { return 0xFFFFFFFFUL; }
`;
        }

        return `#include "mqtt.h"
#include "ota.h"
#include "sd_buffer.h"
#include "diag.h"
#include "eth.h"
#include "config.h"
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <EthernetUdp.h>
#include <esp_task_wdt.h>
#include <string.h>
#include <time.h>
#include <sys/time.h>

// Janelas de retry/drain — evita saturar o broker ao reconectar.
// Publicacoes sao feitas normalmente em tempo real; a drenagem do SD e gradual.
#define WIFI_RECONNECT_MS   15000UL   // tenta WiFi.reconnect() no maximo a cada 15s
#define MQTT_RECONNECT_MS   5000UL    // tenta mqtt.connect() no maximo a cada 5s
#define SD_DRAIN_INTERVAL_MS 10000UL  // drena no maximo uma vez a cada 10s
#define SD_DRAIN_BATCH       5        // no maximo 5 mensagens retro por ciclo de drain
#define SD_DRAIN_ON_RECONNECT 5       // primeira leva ao reconectar (nao sobrecarrega)
#define NET_EVAL_INTERVAL_MS 30000UL  // re-avalia rede a cada 30s (detecta cabo plugado/perdido)

// Interface ativa para o MQTT (escolhida automaticamente, troca em tempo de execucao)
enum NetIf { NET_NONE=0, NET_WIFI=1, NET_ETH=2 };
static NetIf _activeIf = NET_NONE;

static WiFiClient     _wifiClient;
static PubSubClient _mqtt(_wifiClient);  // PubSubClient::setClient() troca o transport sem recriar

// Definicao do MQTT_CLIENT_ID (extern em config.h). Preenchido no mqtt_init() a partir do MAC.
// Formato "TON-XXXXXXXXXXXX\\0" = 17 chars, buffer 20 com folga.
char MQTT_CLIENT_ID[20] = "TON-uninitialized";
static mqtt_cmd_callback_t _cmdCallback = nullptr;
static unsigned long _lastReconnect = 0;
static unsigned long _reconnDelay = MQTT_RECONNECT_MS;   // B2: recuo 5 -> 60 s entre tentativas
static unsigned long _lastWifiReconnect = 0;
static unsigned long _lastDrain = 0;
static unsigned long _lastNetEval = 0;
static bool _wasConnected = false;
static bool _timeSynced = false;

// Estado do WiFi: desligado por default. Ligamos sob demanda (apenas quando Eth nao disponivel).
// Evita logs ruidosos de AUTH_EXPIRE/NO_AP_FOUND quando o cliente so usa Eth.
static bool _wifiStarted = false;

// Helpers para identificar/observar a interface ativa
static const char* _ifName(NetIf i) {
    switch (i) { case NET_WIFI: return "wifi"; case NET_ETH: return "eth"; default: return "none"; }
}

// Liga o radio WiFi e dispara conexao em background.
// Idempotente: chamadas extras nao reiniciam conexao em andamento.
// ---- Gerenciador multi-WiFi (ate WIFI_MAX_NETS) — lista em NVS, semeada da config ----
#include <Preferences.h>
static char _wifiSsid[WIFI_MAX_NETS][33];
static char _wifiPass[WIFI_MAX_NETS][65];
static int  _wifiCount = 0;
static int  _wifiIdx = 0;
static bool _wifiLoaded = false;
static unsigned long _wifiTryStart = 0;

static void _wifi_save_nvs() {
    Preferences pr; pr.begin("wifi", false);
    pr.putInt("count", _wifiCount);
    pr.putUInt("cfghash", WIFI_CONFIG_HASH);
    for (int i = 0; i < WIFI_MAX_NETS; i++) {
        char ks[6], kp[6]; snprintf(ks, sizeof(ks), "s%d", i); snprintf(kp, sizeof(kp), "p%d", i);
        if (i < _wifiCount) { pr.putString(ks, _wifiSsid[i]); pr.putString(kp, _wifiPass[i]); }
        else { pr.remove(ks); pr.remove(kp); }
    }
    pr.end();
}
static void _wifi_seed_from_config() {
    _wifiCount = WIFI_DEF_COUNT < WIFI_MAX_NETS ? WIFI_DEF_COUNT : WIFI_MAX_NETS;
    for (int i = 0; i < _wifiCount; i++) {
        strncpy(_wifiSsid[i], WIFI_DEF_SSID[i], 32); _wifiSsid[i][32] = 0;
        strncpy(_wifiPass[i], WIFI_DEF_PASS[i], 64); _wifiPass[i][64] = 0;
    }
    _wifi_save_nvs();
    Serial.printf("[WIFI] NVS semeado com %d rede(s) da config\\n", _wifiCount);
}
static void _wifi_ensure_loaded() {
    if (_wifiLoaded) return;
    _wifiLoaded = true;
    Preferences pr; pr.begin("wifi", true);
    int cnt = pr.getInt("count", -1);
    unsigned int hh = pr.getUInt("cfghash", 0);
    pr.end();
    if (cnt < 0 || hh != WIFI_CONFIG_HASH) { _wifi_seed_from_config(); return; }
    pr.begin("wifi", true);
    _wifiCount = cnt < WIFI_MAX_NETS ? cnt : WIFI_MAX_NETS;
    for (int i = 0; i < _wifiCount; i++) {
        char ks[6], kp[6]; snprintf(ks, sizeof(ks), "s%d", i); snprintf(kp, sizeof(kp), "p%d", i);
        String ss = pr.getString(ks, ""); String pp = pr.getString(kp, "");
        strncpy(_wifiSsid[i], ss.c_str(), 32); _wifiSsid[i][32] = 0;
        strncpy(_wifiPass[i], pp.c_str(), 64); _wifiPass[i][64] = 0;
    }
    pr.end();
    Serial.printf("[WIFI] %d rede(s) carregada(s) do NVS\\n", _wifiCount);
}
static bool _wifi_add(const char* ssid, const char* pass) {
    _wifi_ensure_loaded();
    if (!ssid || !*ssid) return false;
    for (int i = 0; i < _wifiCount; i++) if (strncmp(_wifiSsid[i], ssid, 32) == 0) {
        strncpy(_wifiPass[i], pass ? pass : "", 64); _wifiPass[i][64] = 0;
        _wifi_save_nvs(); Serial.printf("[WIFI] senha atualizada: %s\\n", ssid); return true;
    }
    if (_wifiCount >= WIFI_MAX_NETS) { Serial.println("[WIFI] lista cheia (max 4)"); return false; }
    strncpy(_wifiSsid[_wifiCount], ssid, 32); _wifiSsid[_wifiCount][32] = 0;
    strncpy(_wifiPass[_wifiCount], pass ? pass : "", 64); _wifiPass[_wifiCount][64] = 0;
    _wifiCount++; _wifi_save_nvs();
    Serial.printf("[WIFI] rede adicionada: %s (%d/%d)\\n", ssid, _wifiCount, WIFI_MAX_NETS); return true;
}
static bool _wifi_remove(const char* ssid) {
    _wifi_ensure_loaded();
    if (!ssid) return false;
    for (int i = 0; i < _wifiCount; i++) if (strncmp(_wifiSsid[i], ssid, 32) == 0) {
        for (int j = i; j < _wifiCount - 1; j++) { strncpy(_wifiSsid[j], _wifiSsid[j+1], 33); strncpy(_wifiPass[j], _wifiPass[j+1], 65); }
        _wifiCount--; _wifi_save_nvs();
        Serial.printf("[WIFI] rede removida: %s (%d)\\n", ssid, _wifiCount); return true;
    }
    return false;
}
// Comando /cmd/wifi: {"action":"add|remove|list","ssid":"..","pass":".."}
static void _wifi_handle_cmd(const char* json) {
    StaticJsonDocument<256> d;
    if (deserializeJson(d, json) != DeserializationError::Ok) { Serial.println("[WIFI] cmd JSON invalido"); return; }
    const char* action = d["action"] | "";
    const char* ssid = d["ssid"] | "";
    const char* pass = d["pass"] | (d["password"] | "");
    if (strcmp(action, "add") == 0) _wifi_add(ssid, pass);
    else if (strcmp(action, "remove") == 0) _wifi_remove(ssid);
    else if (strcmp(action, "list") == 0) {
        _wifi_ensure_loaded();
        Serial.printf("[WIFI] lista (%d):\\n", _wifiCount);
        for (int i = 0; i < _wifiCount; i++) Serial.printf("  %d: %s\\n", i + 1, _wifiSsid[i]);
    }
}
// Cycling nao-bloqueante: WiFi ligado e sem conectar em WIFI_TRY_MS -> proxima rede.
static void _wifi_cycle_tick() {
    if (!_wifiStarted || _wifiCount <= 1) return;
    if (WiFi.status() == WL_CONNECTED) return;
    if (millis() - _wifiTryStart < WIFI_TRY_MS) return;
    _wifiIdx = (_wifiIdx + 1) % _wifiCount;
    Serial.printf("[WIFI] fallback -> '%s' (%d/%d)\\n", _wifiSsid[_wifiIdx], _wifiIdx + 1, _wifiCount);
    WiFi.disconnect();
    WiFi.begin(_wifiSsid[_wifiIdx], _wifiPass[_wifiIdx]);
    _wifiTryStart = millis();
}

static void _start_wifi() {
    if (_wifiStarted) return;
    _wifi_ensure_loaded();
    if (_wifiCount == 0) { Serial.println("[WIFI] sem redes configuradas"); return; }
    Serial.println("[WIFI] Ligando radio (fallback / Eth indisponivel)");
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.persistent(false);
    _wifiIdx = 0;
    WiFi.begin(_wifiSsid[0], _wifiPass[0]);
    Serial.printf("[WIFI] tentando '%s' (1/%d)\\n", _wifiSsid[0], _wifiCount);
    _wifiTryStart = millis();
    _wifiStarted = true;
}

// Desliga o radio WiFi por completo. Para os reconnect attempts internos da stack
// que poluem o serial com AUTH_EXPIRE/NO_AP_FOUND quando o cliente so tem Eth.
static void _stop_wifi() {
    if (!_wifiStarted) return;
    Serial.println("[WIFI] Desligando radio (Eth ativa)");
    WiFi.disconnect(true, true);   // wifioff + erase config persistida
    WiFi.mode(WIFI_OFF);
    _wifiStarted = false;
}
static String _ifLocalIp() {
    if (_activeIf == NET_ETH) return eth_local_ip().toString();
    if (_activeIf == NET_WIFI && WiFi.status() == WL_CONNECTED) return WiFi.localIP().toString();
    return String("0.0.0.0");
}
const char* mqtt_active_iface() { return _ifName(_activeIf); }

// Garante que o transport do PubSubClient bate com a interface alvo.
// Chama disconnect() antes de trocar (PubSubClient nao gosta de troca em conexao viva).
static void _setActiveIf(NetIf target) {
    if (target == _activeIf) return;
    if (_mqtt.connected()) _mqtt.disconnect();
    if (target == NET_ETH) {
        _mqtt.setClient(eth_get_client());
    } else {
        _mqtt.setClient(_wifiClient);
    }
    Serial.printf("[NET] Trocando interface: %s -> %s\\n", _ifName(_activeIf), _ifName(target));
    _activeIf = target;
    _wasConnected = false;
    diag_tcp_connected = (target == NET_ETH);
}

// Avalia qual interface tem internet "boa" agora e troca se necessario.
// Politica: Ethernet ganha sempre que cabo plugado e tem IP. Se cair, volta WiFi.
// Loga MUDANCAS de estado (link UP/DOWN, IP perdido) sempre, e um heartbeat
// resumido a cada 60s pra confirmar que a avaliacao esta rodando.
static void _evalNetwork() {
    static bool _prevLink   = false;
    static bool _prevHasIp  = false;
    static bool _prevWifiOk = false;
    static unsigned long _lastHeartbeat = 0;

    bool linkUp  = eth_link_up();

    // Loga transicoes do link Ethernet (cabo plugado/desplugado)
    if (linkUp != _prevLink) {
        Serial.printf("[NET] Cabo Ethernet: link %s\\n", linkUp ? "UP" : "DOWN");
        _prevLink = linkUp;
    }

    bool ethReady = false;
    if (linkUp) {
        ethReady = eth_check_dhcp();  // pode pegar IP se cabo acabou de ser plugado
    }
    bool wifiReady = (_wifiStarted && WiFi.status() == WL_CONNECTED);

    // Gestao de energia do radio WiFi: liga so' se Eth estiver indisponivel.
    // Sem Eth e WiFi off -> liga.  Com Eth e WiFi on -> desliga.
    if (!ethReady && !_wifiStarted) {
        _start_wifi();
    } else if (ethReady && _wifiStarted) {
        _stop_wifi();
    }
    _wifi_cycle_tick();   // fallback multi-WiFi: cicla pelas redes se a atual nao conectar

    // Loga transicoes de IP/conexao
    if (ethReady != _prevHasIp) {
        Serial.printf("[NET] Ethernet IP: %s\\n", ethReady ? "obtido" : "perdido");
        _prevHasIp = ethReady;
    }
    if (wifiReady != _prevWifiOk) {
        Serial.printf("[NET] WiFi: %s\\n", wifiReady ? "conectado" : "desconectado");
        _prevWifiOk = wifiReady;
    }

    // Decisao de troca
    if (ethReady && _activeIf != NET_ETH) {
        Serial.println("[NET] Cabo Ethernet detectado com IP — preferindo Ethernet");
        _setActiveIf(NET_ETH);
    } else if (!ethReady && _activeIf == NET_ETH && wifiReady) {
        Serial.println("[NET] Cabo Ethernet sem IP/link — voltando para WiFi");
        _setActiveIf(NET_WIFI);
    } else if (_activeIf == NET_NONE) {
        if (ethReady)        _setActiveIf(NET_ETH);
        else if (wifiReady)  _setActiveIf(NET_WIFI);
    }

    // Heartbeat a cada 60s — mostra estado das duas interfaces e quem esta ativa
    if (millis() - _lastHeartbeat > 60000UL) {
        _lastHeartbeat = millis();
        Serial.printf("[NET] estado: ativo=%s | eth=%s/%s%s | wifi=%s%s\\n",
            _ifName(_activeIf),
            linkUp ? "link-UP" : "link-DOWN",
            ethReady ? "ip-OK" : "no-ip",
            (_activeIf == NET_ETH ? " *" : ""),
            wifiReady ? "OK" : "off",
            (_activeIf == NET_WIFI ? " *" : ""));
    }
}

// Forward decl
bool mqtt_publish_raw(const char* topic, const char* payload);

// Sync NTP apos WiFi conectar. Nao bloqueia — apenas arranca o processo.
// 3o servidor e' IP fixo do NTP.br (a.st1.ntp.br) — contorna o caso comum em
// redes corporativas onde DNS esta bloqueado mas UDP 123 sai.
static void _start_ntp() {
    configTime(-3 * 3600, 0, "pool.ntp.org", "time.google.com", "200.160.7.193");
}

// NTP pela pilha do W5500 (Ethernet.h tem TCP/IP PROPRIO, separado do lwIP do
// ESP32). O configTime/SNTP roda no lwIP -> so' sai pelo WiFi; em locais que so'
// tem Ethernet (cabo), o SNTP nunca sincroniza. Aqui montamos a query NTP (UDP
// 123) na mao e enviamos pela pilha do W5500 (EthernetUDP), depois setamos o
// relogio com settimeofday. IPs fixos (sem DNS). O configTime ja' setou o TZ (-3),
// entao localtime() continua certo. Retorna true se sincronizou.
static bool _ntp_eth_sync() {
    if (!eth_has_ip()) return false;
    static const char* NTP_IPS[] = { "200.160.7.193", "200.186.125.195", "162.159.200.123" };
    // 1 servidor por chamada, rotacionando. Assim o bloqueio do loop e' <=800ms
    // (nao 3 x 1.2s = 3.6s), pra nao atrapalhar o orquestrador LoRa enquanto o NTP
    // ainda nao sincronizou. As chamadas seguintes (retry a cada 5s/30s) cobrem os
    // outros servidores. Quando sincroniza, _timeSynced=true e isto nao roda mais.
    static uint8_t _ntpSrv = 0;
    const char* srvIp = NTP_IPS[_ntpSrv];
    _ntpSrv = (_ntpSrv + 1) % 3;
    IPAddress ip;
    if (!ip.fromString(srvIp)) return false;
    EthernetUDP _ntpUdp;
    if (!_ntpUdp.begin(2390)) return false;  // socket do W5500 (8 disponiveis, MQTT usa 1)
    uint8_t pkt[48];
    memset(pkt, 0, sizeof(pkt));
    pkt[0] = 0xE3;  // LI=3 (nao-sync), VN=4, Mode=3 (client)
    pkt[1] = 0; pkt[2] = 6; pkt[3] = 0xEC;
    bool sent = false;
    if (_ntpUdp.beginPacket(ip, 123)) {
        _ntpUdp.write(pkt, 48);
        sent = _ntpUdp.endPacket();
    }
    bool ok = false;
    if (sent) {
        unsigned long t0 = millis();
        while (millis() - t0 < 800) {
            // So' aceita resposta DO servidor que perguntei (origem confere) — evita
            // que um datagrama qualquer na porta injete um timestamp.
            if (_ntpUdp.parsePacket() >= 48 && _ntpUdp.remoteIP() == ip) {
                _ntpUdp.read(pkt, 48);
                // Transmit Timestamp (segundos desde 1900) nos bytes 40..43.
                unsigned long secs1900 = ((unsigned long)pkt[40] << 24) | ((unsigned long)pkt[41] << 16)
                                       | ((unsigned long)pkt[42] << 8)  |  (unsigned long)pkt[43];
                if (secs1900 > 2208988800UL) {
                    unsigned long epoch = secs1900 - 2208988800UL;  // 1900 -> 1970
                    if (epoch > 1700000000UL) {                     // sanity (>= 2023)
                        struct timeval tv; tv.tv_sec = (time_t)epoch; tv.tv_usec = 0;
                        settimeofday(&tv, nullptr);
                        Serial.printf("[NTP-ETH] sincronizado via W5500 (%s)! epoch=%lu\\n",
                                      srvIp, epoch);
                        ok = true;
                    }
                }
                break;  // resposta do servidor certo recebida (valida ou nao)
            }
            delay(10);
            esp_task_wdt_reset();
        }
    }
    _ntpUdp.stop();  // libera o socket do W5500
    return ok;
}

// Salva no SD com timestamp injetado no JSON (se possivel).
// Formato: "{\\"ts\\":<epoch>, ... resto do payload}"
// Se o relogio nao estiver sincronizado, ou o payload nao for JSON,
// salva como esta (sem ts) para nao perder dados.
static void _store_offline(const char* topic, const char* payload) {
    time_t now = time(nullptr);
    bool haveTime = (now > 1700000000);
    if (haveTime) _timeSynced = true;

    if (haveTime && payload && payload[0] == '{' && strstr(payload, "\\"ts\\"") == nullptr) {
        // Cabe ate ~3200 bytes (payload de inversor + overhead do ts)
        char withTs[3200];
        int n = snprintf(withTs, sizeof(withTs), "{\\"ts\\":%lu,%s",
                         (unsigned long)now, payload + 1);
        if (n > 0 && n < (int)sizeof(withTs)) {
            sd_buffer_store(topic, withTs);
            return;
        }
    }
    sd_buffer_store(topic, payload);
}

// Forward decl: gateway router precisa estar declarado pra _onMessage chamar.
${spec.lora_role === 'gateway' ? 'void gateway_handle_satellite_mqtt(const char* mac_alvo, const char* payload);' : ''}

// Callback unico: despacha OTA (TOPIC_BASE/ota/cmd) antes de entregar o
// restante ao callback de usuario (TOPIC_BASE/cmd).
static void _onMessage(char* topic, byte* payload, unsigned int len) {
    static char buf[1200]; // grande para caber JSON OTA
    if (len >= sizeof(buf)) len = sizeof(buf) - 1;
    memcpy(buf, payload, len);
    buf[len] = 0;

    if (strstr(topic, "/ota/cmd") != nullptr) {
        Serial.printf("[MQTT] OTA cmd recebido (%u bytes)\\n", len);
${spec.bomba ? `        { extern bool bomba_ota_permitida();
          if (!bomba_ota_permitida()) {   // posto: OTA so' com a bomba ociosa/bloqueada
              Serial.println("[OTA] RECUSADA: bomba fora de ociosa");
              String st = String(MQTT_TOPIC_BASE) + "/ota/status";
              mqtt_publish_raw(st.c_str(), "{\\"state\\":\\"refused\\",\\"msg\\":\\"bomba_ocupada\\"}");
              return;
          } }
` : ''}        ota_handle_command(buf);
        return;
    }
${spec.lora_role === 'gateway' ? `
    // Gateway: detecta padrao <BASE>/satellite/<MAC>/cmd e roteia via LoRa.
    {
        const char* sat = strstr(topic, "/satellite/");
        if (sat) {
            const char* mac_start = sat + strlen("/satellite/");
            const char* mac_end = strchr(mac_start, '/');
            if (mac_end && strcmp(mac_end, "/cmd") == 0) {
                char mac_alvo[32] = {0};
                size_t mlen = mac_end - mac_start;
                if (mlen > 0 && mlen < sizeof(mac_alvo)) {
                    memcpy(mac_alvo, mac_start, mlen);
                    mac_alvo[mlen] = 0;
                    Serial.printf("[MQTT-GW] Roteando cmd MQTT -> LoRa target=%s\\n", mac_alvo);
                    gateway_handle_satellite_mqtt(mac_alvo, buf);
                    return;
                }
            }
        }
    }
` : ''}
    Serial.printf("[MQTT] Recebido: %s -> %s\\n", topic, buf);
${spec.bomba ? `    if (strstr(topic, "/cmd/rfid_sync") != nullptr) {   // posto: lista de autorizados (retida)
        extern void bomba_set_lista(const char*);
        bomba_set_lista(buf);
        return;
    }
    if (strstr(topic, "/auth/resp") != nullptr) {       // posto: resposta do NexON a auth/req
        extern void bomba_auth_resp(const char*);
        bomba_auth_resp(buf);
        return;
    }
` : ''}    if (strstr(topic, "/cmd/wifi") != nullptr) {   // config multi-WiFi em runtime (add/remove/list)
        _wifi_handle_cmd(buf);
        return;
    }
    if (_cmdCallback) _cmdCallback(buf);
}

// =====================================================================
// AUTO-RECUPERACAO — watchdog de conectividade (caso NS Aparecida, 01/08->16/09:
// TON 47 dias sem broker com o WiFi "conectado" e a rede da fazenda funcionando;
// so' voltou tirando da tomada). Nada aqui depende de ter mais de uma rede WiFi.
//   1) MQTT fora ha NETWD_REASSOC_MS com WiFi associado  -> desassocia e reassocia
//      (se houver mais de uma rede cadastrada, passa pra proxima)
//   2) MQTT fora ha 10 / 30 / 60 min (recuo por reinicio seguido) -> ESP.restart()
//      Se o proprio broker estiver fora, a TON reinicia no maximo 1x/hora (dados no SD).
// O relogio e' preservado no reinicio (RTC noinit) — sem internet ainda carimba certo.
// Reinicio so' e' executado se for seguro (sem OTA em curso; posto ocioso/bloqueado).
// =====================================================================
#define NETWD_REASSOC_MS   180000UL
#define NETWD_STABLE_MS    300000UL   // conectado ha 5 min => zera o recuo
static const unsigned long NETWD_RESTART_MS[3] = { 600000UL, 1800000UL, 3600000UL };
#define NETWD_MAGIC        0x544F4E57UL
RTC_NOINIT_ATTR static uint32_t _rtcMagic;
RTC_NOINIT_ATTR static uint32_t _rtcRestarts;
RTC_NOINIT_ATTR static uint32_t _rtcEpoch;
RTC_NOINIT_ATTR static char     _rtcCause[24];
RTC_NOINIT_ATTR static uint32_t _rtcAutoTs[4];   // D0: epoch dos ultimos reinicios automaticos
static char _bootCause[24] = "";
static unsigned long _lastMqttOkMs = 0, _mqttConnSince = 0, _lastReassocMs = 0, _lastRestartTry = 0;
static unsigned long _restartAt = 0;
static unsigned long _lastEthReset = 0;
static char _restartReason[24] = "";

bool mqtt_restart_permitido() {
    if (ota_in_progress()) return false;
${spec.bomba ? `    { extern bool bomba_ota_permitida(); if (!bomba_ota_permitida()) return false; }\n` : ''}    return true;
}

const char* mqtt_restart_cause() { return _bootCause; }
unsigned long mqtt_conn_age_ms() { return (_mqtt.connected() && _mqttConnSince) ? millis() - _mqttConnSince : 0xFFFFFFFFUL; }

static bool _doRestart(const char* reason) {
    if (!mqtt_restart_permitido()) {
        Serial.printf("[SYS] reinicio (%s) adiado: TON ocupada (OTA/abastecimento)\\n", reason);
        return false;
    }
    time_t nowE = time(nullptr);
    // D0 gestor unico: no maximo 4 reinicios automaticos em 6 h (comando manual e o
    // watchdog de broker, que ja' tem recuo de ate' 1/h, ficam fora do teto).
    bool automatico = strcmp(reason, "comando") != 0 && strcmp(reason, "sem_broker") != 0;
    if (automatico && nowE > 1700000000) {
        int recentes = 0;
        for (int i = 0; i < 4; i++) if (_rtcAutoTs[i] && (uint32_t)nowE - _rtcAutoTs[i] < 21600UL) recentes++;
        if (recentes >= 4) {
            Serial.printf("[SYS] reinicio (%s) NEGADO: teto de 4 reinicios automaticos em 6 h\\n", reason);
            return false;
        }
        for (int i = 3; i > 0; i--) _rtcAutoTs[i] = _rtcAutoTs[i - 1];
        _rtcAutoTs[0] = (uint32_t)nowE;
    }
    strncpy(_rtcCause, reason, sizeof(_rtcCause) - 1); _rtcCause[sizeof(_rtcCause) - 1] = 0;
    _rtcEpoch = (nowE > 1700000000) ? (uint32_t)nowE : 0;
    _rtcMagic = NETWD_MAGIC;
    Serial.printf("[SYS] REINICIANDO a TON (motivo: %s, reinicios seguidos: %lu)\\n", reason, (unsigned long)_rtcRestarts);
    if (_mqtt.connected()) { _mqtt.disconnect(); }
    delay(200);
    ESP.restart();
    return true;
}

void mqtt_request_restart(const char* reason, unsigned long delay_ms) {
    strncpy(_restartReason, reason ? reason : "comando", sizeof(_restartReason) - 1);
    _restartReason[sizeof(_restartReason) - 1] = 0;
    _restartAt = millis() + (delay_ms ? delay_ms : 1);
}

static void _netwdInit() {
    if (_rtcMagic != NETWD_MAGIC || esp_reset_reason() == ESP_RST_POWERON || esp_reset_reason() == ESP_RST_BROWNOUT) {
        _rtcMagic = NETWD_MAGIC; _rtcRestarts = 0; _rtcEpoch = 0; _rtcCause[0] = 0;
        for (int i = 0; i < 4; i++) _rtcAutoTs[i] = 0;
    }
    _rtcCause[sizeof(_rtcCause) - 1] = 0;
    strncpy(_bootCause, _rtcCause, sizeof(_bootCause) - 1);
    _rtcCause[0] = 0;
    // Relogio: reinicio por software nao zera o RTC do ESP32, mas a hora do sistema sim.
    // Restaura a ultima hora conhecida (+3 s do boot) ate o NTP corrigir.
    if (_bootCause[0] && _rtcEpoch > 1700000000UL && time(nullptr) < 1700000000) {
        struct timeval tv; tv.tv_sec = (time_t)_rtcEpoch + 3; tv.tv_usec = 0;
        settimeofday(&tv, nullptr);
        Serial.printf("[SYS] hora restaurada apos reinicio (%s): epoch=%lu\\n", _bootCause, (unsigned long)tv.tv_sec);
    }
    _rtcEpoch = 0;
    if (_bootCause[0]) Serial.printf("[SYS] boot apos reinicio pedido pelo firmware: %s (seguidos: %lu)\\n", _bootCause, (unsigned long)_rtcRestarts);
    _lastMqttOkMs = millis();
}

static void _netWatchdog() {
    unsigned long now = millis();
    if (_restartAt && (long)(now - _restartAt) >= 0) {
        if (_doRestart(_restartReason)) return;
        _restartAt = now + 30000UL;   // ocupada: tenta de novo em 30 s
    }
    if (_mqtt.connected()) {
        _lastMqttOkMs = now;
        if (_rtcRestarts && _mqttConnSince && now - _mqttConnSince > NETWD_STABLE_MS) {
            Serial.println("[SYS] conexao estavel: recuo do watchdog zerado");
            _rtcRestarts = 0;
        }
        return;
    }
    unsigned long off = now - _lastMqttOkMs;
    // 1) WiFi "conectado" mas sem broker: forca nova associacao (mesma rede se so' houver uma)
    if (off > NETWD_REASSOC_MS && now - _lastReassocMs > NETWD_REASSOC_MS
        && _wifiStarted && _activeIf != NET_ETH && WiFi.status() == WL_CONNECTED && _wifiCount > 0) {
        _lastReassocMs = now;
        if (_wifiCount > 1) _wifiIdx = (_wifiIdx + 1) % _wifiCount;
        Serial.printf("[SYS] sem broker ha %lus com WiFi associado -> reassociando em '%s'\\n",
                      (unsigned long)(off / 1000), _wifiSsid[_wifiIdx]);
        WiFi.disconnect();
        WiFi.begin(_wifiSsid[_wifiIdx], _wifiPass[_wifiIdx]);
        _wifiTryStart = now;
    }
    // 1b) Ethernet ativa, cabo com link e sem broker ha 5 min: reset FISICO do W5500 (IO14).
    //     Criterio ativo (broker nao responde), nao "sem trafego": o keepalive MQTT e' obrigatorio.
    if (_activeIf == NET_ETH && eth_link_up() && off > 300000UL && now - _lastEthReset > 300000UL) {
        _lastEthReset = now;
        if (_mqtt.connected()) _mqtt.disconnect();
        eth_hw_reset();
    }
    // 2) Reinicio com recuo (10 / 30 / 60 min)
    uint32_t k = _rtcRestarts < 2 ? _rtcRestarts : 2;
    if (off > NETWD_RESTART_MS[k] && now - _lastRestartTry > 60000UL) {
        _lastRestartTry = now;
        if (_rtcRestarts < 1000) _rtcRestarts++;
        if (!_doRestart("sem_broker")) { if (_rtcRestarts) _rtcRestarts--; }
    }
}

void mqtt_init(mqtt_cmd_callback_t callback) {
    _cmdCallback = callback;

    // 1) Captura o MAC ANTES de mexer com radios — WiFi.macAddress() le do efuse
    //    e funciona independente do WIFI_MODE. Garantia de identidade estavel.
    uint8_t _mac_for_id[6];
    WiFi.macAddress(_mac_for_id);

    // 2) Ethernet (W5500) — tenta primeiro. Se cabo plugado com IP, ETH vence
    //    e o radio WiFi sequer e' ligado (evita logs spurious de AUTH_EXPIRE).
    eth_hw_init();
    bool ethReady = eth_check_dhcp();   // tenta DHCP se link UP

    // 3) WiFi — so' liga se Eth nao estiver disponivel. Se Eth cair depois,
    //    _evalNetwork() religa o WiFi como fallback (e desliga quando Eth volta).
    if (ethReady) {
        Serial.println("[NET] Ethernet OK no boot — WiFi ficara OFF (auto fallback se Eth cair)");
        WiFi.mode(WIFI_OFF);
        _wifiStarted = false;
        _setActiveIf(NET_ETH);
        _start_ntp();        // seta o TZ (-3h); o SNTP/lwIP NAO sai pela pilha do W5500
        _ntp_eth_sync();     // sincroniza JA pela pilha do W5500 (NTP via EthernetUDP)
    } else {
        _start_wifi();
        Serial.printf("[WIFI] Conectando a '%s'...\\n", WIFI_SSID);
        unsigned long t = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - t < WIFI_TIMEOUT_MS) {
            delay(500); Serial.print(".");
            esp_task_wdt_reset();
        }
        if (WiFi.status() == WL_CONNECTED) {
            Serial.printf("\\n[WIFI] IP: %s\\n", WiFi.localIP().toString().c_str());
            _setActiveIf(NET_WIFI);
            _start_ntp();
        } else {
            Serial.println("\\n[WIFI] FALHOU no boot - continuara tentando em background");
        }
    }

    // 4) MQTT_CLIENT_ID derivado do MAC — unico por hardware, evita colisao de IDs
    //    que estava causando 26k+ desconexoes/dia no broker (10 IPs em "TON1-TON1").
    snprintf(MQTT_CLIENT_ID, sizeof(MQTT_CLIENT_ID),
             "TON-%02X%02X%02X%02X%02X%02X",
             _mac_for_id[0], _mac_for_id[1], _mac_for_id[2],
             _mac_for_id[3], _mac_for_id[4], _mac_for_id[5]);
    Serial.printf("[MQTT] client_id (do MAC): %s\\n", MQTT_CLIENT_ID);

    // MQTT (PubSubClient — transport ja foi setado por _setActiveIf)
    _mqtt.setServer(MQTT_SERVER, MQTT_PORT);
    bool bufok = _mqtt.setBufferSize(MQTT_BUFFER_SIZE);
    Serial.printf("[MQTT] Buffer %d bytes: %s\\n", MQTT_BUFFER_SIZE, bufok ? "OK" : "FAIL (heap?)");
    _mqtt.setCallback(_onMessage);
    // Default PubSubClient: keepalive 15s, socket timeout 15s — apertado demais.
    // Um sample Modbus com 1-2 timeouts pode passar de 15s (lib ModbusMaster
    // timeout = 2s/transacao, nao configuravel). 60s/30s da' folga real.
    _mqtt.setKeepAlive(60);
    _mqtt.setSocketTimeout(8);   // B1 anti-travamento: broker que aceita TCP e nao responde prendia o laco 30 s
    _netwdInit();
}

void mqtt_loop() {
    _netWatchdog();   // auto-recuperacao (reassocia / reinicia com recuo)
    sd_buffer_tick(); // fila do SD: contagem inicial fatiada + remontagem do cartao com falha
    // Mantem stack do W5500 atualizada (DHCP renew, etc.)
    eth_maintain();

    // Re-avalia interface ativa periodicamente — detecta cabo plugado/perdido a quente.
    if (millis() - _lastNetEval > NET_EVAL_INTERVAL_MS) {
        _lastNetEval = millis();
        _evalNetwork();
    }

    // Detecta queda de WiFi para o contador (so' conta se o radio estiver ligado)
    static bool _wifiWasConn = false;
    bool wifiNow = (_wifiStarted && WiFi.status() == WL_CONNECTED);
    if (_wifiWasConn && !wifiNow) {
        diag_wifi_disconnects++;
        Serial.printf("[ALERTA] WiFi desconectou (#%lu)\\n", (unsigned long)diag_wifi_disconnects);
    }
    _wifiWasConn = wifiNow;

    // Tem alguma rede usavel? (Ethernet com IP OU WiFi conectado)
    bool ethOk = eth_has_ip();
    bool netUp = ethOk || wifiNow;

    if (!netUp) {
        // Sem nenhuma rede. Garante que o WiFi esta ligado pra tentar fallback
        // (se ETH cair, ainda nao foi processado por _evalNetwork ainda).
        if (!_wifiStarted) _start_wifi();
        // Tenta reconectar WiFi em background (rate-limited).
        if (millis() - _lastWifiReconnect > WIFI_RECONNECT_MS) {
            _lastWifiReconnect = millis();
            Serial.println("[WIFI] Desconectado — reconectando em background...");
            WiFi.reconnect();
        }
        if (_wasConnected) {
            Serial.println("[MQTT] DESCONECTADO - mensagens irao para o SD (com timestamp)");
            _wasConnected = false;
            diag_mqtt_disconnects++;
        }
        return;
    }

    // Se eh a primeira vez que temos rede, decide a interface inicial.
    if (_activeIf == NET_NONE) {
        _setActiveIf(ethOk ? NET_ETH : NET_WIFI);
    }

    // WiFi/Eth OK — rekick NTP ate sincronizar. Usa variavel separada
    // (_lastNtpKick) pra nao competir com o rate-limit do WiFi.reconnect().
    // Intervalo agressivo (5s) nos primeiros 5min depois do boot — periodo
    // critico onde o TON precisa carimbar timestamps validos. Depois espaca
    // pra 30s pra reduzir trafego.
    if (!_timeSynced) {
        time_t now = time(nullptr);
        if (now < 1700000000) {
            static unsigned long _lastNtpKick = 0;
            unsigned long retryInterval = (millis() < 300000UL) ? 5000UL : 30000UL;
            if (millis() - _lastNtpKick > retryInterval) {
                _lastNtpKick = millis();
                // Ethernet (W5500) tem pilha TCP/IP propria -> SNTP/lwIP nao roteia
                // por ela. Usa o NTP via EthernetUDP. WiFi usa o SNTP (lwIP) normal.
                if (_activeIf == NET_ETH) _ntp_eth_sync();
                else _start_ntp();
                Serial.printf("[NTP] retry (uptime=%lus, epoch=%lu)\\n",
                              (unsigned long)(millis()/1000), (unsigned long)now);
            }
        } else {
            _timeSynced = true;
            Serial.printf("[NTP] sincronizado! epoch=%lu\\n", (unsigned long)now);
        }
    }

    if (_mqtt.connected()) {
        _mqtt.loop();
        // Drena retroativo aos poucos: no maximo SD_DRAIN_BATCH msgs por SD_DRAIN_INTERVAL_MS.
        // Isto garante que tempo real + retroativo nao sobrecarregue o broker.
        if (millis() - _lastDrain > SD_DRAIN_INTERVAL_MS) {
            _lastDrain = millis();
            int pending = sd_buffer_pending();
            if (pending > 0) {
                Serial.printf("[MQTT] Drenando retroativo (%d pendentes, batch %d)...\\n",
                              pending, SD_DRAIN_BATCH);
                sd_buffer_drain(mqtt_publish_raw, SD_DRAIN_BATCH);
            }
        }
        return;
    }

    // MQTT desconectado (mas WiFi OK) — tentar reconectar
    if (_wasConnected) {
        Serial.println("[MQTT] DESCONECTADO - mensagens irao para o SD (com timestamp)");
        _wasConnected = false;
        diag_mqtt_disconnects++;
    }
    if (millis() - _lastReconnect < _reconnDelay) return;
    _lastReconnect = millis();

    Serial.printf("[MQTT] Conectando a %s:%d (%s)...\\n", MQTT_SERVER, MQTT_PORT, MQTT_CLIENT_ID);
    // Last Will em TOPIC_BASE/status (QoS 1, retained) -> sinaliza offline se cair
    String willTopic = String(MQTT_TOPIC_BASE) + "/status";
    const char* willMsg = "{\\"online\\":false}";

    bool ok;
    if (strlen(MQTT_USER) > 0) {
        ok = _mqtt.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASS,
                           willTopic.c_str(), 1, true, willMsg);
    } else {
        ok = _mqtt.connect(MQTT_CLIENT_ID, nullptr, nullptr,
                           willTopic.c_str(), 1, true, willMsg);
    }

    if (!ok) {
        _reconnDelay = (_reconnDelay >= 30000UL) ? 60000UL : _reconnDelay * 2;
        Serial.printf("[MQTT] falha (rc=%d) - nova tentativa em %lus\\n", _mqtt.state(), (unsigned long)(_reconnDelay / 1000));
    }
    if (ok) {
        _reconnDelay = MQTT_RECONNECT_MS;
        Serial.println("[MQTT] Conectado!");
        _mqttConnSince = millis();
        _wasConnected = true;
        _mqtt.subscribe(MQTT_TOPIC_CMD);
        { String wt = String(MQTT_TOPIC_BASE) + "/cmd/wifi"; _mqtt.subscribe(wt.c_str()); Serial.printf("[MQTT] Inscrito em: %s\\n", wt.c_str()); }
${spec.bomba ? `        { String rfidTopic = String(MQTT_TOPIC_BASE) + "/cmd/rfid_sync"; _mqtt.subscribe(rfidTopic.c_str()); Serial.printf("[MQTT] Inscrito em: %s\\n", rfidTopic.c_str()); }
        { String authTopic = String(MQTT_TOPIC_BASE) + "/auth/resp"; _mqtt.subscribe(authTopic.c_str()); Serial.printf("[MQTT] Inscrito em: %s\\n", authTopic.c_str()); }
` : ''}        String otaCmdTopic = String(MQTT_TOPIC_BASE) + "/ota/cmd";
        _mqtt.subscribe(otaCmdTopic.c_str());
        Serial.printf("[MQTT] Inscrito em: %s\\n[MQTT] Inscrito em: %s\\n",
                      MQTT_TOPIC_CMD, otaCmdTopic.c_str());
${spec.lora_role === 'gateway' ? `
        // Gateway: tambem subscreve no namespace de satellites pra rotear
        // comandos vindos do backend via LoRa pros TON satelites.
        String satCmdTopic = String(MQTT_TOPIC_BASE) + "/satellite/+/cmd";
        _mqtt.subscribe(satCmdTopic.c_str());
        Serial.printf("[MQTT] Inscrito em (gateway): %s\\n", satCmdTopic.c_str());
` : ''}

        // Announce online + identidade (retained). Inclui MAC, IP da interface
        // ativa e qual interface (wifi/eth) — backend usa para auto-discovery.
        char hello[256];
        snprintf(hello, sizeof(hello),
                 "{\\"online\\":true,\\"version\\":\\"%s\\",\\"model\\":\\"%s\\",\\"mac\\":\\"%s\\",\\"ip\\":\\"%s\\",\\"iface\\":\\"%s\\",\\"reset\\":\\"%s\\",\\"restart_cause\\":\\"%s\\"}",
                 FIRMWARE_VERSION, DEVICE_MODEL,
                 WiFi.macAddress().c_str(),
                 _ifLocalIp().c_str(),
                 _ifName(_activeIf),
                 diag_reset_reason(), _bootCause);
        _mqtt.publish(willTopic.c_str(), hello, true);

        // Primeira leva ao reconectar — pequena, so pra confirmar fluxo.
        // O resto sera drenado pelo _lastDrain no mqtt_loop, aos poucos.
        int pending = sd_buffer_pending();
        if (pending > 0) {
            Serial.printf("[MQTT] Reconectado - %d mensagens no SD, iniciando drain gradual...\\n", pending);
            sd_buffer_drain(mqtt_publish_raw, SD_DRAIN_ON_RECONNECT);
            _lastDrain = millis();  // espera SD_DRAIN_INTERVAL_MS antes do proximo lote
        }
    }
}

// Publica direto, sem fallback de SD (usado pela drain para evitar loop)
bool mqtt_publish_raw(const char* topic, const char* payload) {
    if (!_mqtt.connected()) return false;
    bool ok = _mqtt.publish(topic, payload);
    if (ok) diag_mqtt_pub++;
    else    diag_publish_fails++;
    return ok;
}

bool mqtt_publish(const char* topic, const char* payload) {
    if (!_mqtt.connected()) {
        Serial.printf("[MQTT] PUB FAIL (desconectado): %s -> SD\\n", topic);
        diag_publish_fails++;
        _store_offline(topic, payload);
        return false;
    }
    size_t plen = strlen(payload);
    size_t tlen = strlen(topic);
    bool ok = _mqtt.publish(topic, payload);
    if (ok) {
        diag_mqtt_pub++;
        // Sinaliza execucao saudavel: apos N pubs OK pos-OTA,
        // confirma firmware como valido (cancela rollback do bootloader).
        ota_confirm_valid_if_needed();
    } else {
        diag_publish_fails++;
        Serial.printf("[MQTT] PUB FAIL: %s (payload=%u bytes, topic=%u bytes, state=%d) -> SD\\n",
                      topic, (unsigned)plen, (unsigned)tlen, _mqtt.state());
        _store_offline(topic, payload);
    }
    return ok;
}

bool mqtt_connected() { return _mqtt.connected(); }
`;
    }

    // ---- eth.h ----
    _genEthH() {
        return `#ifndef ETH_H
#define ETH_H
#include <Arduino.h>
#include <Ethernet.h>
#include <IPAddress.h>

bool eth_hw_init();           // Inicializa W5500 (so a parte fisica/SPI). Sem DHCP.
void eth_hw_reset();          // B4: pulso no pino RST (IO14) + reinit; o DHCP refaz sozinho
bool eth_link_up();           // Cabo plugado e link UP?
bool eth_has_ip();            // Temos IP atribuido (DHCP ou estatico)?
bool eth_check_dhcp();        // Tenta DHCP se link UP e ainda sem IP. true = temos IP no fim.
EthernetClient& eth_get_client();
IPAddress       eth_local_ip();

// Compat antigos
bool eth_init();
bool eth_connected();
void eth_maintain();

#endif
`;
    }

    // ---- eth.cpp ----
    _genEthCpp() {
        return `#include "hal.h"
#include "config.h"
#include <SPI.h>
#include <Ethernet.h>
#include <WiFi.h>   // pra usarmos esp_efuse_mac_get_default

static byte _mac[6];
static bool _hwReady = false;
static bool _hasIp   = false;
static EthernetClient _ethClient;

// Deriva MAC unico da TON a partir do eFuse (MAC WiFi base + 1).
// Evita colisao quando mais de uma TON estao na mesma rede.
static void _deriveMac() {
    uint8_t base[6];
    WiFi.macAddress(base);
    memcpy(_mac, base, 6);
    _mac[0] |= 0x02;  // localmente administrado, evita colisao com OUIs reais
    _mac[5] = (uint8_t)((base[5] + 1) & 0xFF);
}

// Le diretamente o Version Register do W5500 (endereco 0x0039 do bloco Common Register).
// W5500 sempre retorna 0x04 nesse registro. Mesmo metodo do TON-TESTE/main.cpp.
// SPI a 1 MHz (mais confiavel pra diagnostico do que os 14 MHz default).
static uint8_t _w5500_read_version() {
    digitalWrite(W5500_CS, LOW);
    SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
    SPI.transfer(0x00);   // address high byte
    SPI.transfer(0x39);   // address low byte (Version Register)
    SPI.transfer(0x01);   // control: Common Register, Read mode
    uint8_t ver = SPI.transfer(0x00);
    SPI.endTransaction();
    digitalWrite(W5500_CS, HIGH);
    return ver;
}

bool eth_hw_init() {
    if (_hwReady) return true;
    _deriveMac();

    Serial.printf("[ETH] Iniciando W5500 — pinos: CS=%d RST=%d MOSI=%d MISO=%d SCLK=%d\\n",
                  W5500_CS, W5500_RST, SPI2_MOSI_PIN, SPI2_MISO_PIN, SPI2_SCLK_PIN);

    // Mesma sequencia de reset do TON-TESTE (validada em hardware)
    pinMode(W5500_CS, OUTPUT);
    digitalWrite(W5500_CS, HIGH);
    pinMode(W5500_RST, OUTPUT);
    digitalWrite(W5500_RST, LOW); delay(50);
    digitalWrite(W5500_RST, HIGH); delay(500);    // PHY ready (datasheet: >=150ms)

    SPI.begin(SPI2_SCLK_PIN, SPI2_MISO_PIN, SPI2_MOSI_PIN);

    // Le o Version Register direto via SPI — fonte de verdade:
    // 0x04 = W5500 OK | 0x00 ou 0xFF = chip nao responde
    uint8_t ver = _w5500_read_version();
    Serial.printf("[ETH] Version register (0x39): 0x%02X (esperado 0x04)\\n", ver);
    _hwReady = (ver == 0x04);

    if (_hwReady) {
        Ethernet.init(W5500_CS);
        Serial.printf("[ETH] OK — W5500 detectado, MAC %02X:%02X:%02X:%02X:%02X:%02X\\n",
                      _mac[0], _mac[1], _mac[2], _mac[3], _mac[4], _mac[5]);
    } else {
        // Diagnostico extra de MISO em high-Z
        pinMode(SPI2_MISO_PIN, INPUT_PULLUP);
        int misoUp = digitalRead(SPI2_MISO_PIN);
        pinMode(SPI2_MISO_PIN, INPUT_PULLDOWN);
        int misoDown = digitalRead(SPI2_MISO_PIN);
        Serial.printf("[ETH] MISO high-Z: pull-up=%d pull-down=%d "
                      "(ambos seguem o pull = MISO flutuando, chip ausente/desligado)\\n",
                      misoUp, misoDown);
        Serial.println("[ETH] FALHA: W5500 nao respondeu. Cheque solda, 3V3, pinos SPI e RST.");
    }
    return _hwReady;
}

bool eth_link_up() {
    if (!_hwReady) return false;
    return Ethernet.linkStatus() == LinkON;
}

bool eth_has_ip() { return _hwReady && _hasIp; }

// Tenta DHCP se link UP e ainda nao temos IP. Retorna true se temos IP via DHCP.
// IMPORTANTE: NAO faz fallback automatico para IP estatico — se DHCP falhar, retorna false
// e a logica de switching mantem WiFi (rede provavelmente nao serve a TON).
// Para usar IP estatico explicitamente, ative ETH_USE_STATIC_FALLBACK no config.h.
bool eth_check_dhcp() {
    if (!_hwReady) return false;
    if (!eth_link_up()) {
        if (_hasIp) {
            Serial.println("[ETH] Link DOWN — perdemos IP");
            _hasIp = false;
        }
        return false;
    }
    if (_hasIp) return true;

    // B3: link sem servidor DHCP (switch sem roteador) -> apos 3 falhas, tenta so' a cada 2 min
    static uint8_t _dhcpFails = 0; static unsigned long _dhcpLast = 0;
    if (_dhcpFails >= 3 && millis() - _dhcpLast < 120000UL) return false;
    _dhcpLast = millis();
    Serial.printf("[ETH] Link UP, tentando DHCP (timeout %lums)...\\n",
                  (unsigned long)ETH_DHCP_TIMEOUT_MS);
    if (Ethernet.begin(_mac, ETH_DHCP_TIMEOUT_MS, 2000) != 0) {
        _dhcpFails = 0;
        _hasIp = true;
        Serial.printf("[ETH] DHCP OK -> %s | gw=%s | dns=%s\\n",
                      Ethernet.localIP().toString().c_str(),
                      Ethernet.gatewayIP().toString().c_str(),
                      Ethernet.dnsServerIP().toString().c_str());
        return true;
    }

    if (_dhcpFails < 255) _dhcpFails++;
#ifdef ETH_USE_STATIC_FALLBACK
    // Fallback IP estatico — so se explicitamente habilitado no config.
    // Cuidado: se a rede nao for ETH_STATIC_IP/SUBNET, o broker fica inalcancavel.
    IPAddress ip, gw, sn, dns;
    ip.fromString(ETH_STATIC_IP); gw.fromString(ETH_GATEWAY);
    sn.fromString(ETH_SUBNET); dns.fromString(ETH_DNS);
    Ethernet.begin(_mac, ip, dns, gw, sn);
    _hasIp = (Ethernet.localIP() != IPAddress(0, 0, 0, 0));
    if (_hasIp) {
        Serial.printf("[ETH] DHCP falhou, IP estatico %s\\n", Ethernet.localIP().toString().c_str());
    } else {
        Serial.println("[ETH] Sem IP (DHCP falhou e estatico tambem)");
    }
    return _hasIp;
#else
    Serial.println("[ETH] DHCP falhou — sem IP. Mantendo WiFi.");
    _hasIp = false;
    return false;
#endif
}

EthernetClient& eth_get_client() { return _ethClient; }

IPAddress eth_local_ip() { return Ethernet.localIP(); }

// === Compat: mantidas para nao quebrar quem ja chamava ===
bool eth_init()       { return eth_hw_init() && eth_check_dhcp(); }
bool eth_connected()  { return eth_has_ip(); }
void eth_maintain()   { if (_hwReady) Ethernet.maintain(); }
void eth_hw_reset() {
    Serial.println("[ETH] RESET do W5500 pelo pino (Ethernet com link e sem broker)");
    _hwReady = false; _hasIp = false;
    eth_hw_init();
}
`;
    }

    // ---- lora.h ----
    _genLoraH() {
        return `#ifndef LORA_H
#define LORA_H
#include <Arduino.h>

void lora_init();
void lora_send(const char* msg);
bool lora_available();
String lora_read();
bool lora_ready();

#endif
`;
    }

    // ---- lora.cpp ----
    _genLoraCpp(spec) {
        return `#include "lora.h"
#include "hal.h"
#include "config.h"
#include <esp_task_wdt.h>

#define LORA_SERIAL Serial2

void lora_init() {
    pinMode(LORA_AUX, INPUT);
    LORA_SERIAL.begin(LORA_BAUD, LORA_CONFIG, UART2_TX, UART2_RX);
    unsigned long t = millis();
    while (!digitalRead(LORA_AUX) && millis() - t < 2000) { delay(10); esp_task_wdt_reset(); }
    Serial.printf("[LORA] E220 AUX=%s\\n", digitalRead(LORA_AUX) ? "OK" : "FALHA");
}

void lora_send(const char* msg) {
    unsigned long t = millis();
    while (!digitalRead(LORA_AUX) && millis() - t < 1000) { delay(1); esp_task_wdt_reset(); }
    LORA_SERIAL.println(msg);
    LORA_SERIAL.flush();
}

bool lora_available() { return LORA_SERIAL.available() > 0; }
String lora_read() {
    if (!LORA_SERIAL.available()) return "";
    LORA_SERIAL.setTimeout(100);
    String msg = LORA_SERIAL.readStringUntil('\\n');
    msg.trim();
    return msg;
}
bool lora_ready() { return digitalRead(LORA_AUX) == HIGH; }
`;
    }

    // ============================================================
    // LoRa router: dispatcher consciente do papel na topologia.
    // - gateway (TON2 com WiFi+LoRa): roteia MQTT<->LoRa
    // - satellite (TON sem WiFi, só LoRa+RS485): só recebe cmd LoRa
    //   destinado ao próprio MAC, executa e publica ack via LoRa
    // - default (modo tx simples): mantém comportamento legado
    // ============================================================
    _genLoraRouter(spec) {
        const role = spec.lora_role || 'tx';
        // MESTRE-PUXA: o gateway orquestra (polling round-robin) por padrao. NAO exige
        // alvos no diagrama: a lista de alvos e' DINAMICA — o gateway DESCOBRE os
        // satelites polláveis pelos heartbeats ("poll":1) e passa a pollá-los (como o
        // push antigo aprendia o MAC do 'from' em runtime). Os alvos do diagrama (se
        // houver) so' semeiam a lista. O fallback autonomo (_loraAutonomousPush) desliga
        // o orquestrador e volta o satellite a empurrar sozinho (comportamento antigo).
        const pollTargets = (spec.poll_targets || []);
        const gwOrchestrate = role === 'gateway' && !this._loraAutonomousPush();

        // Detecta dispositivos M160 (mesmo field-set binario) entre os RS485 do
        // satellite e gera o mapeamento subtopic-real -> type_code. Isso conserta
        // o bug critico: o subtopic emitido pelo device reader e' `${name}_${addr}/data`
        // (default "Power Meter_1/data" COM ESPACO), nunca o literal hardcoded
        // "Power_Meter_1/data". Agora casamos pelo subtopic REAL de cada device.
        const cEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const isM160 = (d) => {
            const cid = (d.catalog_id || '').toLowerCase();
            const nm = (d.name || '').toLowerCase();
            return cid.includes('m160') || cid.includes('ims') || nm.includes('m160')
                || d.type === 'power_meter';
        };
        const m160Devices = (spec.rs485_devices || []).filter(isM160);
        const m160SubtopicCases = m160Devices.map((d) => {
            const sub = `${d.name || 'dev'}_${d.modbus_address || 1}/data`;
            return `    if (strcmp(subtopic, "${cEsc(sub)}") == 0) return LORA_TYPE_M160;`;
        }).join('\n') || '    (void)subtopic;';

        // ----- Helpers comuns: parser de MAC e normalização -----
        let cpp = `
// ===== LoRa Router (role: ${role}) =====
// Protocolo em envelope JSON (modo transparente do E220):
//   cmd:        {"to":"AA:BB:..","from":"<orig>","cmd_id":"...","cmd":"r1 on"}
//   ack:        {"to":"<orig>","from":"<me>","cmd_id":"...","status":"ok","msg":"..."}
//   data:       {"to":"<gw>","from":"<me>","type":"data","subtopic":"X/data","payload":{...}}
//   status:     {"to":"<gw>","from":"<me>","type":"status","online":true,"version":"..."}
//
// Garantias de entrega:
//   - Gateway: pending queue + retry com timeout 2s, ate 3 tentativas. Se nao
//     receber ACK no ultimo retry, publica ack erro "lora_no_ack" no MQTT.
//   - Ambos: CSMA simples (aguarda AUX=HIGH) + jitter random antes de TX pra
//     reduzir colisao quando varios dispositivos transmitem perto no tempo.
//   - MTU E220: 200 bytes max em modo transparente. _lora_safe_send descarta
//     payload acima e loga erro (caller deve dividir ou comprimir).

#define LORA_MAX_PAYLOAD 200

// Compara MACs ignorando case e separadores ':' / '-'.
static bool _lora_mac_eq(const char* a, const char* b) {
    if (!a || !b) return false;
    auto norm = [](char c) -> char {
        if (c == ':' || c == '-') return 0;
        if (c >= 'a' && c <= 'z') return c - 32;
        return c;
    };
    while (*a || *b) {
        while (*a && norm(*a) == 0) a++;
        while (*b && norm(*b) == 0) b++;
        if (norm(*a) != norm(*b)) return false;
        if (!*a || !*b) return (*a == *b);
        a++; b++;
    }
    return true;
}

// ============================================================
// REPASSE MULTI-HOP (defined-path) — tabela de rotas + next_hop.
// ----------------------------------------------------------------
// O 'to' do envelope e' o destino FINAL. Esta tabela (gerada do grafo LoRa
// pelo gerador, via BFS) diz qual o MAC do PROXIMO SALTO em direcao a cada
// destino alcancavel. 1-salto: nh == dst (vizinho direto). Multi-hop: nh e'
// um intermediario. Se o destino nao esta na tabela (ex: gateway que so'
// aprende MACs em runtime), _lora_next_hop devolve o proprio dst -> envia
// direto (compat: comportamento ponto-a-ponto antigo).
#define LORA_DEFAULT_TTL ${LORA_DEFAULT_TTL}

typedef struct { const char* dst; const char* nh; } LoraRoute;
static const LoraRoute _LORA_ROUTES[] = {
${(spec.lora_routes || []).map(r => `    { "${cEsc(r.dst)}", "${cEsc(r.nh)}" },`).join('\n')}
};
static const int _LORA_ROUTES_N = sizeof(_LORA_ROUTES) / sizeof(_LORA_ROUTES[0]);

// Retorna o MAC do proximo salto em direcao a 'dst'. Se 'dst' nao esta na
// tabela, devolve o proprio 'dst' (envio direto/compat ponto-a-ponto).
static const char* _lora_next_hop(const char* dst) {
    if (!dst || !dst[0]) return dst;
    for (int i = 0; i < _LORA_ROUTES_N; i++) {
        if (_lora_mac_eq(_LORA_ROUTES[i].dst, dst)) return _LORA_ROUTES[i].nh;
    }
    return dst;  // desconhecido -> tenta direto
}

// ----- Dedup por cmd_id (ring buffer) — compartilhado por todos os roles LoRa.
// Usado pra: (sat) nao reaplicar cmd reenviado; (todos) anti-loop no repasse
// multi-hop (nao repassar o mesmo cmd_id 2x). Retorna true se ja' visto.
#define LORA_DEDUP_SIZE 32
// [72] = from(17) + "|" + cmd_id(ate' 39, igual LoraPending.cmd_id) + "|" + type
// (ate' "pollresp") sem truncar.
static char _loraDedup[LORA_DEDUP_SIZE][72];
static int _loraDedupIdx = 0;
static bool _sat_seen_or_add(const char* cmd_id, const char* type, const char* from) {
    if (!cmd_id || !cmd_id[0]) return false;
    // Chave "from|cmd_id|type" (originador + id + direcao). Dois motivos:
    //  1) o MESMO cmd_id viaja como pergunta E resposta (POLL<->POLLRESP,
    //     cmd<->ack reusam o id) -> o 'type' separa ida da volta, senao a
    //     repetidora marcava a ida e descartava a volta como duplicada (offline
    //     indevido a 2+ saltos).
    //  2) o cmd_id de telemetria ("d<seq>") e' por-no (cada satelite tem seu
    //     contador) -> sem o 'from', dois irmaos atras da MESMA repetidora
    //     gerariam "d1|data" identico e a repetidora descartaria a telemetria de
    //     um deles. O 'from' (originador, ja' no envelope) torna a chave unica por
    //     no SEM inchar o id -> o id curto cabe no MTU 200 (ex.: status do pivo).
    char key[72];
    snprintf(key, sizeof(key), "%s|%s|%s",
             (from && from[0]) ? from : "?", cmd_id, (type && type[0]) ? type : "-");
    for (int i = 0; i < LORA_DEDUP_SIZE; i++) {
        if (_loraDedup[i][0] && strcmp(_loraDedup[i], key) == 0) return true;
    }
    strncpy(_loraDedup[_loraDedupIdx], key, sizeof(_loraDedup[0]) - 1);
    _loraDedup[_loraDedupIdx][sizeof(_loraDedup[0]) - 1] = 0;
    _loraDedupIdx = (_loraDedupIdx + 1) % LORA_DEDUP_SIZE;
    return false;
}

// CSMA simples: aguarda canal idle (AUX=HIGH) + jitter random pra evitar
// colisao quando varios devices transmitem perto no tempo. Retorna false
// (sem transmitir) se passou do MTU do E220 (200 bytes) — caller decide o que
// fazer (ex: gateway publica erro imediato em vez de esperar timeout).
static bool _lora_safe_send(const char* msg) {
    if (!msg) return false;
    size_t len = strlen(msg);
    if (len > LORA_MAX_PAYLOAD) {
        Serial.printf("[LORA] descartado: payload %u > MTU %d\\n", (unsigned)len, LORA_MAX_PAYLOAD);
        return false;
    }
    // Espera ate 2s o canal ficar idle.
    unsigned long t = millis();
    while (!digitalRead(LORA_AUX) && millis() - t < 2000) {
        delay(2);
        esp_task_wdt_reset();
    }
    // Jitter aleatorio 30-150ms reduz colisao entre transmissores proximos.
    delay(30 + (esp_random() % 120));
    lora_send(msg);
    return true;
}

// REPASSE (forward) — re-serializa o envelope JSON cru com ttl decrementado e
// re-transmite (CSMA via _lora_safe_send). 'to'/'from'/'cmd_id'/payload ficam
// INTACTOS; so' o ttl muda. Compartilhado por todos os roles LoRa.
static void _lora_forward(JsonDocument& env, int ttl) {
    env["ttl"] = ttl;
    char buf[LORA_MAX_PAYLOAD + 20];
    int n = serializeJson(env, buf, sizeof(buf));
    if (n <= 0 || n >= (int)sizeof(buf)) {
        Serial.printf("[LORA] forward: envelope %d bytes nao cabe — descartado\\n", n);
        return;
    }
    _lora_safe_send(buf);
}

// ============================================================
// SCHEMAS BINARIOS — compress\xe3o de telemetria pra caber no MTU do E220.
// Frame: "$B$" + Base64( header + subtopic + payload ), onde:
//   header   = [type_code(1), version(1), from_mac(6), subtopic_len(1)] = 9 bytes
//   subtopic = N bytes (o subtopic REAL do device, ex: "Power Meter_1/data")
//   payload  = bytes dos fields do field-set (big-endian, com escala)
// O subtopic VIAJA no frame — assim o gateway republica no topico exato que o
// satellite emitiu (conserta o bug de subtopic hardcoded). O type_code so'
// seleciona o LAYOUT de campos (compartilhado entre os firmwares).
// Tamanho M160: 9 + ~18 (subtopic) + 50 (payload) = 77B -> Base64 104B + 3 = 107B ✓
// ============================================================

#define LORA_SUBTOPIC_MAX 60

typedef enum { LFT_U8 = 1, LFT_U16, LFT_S16, LFT_U32, LFT_S32 } LoraFieldType;

typedef struct {
    const char* json_key;
    uint8_t type;       // LoraFieldType
    float scale;        // raw_binario = real * scale; real = raw / scale
} LoraField;

typedef struct {
    uint8_t type_code;          // identificador do layout de campos (0x10=M160)
    uint8_t version;            // pra migrar layouts no futuro sem quebrar
    const LoraField* fields;    // array null-terminated (key=NULL)
} LoraFieldSet;

// ---- M160 (Modbus RTU, multimedidor IMS) — keys batem com o payload REAL do
//      firmware do M160 (Va,Ia,FPa,Pt,phf,consumo_* — capitalizado, confirmado
//      no broker em campo). ----
static const LoraField LORA_FIELDS_M160_V1[] = {
    {"Va",          LFT_U16, 100.0f},   // 0.01 V
    {"Vb",          LFT_U16, 100.0f},
    {"Vc",          LFT_U16, 100.0f},
    {"Ia",          LFT_U16, 100.0f},   // 0.01 A
    {"Ib",          LFT_U16, 100.0f},
    {"Ic",          LFT_U16, 100.0f},
    {"FPa",         LFT_S16, 1000.0f},  // 0.001 FP
    {"FPb",         LFT_S16, 1000.0f},
    {"FPc",         LFT_S16, 1000.0f},
    {"Pt",          LFT_S32, 10.0f},    // 0.1 W
    {"Qt",          LFT_S32, 10.0f},    // 0.1 var
    {"St",          LFT_S32, 10.0f},    // 0.1 VA
    {"phf",         LFT_U32, 1000.0f},  // mWh
    {"consumo_phf", LFT_U32, 1000.0f},
    {"consumo_phr", LFT_U32, 1000.0f},
    {"consumo_qhf", LFT_U32, 1000.0f},
    {"consumo_qhr", LFT_U32, 1000.0f},
    {NULL, 0, 0}  // terminator
};

#define LORA_TYPE_M160 0x10

// Tabela de field-sets FIXA e compartilhada (gateway e satellite tem a mesma).
// Indexada por type_code — define apenas o LAYOUT, nao o subtopic.
static const LoraFieldSet LORA_FIELD_SETS[] = {
    {LORA_TYPE_M160, 1, LORA_FIELDS_M160_V1},
    {0, 0, NULL}  // terminator
};

static const LoraFieldSet* _lora_fieldset_for_type(uint8_t type_code, uint8_t version) {
    for (const LoraFieldSet* s = LORA_FIELD_SETS; s->fields; s++) {
        if (s->type_code == type_code && s->version == version) return s;
    }
    return NULL;
}

// SATELLITE-SIDE: mapeia o subtopic REAL emitido pelo device reader
// (formato nome_endereco/data) -> type_code. Gerado a partir dos RS485 do
// diagrama desta TON, entao casa exatamente o que lora_publish_data recebe.
static uint8_t _lora_typecode_for_subtopic(const char* subtopic) {
    if (!subtopic) return 0;
${m160SubtopicCases}
    return 0;  // sem field-set conhecido -> caller usa JSON (e loga)
}

// MAC string ("AA:BB:CC:DD:EE:FF") <-> 6 bytes binarios
static void _lora_mac_str_to_bytes(const char* str, uint8_t bytes[6]) {
    memset(bytes, 0, 6);
    if (!str) return;
    int b = 0;
    const char* p = str;
    while (*p && b < 6) {
        while (*p && (*p == ':' || *p == '-' || *p == ' ')) p++;
        if (!*p || !*(p+1)) break;
        char h[3] = { *p, *(p+1), 0 };
        bytes[b++] = (uint8_t)strtoul(h, NULL, 16);
        p += 2;
    }
}
static void _lora_mac_bytes_to_str(const uint8_t bytes[6], char* out) {
    sprintf(out, "%02X:%02X:%02X:%02X:%02X:%02X",
            bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]);
}

// Pack JSON -> binario. Retorna bytes escritos ou -1 em overflow.
static int _lora_pack_fields(const LoraField* fields, JsonDocument& doc,
                              uint8_t* buf, int max_len) {
    int pos = 0;
    for (const LoraField* f = fields; f->json_key; f++) {
        if (pos + 4 > max_len) return -1;
        double val = doc[f->json_key] | 0.0;
        int64_t raw = (int64_t)(val * f->scale + (val >= 0 ? 0.5 : -0.5));  // round
        switch (f->type) {
            case LFT_U8:
                buf[pos++] = (uint8_t)(raw & 0xFF);
                break;
            case LFT_U16:
            case LFT_S16:
                buf[pos++] = (uint8_t)((raw >> 8) & 0xFF);
                buf[pos++] = (uint8_t)(raw & 0xFF);
                break;
            case LFT_U32:
            case LFT_S32:
                buf[pos++] = (uint8_t)((raw >> 24) & 0xFF);
                buf[pos++] = (uint8_t)((raw >> 16) & 0xFF);
                buf[pos++] = (uint8_t)((raw >> 8) & 0xFF);
                buf[pos++] = (uint8_t)(raw & 0xFF);
                break;
        }
    }
    return pos;
}

// Unpack binario -> JSON. Retorna bytes consumidos ou -1 em underflow.
static int _lora_unpack_fields(const LoraField* fields, const uint8_t* buf,
                                int len, JsonDocument& doc) {
    int pos = 0;
    for (const LoraField* f = fields; f->json_key; f++) {
        int64_t raw = 0;
        switch (f->type) {
            case LFT_U8:
                if (pos + 1 > len) return -1;
                raw = buf[pos++];
                break;
            case LFT_U16:
                if (pos + 2 > len) return -1;
                raw = ((uint16_t)buf[pos] << 8) | buf[pos+1]; pos += 2;
                break;
            case LFT_S16:
                if (pos + 2 > len) return -1;
                raw = (int16_t)(((uint16_t)buf[pos] << 8) | buf[pos+1]); pos += 2;
                break;
            case LFT_U32:
                if (pos + 4 > len) return -1;
                raw = ((uint32_t)buf[pos] << 24) | ((uint32_t)buf[pos+1] << 16)
                    | ((uint32_t)buf[pos+2] << 8) | buf[pos+3]; pos += 4;
                break;
            case LFT_S32:
                if (pos + 4 > len) return -1;
                raw = (int32_t)(((uint32_t)buf[pos] << 24) | ((uint32_t)buf[pos+1] << 16)
                              | ((uint32_t)buf[pos+2] << 8) | buf[pos+3]); pos += 4;
                break;
        }
        // Scale=1 mantem como inteiro; senao como double
        if (f->scale == 1.0f) {
            doc[f->json_key] = (long)raw;
        } else {
            doc[f->json_key] = (double)raw / f->scale;
        }
    }
    return pos;
}

// Base64 — usa mbedtls (ja disponivel no Arduino-ESP32 framework)
#include <mbedtls/base64.h>
static int _lora_b64_encode(const uint8_t* in, size_t in_len, char* out, size_t out_max) {
    size_t olen = 0;
    int rc = mbedtls_base64_encode((unsigned char*)out, out_max, &olen, in, in_len);
    if (rc != 0) return -1;
    out[olen] = 0;
    return (int)olen;
}
static int _lora_b64_decode(const char* in, size_t in_len, uint8_t* out, size_t out_max) {
    size_t olen = 0;
    int rc = mbedtls_base64_decode(out, out_max, &olen, (const unsigned char*)in, in_len);
    if (rc != 0) return -1;
    return (int)olen;
}

`;
        if (role === 'satellite') {
            cpp += `
// Satellite: recebe envelope LoRa, processa só se 'to' bater com meu MAC.
// Dedup (_sat_seen_or_add, ring compartilhado) evita reaplicar cmd quando
// gateway re-envia por timeout. Heartbeat a cada 30s pro gateway saber vivo.

#define LORA_SAT_HEARTBEAT_MS 30000UL
// 1 = gateway e' vizinho direto (1 salto); 0 = atras de repetidora (2+ saltos).
// Telemetria binaria ("$B$") so' roteia 1-salto -> a 2+ saltos o firmware avisa.
#define LORA_GW_DIRECT ${spec.lora_gw_direct ? 1 : 0}

static String _ton2_gw_mac = "";  // MAC do gateway (descoberto na 1a msg recebida)
static unsigned long _lastHeartbeat = 0;

// MESTRE-PUXA: definida no main.cpp (la' tem acesso aos leitores Modbus/TCP/IO).
// Lê o device, publica a telemetria via lora_publish_data e fecha com pollresp.
// Forward-decl aqui pois lora_handle_rx a chama ao receber um POLL.
void lora_poll_respond(const char* gw_mac, const char* req_id);
// Envia o envelope de CONCLUSAO do poll (type:"pollresp") — def. abaixo de
// lora_send_envelope (que ela usa). Chamada por lora_poll_respond no main.cpp.
void lora_send_pollresp(const char* gw_mac, const char* req_id);

// Empacota envelope JSON e envia via _lora_safe_send (CSMA + jitter).
// 'to_mac' e' o destino FINAL. O campo "ttl" (multi-hop) limita os saltos —
// intermediarios repassam ate ttl chegar a 0. Em 1-salto o destino e' vizinho
// direto e o ttl nem e' consumido.
static void lora_send_envelope(const char* to_mac, const char* type, const char* cmd_id,
                                const char* status, const char* msg,
                                const char* subtopic, const char* payload_json) {
    char buf[LORA_MAX_PAYLOAD + 20];  // +20 pra detectar overflow antes do safe_send
    String my_mac = WiFi.macAddress();
    int n = snprintf(buf, sizeof(buf), "{\\"to\\":\\"%s\\",\\"from\\":\\"%s\\"",
                     to_mac && to_mac[0] ? to_mac : "*", my_mac.c_str());
    if (type && type[0]) n += snprintf(buf + n, sizeof(buf) - n, ",\\"type\\":\\"%s\\"", type);
    if (cmd_id && cmd_id[0]) n += snprintf(buf + n, sizeof(buf) - n, ",\\"cmd_id\\":\\"%s\\"", cmd_id);
    if (status && status[0]) n += snprintf(buf + n, sizeof(buf) - n, ",\\"status\\":\\"%s\\"", status);
    if (msg && msg[0]) n += snprintf(buf + n, sizeof(buf) - n, ",\\"msg\\":\\"%s\\"", msg);
    if (subtopic && subtopic[0]) n += snprintf(buf + n, sizeof(buf) - n, ",\\"subtopic\\":\\"%s\\"", subtopic);
    if (payload_json && payload_json[0]) n += snprintf(buf + n, sizeof(buf) - n, ",\\"payload\\":%s", payload_json);
    n += snprintf(buf + n, sizeof(buf) - n, ",\\"ttl\\":%d", LORA_DEFAULT_TTL);
    // "data" e "status" omitem o "ts" do envelope (o gateway republica so' o
    // payload e nao usa esse ts) — economiza ~13B pro MTU 200 (telemetria do pivo,
    // heartbeat com "poll":1). ack/pollresp mantem o ts.
    if (!type || (strcmp(type, "data") != 0 && strcmp(type, "status") != 0))
        n += snprintf(buf + n, sizeof(buf) - n, ",\\"ts\\":%lu", (unsigned long)(millis()/1000));
    n += snprintf(buf + n, sizeof(buf) - n, "}");
    if (n <= 0 || n >= (int)sizeof(buf)) {
        Serial.printf("[LORA-SAT] envelope montagem falhou (n=%d)\\n", n);
        return;
    }
    _lora_safe_send(buf);  // descarta se > MTU 200, com log
}

// MESTRE-PUXA: fecha o ciclo de poll respondendo o req_id pro mestre. A
// telemetria em si ja' foi enviada por lora_poll_respond via lora_publish_data;
// este envelope so' sinaliza "terminei, req_id=X" pro mestre avancar.
void lora_send_pollresp(const char* gw_mac, const char* req_id) {
    const char* gw = (gw_mac && gw_mac[0]) ? gw_mac
                   : (_ton2_gw_mac.length() ? _ton2_gw_mac.c_str() : "*");
    lora_send_envelope(gw, "pollresp", req_id, "ok", nullptr, nullptr, nullptr);
}

static void lora_handle_rx(const char* raw) {
    if (!raw || !*raw || raw[0] != '{') {
        Serial.printf("[LORA-SAT] payload nao-JSON descartado: %s\\n", raw ? raw : "(null)");
        return;
    }
    StaticJsonDocument<512> env;
    if (deserializeJson(env, raw) != DeserializationError::Ok) {
        Serial.println("[LORA-SAT] JSON invalido");
        return;
    }
    const char* to = env["to"] | "";
    const char* from = env["from"] | "";
    String myMac = WiFi.macAddress();
    const char* cmd_id = env["cmd_id"] | "";
    bool forMe = _lora_mac_eq(to, myMac.c_str());

    // MULTI-HOP: nao e' pra mim. Tenta REPASSAR (defined-path) em direcao ao
    // destino FINAL. Dedup por cmd_id evita repassar 2x (anti-loop), junto com o
    // TTL. 1-salto (gateway<->satellite direto) NUNCA cai aqui (to == myMac).
    if (!forMe) {
        // Dedup PRIMEIRO: ja' repassado/processado -> descarta (nem reprocessa
        // nem re-encaminha). Conta como "visto" pra nao repassar de novo.
        if (cmd_id[0] && _sat_seen_or_add(cmd_id, env["type"] | "", from)) return;
        int ttl = env["ttl"] | 0;   // ausente -> 0 -> nao repassa (compat: era so' p/ mim)
        if (ttl <= 0) return;       // esgotou TTL ou envelope antigo sem ttl
        const char* nh = _lora_next_hop(to);
        if (!nh || !nh[0] || _lora_mac_eq(nh, myMac.c_str())) return;  // sem rota
        Serial.printf("[LORA-SAT] FORWARD to=%s nh=%s ttl=%d->%d\\n", to, nh, ttl, ttl - 1);
        _lora_forward(env, ttl - 1);  // re-send com to/from/cmd_id intactos, ttl-1
        return;
    }

    // ---- Daqui pra baixo: 'to' == meu MAC (fluxo ponto-a-ponto original) ----
    // Memoriza MAC do gateway pra responder ack/telemetria.
    if (from[0] && _ton2_gw_mac.length() == 0) {
        _ton2_gw_mac = String(from);
        Serial.printf("[LORA-SAT] Gateway descoberto: %s\\n", from);
    }

    // MESTRE-PUXA (satellite REATIVO): POLL endereçado a mim. O mestre pergunta;
    // eu leio o device + faco os calculos (decode/escala EXISTENTE) e respondo
    // DATA(req_id) pela malha. req_id = cmd_id deste POLL (correlaciona no mestre).
    // NAO entra no dedup: cada POLL e' um pedido novo; se o mestre re-perguntar
    // (retransmissao), responder de novo com dado fresco e' o correto. So' um POLL
    // em voo por vez (mestre serializa), entao nao ha burst.
    {
        const char* _ptype = env["type"] | "";
        if (strcmp(_ptype, "poll") == 0) {
            Serial.printf("[LORA-SAT] POLL recebido req_id=%s de %s — lendo device e respondendo\\n",
                          cmd_id[0] ? cmd_id : "(sem)", from);
            // Responde p/ quem perguntou (o mestre). Le devices + publica telemetria
            // via lora_publish_data (mesmo caminho do push antigo) e fecha com pollresp.
            lora_poll_respond(from, cmd_id);
            return;
        }
    }

    // Dedup: gateway pode reenviar mesmo cmd_id se nosso ACK se perdeu.
    // Resposta correta e' re-enviar ack 'duplicate' (gateway libera pendente).
    if (cmd_id[0] && _sat_seen_or_add(cmd_id, env["type"] | "", from)) {
        Serial.printf("[LORA-SAT] Duplicado cmd_id=%s — re-enviando ack 'duplicate'\\n", cmd_id);
        lora_send_envelope(from, "ack", cmd_id, "duplicate", "already_seen", nullptr, nullptr);
        return;
    }

    JsonVariantConst inner = env["cmd"];
    static char inner_buf[300];
    const char* effective = "";
    if (inner.is<const char*>()) {
        snprintf(inner_buf, sizeof(inner_buf), "%s", inner.as<const char*>());
        effective = inner_buf;
    } else if (inner.is<JsonObjectConst>()) {
        serializeJson(inner, inner_buf, sizeof(inner_buf));
        effective = inner_buf;
    } else {
        if (cmd_id[0]) lora_send_envelope(from, "ack", cmd_id, "error", "missing_cmd_field", nullptr, nullptr);
        return;
    }

    char msg[64] = {0};
    bool ok = _process_command_inner(effective, msg, sizeof(msg));
    Serial.printf("[LORA-SAT][CMD] %s -> %s (%s)\\n", effective, ok ? "OK" : "FAIL", msg);
    if (cmd_id[0]) {
        lora_send_envelope(from, "ack", cmd_id, ok ? "ok" : "error", msg, nullptr, nullptr);
    }
}

// Tenta enviar binario (cabe folgado no MTU). Retorna true se conseguiu.
// Frame: "$B$" + Base64( type(1), version(1), from_mac[6], sublen(1), subtopic, payload ).
// O subtopic viaja no frame -> gateway republica no topico EXATO emitido aqui.
static bool _lora_try_publish_binary(const char* subtopic, const char* payload_json) {
    uint8_t type_code = _lora_typecode_for_subtopic(subtopic);
    if (!type_code) return false;  // sem field-set p/ esse device -> caller usa JSON
    const LoraFieldSet* fs = _lora_fieldset_for_type(type_code, 1);
    if (!fs) return false;

    StaticJsonDocument<400> doc;
    if (deserializeJson(doc, payload_json) != DeserializationError::Ok) {
        Serial.println("[LORA-SAT] bin: JSON invalido");
        return false;
    }

    size_t sublen = strlen(subtopic);
    if (sublen > LORA_SUBTOPIC_MAX) {
        Serial.printf("[LORA-SAT] bin: subtopic %u > %d (usa JSON)\\n",
                      (unsigned)sublen, LORA_SUBTOPIC_MAX);
        return false;
    }

    // Header: type(1) + version(1) + from_mac(6) + sublen(1), depois subtopic + payload
    uint8_t binbuf[200];
    binbuf[0] = fs->type_code;
    binbuf[1] = fs->version;
    String my_mac = WiFi.macAddress();
    _lora_mac_str_to_bytes(my_mac.c_str(), &binbuf[2]);
    binbuf[8] = (uint8_t)sublen;
    memcpy(&binbuf[9], subtopic, sublen);
    int payload_off = 9 + (int)sublen;

    int payload_len = _lora_pack_fields(fs->fields, doc, &binbuf[payload_off],
                                        (int)sizeof(binbuf) - payload_off);
    if (payload_len < 0) {
        Serial.println("[LORA-SAT] bin: pack overflow");
        return false;
    }
    int bin_total = payload_off + payload_len;

    char out[LORA_MAX_PAYLOAD + 4];
    out[0] = '$'; out[1] = 'B'; out[2] = '$';
    int b64_len = _lora_b64_encode(binbuf, bin_total, out + 3, sizeof(out) - 4);
    if (b64_len < 0) {
        Serial.println("[LORA-SAT] bin: b64 encode falhou");
        return false;
    }
    int total = 3 + b64_len;
    if (total > LORA_MAX_PAYLOAD) {
        Serial.printf("[LORA-SAT] bin: %d > MTU %d (descarta)\\n", total, LORA_MAX_PAYLOAD);
        return false;
    }
    Serial.printf("[LORA-SAT] BIN tx sub=%s type=0x%02X bin=%dB total=%dB\\n",
                  subtopic, fs->type_code, bin_total, total);
    _lora_safe_send(out);
    return true;
}

// Helper: satellite publica telemetria via LoRa. Tenta binario primeiro. Se
// nao ha field-set conhecido, cai pro JSON envelope — que pode exceder o MTU.
// FAIL-LOUD: avisa no Serial quando vai pro JSON, pra diagnosticar perda.
static void lora_publish_data(const char* subtopic, const char* payload_json) {
#if !LORA_GW_DIRECT
    // Este satelite esta a 2+ saltos do gateway. O frame binario "$B$" NAO carrega
    // to/ttl -> a repetidora (que so' repassa JSON) o descarta e a telemetria nao
    // chega. Avisa ALTO (sem silencio). Correcao: colocar o medidor a 1 salto do
    // gateway, ou aguardar o suporte a binario roteavel multi-hop (TODO).
    if (_lora_typecode_for_subtopic(subtopic)) {
        Serial.printf("[LORA-SAT] ⚠ sub=%s usa telemetria BINARIA e este no esta a 2+ saltos do "
                      "gateway — o frame nao roteia multi-hop ainda; a telemetria deste device NAO "
                      "chegara. Coloque o medidor a 1 salto do gateway.\\n", subtopic ? subtopic : "?");
    }
#endif
    if (_lora_try_publish_binary(subtopic, payload_json)) return;
    size_t plen = payload_json ? strlen(payload_json) : 0;
    if (plen > 120) {
        // Envelope JSON vai estourar o MTU 200. Avisa claramente (sem schema
        // binario nao temos como caber). Telemetria NAO sera entregue.
        Serial.printf("[LORA-SAT] ⚠ sub=%s sem field-set binario e payload=%uB — "
                      "JSON provavelmente excede MTU 200 e sera descartado. "
                      "Cadastre um field-set p/ este device.\\n",
                      subtopic ? subtopic : "?", (unsigned)plen);
    }
    // cmd_id de telemetria "d<seq>" (CURTO). A unicidade ENTRE satelites vem do
    // 'from' na chave de dedup (from|cmd_id|type), nao do id — assim o id fica curto
    // e o envelope cabe no MTU 200 (ex.: status do pivo). O seq por-no basta pra
    // o anti-loop/dedup dos proprios frames repassados.
    // Semeado com esp_random() no boot (init do static, 1a chamada): apos um reboot
    // os ids NAO recomecam de 'd1' (que poderia ainda estar no ring de dedup da
    // repetidora e fazer a telemetria pos-reboot ser dropada como duplicata por
    // alguns ciclos). Comeco aleatorio -> sem reuso de id entre reinicios. O id
    // maximo (uint32) ainda cabe no MTU 200 (verificado).
    static uint32_t _data_seq = esp_random();
    char _data_id[16];
    snprintf(_data_id, sizeof(_data_id), "d%lu", (unsigned long)(++_data_seq));
    const char* gw = _ton2_gw_mac.length() ? _ton2_gw_mac.c_str() : "*";
    lora_send_envelope(gw, "data", _data_id, nullptr, nullptr, subtopic, payload_json);
}

// Heartbeat periodico pro gateway saber que satellite esta vivo.
// Gateway re-publica em <BASE>/satellite/<MAC>/status (retain) — backend ve
// presence. Sem heartbeat por 2*intervalo, backend pode marcar offline.
void lora_loop_tick() {
    unsigned long now = millis();
    if (now - _lastHeartbeat < LORA_SAT_HEARTBEAT_MS) return;
    _lastHeartbeat = now;
    char payload[180];
    // "poll":1 anuncia que este satelite e' POLLAVEL (reativo, tem device) — o
    // gateway usa isso pra DESCOBRIR o alvo sem precisar do MAC no diagrama.
    snprintf(payload, sizeof(payload),
             "{\\"online\\":true,${this._simMode() ? ('\\"sim\\":\\"' + (spec.name || '').replace(/[^\w .:-]/g, '') + '\\",') : ''}${(role === 'satellite' && !this._loraAutonomousPush() && this._satelliteHasDevice(spec)) ? '\\"poll\\":1,' : ''}\\"version\\":\\"%s\\",\\"uptime\\":%lu,\\"free_heap\\":%u}",
             FIRMWARE_VERSION, (unsigned long)(now/1000),
             (unsigned)ESP.getFreeHeap());
    const char* gw = _ton2_gw_mac.length() ? _ton2_gw_mac.c_str() : "*";
    lora_send_envelope(gw, "status", nullptr, nullptr, nullptr, nullptr, payload);
}
`;
        } else if (role === 'gateway') {
            cpp += `
// Gateway: subscreve <BASE>/satellite/+/cmd no MQTT. Cmds MQTT viram envelope
// LoRa, sao enfileirados (pending queue) e transmitidos com retry ate receber
// ACK do satellite. Sem ACK em 3 tentativas, publica ack erro no MQTT.
// RX LoRa: filtra por 'to'=meu MAC; roteia ack/data/status pro MQTT.

extern bool mqtt_publish_raw(const char* topic, const char* payload);

// ===== Pending queue de cmds aguardando ACK do satellite =====
// Timeout/attempts calibrados pro canal half-duplex do E220: depois de TX, o
// gateway precisa FICAR EM SILENCIO tempo suficiente pro satellite responder o
// ACK sem colisao. 4s de janela cobre: airtime do cmd (~0.5s) + processamento
// do satellite (ate ~1s, ou mais se estiver saindo de um ciclo Modbus) +
// airtime do ACK (~0.5s) + folga. 3 tentativas = 12s total, dentro dos 15s do
// publishCommand do backend (5s x 3), entao o resultado (ACK ou erro) sempre
// chega a tempo. Antes era 2s x 3 = 6s: o gateway retransmitia POR CIMA do ACK.
#define LORA_PENDING_MAX 8
#define LORA_RETRY_TIMEOUT_MS 4000UL
#define LORA_MAX_ATTEMPTS 3

struct LoraPending {
    bool in_use;
    char cmd_id[40];
    char target_mac[20];
    char envelope[400];       // serializado pronto pra reenvio
    uint8_t attempts;
    unsigned long last_sent_ms;
};
static LoraPending _loraPending[LORA_PENDING_MAX];

static int _pending_alloc() {
    for (int i = 0; i < LORA_PENDING_MAX; i++) if (!_loraPending[i].in_use) return i;
    return -1;
}
static void _pending_release(int idx) {
    if (idx >= 0 && idx < LORA_PENDING_MAX) _loraPending[idx].in_use = false;
}
static int _pending_find(const char* cmd_id) {
    if (!cmd_id || !cmd_id[0]) return -1;
    for (int i = 0; i < LORA_PENDING_MAX; i++) {
        if (_loraPending[i].in_use && strcmp(_loraPending[i].cmd_id, cmd_id) == 0) return i;
    }
    return -1;
}

// Publica ack de erro no MQTT (queue cheia, timeout LoRa, etc).
static void _publish_error_ack(const char* mac_alvo, const char* cmd_id, const char* reason, int attempts) {
    char topic[200];
    snprintf(topic, sizeof(topic), "%s/satellite/%s/cmd/ack", MQTT_TOPIC_BASE, mac_alvo);
    char ack[300];
    snprintf(ack, sizeof(ack),
             "{\\"cmd_id\\":\\"%s\\",\\"status\\":\\"error\\",\\"msg\\":\\"%s\\",\\"attempts\\":%d,\\"ts\\":%lu}",
             cmd_id, reason, attempts, (unsigned long)(millis()/1000));
    mqtt_publish_raw(topic, ack);
}

// Chamado por mqtt.cpp quando recebe <BASE>/satellite/<MAC>/cmd.
// Aloca slot no pending queue, monta envelope, envia 1a tentativa.
void gateway_handle_satellite_mqtt(const char* mac_alvo, const char* payload) {
    if (!mac_alvo || !mac_alvo[0] || !payload) return;
    StaticJsonDocument<512> env;
    if (deserializeJson(env, payload) != DeserializationError::Ok) {
        Serial.println("[LORA-GW] payload MQTT invalido — descartado");
        return;
    }
    const char* cmd_id = env["cmd_id"] | "";

    // DEDUP (bug-fix): o backend re-publica o MESMO cmd_id a cada 5s (3x). Sem
    // esse guard, cada re-publish alocava um novo slot -> burst LoRa duplicado +
    // slot vazado. Se ja' temos esse cmd_id em voo, ignoramos o re-publish (a
    // retransmissao LoRa ja' e' gerida por lora_loop_tick).
    if (cmd_id[0] && _pending_find(cmd_id) >= 0) {
        Serial.printf("[LORA-GW] cmd_id=%s ja' em voo — re-publish MQTT ignorado\\n", cmd_id);
        return;
    }

    JsonVariantConst inner = env["cmd"];
    char inner_buf[300];
    if (inner.is<const char*>()) {
        snprintf(inner_buf, sizeof(inner_buf), "\\"%s\\"", inner.as<const char*>());
    } else if (inner.is<JsonObjectConst>()) {
        serializeJson(inner, inner_buf, sizeof(inner_buf));
    } else {
        snprintf(inner_buf, sizeof(inner_buf), "\\"\\"");
    }

    int idx = _pending_alloc();
    if (idx < 0) {
        Serial.println("[LORA-GW] pending queue cheia");
        if (cmd_id[0]) _publish_error_ack(mac_alvo, cmd_id, "gateway_queue_full", 0);
        return;
    }
    LoraPending& p = _loraPending[idx];
    p.in_use = true;
    strncpy(p.cmd_id, cmd_id, sizeof(p.cmd_id) - 1); p.cmd_id[sizeof(p.cmd_id) - 1] = 0;
    strncpy(p.target_mac, mac_alvo, sizeof(p.target_mac) - 1); p.target_mac[sizeof(p.target_mac) - 1] = 0;
    String myMac = WiFi.macAddress();
    // MULTI-HOP: 'to' = destino FINAL (mac_alvo). O "ttl" permite que nos
    // intermediarios repassem ate o satellite. Em 1-salto o satellite e' vizinho
    // direto: _lora_next_hop(mac_alvo) == mac_alvo, e o satellite ja' ve to==myMac.
    int n = snprintf(p.envelope, sizeof(p.envelope),
                     "{\\"to\\":\\"%s\\",\\"from\\":\\"%s\\",\\"cmd_id\\":\\"%s\\",\\"cmd\\":%s,\\"ttl\\":%d,\\"ts\\":%lu}",
                     mac_alvo, myMac.c_str(), cmd_id, inner_buf, LORA_DEFAULT_TTL, (unsigned long)(millis()/1000));
    if (n <= 0 || n >= (int)sizeof(p.envelope)) {
        Serial.println("[LORA-GW] envelope > buffer — descartado");
        _pending_release(idx);
        if (cmd_id[0]) _publish_error_ack(mac_alvo, cmd_id, "envelope_too_large", 0);
        return;
    }
    // Bug-fix MTU: checa o limite REAL do radio (200), nao so o buffer (400).
    // Comando entre 201-399B passava o guard mas era descartado por _lora_safe_send,
    // gerando um "lora_no_ack" enganoso 6s depois. Falha imediato com motivo certo.
    p.attempts = 1;
    p.last_sent_ms = millis();
    if (!_lora_safe_send(p.envelope)) {
        Serial.printf("[LORA-GW] envelope %dB > MTU %d — abortado\\n", n, LORA_MAX_PAYLOAD);
        _pending_release(idx);
        if (cmd_id[0]) _publish_error_ack(mac_alvo, cmd_id, "lora_mtu_exceeded", 0);
        return;
    }
    Serial.printf("[LORA-GW] TX#1 -> %s cmd_id=%s slot=%d (%d bytes)\\n", mac_alvo, cmd_id, idx, n);
}

// Quantos cmds estao em voo (pending queue). O orquestrador de poll so' POLLa
// quando o canal esta livre de comandos (comando tem prioridade).
static int _pending_count() {
    int n = 0;
    for (int i = 0; i < LORA_PENDING_MAX; i++) if (_loraPending[i].in_use) n++;
    return n;
}
${gwOrchestrate ? this._genGatewayOrchestrator(spec) : `
// Orquestrador de poll DESLIGADO (modo autonomo/fallback ou sem satelite com
// device). Stubs no-op pra manter a interface de lora_loop_tick uniforme.
static void _gw_poll_tick() {}
static bool _gw_poll_match(const char* req_id, const char* from) { (void)req_id; (void)from; return false; }
static void _poll_note_activity(const char* from) { (void)from; }
`}
// Tick periodico — chamado do loop() do main. Reenvia pendentes que estouraram
// timeout, e descarta os que esgotaram tentativas (publica ack de erro). Depois
// roda o orquestrador de poll (mestre-puxa), que so' transmite com o canal livre.
void lora_loop_tick() {
    unsigned long now = millis();
    for (int i = 0; i < LORA_PENDING_MAX; i++) {
        LoraPending& p = _loraPending[i];
        if (!p.in_use) continue;
        if (now - p.last_sent_ms < LORA_RETRY_TIMEOUT_MS) continue;
        if (p.attempts >= LORA_MAX_ATTEMPTS) {
            Serial.printf("[LORA-GW] FALHA cmd_id=%s -> %s apos %d tentativas\\n",
                          p.cmd_id, p.target_mac, p.attempts);
            _publish_error_ack(p.target_mac, p.cmd_id, "lora_no_ack", p.attempts);
            _pending_release(i);
        } else {
            p.attempts++;
            p.last_sent_ms = now;
            _lora_safe_send(p.envelope);
            Serial.printf("[LORA-GW] TX#%d -> %s cmd_id=%s (retry)\\n",
                          p.attempts, p.target_mac, p.cmd_id);
        }
    }
    // MESTRE-PUXA: orquestra o polling round-robin dos satelites. No-op no fallback.
    _gw_poll_tick();
}

// Decodifica frame "$B$" + Base64( type, version, from_mac[6], sublen, subtopic, payload ).
// Republica em <BASE>/satellite/<from_mac>/<subtopic> com JSON expandido.
// O subtopic vem DO frame (nao de tabela), entao casa o que o satellite emitiu.
static bool _lora_handle_binary(const char* raw, size_t raw_len) {
    if (raw_len < 4 || raw[0] != '$' || raw[1] != 'B' || raw[2] != '$') return false;

    uint8_t binbuf[200];
    int bin_len = _lora_b64_decode(raw + 3, raw_len - 3, binbuf, sizeof(binbuf));
    if (bin_len < 9) {
        Serial.println("[LORA-GW] BIN: b64 decode falhou ou < header");
        return true;  // foi reconhecido como binario, so descartado
    }

    uint8_t type_code = binbuf[0];
    uint8_t version = binbuf[1];
    uint8_t from_bytes[6];
    memcpy(from_bytes, &binbuf[2], 6);
    uint8_t sublen = binbuf[8];
    if (9 + (int)sublen > bin_len || sublen >= LORA_SUBTOPIC_MAX) {
        Serial.printf("[LORA-GW] BIN: sublen invalido (%u)\\n", sublen);
        return true;
    }
    char subtopic[LORA_SUBTOPIC_MAX + 1];
    memcpy(subtopic, &binbuf[9], sublen);
    subtopic[sublen] = 0;
    int payload_off = 9 + (int)sublen;

    const LoraFieldSet* fs = _lora_fieldset_for_type(type_code, version);
    if (!fs) {
        Serial.printf("[LORA-GW] BIN: field-set desconhecido type=0x%02X v%d\\n", type_code, version);
        return true;
    }

    StaticJsonDocument<512> doc;
    int consumed = _lora_unpack_fields(fs->fields, &binbuf[payload_off], bin_len - payload_off, doc);
    if (consumed < 0) {
        Serial.println("[LORA-GW] BIN: unpack underflow");
        return true;
    }

    char from_str[20];
    _lora_mac_bytes_to_str(from_bytes, from_str);
    _poll_note_activity(from_str);  // frame do alvo -> estende a janela do poll

    // CARIMBO de hora no GATEWAY: o satelite nao tem internet/NTP e o frame binario
    // nao carrega timestamp. Como o gateway TEM hora (NTP) e o dado e' fresco (acabou
    // de ser lido sob POLL), carimba aqui com a hora do gateway (epoch s). So' se o
    // relogio ja' sincronizou (senao deixa sem -> backend usa a hora de chegada).
    {
        time_t _tnow = time(nullptr);
        if (_tnow > 1700000000) doc["timestamp"] = (long)_tnow;
    }

    char topic[220];
    snprintf(topic, sizeof(topic), "%s/satellite/%s/%s",
             MQTT_TOPIC_BASE, from_str, subtopic);
    char json_buf[600];
    size_t n = serializeJson(doc, json_buf, sizeof(json_buf));
    if (n > 0) {
        Serial.printf("[LORA-GW] BIN rx type=0x%02X from=%s -> %s (%uB JSON)\\n",
                      type_code, from_str, topic, (unsigned)n);
        mqtt_publish_raw(topic, json_buf);
    }
    return true;
}

static void lora_handle_rx(const char* raw) {
    if (!raw || !*raw) return;
    size_t raw_len = strlen(raw);

    // Detecta frame binario antes do JSON (prefixo "$B$").
    if (_lora_handle_binary(raw, raw_len)) return;

    if (raw[0] != '{') return;
    StaticJsonDocument<700> env;
    if (deserializeJson(env, raw) != DeserializationError::Ok) {
        Serial.println("[LORA-GW] JSON invalido");
        return;
    }
    const char* to = env["to"] | "";
    const char* from = env["from"] | "";
    String myMac = WiFi.macAddress();
    // Aceita frames endereçados a mim OU broadcast "*". Satellites enviam
    // heartbeat/telemetria pra "*" ANTES de descobrir o MAC do gateway (so'
    // aprendem ao receber o 1o comando). Sem aceitar "*", o heartbeat de um
    // satellite recem-ligado nunca chegava -> o MAC dele nunca aparecia no
    // broker -> impossivel cadastrar. Aceitando "*", o satellite aparece online
    // assim que liga, revelando o MAC pra cadastro.
    bool isBroadcast = (to[0] == '*' && to[1] == 0);
    bool forMe = _lora_mac_eq(to, myMac.c_str());
    // MULTI-HOP: envelope endereçado a OUTRO no (nem eu nem broadcast). Repassa
    // em direcao ao destino FINAL (defined-path). Dedup por cmd_id + TTL evitam
    // loop. 1-salto e broadcast "*" NAO caem aqui. (Frames binarios "$B$" sao
    // 1-salto e ja' foram tratados acima — multi-hop so' vale p/ envelope JSON.)
    if (!isBroadcast && !forMe) {
        const char* cmd_id = env["cmd_id"] | "";
        if (cmd_id[0] && _sat_seen_or_add(cmd_id, env["type"] | "", from)) return;  // ja' repassado -> descarta
        int ttl = env["ttl"] | 0;
        if (ttl <= 0) return;
        const char* nh = _lora_next_hop(to);
        if (!nh || !nh[0] || _lora_mac_eq(nh, myMac.c_str())) return;
        Serial.printf("[LORA-GW] FORWARD to=%s nh=%s ttl=%d->%d\\n", to, nh, ttl, ttl - 1);
        _lora_forward(env, ttl - 1);
        return;
    }
    if (!from[0]) {
        Serial.println("[LORA-GW] envelope sem 'from' — descartado");
        return;
    }
    _poll_note_activity(from);  // frame do alvo (pollresp/data/status) -> estende a janela

    const char* type = env["type"] | "";

    // MESTRE-PUXA: resposta de conclusao do POLL. O satellite ja' mandou a
    // telemetria em envelopes "data" (republicados acima/abaixo); este "pollresp"
    // so' diz "terminei, req_id=X". O orquestrador casa pelo req_id (ignora se nao
    // estava esperando esse req_id) e avanca pro proximo satellite. No fallback
    // autonomo _gw_poll_match e' stub (retorna false) -> cai e e' ignorado.
    if (strcmp(type, "pollresp") == 0) {
        const char* req_id = env["cmd_id"] | "";
        if (_gw_poll_match(req_id, from)) {
            Serial.printf("[LORA-GW] POLLRESP req_id=%s de %s — satellite respondeu, avancando\\n",
                          req_id, from);
        } else {
            Serial.printf("[LORA-GW] POLLRESP req_id=%s de %s ignorado (nao esperado)\\n",
                          req_id, from);
        }
        return;
    }

    // ACK do satellite — libera pendente e publica em <BASE>/satellite/<from>/cmd/ack
    if (!type[0] || strcmp(type, "ack") == 0) {
        const char* cmd_id = env["cmd_id"] | "";
        int idx = _pending_find(cmd_id);
        if (idx >= 0) {
            Serial.printf("[LORA-GW] ACK recebido cmd_id=%s slot=%d apos %d tentativas\\n",
                          cmd_id, idx, _loraPending[idx].attempts);
            _pending_release(idx);
        }
        char topic[200];
        snprintf(topic, sizeof(topic), "%s/satellite/%s/cmd/ack", MQTT_TOPIC_BASE, from);
        char ack_buf[400];
        const char* status = env["status"] | "ok";
        const char* msg = env["msg"] | "";
        unsigned long ts = env["ts"] | 0UL;
        snprintf(ack_buf, sizeof(ack_buf),
                 "{\\"cmd_id\\":\\"%s\\",\\"status\\":\\"%s\\",\\"msg\\":\\"%s\\",\\"ts\\":%lu}",
                 cmd_id, status, msg, ts);
        mqtt_publish_raw(topic, ack_buf);
        return;
    }

    // Telemetria — re-publica em <BASE>/satellite/<from>/<subtopic>
    if (strcmp(type, "data") == 0) {
        const char* subtopic = env["subtopic"] | "";
        if (!subtopic[0]) return;
        char topic[200];
        snprintf(topic, sizeof(topic), "%s/satellite/%s/%s", MQTT_TOPIC_BASE, from, subtopic);
        char payload_buf[600];
        JsonVariant payload = env["payload"];  // mutavel (env nao e' const) p/ carimbar a hora
        if (payload.isNull()) return;
        // CARIMBO de hora no gateway (mesmo motivo do binario): so' se sincronizou e
        // se o payload e' objeto. Sobrescreve um "timestamp":0 que o satelite mande.
        {
            time_t _tnow = time(nullptr);
            if (_tnow > 1700000000 && payload.is<JsonObject>()) payload["timestamp"] = (long)_tnow;
        }
        size_t n = serializeJson(payload, payload_buf, sizeof(payload_buf));
        if (n > 0) mqtt_publish_raw(topic, payload_buf);
        return;
    }

    // Heartbeat/status do satellite — publica em <BASE>/satellite/<from>/status (retain)
    if (strcmp(type, "status") == 0) {
        JsonVariantConst payload = env["payload"];
        ${gwOrchestrate ? `// DESCOBERTA DINAMICA: satelite que anuncia "poll":1 com MAC novo
        // entra na fila de polling (sem precisar do MAC no diagrama).
        if (!payload.isNull() && ((payload["poll"] | 0) == 1)) _poll_add(from, "");
        ` : ``}char topic[200];
        snprintf(topic, sizeof(topic), "%s/satellite/%s/status", MQTT_TOPIC_BASE, from);
        char status_buf[400];
        if (payload.isNull()) {
            // Sem payload aninhado: re-serializa envelope inteiro
            size_t n = serializeJson(env, status_buf, sizeof(status_buf));
            if (n > 0) mqtt_publish_raw(topic, status_buf);
        } else {
            size_t n = serializeJson(payload, status_buf, sizeof(status_buf));
            if (n > 0) mqtt_publish_raw(topic, status_buf);
        }
        return;
    }
}
`;
        } else {
            // Modo legado: TX simples sem roteamento, mantém comportamento antigo.
            cpp += `
// Modo legacy: trata payload LoRa como comando local direto.
static void lora_handle_rx(const char* raw) {
    if (!raw || !*raw) return;
    process_command(raw);
}
`;
        }
        return cpp;
    }

    // ============================================================
    // MESTRE-PUXA — Orquestrador de polling do GATEWAY.
    // ----------------------------------------------------------------
    // Gera a tabela de satelites a pollar (do grafo, via spec.poll_targets) + a
    // maquina de estados round-robin: envia POLL(req_id) pra UM satelite por vez,
    // espera POLLRESP(req_id) ate POLL_TIMEOUT_MS, casa pelo req_id, republica o
    // que chegou (os "data" ja' foram tratados em lora_handle_rx) e avanca. Apos
    // POLL_MAX_TIMEOUTS seguidos marca o satelite offline e segue. So' um satelite
    // transmite por vez -> sem colisao. O POLL roteia pela malha (to=mac + ttl).
    // O orquestrador so' transmite com o canal de COMANDO livre (_pending_count==0):
    // comando tem prioridade. Os 3s de timeout ja' cobrem os saltos multi-hop.
    // ============================================================
    _genGatewayOrchestrator(spec) {
        const cEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const targets = spec.poll_targets || [];
        const seedCalls = targets.map(t =>
            `    _poll_add("${cEsc(t.mac)}", "${cEsc(t.name || '')}");`).join('\n');
        return `
// ===== MESTRE-PUXA: orquestrador de polling (round-robin, alvos DINAMICOS) =====
#define POLL_TIMEOUT_MS    10000UL  // janela de espera por POLLRESP. Cobre a resposta
                                     // COMPLETA do satelite: leitura + N frames de
                                     // telemetria (1 por device) + pollresp, cada um
                                     // com airtime LoRa + CSMA (~1.7s/frame medido).
                                     // _poll_note_activity ESTENDE a cada frame do alvo,
                                     // entao o timeout so' dispara se o satelite ficar
                                     // MUDO por 10s (morto), nao por demorar a terminar.
#define POLL_MAX_TIMEOUTS  3        // N timeouts seguidos -> marca satelite offline
#define POLL_GAP_MS        200UL    // respiro entre o fim de um poll e o proximo TX
#define POLL_MIN_INTERVAL_MS 60000UL // cadencia minima por alvo (casa com PUBLISH_INTERVAL_MS):
                                     // o satelite zera o acumulador a cada POLL, entao espacar
                                     // os polls garante uma janela cheia de amostras (METER_CYCLE_MS)
                                     // e media com a MESMA qualidade do push antigo.
#define POLL_MAX_TARGETS   16        // teto de satelites polláveis (diagrama + descobertos)

// Lista de alvos MUTAVEL: semeada pelos alvos do diagrama (se houver) e CRESCE
// com descoberta dinamica (heartbeat "poll":1).
typedef struct { char mac[20]; char name[24]; } PollTarget;
static PollTarget    _poll_targets[POLL_MAX_TARGETS];
static int           _poll_n = 0;     // alvos ativos

static int  _poll_idx      = -1;      // indice do satelite POLLado por ultimo
static bool _poll_waiting  = false;   // true enquanto espera POLLRESP
static char _poll_req_id[16] = {0};   // req_id do POLL em voo
static unsigned long _poll_deadline = 0;
static unsigned long _poll_next_ms  = 0;
static uint32_t _poll_seq   = 0;
static uint8_t  _poll_timeouts[POLL_MAX_TARGETS];  // timeouts seguidos por satelite
static bool     _poll_online[POLL_MAX_TARGETS];    // estado de presenca conhecido
static unsigned long _poll_last_ms[POLL_MAX_TARGETS]; // millis do ultimo POLL (0=nunca)

// Adiciona um alvo (se novo e ha espaco). Semeia o diagrama E a descoberta
// dinamica: ao ouvir o heartbeat de um satelite pollável (status "poll":1) com
// MAC novo, o gateway passa a pollá-lo — sem precisar do MAC no diagrama (como o
// push antigo, que aprendia o 'from' em runtime). Retorna true se adicionou.
static bool _poll_add(const char* mac, const char* name) {
    if (!mac || !mac[0]) return false;
    for (int i = 0; i < _poll_n; i++)
        if (_lora_mac_eq(_poll_targets[i].mac, mac)) return false;  // ja' na lista
    if (_poll_n >= POLL_MAX_TARGETS) { Serial.println("[LORA-GW] poll: lista cheia"); return false; }
    strncpy(_poll_targets[_poll_n].mac, mac, sizeof(_poll_targets[0].mac) - 1);
    _poll_targets[_poll_n].mac[sizeof(_poll_targets[0].mac) - 1] = 0;
    strncpy(_poll_targets[_poll_n].name, (name && name[0]) ? name : mac, sizeof(_poll_targets[0].name) - 1);
    _poll_targets[_poll_n].name[sizeof(_poll_targets[0].name) - 1] = 0;
    _poll_timeouts[_poll_n] = 0; _poll_online[_poll_n] = false; _poll_last_ms[_poll_n] = 0;
    Serial.printf("[LORA-GW] alvo de poll +%s (%s) total=%d\\n",
                  mac, _poll_targets[_poll_n].name, _poll_n + 1);
    _poll_n++;
    return true;
}

// Semeia os alvos vindos do DIAGRAMA (pode ser 0 — descoberta dinamica supre).
static void _poll_seed_init() {
${seedCalls}
}

// Publica presenca do satelite (online/offline) em <BASE>/satellite/<mac>/status.
static void _poll_publish_presence(int idx, bool online) {
    char topic[200];
    snprintf(topic, sizeof(topic), "%s/satellite/%s/status", MQTT_TOPIC_BASE, _poll_targets[idx].mac);
    char buf[200];
    snprintf(buf, sizeof(buf),
             "{\\"online\\":%s,\\"source\\":\\"poll\\",\\"ts\\":%lu}",
             online ? "true" : "false", (unsigned long)(millis()/1000));
    mqtt_publish_raw(topic, buf);
}

// Monta e envia o POLL pro satelite idx. 'to' = MAC final; roteia pela malha
// (_lora_next_hop + ttl). req_id curto ("p<seq>") correlaciona a resposta.
static void _poll_send(int idx) {
    snprintf(_poll_req_id, sizeof(_poll_req_id), "p%lu", (unsigned long)(++_poll_seq));
    String myMac = WiFi.macAddress();
    char env[200];
    int n = snprintf(env, sizeof(env),
        "{\\"to\\":\\"%s\\",\\"from\\":\\"%s\\",\\"cmd_id\\":\\"%s\\",\\"type\\":\\"poll\\",\\"ttl\\":%d,\\"ts\\":%lu}",
        _poll_targets[idx].mac, myMac.c_str(), _poll_req_id, LORA_DEFAULT_TTL,
        (unsigned long)(millis()/1000));
    if (n <= 0 || n >= (int)sizeof(env)) { Serial.println("[LORA-GW] POLL envelope overflow"); return; }
    // Semeia o proprio POLL no dedup (chave cmd_id|type): se uma repetidora
    // re-emitir este POLL e o gateway ouvir de volta, o forward reconhece como
    // ja' visto e NAO re-repassa o proprio POLL (evita TX duplicado na malha).
    _sat_seen_or_add(_poll_req_id, "poll", myMac.c_str());
    Serial.printf("[LORA-GW] POLL -> %s (%s) req_id=%s\\n",
                  _poll_targets[idx].mac, _poll_targets[idx].name, _poll_req_id);
    // So' abre a janela de espera se o CSMA REALMENTE transmitiu. Se o canal
    // estava ocupado/overflow, _lora_safe_send devolve false: nao adianta esperar
    // POLLRESP de um POLL que nem saiu — agenda o proximo apos o respiro.
    if (_lora_safe_send(env)) {
        _poll_waiting  = true;
        _poll_deadline = millis() + POLL_TIMEOUT_MS;
        _poll_last_ms[idx] = millis();  // marca a cadencia so' quando o POLL saiu de fato
    } else {
        _poll_next_ms = millis() + POLL_GAP_MS;
    }
}

// Casa um POLLRESP recebido com o POLL em voo. So' aceita se: estamos esperando,
// o req_id bate E o 'from' e' o satelite que estamos pollando (ignora o resto).
// Em match: marca online, zera timeouts, libera a janela e agenda o proximo.
static bool _gw_poll_match(const char* req_id, const char* from) {
    if (!_poll_waiting || _poll_idx < 0 || _poll_idx >= _poll_n) return false;
    if (!req_id || !req_id[0] || strcmp(req_id, _poll_req_id) != 0) return false;
    if (!_lora_mac_eq(from, _poll_targets[_poll_idx].mac)) return false;  // resposta de outro no
    if (!_poll_online[_poll_idx]) {
        _poll_online[_poll_idx] = true;
        _poll_publish_presence(_poll_idx, true);
        Serial.printf("[LORA-GW] %s ONLINE (poll)\\n", _poll_targets[_poll_idx].mac);
    }
    _poll_timeouts[_poll_idx] = 0;
    _poll_waiting = false;
    _poll_next_ms = millis() + POLL_GAP_MS;  // respira antes do proximo TX
    return true;
}

// Qualquer frame recebido DO satelite que estamos pollando (data binario/JSON,
// status) prova que ele esta vivo e respondendo -> ESTENDE a janela de espera.
// Assim uma resposta multi-frame (varios devices) ou cold-start lento NAO dispara
// timeout falso: o timeout so' vale se o alvo ficar MUDO por POLL_TIMEOUT_MS.
static void _poll_note_activity(const char* from) {
    if (!_poll_waiting || _poll_idx < 0 || _poll_idx >= _poll_n) return;
    if (from && from[0] && _lora_mac_eq(from, _poll_targets[_poll_idx].mac))
        _poll_deadline = millis() + POLL_TIMEOUT_MS;
}

// Tick do orquestrador (chamado de lora_loop_tick). Avanca a maquina round-robin.
static void _gw_poll_tick() {
    static bool _seeded = false;
    if (!_seeded) { _seeded = true; _poll_seed_init(); }  // alvos do diagrama (1x)
    if (_poll_n <= 0) return;  // sem alvos ainda (nem diagrama nem descoberto) -> idle
    unsigned long now = millis();
    // Comando tem prioridade: nao POLLa enquanto ha cmd em voo (evita colisao no
    // canal half-duplex). O retry do cmd ja' e' gerido acima no lora_loop_tick.
    if (_pending_count() > 0) return;

    if (_poll_waiting) {
        if ((long)(now - _poll_deadline) < 0) return;  // ainda dentro da janela
        // TIMEOUT: nenhum POLLRESP casou em POLL_TIMEOUT_MS.
        if (_poll_idx >= 0 && _poll_idx < _poll_n) {
            if (_poll_timeouts[_poll_idx] < 255) _poll_timeouts[_poll_idx]++;
            Serial.printf("[LORA-GW] POLL timeout %s (%u/%d) req_id=%s\\n",
                          _poll_targets[_poll_idx].mac, _poll_timeouts[_poll_idx],
                          POLL_MAX_TIMEOUTS, _poll_req_id);
            if (_poll_timeouts[_poll_idx] >= POLL_MAX_TIMEOUTS && _poll_online[_poll_idx]) {
                _poll_online[_poll_idx] = false;
                _poll_publish_presence(_poll_idx, false);
                Serial.printf("[LORA-GW] %s OFFLINE apos %d timeouts\\n",
                              _poll_targets[_poll_idx].mac, POLL_MAX_TIMEOUTS);
            }
        }
        _poll_waiting = false;
        _poll_next_ms = now + POLL_GAP_MS;
        return;
    }

    // Canal livre e nao esperando: agenda o proximo satelite (round-robin).
    if ((long)(now - _poll_next_ms) < 0) return;  // respiro entre polls
    // Cadencia minima por alvo: nao re-POLLa um satelite antes de POLL_MIN_INTERVAL_MS
    // (ele precisa acumular uma janela de amostras entre respostas — senao a media
    // degrada). Espera estrita pelo proximo da fila: como todos foram pollados em
    // sequencia, ficam "vencidos" por volta do mesmo instante.
    int _next = (_poll_idx + 1) % _poll_n;
    if (_poll_last_ms[_next] != 0 && (long)(now - _poll_last_ms[_next]) < (long)POLL_MIN_INTERVAL_MS) return;
    _poll_idx = _next;
    _poll_send(_poll_idx);
}
`;
    }

    // ============================================================
    // Modbus dinâmico — gerado a partir de DEVICE_MODELS do catálogo.
    // Suporta: func 0x03 (holding), 0x04 (input), 0x01 (coils), 0x05 (write coil).
    // DataTypes: U16, S16, U32, S32, COSFI, U32_SUM3 (Pextron).
    // ============================================================

    _genModbusH(spec) {
        return `#ifndef MODBUS_METER_H
#define MODBUS_METER_H
#include <stdint.h>

typedef void (*modbus_publish_fn)(const char* subtopic, const char* payload);

void modbus_init();

// Acumulacao + media. Chamar a cada READ_INTERVAL_MS (round-robin 1 device por call)
// Internamente cicla entre os devices.
void modbus_sample_one();

// Publica medias acumuladas e reseta contadores. Chamar a cada PUBLISH_INTERVAL_MS.
void modbus_publish_all(modbus_publish_fn publish);

// Wrapper legado: faz sample de todos e publica imediatamente (sem media).
void modbus_read_all(modbus_publish_fn publish);

// SOE: drena a fila de eventos dos devices que expoem buffer (chave 'eventos' no catalogo).
// Publica cada evento CRU no subtopico "evt". Chamar a cada EVT_POLL_MS.
void modbus_events_poll(modbus_publish_fn publish);

// Executa comando BO (write coil). device_name do catalogo, cmd_id conforme bo_map.
bool modbus_exec_command(const char* device_name, const char* cmd_id);

#endif
`;
    }

    _genModbusCpp(spec) {
        const devs = (spec.rs485_devices || []).filter(d => d.catalog_device);

        let cpp = `#include "modbus_meter.h"
#include "hal.h"
#include "config.h"
#include "diag.h"
#include "mqtt.h"   // mqtt_loop() chamado entre blocos pra nao bloquear keepalive
#include <ModbusMaster.h>
#include <ArduinoJson.h>
#include <string.h>
#include <math.h>
#include <time.h>

static ModbusMaster _mb;
static HardwareSerial _rs485(RS485_UART_NUM);

// NOTA: ModbusMaster usa ku16MBResponseTimeout = 2000ms como static const compilada
// na lib — nao expoe setter runtime. Timeout fica em 2s (folgado pra Sungrow).
// Refator pra ajustar exige trocar a lib (ex: eModbus) — fora deste escopo.

// preTx: garante TX anterior 100% drenado (flush) antes de comutar DE/RE pra TX.
// Sem o flush, bytes do envio anterior ainda no shift register UART podem ecoar
// pelo RX e o ModbusMaster os interpreta como inicio de resposta -> rc=0xE0
// (ku8MBInvalidSlaveID). Delay de 1ms (vs 500us anterior) e' folga pro driver
// MAX485 — necessario em variantes com optoacoplador/isolacao.
static void _preTx()  {
    _rs485.flush();
    digitalWrite(RS485_DIR, HIGH);
    delayMicroseconds(1000);
}
// postTx: mantem TX habilitado por 1ms apos enviar pra ultimo bit nao ser truncado,
// depois libera linha pro slave responder.
static void _postTx() {
    delayMicroseconds(1000);
    digitalWrite(RS485_DIR, LOW);
}

// _select: prepara a proxima transacao Modbus.
// CRITICO: drena buffer RX antes de cada nova requisicao. Bytes residuais (eco
// de transacao anterior OU resposta atrasada de outro slave no barramento)
// contaminam o frame proximo. Sem drain, ModbusMaster ve o byte residual como
// slave ID da resposta e retorna 0xE0 mesmo com o frame real chegando depois.
static inline void _select(uint8_t addr) {
    while (_rs485.available()) _rs485.read();
    _mb.begin(addr, _rs485);
    _mb.preTransmission(_preTx);
    _mb.postTransmission(_postTx);
}

// Decodifica 2 regs 16-bit como IEEE 754 float (32-bit). Usado por dataType='FLOAT'.
static inline float _u32_to_float(uint16_t hi, uint16_t lo) {
    uint32_t u = ((uint32_t)hi << 16) | (uint32_t)lo;
    float f;
    memcpy(&f, &u, sizeof(float));
    return f;
}

// 10^e por inteiro (e pode ser negativo). Evita pull de powf; deterministico em FPU/no-FPU.
static inline float _pow10i(int e){ float r=1.0f; if(e>=0){ for(int i=0;i<e;i++) r*=10.0f; } else { for(int i=0;i<-e;i++) r/=10.0f; } return r; }

// Timestamp formatado "DD/MM/YYYY HH:MM:SS" no timezone local (configurado via configTime).
// Fallback "0" (epoch zero) se o relogio nao estiver sincronizado.
static String _format_timestamp_str() {
    time_t now = time(nullptr);
    if (now < 1700000000) return String("0");
    struct tm* t = localtime(&now);
    char buf[24];
    sprintf(buf, "%02d/%02d/%04d %02d:%02d:%02d",
            t->tm_mday, t->tm_mon + 1, t->tm_year + 1900,
            t->tm_hour, t->tm_min, t->tm_sec);
    return String(buf);
}

// Mapeia codigo de work_state Sungrow -> texto (mesmo do UFV-SOLAR_POWER)
static const char* _work_state_text(uint16_t s) {
    switch (s) {
        case 0x0000: return "Run";
        case 0x8000: return "Stop";
        case 0x1300: return "Key Stop";
        case 0x1500: return "Emergency Stop";
        case 0x1400: return "Standby";
        case 0x1200: return "Initial Standby";
        case 0x1600: return "Starting";
        case 0x9100: return "Alarm Run";
        case 0x8100: return "Derating Run";
        case 0x8200: return "Dispatch Run";
        case 0x5500: return "Fault";
        case 0x2500: return "Communication Fault";
        case 0x1111: return "Uninitialized";
        default:     return "Unknown";
    }
}

void modbus_init() {
    pinMode(RS485_DIR, OUTPUT);
    digitalWrite(RS485_DIR, LOW);
    _rs485.begin(RS485_BAUD, RS485_CONFIG, UART1_RX, UART1_TX);
    Serial.printf("[RS485] TX=%d RX=%d DIR=%d %d baud\\n",
                  UART1_TX, UART1_RX, RS485_DIR, RS485_BAUD);
}

`;

        if (devs.length === 0) {
            cpp += `void modbus_sample_one() {}
void modbus_publish_all(modbus_publish_fn) {}
void modbus_read_all(modbus_publish_fn) {}
void modbus_events_poll(modbus_publish_fn) {}
bool modbus_exec_command(const char*, const char*) { return false; }
`;
            return cpp;
        }

        // Um bloco de codigo por device (+ poll de evento, se o catalogo expuser buffer)
        devs.forEach((dev, idx) => {
            cpp += this._genDeviceReader(dev, idx);
            cpp += this._genDeviceEventPoll(dev, idx);
        });

        // Round-robin sample: 1 device por chamada
        cpp += `
static int _rr_idx = 0;
static const int _dev_count = ${devs.length};

void modbus_sample_one() {
    switch (_rr_idx) {
`;
        devs.forEach((_, idx) => {
            cpp += `        case ${idx}: _sample_dev_${idx}(); break;\n`;
        });
        cpp += `    }
    _rr_idx = (_rr_idx + 1) % _dev_count;
}

void modbus_publish_all(modbus_publish_fn publish) {
    if (!publish) return;
`;
        devs.forEach((_, idx) => {
            cpp += `    _publish_dev_${idx}(publish);\n`;
        });
        cpp += `}

// Legado: sample todos + publica (sem media)
void modbus_read_all(modbus_publish_fn publish) {
    if (!publish) return;
`;
        devs.forEach((_, idx) => {
            cpp += `    _sample_dev_${idx}();\n    _publish_dev_${idx}(publish);\n`;
        });
        cpp += `}

// SOE: drena a fila de eventos de cada device que tem buffer no catalogo.
void modbus_events_poll(modbus_publish_fn publish) {
    if (!publish) return;
`;
        devs.forEach((dev, idx) => {
            if (dev.catalog_device && dev.catalog_device.eventos) {
                cpp += `    _evt_poll_dev_${idx}(publish);\n`;
            }
        });
        cpp += `}

bool modbus_exec_command(const char* device_name, const char* cmd_id) {
    if (!device_name || !cmd_id) return false;
`;
        devs.forEach((dev) => {
            const bo = (dev.catalog_device && dev.catalog_device.bo_map) || {};
            const cmds = Object.entries(bo);
            if (cmds.length === 0) return;
            cpp += `    if (strcmp(device_name, "${this._escStr(dev.name)}") == 0) {\n`;
            cpp += `        _select(${dev.modbus_address});\n`;
            // Handshake PRE-COMANDO. Relés DNP3 com auto-reconhecimento Modbus (ex: URP6000)
            // só respondem em Modbus logo após uma leitura do registro de identificação. O
            // caminho de leitura (_read_dev_*) já faz isso todo ciclo — por isso a LEITURA
            // funciona; o comando pulava e caía fora da janela Modbus (write timeout → FAIL).
            // Espelhar aqui torna o comando tão confiável quanto a leitura.
            {
                const hsCmd = dev.catalog_device && dev.catalog_device.handshake;
                if (hsCmd) {
                    const hfn = hsCmd.func === 0x04 ? 'readInputRegisters' : 'readHoldingRegisters';
                    cpp += `        _mb.${hfn}(${hsCmd.register}, ${hsCmd.count}); delay(30);  // handshake auto-Modbus\n`;
                    cpp += `        while (_rs485.available()) _rs485.read();  // drena eco do handshake\n`;
                }
            }
            // Helper: emite UMA chamada Modbus pra um "step" do bo_map
            // Step pode ser:
            //   { func: 0x05, coil: NNN }          -> writeSingleCoil
            //   { func: 0x06, register: NNN, value: V } -> writeSingleRegister
            //   { func: 0x0F, addr: NNN, count: C, value: V } -> writeMultipleCoils
            //       (DPC double-bit, ex: CB-1 do 7SR5: value 1=Off/abre, 2=On/fecha;
            //        bits vao no transmit buffer, LSB = primeiro coil)
            // Retorna o trecho cpp com "if (!_mb.writeXxx(...)) return false;"
            const emitStep = (step) => {
                const sFunc = step.func || 0x06;
                if (sFunc === 0x05) {
                    if (step.coil === undefined) {
                        console.warn(`[gen] step func 0x05 exige 'coil'`);
                        return null;
                    }
                    // value 0 => desliga a coil (FC05 off); ausente/1 => liga (compat byte-identica).
                    const on = (step.value === 0 || step.value === false) ? 'false' : 'true';
                    return `            if (_mb.writeSingleCoil(${step.coil}, ${on}) != _mb.ku8MBSuccess) return false;\n`;
                } else if (sFunc === 0x06) {
                    if (step.register === undefined) {
                        console.warn(`[gen] step func 0x06 exige 'register'`);
                        return null;
                    }
                    const v = (step.value !== undefined) ? step.value : 1;
                    return `            if (_mb.writeSingleRegister(${step.register}, ${v}) != _mb.ku8MBSuccess) return false;\n`;
                } else if (sFunc === 0x0F) {
                    if (step.addr === undefined) {
                        console.warn(`[gen] step func 0x0F exige 'addr'`);
                        return null;
                    }
                    const cnt = Number(step.count) || 2;
                    const bits = Number(step.value) || 1;
                    return `            _mb.setTransmitBuffer(0, ${bits});\n`
                         + `            if (_mb.writeMultipleCoils(${step.addr}, ${cnt}) != _mb.ku8MBSuccess) return false;\n`;
                }
                console.warn(`[gen] step func 0x${sFunc.toString(16)} nao suportada`);
                return null;
            };

            cmds.forEach(([cid, m]) => {
                // Caso 1: comando composto (multi-write sequencial). Usado por padroes
                // industriais Select-Before-Operate (SBO) — ex: Schneider P3 Object control,
                // que exige 2 writes (Select + Execute) pra disparar trip/close.
                // Formato: { steps: [ {func, ...}, {func, ...} ], delay_ms: 50 }
                if (Array.isArray(m.steps)) {
                    cpp += `        if (strcmp(cmd_id, "${this._escStr(cid)}") == 0) {\n`;
                    const delayMs = m.delay_ms || 0;
                    let validSteps = 0;
                    m.steps.forEach((step, idx) => {
                        if (idx > 0 && delayMs > 0) {
                            cpp += `            delay(${delayMs});\n`;
                        }
                        const line = emitStep(step);
                        if (line) { cpp += line; validSteps++; }
                    });
                    if (validSteps > 0) {
                        cpp += `            return true;\n`;
                    } else {
                        cpp += `            return false;  // nenhum step valido\n`;
                    }
                    cpp += `        }\n`;
                    return;
                }

                // Caso 2: comando simples (1 write). Formato legado.
                const func = m.func || 0x05;
                if (func === 0x05) {
                    // Write Single Coil. Sem coil = placeholder do catálogo (comando não
                    // vinculado a BO nessa instância) — pula (o vínculo é no editor IoT).
                    if (m.coil == null) {
                        console.warn(`[gen] bo_map ${cid}: sem coil (comando não vinculado a BO) — skip`);
                        return;
                    }
                    cpp += `        if (strcmp(cmd_id, "${this._escStr(cid)}") == 0) {\n`;
                    cpp += `            uint8_t rc = _mb.writeSingleCoil(${m.coil}, true);\n`;
                    cpp += `            if (rc != _mb.ku8MBSuccess) { delay(40); while (_rs485.available()) _rs485.read(); rc = _mb.writeSingleCoil(${m.coil}, true); }\n`;
                    // Coil de COMANDO por pulso (ex: URP6000 abre/fecha/reset): o relé arma na
                    // BORDA 0->1. Se a coil ficar em 1, o próximo comando não gera borda nova e
                    // nada acontece (e um 1 pendente dispara sozinho ao sair de LOCAL->REMOTO).
                    // Escrever 0 depois REARMA a coil. `hold:true` no cadastro desliga isso
                    // (coil de ESTADO, ex: acionar RL direto, que deve permanecer).
                    // rearm_ms: tempo coil=1 antes do 0 (default 3000; override por entrada).
                    // Em relés DNP3+auto-Modbus a saída segue o nível da coil até o teto
                    // T S TIME — o rearm_ms define na prática a duração do pulso físico.
                    // O write(0) é CRÍTICO (0 perdido = coil travada = bug de volta): re-faz o
                    // handshake (janela auto-Modbus pode expirar durante o delay) e tem retry.
                    if (m.hold !== true) {
                        const rearmMs = Number(m.rearm_ms) > 0 ? Number(m.rearm_ms) : 3000;
                        cpp += `            delay(${rearmMs});\n`;
                        const hsR = dev.catalog_device && dev.catalog_device.handshake;
                        if (hsR) {
                            const hfnR = hsR.func === 0x04 ? 'readInputRegisters' : 'readHoldingRegisters';
                            cpp += `            _mb.${hfnR}(${hsR.register}, ${hsR.count}); delay(30);\n`;
                            cpp += `            while (_rs485.available()) _rs485.read();\n`;
                        }
                        cpp += `            if (_mb.writeSingleCoil(${m.coil}, false) != _mb.ku8MBSuccess) {  // rearma coil de pulso\n`;
                        cpp += `                delay(40); while (_rs485.available()) _rs485.read();\n`;
                        cpp += `                _mb.writeSingleCoil(${m.coil}, false);\n`;
                        cpp += `            }\n`;
                    }
                    cpp += `            return rc == _mb.ku8MBSuccess;\n`;
                    cpp += `        }\n`;
                } else if (func === 0x06) {
                    // Write Single Register — Schneider via VI ou registro de comando direto
                    if (m.register === undefined) {
                        console.warn(`[gen] bo_map ${cid}: func 0x06 exige 'register' (cadastro do ${dev.name})`);
                        return;
                    }
                    const value = (m.value !== undefined) ? m.value : 1;
                    cpp += `        if (strcmp(cmd_id, "${this._escStr(cid)}") == 0) {\n`;
                    cpp += `            return _mb.writeSingleRegister(${m.register}, ${value}) == _mb.ku8MBSuccess;\n`;
                    cpp += `        }\n`;
                } else if (func === 0x0F) {
                    // Write Multiple Coils — DPC double-bit (CB-1 do 7SR5):
                    // value 1 = Off (bits 01, ABRE) | 2 = On (bits 10, FECHA).
                    if (m.addr === undefined) {
                        console.warn(`[gen] bo_map ${cid}: func 0x0F exige 'addr' (cadastro do ${dev.name})`);
                        return;
                    }
                    const cnt = Number(m.count) || 2;
                    const bits = Number(m.value) || 1;
                    cpp += `        if (strcmp(cmd_id, "${this._escStr(cid)}") == 0) {\n`;
                    cpp += `            _mb.setTransmitBuffer(0, ${bits});\n`;
                    cpp += `            return _mb.writeMultipleCoils(${m.addr}, ${cnt}) == _mb.ku8MBSuccess;\n`;
                    cpp += `        }\n`;
                } else {
                    console.warn(`[gen] bo_map ${cid}: func 0x${func.toString(16)} nao suportada (cadastro do ${dev.name})`);
                }
            });
            cpp += `        return false;\n    }\n`;
        });
        cpp += `    return false;
}
`;
        return cpp;
    }

    // ========================================================================
    // SOE — buffer de eventos do relé (método privado IEC-103-like sobre Modbus).
    // Só gera se o catálogo do device tiver `eventos` (ver docs/IOT-SOE-EVENTOS-RELE.md).
    //
    // Mecanismo (7SR manual §6.1): EVENTCOUNT diz quantos eventos há na fila; ler o
    // registrador EVENT (qty EXATAMENTE 8) devolve o mais antigo e DÁ POP. Exceção 0x02
    // = fila vazia — é o fim normal da drenagem, NÃO é erro (não pode cair no back-off).
    //
    // O firmware publica o evento CRU (type/FUN/INF/timestamp/RT/F#/Meas); a tradução
    // FUN/INF -> função de proteção é do backend (dado curável, e é o que deixa o DNP3
    // plugar depois no mesmo modelo canônico).
    // ========================================================================
    _genDeviceEventPoll(dev, idx) {
        const cat = dev.catalog_device || {};
        const evt = cat.eventos;
        if (!evt || !evt.count || !evt.record) return '';
        const slave = dev.modbus_address;
        const topicName = `${dev.name || 'dev'}_${dev.modbus_address}`;
        const nameEsc = this._escStr(topicName);
        // catalog_id vai no payload: o mapa FUN/INF é POR MODELO (o do 7SR10 != o do
        // 7SR5111). Sem isso o backend não sabe qual tabela aplicar e rotula errado.
        const catIdEsc = this._escStr(String(dev.catalog_id || ''));
        const cntReg = Number(evt.count.reg) || 0;
        const recReg = Number(evt.record.reg) || 1;
        const qty = Number(evt.record.qty) || 8;
        const excVazio = Number(evt.excecao_vazio) || 2;

        return `
// ===== SOE (eventos) — ${dev.name} =====
static void _evt_emit_dev_${idx}(modbus_publish_fn publish, const uint8_t* b) {
    uint8_t type = b[0];
    if (type != 1 && type != 2 && type != 4) return;   // tipo desconhecido: ignora
    uint8_t fun = b[2], inf = b[3];
    uint16_t ms = 0; uint8_t mi = 0, ho = 0;
    int dpi = -1; long rt = -1, fnum = -1;
    bool hasMeas = false; float meas = 0.0f;
    if (type == 1) {
        dpi = b[4];
    } else if (type == 2) {
        dpi = b[4];
        rt   = (long)b[5]  | ((long)b[6]  << 8);
        fnum = (long)b[7]  | ((long)b[8]  << 8);
    } else { // type 4: Meas (R32.23, LSB first) nos bytes 4-7
        uint32_t u = (uint32_t)b[4] | ((uint32_t)b[5] << 8) | ((uint32_t)b[6] << 16) | ((uint32_t)b[7] << 24);
        memcpy(&meas, &u, sizeof(float)); hasMeas = true;
        rt   = (long)b[8]  | ((long)b[9]  << 8);
        fnum = (long)b[10] | ((long)b[11] << 8);
    }
    ms = (uint16_t)b[12] | ((uint16_t)b[13] << 8);   // ms L, ms H
    mi = b[14]; ho = b[15];
    bool hora_ok = !(mi & 0x80);      // MSB de Mi = hora invalida (relogio nao setado)
    bool dst     = (ho & 0x80) != 0;  // MSB de Ho = horario de verao
    uint8_t mins = mi & 0x7F, hrs = ho & 0x7F;

    char p[320]; int n = 0;
    n += snprintf(p + n, sizeof(p) - n,
        "{\\"dev\\":\\"${nameEsc}\\",\\"cat\\":\\"${catIdEsc}\\",\\"proto\\":\\"modbus_7sr\\""
        ",\\"type\\":%u,\\"fun\\":%u,\\"inf\\":%u"
        ",\\"ho\\":%u,\\"mi\\":%u,\\"ms\\":%u,\\"hora_ok\\":%s,\\"dst\\":%s,\\"ts_rx\\":%ld",
        type, fun, inf, hrs, mins, ms, hora_ok ? "true" : "false", dst ? "true" : "false",
        (long)time(nullptr));
    if (dpi  >= 0) n += snprintf(p + n, sizeof(p) - n, ",\\"dpi\\":%d", dpi);
    if (rt   >= 0) n += snprintf(p + n, sizeof(p) - n, ",\\"rt\\":%ld", rt);
    if (fnum >= 0) n += snprintf(p + n, sizeof(p) - n, ",\\"fault\\":%ld", fnum);
    if (hasMeas)   n += snprintf(p + n, sizeof(p) - n, ",\\"meas\\":%.3f", meas);
    snprintf(p + n, sizeof(p) - n, "}");

    Serial.printf("[EVT] ${nameEsc} t%u FUN=%u INF=%u %02u:%02u:%06.3f%s\\n",
                  type, fun, inf, hrs, mins, ms / 1000.0, hora_ok ? "" : " (HORA INVALIDA)");
    publish("evt", p);
}

// Drena a fila de eventos. Oportunista: se o rele nao responder, sai quieto (a
// telemetria ja loga falha; evento nao deve poluir nem entrar no back-off).
static void _evt_poll_dev_${idx}(modbus_publish_fn publish) {
    _select(${slave});
    _mb.clearResponseBuffer();
    if (_mb.readInputRegisters(${cntReg}, 1) != _mb.ku8MBSuccess) return;
    uint16_t cnt = _mb.getResponseBuffer(0);
    if (cnt == 0) return;
    Serial.printf("[EVT] ${nameEsc}: %u evento(s) no buffer\\n", (unsigned)cnt);
    for (int guard = 0; guard < 32; guard++) {   // teto: nunca travar o loop principal
        _select(${slave});
        _mb.clearResponseBuffer();
        uint8_t rc = _mb.readInputRegisters(${recReg}, ${qty});
        if (rc == 0x${excVazio.toString(16).padStart(2, '0')}) break;  // fila vazia = fim (NORMAL)
        if (rc != _mb.ku8MBSuccess) {
            Serial.printf("[EVT] ${nameEsc}: leitura de evento rc=0x%02X — aborta ciclo\\n", rc);
            break;
        }
        uint8_t b[16];
        for (int i = 0; i < 8; i++) {
            uint16_t r = _mb.getResponseBuffer(i);
            b[i * 2] = (uint8_t)(r >> 8); b[i * 2 + 1] = (uint8_t)(r & 0xFF);
        }
        _evt_emit_dev_${idx}(publish, b);
    }
}
`;
    }

    // SOE via TCP — espelho do _genDeviceEventPoll para devices TCP diretos (MBAP).
    // Mesmo mecanismo (EVENTCOUNT FC04 qty1 + EVENT FC04 qty8, excecao 2 = fila vazia),
    // transporte _modbus_tcp_read. Fila-vazia detectada via _tcp_last_exc (o helper nao
    // devolve o codigo no retorno); _tcp_quiet_exc suprime o log da excecao esperada.
    // So MBAP: rele atras de conversor rtu_tcp nao drena eventos (limitacao documentada).
    _genTcpDeviceEventPoll(inv, idx) {
        const cat = inv.catalog_device || {};
        const evt = cat.eventos;
        if (!evt || !evt.count || !evt.record) return '';
        const gw = inv.gateway || {};
        if (gw.mode === 'rtu_tcp') return '';
        const gwArgs = `"${gw.ip || ''}", ${gw.port || 502}, ${gw.timeout_ms || 2000}`;
        const slave = inv.modbus_address;
        const topicName = `${inv.name || 'dev'}_${inv.modbus_address}`;
        const nameEsc = this._escStr(topicName);
        const catIdEsc = this._escStr(String(inv.catalog_id || ''));
        const cntReg = Number(evt.count.reg) || 0;
        const recReg = Number(evt.record.reg) || 1;
        const qty = Number(evt.record.qty) || 8;
        const excVazio = Number(evt.excecao_vazio) || 2;

        return `
// ===== SOE (eventos) via TCP — ${inv.name} =====
static void _tcp_evt_emit_dev_${idx}(tcp_publish_fn publish, const uint8_t* b) {
    uint8_t type = b[0];
    if (type != 1 && type != 2 && type != 4) return;   // tipo desconhecido: ignora
    uint8_t fun = b[2], inf = b[3];
    uint16_t ms = 0; uint8_t mi = 0, ho = 0;
    int dpi = -1; long rt = -1, fnum = -1;
    bool hasMeas = false; float meas = 0.0f;
    if (type == 1) {
        dpi = b[4];
    } else if (type == 2) {
        dpi = b[4];
        rt   = (long)b[5]  | ((long)b[6]  << 8);
        fnum = (long)b[7]  | ((long)b[8]  << 8);
    } else { // type 4: Meas (R32.23, LSB first) nos bytes 4-7
        uint32_t u = (uint32_t)b[4] | ((uint32_t)b[5] << 8) | ((uint32_t)b[6] << 16) | ((uint32_t)b[7] << 24);
        memcpy(&meas, &u, sizeof(float)); hasMeas = true;
        rt   = (long)b[8]  | ((long)b[9]  << 8);
        fnum = (long)b[10] | ((long)b[11] << 8);
    }
    ms = (uint16_t)b[12] | ((uint16_t)b[13] << 8);   // ms L, ms H
    mi = b[14]; ho = b[15];
    bool hora_ok = !(mi & 0x80);      // MSB de Mi = hora invalida (relogio nao setado)
    bool dst     = (ho & 0x80) != 0;  // MSB de Ho = horario de verao
    uint8_t mins = mi & 0x7F, hrs = ho & 0x7F;

    char p[320]; int n = 0;
    n += snprintf(p + n, sizeof(p) - n,
        "{\\"dev\\":\\"${nameEsc}\\",\\"cat\\":\\"${catIdEsc}\\",\\"proto\\":\\"modbus_7sr\\""
        ",\\"type\\":%u,\\"fun\\":%u,\\"inf\\":%u"
        ",\\"ho\\":%u,\\"mi\\":%u,\\"ms\\":%u,\\"hora_ok\\":%s,\\"dst\\":%s,\\"ts_rx\\":%ld",
        type, fun, inf, hrs, mins, ms, hora_ok ? "true" : "false", dst ? "true" : "false",
        (long)time(nullptr));
    if (dpi  >= 0) n += snprintf(p + n, sizeof(p) - n, ",\\"dpi\\":%d", dpi);
    if (rt   >= 0) n += snprintf(p + n, sizeof(p) - n, ",\\"rt\\":%ld", rt);
    if (fnum >= 0) n += snprintf(p + n, sizeof(p) - n, ",\\"fault\\":%ld", fnum);
    if (hasMeas)   n += snprintf(p + n, sizeof(p) - n, ",\\"meas\\":%.3f", meas);
    snprintf(p + n, sizeof(p) - n, "}");

    Serial.printf("[EVT] ${nameEsc} t%u FUN=%u INF=%u %02u:%02u:%06.3f%s\\n",
                  type, fun, inf, hrs, mins, ms / 1000.0, hora_ok ? "" : " (HORA INVALIDA)");
    publish("evt", p);
}

// Drena a fila de eventos via MBAP. Oportunista: rele mudo = sai quieto (a telemetria
// ja loga falha; evento nao entra no back-off do sample).
static void _tcp_evt_poll_dev_${idx}(tcp_publish_fn publish) {
    uint16_t _cnt_r[1];
    // Quiet: rele sem 30001 no mapa (EVENTCOUNT) daria excecao logada a cada poll.
    _tcp_quiet_exc = true;
    bool _cntOk = _modbus_tcp_read(${gwArgs}, ${slave}, 0x04, ${cntReg}, 1, _cnt_r);
    _tcp_quiet_exc = false;
    if (!_cntOk) return;
    if (_cnt_r[0] == 0) return;
    Serial.printf("[EVT] ${nameEsc}: %u evento(s) no buffer\\n", (unsigned)_cnt_r[0]);
    for (int guard = 0; guard < 32; guard++) {   // teto: nunca travar o loop principal
        uint16_t _rec[${qty}];
        _tcp_quiet_exc = true;
        bool ok = _modbus_tcp_read(${gwArgs}, ${slave}, 0x04, ${recReg}, ${qty}, _rec);
        _tcp_quiet_exc = false;
        if (!ok) {
            if (_tcp_last_exc == 0x${excVazio.toString(16).padStart(2, '0')}) break;  // fila vazia = fim (NORMAL)
            Serial.printf("[EVT] ${nameEsc}: leitura de evento falhou (exc=0x%02X) — aborta ciclo\\n", _tcp_last_exc);
            break;
        }
        uint8_t b[16];
        for (int i = 0; i < 8; i++) {
            b[i * 2] = (uint8_t)(_rec[i] >> 8); b[i * 2 + 1] = (uint8_t)(_rec[i] & 0xFF);
        }
        _tcp_evt_emit_dev_${idx}(publish, b);
    }
}
`;
    }

    // Gera _sample_dev_<idx>() (acumula) e _publish_dev_<idx>(publish) (processa + reseta)
    _genDeviceReader(dev, idx) {
        const cat = dev.catalog_device;
        const blocks = cat.ai_blocks || [];
        // ModbusMaster tem buffer de resposta de 64 words — bloco AI maior que isso
        // trunca silenciosamente no RS485 (o TCP le ate 125). Catalogo compartilhado
        // entre transportes (ex: 7SR5111 tcp/rtu) deve manter blocos <= 64.
        blocks.forEach((b, i) => {
            if (b.count > 64) console.warn(`[gen] ${dev.name}: ai_block ${i} count=${b.count} > 64 (limite ModbusMaster RS485) — dividir o bloco no catalogo`);
        });
        // Aplica overrides do diagrama (props.current_scale_override / voltage_scale_override)
        // antes de processar o ai_map.
        const aiMap = this._applyScaleOverrides(cat.ai_map || {}, dev);
        const biBlock = cat.bi_block || null;
        const biMap = cat.bi_map || {};
        // Esquema NOVO de BI (bits esparsos): bi_blocks [{start,count,func}] +
        // bi_map {pid:{block,bit}} — igual ao caminho TCP. Quando presente, substitui
        // o legado bi_block/coil (que permanece intacto pra Pextron/7SR10).
        const biBlocksNew = Array.isArray(cat.bi_blocks) && cat.bi_blocks.length > 0 ? cat.bi_blocks : null;
        const biEntriesNew = biBlocksNew
            ? Object.entries(biMap)
                .filter(([, m]) => m.bit !== undefined && m.block !== undefined && m.block < biBlocksNew.length)
            : [];
        const scales = cat.scales || {};
        const topicName = `${dev.name || 'dev'}_${dev.modbus_address}`;
        const deviceName = this._escStr(topicName);

        const blockOffsets = [];
        let acc = 0;
        for (const b of blocks) { blockOffsets.push(acc); acc += b.count; }
        const totalRegs = Math.max(acc, 1);

        // Classificar campos por modo
        const avgFields = [];    // media das amostras
        const lastFields = [];   // ultimo valor
        const deltaFields = [];  // ultimo - primeiro

        const wordOrder = cat.word_order || 'high_first';

        for (const [pid, m] of Object.entries(aiMap)) {
            if (m.block === undefined || m.offset === undefined) continue;
            if (m.block >= blocks.length) continue;
            const base = blockOffsets[m.block];
            const i0 = base + m.offset;
            const scale = this._resolveScale(m.scale, scales);
            let decoder = this._decodeExpr(m.dataType || 'U16', 'buf', i0, scale, m, wordOrder);
            if (!decoder) continue;

            // Casa decimal por campo (espelha apply_factor). Aplicado ANTES do TP/TC.
            // O fator é o DELTA do expoente lido (reg35/36) vs o baseline já codificado
            // no `scale` fixo do catálogo. No ponto típico vale 1.0 -> diff vazio.
            if (m.decimal_src && cat.decimal_regs && !this._tpTcDisabled()) {
                const decVar = m.decimal_src === 'dpt' ? '_fDPT'
                             : m.decimal_src === 'dct' ? '_fDCT'
                             : m.decimal_src === 'dpq' ? '_fDPQ'
                             : null;
                if (decVar) decoder = `(${decoder}) * ${decVar}`;
            }

            // Aplica fator TP/TC quando configurado no campo (vide cat.tp_tc).
            // Replica comportamento das referências PlatformIO (M-160 LORA_TX_MODBUS,
            // PD666 EV-PD666_USR_MQTT). Variáveis _fTP/_fTC/_fatorEnergia são
            // computadas no início do _sample_dev_${idx}.
            // FLAG DE DIAGNÓSTICO: setar IOT_DISABLE_TP_TC = true desativa toda
            // a feature pra isolar regressões. Default: ativada.
            if (m.apply_factor && !this._tpTcDisabled()) {
                const factorVar = m.apply_factor === 'tp'    ? '_fTP'
                                : m.apply_factor === 'tc'    ? '_fTC'
                                : m.apply_factor === 'tp_tc' ? '_fatorEnergia'
                                : null;
                if (factorVar) decoder = `(${decoder}) * ${factorVar}`;
            }

            const mode = m.mode || 'avg';
            const entry = { pid, decoder, clamp: !!m.clamp_negative, format: m.format || null };
            if (mode === 'last') lastFields.push(entry);
            else if (mode === 'delta') deltaFields.push(entry);
            else avgFields.push(entry);
        }

        const biCount = biBlocksNew
            ? biEntriesNew.length
            : (biBlock && Object.keys(biMap).length > 0 ? Object.keys(biMap).length : 0);

        let cpp = `
// =========================================================================
// ${dev.name} (${cat.fabricante || '?'} ${cat.modelo || cat.tipo || '?'})
// Endereco Modbus: ${dev.modbus_address}
// Modos: ${avgFields.length} avg, ${lastFields.length} last, ${deltaFields.length} delta${biBlocksNew ? ` | BI: ${biCount} pontos em ${biBlocksNew.length} blocos` : ''}
// =========================================================================

struct _Dev${idx}State {
    // Acumuladores (somas para media)
    double sum_[${Math.max(avgFields.length, 1)}];
    int samples;
    // Ultima amostra (valores brutos decodificados)
    float last_[${Math.max(avgFields.length + lastFields.length + deltaFields.length, 1)}];
    // Primeira amostra de delta (snapshot no inicio do ciclo)
    float first_delta_[${Math.max(deltaFields.length, 1)}];
    bool has_first_delta;
    // Estados BI da ultima leitura
    uint8_t bi_[${Math.max(biCount, 1)}];
${biBlocksNew ? `    bool bi_valid;              // >=1 ciclo com TODOS os blocos BI lidos OK
` : ''}    bool valid;
    int fail_streak;            // leituras consecutivas falhas
    unsigned long cooldown_until;  // millis() ate quando pular este device (back-off)
};
static _Dev${idx}State _ds${idx} = {};

static bool _read_dev_${idx}_raw(uint16_t *buf) {
    _select(${dev.modbus_address});
`;

        if (this._simMode()) {
            cpp += this._genSimFill(aiMap, blocks, blockOffsets);
            cpp += `}\n`;
        } else {

        if (cat.handshake) {
            const h = cat.handshake;
            const fn = h.func === 0x04 ? 'readInputRegisters' : 'readHoldingRegisters';
            cpp += `    // Handshake
    _mb.${fn}(${h.register}, ${h.count});
    delay(30);
`;
        }

        blocks.forEach((b, bi) => {
            const fn = b.func === 0x04 ? 'readInputRegisters'
                    : b.func === 0x01 ? 'readCoils'
                    : 'readHoldingRegisters';
            const off = blockOffsets[bi];
            cpp += `    // Bloco ${bi}: reg ${b.start}, count ${b.count}, func 0x${b.func.toString(16).padStart(2,'0')}${b.label ? ' - ' + b.label : ''}
    {
        uint8_t rc = _mb.${fn}(${b.start}, ${b.count});
        if (rc != _mb.ku8MBSuccess) {
            // Codigos: 0xE0 InvalidSlaveID (cross-talk/eco) | 0xE2 timeout
            //          0xE3 CRC | 0x02 IllegalAddr | 0x01 IllegalFn | 0x04 SlaveFail
            // 0xE0 indica que recebemos bytes errados (residuo no RX). Drenar
            // agressivamente antes do retry pra nao herdar a contaminacao.
            if (rc == 0xE0) {
                delay(20);
                while (_rs485.available()) _rs485.read();
                delay(20);
            } else {
                delay(50);
            }
            // Retry so' na 1a falha (transiente). Device cronicamente morto nao
            // paga 2x o timeout — reduz o bloqueio do loop ate o cooldown armar.
            if (_ds${idx}.fail_streak == 0) {
                rc = _mb.${fn}(${b.start}, ${b.count});
            }
        }
        if (rc == _mb.ku8MBSuccess) {
            for (uint16_t i = 0; i < ${b.count}; i++) buf[${off} + i] = _mb.getResponseBuffer(i);
            diag_modbus_ok++;
        } else {
            diag_modbus_err++;
            Serial.printf("[MB] ${topicName} bloco ${bi} FAIL (reg=${b.start} count=${b.count} rc=0x%02X)\\n", rc);
            return false;
        }
    }
    // Espacamento entre blocos. 80ms cobre datalogger interno do Sungrow CX
    // (mais lento do parque). Outros devices pagam 40ms extra por bloco — desprezivel
    // dado round-robin de 2s/device * N devices.
    delay(80);
    // CRITICO: chamar mqtt_loop() entre blocos para nao bloquear PubSubClient.
    // Se um sample Modbus passa de 15s (default keepalive antigo) sem loop(),
    // broker desconecta. Mantem mensagens MQTT processadas durante ciclos longos.
    mqtt_loop();
`;
        });

        cpp += `    return true;
}
`;
        }  // fim do else (caminho de leitura real — pulado em sim mode)

        cpp += `
// Le + acumula. Chamar a cada READ_INTERVAL_MS.
static void _sample_dev_${idx}() {
    // Back-off: device que falhou MODBUS_FAIL_COOLDOWN_N vezes fica em cooldown.
    // Pula a leitura (que bloquearia o loop no timeout) ate o cooldown expirar.
    if (_ds${idx}.cooldown_until && (long)(millis() - _ds${idx}.cooldown_until) < 0) return;

    uint16_t buf[${totalRegs}];
    if (!_read_dev_${idx}_raw(buf)) {
        _ds${idx}.fail_streak++;
        Serial.printf("[MB] ${topicName}: falha leitura (consecutivas: %d)\\n", _ds${idx}.fail_streak);
        if (_ds${idx}.fail_streak >= MODBUS_FAIL_COOLDOWN_N) {
            _ds${idx}.cooldown_until = millis() + MODBUS_COOLDOWN_MS;
            if (_ds${idx}.cooldown_until == 0) _ds${idx}.cooldown_until = 1;  // 0 = sentinela "sem cooldown"
            Serial.printf("[MB] ${topicName}: cooldown %lus (nao responde) — loop liberado p/ LoRa/cmd\\n",
                          (unsigned long)(MODBUS_COOLDOWN_MS/1000));
        }
        return;
    }
    diag_last_successful_read_ms = millis();
    _ds${idx}.cooldown_until = 0;
    if (_ds${idx}.fail_streak > 0) {
        Serial.printf("[MB] ${topicName}: OK (apos %d falhas consecutivas)\\n", _ds${idx}.fail_streak);
        _ds${idx}.fail_streak = 0;
    }

`;
        // Bloco TP/TC: lê separadamente do bloco principal e calcula fatores.
        // Defaults 1.0 garantem degrade graceful se a leitura falhar.
        // Comportamento replica referências PlatformIO (regs separados, scale
        // independente). Variáveis usadas pelos decoders via apply_factor.
        // FLAG DE DIAGNÓSTICO: vide _tpTcDisabled() abaixo.
        if (cat.tp_tc && !this._tpTcDisabled()) {
            const t = cat.tp_tc;
            const sTp = (Number(t.scale_tp) || 1).toFixed(1);
            const sTc = (Number(t.scale_tc) || 1).toFixed(1);
            // Override explicito do diagrama (tc_ratio/tp_ratio): deterministico, NAO
            // depende do registrador do medidor. Critico onde nao tem OTA.
            const _tcOv = this._parseScaleOverride(dev.tc_ratio);
            const _tpOv = this._parseScaleOverride(dev.tp_ratio);
            cpp += `    // TP/TC para escalonamento. Le do medidor (reg ${t.register}) pra log; se houver
    // override no diagrama (tc_ratio/tp_ratio), usa o valor FIXO (deterministico).
    float _fTP = 1.0f, _fTC = 1.0f, _fatorEnergia = 1.0f;
    {
        delay(40);
        uint8_t rc_tptc = _mb.readHoldingRegisters(${t.register}, ${t.count});
        if (rc_tptc == _mb.ku8MBSuccess) {
            uint16_t _tp_raw = _mb.getResponseBuffer(${t.tp_offset});
            uint16_t _tc_raw = _mb.getResponseBuffer(${t.tc_offset});
            _fTP = (float)_tp_raw / ${sTp}f;
            _fTC = (float)_tc_raw / ${sTc}f;
            Serial.printf("[M160] medidor reporta TP=%.0f TC=%.0f (raw tp=%u tc=%u)\\n", _fTP, _fTC, _tp_raw, _tc_raw);
        } else {
            Serial.println("[M160] leitura TP/TC FALHOU (rc!=0)");
        }
${_tpOv ? `        _fTP = ${_tpOv.toFixed(1)}f;  // override tp_ratio (diagrama)\n` : ''}${_tcOv ? `        _fTC = ${_tcOv.toFixed(1)}f;  // override tc_ratio (diagrama) — deterministico\n` : ''}        _fatorEnergia = _fTP * _fTC;
        Serial.printf("[M160] usando TP=%.0f TC=%.0f -> fatorEnergia=%.0f\\n", _fTP, _fTC, _fatorEnergia);
    }

`;
        }

        // Bloco DPT/DCT/DPQ (casa decimal dinamica, M160). Lê reg35/36 e calcula
        // fatores _fDPT/_fDCT/_fDPQ como DELTA do expoente lido vs baseline do scale
        // fixo do catalogo. value = raw*10^(exp-baseline). Default 1.0 = degrade graceful.
        if (cat.decimal_regs && !this._tpTcDisabled()) {
            const d = cat.decimal_regs, L = d.layout || {};
            const ext = (s) => {
                const cfg = L[s]; if (!cfg) return null;
                const w = cfg.word || 0, base = (cfg.baseline ?? 4);
                const expr = cfg.byte === 'hi' ? `(_dec${w} >> 8) & 0xFF` : `_dec${w} & 0xFF`;
                return { expr, base, w };
            };
            const dpt = ext('dpt'), dct = ext('dct'), dpq = ext('dpq');
            cpp += `    // Casas decimais (reg ${d.register}: DPT/DCT/DPQ). value = raw*10^(exp-baseline).
    // Cache do ultimo valor bom (init=baseline => fator 1.0): expoentes mudam raro, entao se a
    // leitura falhar usa o ultimo lido em vez de cair pra 1.0. Flush+retry (mesmo do bloco principal).
    static uint8_t _lDPT = ${dpt ? dpt.base : 4}, _lDCT = ${dct ? dct.base : 4}, _lDPQ = ${dpq ? dpq.base : 4};
    float _fDPT = 1.0f, _fDCT = 1.0f, _fDPQ = 1.0f;
    {
        uint8_t rc_dec = 0xFF;
        for (int _t = 0; _t < 3 && rc_dec != _mb.ku8MBSuccess; _t++) {
            while (_rs485.available()) _rs485.read();   // drena residual — corrige 0xE0 (dessincronia)
            delay(20);
            rc_dec = _mb.readHoldingRegisters(${d.register}, ${d.count});
        }
        if (rc_dec == _mb.ku8MBSuccess) {
            uint16_t _dec0 = _mb.getResponseBuffer(0);
            uint16_t _dec1 = _mb.getResponseBuffer(${d.count > 1 ? 1 : 0});
${dpt ? `            _lDPT = ${dpt.expr};\n` : ''}${dct ? `            _lDCT = ${dct.expr};\n` : ''}${dpq ? `            _lDPQ = ${dpq.expr};\n` : ''}            uint8_t _sign = _dec1 & 0xFF;
            Serial.printf("[M160] DPT=%u DCT=%u DPQ=%u SIGN=0x%02X (raw r35=0x%04X r36=0x%04X)\\n", _lDPT, _lDCT, _lDPQ, _sign, _dec0, _dec1);
        } else {
            Serial.printf("[M160] reg35 falhou (rc=0x%02X) — usando ultimo bom DPT=%u DCT=%u DPQ=%u\\n", rc_dec, _lDPT, _lDCT, _lDPQ);
        }
${dpt ? `        _fDPT = _pow10i((int)_lDPT - ${dpt.base});\n` : ''}${dct ? `        _fDCT = _pow10i((int)_lDCT - ${dct.base});\n` : ''}${dpq ? `        _fDPQ = _pow10i((int)_lDPQ - ${dpq.base});\n` : ''}    }

`;
        }

        // Decodificar todos os campos (avg + last + delta) usando 'buf'
        // Acumular 'avg' em sum_
        avgFields.forEach((f, i) => {
            cpp += `    float v_${f.pid} = ${f.decoder};\n`;
            cpp += `    _ds${idx}.sum_[${i}] += v_${f.pid};\n`;
        });

        // Guardar 'last' para todos os campos não-avg também (para publicação)
        lastFields.forEach((f) => {
            cpp += `    float v_${f.pid} = ${f.decoder};\n`;
        });
        deltaFields.forEach((f, i) => {
            cpp += `    float v_${f.pid} = ${f.decoder};\n`;
            cpp += `    if (!_ds${idx}.has_first_delta) { _ds${idx}.first_delta_[${i}] = v_${f.pid}; }\n`;
        });

        if (deltaFields.length > 0) {
            cpp += `    if (!_ds${idx}.has_first_delta) _ds${idx}.has_first_delta = true;\n`;
        }

        // Salvar last_ em ordem (avg + last + delta)
        let lastIdx = 0;
        [...avgFields, ...lastFields, ...deltaFields].forEach(f => {
            cpp += `    _ds${idx}.last_[${lastIdx++}] = v_${f.pid};\n`;
        });

        cpp += `    _ds${idx}.samples++;\n`;

        // Log de debug: mostra os principais campos lidos a cada sample
        cpp += `    // Log de debug — mostra principais valores lidos\n`;
        cpp += `    Serial.printf("[MB] ${topicName} #%d: ", _ds${idx}.samples);\n`;

        // Priorizar campos mais informativos: V, I, P, e alguns "last" tipicos
        const preferredOrder = ['vab', 'vbc', 'vca', 'va', 'vb', 'vc',
                                'ia', 'ib', 'ic',
                                'potencia_ativa', 'pa_total', 'dc_total_power',
                                'freq_rede', 'freq', 'fator_potencia', 'fp', 'fp_total',
                                'mppt1_voltage', 'mppt1_v', 'temp_interna',
                                'daily_yield', 'total_yield', 'work_state',
                                'geracao_diaria', 'geracao_total', 'estado_operacao',
                                'energia_ativa_imp', 'consumo_ativa_imp'];
        const logFields = [];
        // Adicionar até 6 campos na ordem de preferência
        for (const pid of preferredOrder) {
            if (aiMap[pid] && logFields.length < 6) {
                const m = aiMap[pid];
                if (m.block !== undefined && m.offset !== undefined && m.block < blocks.length) {
                    logFields.push(pid);
                }
            }
        }
        logFields.forEach((pid, i) => {
            cpp += `    Serial.printf("${pid}=%.2f${i < logFields.length - 1 ? ' ' : ''}", v_${pid});\n`;
        });
        cpp += `    Serial.println();\n`;

        // BI
        if (biCount > 0 && biBlocksNew) {
            // Esquema NOVO: N blocos FC02/FC01 pequenos (bits esparsos, ex: 7SR5111).
            // Cada bloco le e desempacota imediatamente (o response buffer e' reusado).
            // bi_valid so' liga com TODOS os blocos OK no ciclo — nunca publica bit chutado.
            cpp += `
    // BI ${biCount} pontos em ${biBlocksNew.length} bloco(s)
    {
        bool _biOk = true;
`;
            biBlocksNew.forEach((b, bIdx) => {
                const fn = (b.func || 0x02) === 0x02 ? 'readDiscreteInputs' : 'readCoils';
                cpp += `        if (_mb.${fn}(${b.start}, ${b.count}) == _mb.ku8MBSuccess) {\n`;
                biEntriesNew.forEach(([pid, m], k) => {
                    if (m.block !== bIdx) return;
                    cpp += `            _ds${idx}.bi_[${k}] = (_mb.getResponseBuffer(${Math.floor(m.bit / 16)}) >> ${m.bit % 16}) & 1;  // ${pid}\n`;
                });
                cpp += `        } else _biOk = false;\n`;
            });
            cpp += `        if (_biOk) _ds${idx}.bi_valid = true;
    }
`;
        } else if (biCount > 0) {
            // func 0x01 = Coils (Pextron); func 0x02 = Discrete Inputs (Siemens 7SR).
            // Ambos empacotam bits em words no response buffer -> mesmo bit-unpack.
            const biReadFn = biBlock.func === 0x02 ? 'readDiscreteInputs' : 'readCoils';
            const biKind = biBlock.func === 0x02 ? 'discrete inputs (0x02)' : 'coils (0x01)';
            cpp += `
    // BI ${biKind}
    if (_mb.${biReadFn}(${biBlock.start}, ${biBlock.count}) == _mb.ku8MBSuccess) {
`;
            let bi = 0;
            for (const [pid, m] of Object.entries(biMap)) {
                if (m.coil === undefined) continue;
                const reg = Math.floor(m.coil / 16);
                const bit = m.coil % 16;
                cpp += `        _ds${idx}.bi_[${bi++}] = (_mb.getResponseBuffer(${reg}) >> ${bit}) & 1;\n`;
            }
            cpp += `    }
`;
        }

        cpp += `    _ds${idx}.valid = true;
}

// Publica JSON (medias + last + delta) e reseta acumuladores. Chamar a cada PUBLISH_INTERVAL_MS.
static void _publish_dev_${idx}(modbus_publish_fn publish) {
    if (!_ds${idx}.valid || _ds${idx}.samples == 0) {
        publish("${deviceName}/status", "{\\"error\\":\\"no_samples\\"}");
        return;
    }

    int n = _ds${idx}.samples;
    // JSON na heap (nao na stack). loopTask tem 8KB de stack; alocar 3KB+3KB
    // aqui (doc + payload) causava Panic em ~200s no projeto Chimarrao com
    // Power_Meter + 2 inversores. Heap fica em ~280KB livres.
    DynamicJsonDocument d(3072);
`;

        // --- Resolver path JSON para cada pid (usa DEVICE_POINTS[tipo]) ---
        const tipo = (typeof DEVICE_POINTS !== 'undefined' && cat.tipo) ? DEVICE_POINTS[cat.tipo] : null;
        const tipoAi = tipo ? (tipo.ai || []) : [];
        const tipoBi = tipo ? (tipo.bi || []) : [];

        // Config de publicacao: timestamp_format, timestamp_position, meta_fields
        const pubCfg = (tipo && tipo.publish) || {};
        const tsFormat   = pubCfg.timestamp_format   || 'epoch';
        const tsPosition = pubCfg.timestamp_position || 'first';
        const metaFields = pubCfg.meta_fields || ['inverter_id', 'samples'];
        const tsExpr = (tsFormat === 'datetime')
            ? '_format_timestamp_str()'
            : '(long)time(nullptr)';

        if (tsPosition === 'first') {
            cpp += `    d["timestamp"] = ${tsExpr};\n`;
        }
        if (metaFields.includes('inverter_id')) {
            cpp += `    d["inverter_id"] = ${dev.modbus_address};\n`;
        }
        if (metaFields.includes('samples')) {
            cpp += `    d["samples"] = n;\n`;
        }
        cpp += `\n`;
        const resolveJsonPath = (pid) => {
            const exactAi = tipoAi.find(a => a.id === pid);
            if (exactAi && exactAi.json) return exactAi.json;
            const exactBi = tipoBi.find(a => a.id === pid);
            if (exactBi && exactBi.json) return exactBi.json;
            for (const a of tipoAi) {
                if (a.per_instance && a.prefix && a.suffix) {
                    const re = new RegExp(`^${a.prefix}\\d+${a.suffix}$`);
                    if (re.test(pid)) return `${a.group || 'dc'}.${pid}`;
                }
            }
            return pid;
        };

        // --- Coleta expressoes fonte para cada pid ---
        const fieldSources = {}; // pid -> { expr, format }
        avgFields.forEach((f, i) => {
            fieldSources[f.pid] = { expr: `(float)(_ds${idx}.sum_[${i}] / n)`, format: f.format, raw: false };
        });
        let lastRunIdx = avgFields.length;
        lastFields.forEach((f) => {
            fieldSources[f.pid] = { expr: `_ds${idx}.last_[${lastRunIdx++}]`, format: f.format, raw: false };
        });
        const deltaExprs = {}; // pid -> { lastI, deltaIdx, clamp }
        deltaFields.forEach((f, i) => {
            const lastI = avgFields.length + lastFields.length + i;
            deltaExprs[f.pid] = { lastI, deltaIdx: i, clamp: !!f.clamp, format: f.format };
            // Placeholder — real expr resolvido ao emitir (usa variavel local dv_pid)
            fieldSources[f.pid] = { expr: `dv_${f.pid}`, format: f.format, raw: false };
        });
        if (biCount > 0 && biBlocksNew) {
            // Esquema novo: indices casam com biEntriesNew; flag bi -> guarda bi_valid na emissao
            biEntriesNew.forEach(([pid], k) => {
                fieldSources[pid] = { expr: `_ds${idx}.bi_[${k}]`, format: null, raw: false, bi: true };
            });
        } else if (biCount > 0) {
            let bi = 0;
            for (const [pid, m] of Object.entries(biMap)) {
                if (m.coil === undefined) continue;
                fieldSources[pid] = { expr: `_ds${idx}.bi_[${bi++}]`, format: null, raw: false };
            }
        }

        // --- Agrupar por top-level key do json path ---
        // Pre-popular groups na ordem definida pelo tipo (info, energy, ..., pid)
        // para que o JSON de saida tenha a mesma ordem de campos do UFV-SOLAR_POWER.
        const groups = {};        // topKey -> [{ subKey, pid, src }]
        for (const a of [...tipoAi, ...tipoBi]) {
            if (a.json && a.json.includes('.')) {
                const top = a.json.split('.')[0];
                if (!groups[top]) groups[top] = [];
            } else if (a.group) {
                // per_instance: usa group como top-level
                if (!groups[a.group]) groups[a.group] = [];
            }
        }
        const topLevelFields = []; // flat fields
        for (const [pid, src] of Object.entries(fieldSources)) {
            const path = resolveJsonPath(pid);
            const parts = path.split('.');
            if (parts.length === 1) {
                topLevelFields.push({ key: parts[0], pid, src });
            } else {
                const top = parts[0];
                const rest = parts.slice(1).join('.');
                if (!groups[top]) groups[top] = [];
                groups[top].push({ subKey: rest, pid, src });
            }
        }

        // --- Emitir delta (precisa calcular dv_<pid> antes de usar) ---
        Object.entries(deltaExprs).forEach(([pid, de]) => {
            cpp += `    float dv_${pid} = _ds${idx}.last_[${de.lastI}] - _ds${idx}.first_delta_[${de.deltaIdx}];\n`;
            if (de.clamp) {
                cpp += `    if (dv_${pid} < 0 || fabsf(dv_${pid}) < 1e-6f) dv_${pid} = 0;\n`;
            }
        });

        // --- Ordenar topLevelFields pela ordem do tipo.ai/bi (saida flat consistente) ---
        const aiOrder = new Map();
        [...tipoAi, ...tipoBi].forEach((a, i) => aiOrder.set(a.id, i));
        topLevelFields.sort((a, b) => {
            const ia = aiOrder.has(a.pid) ? aiOrder.get(a.pid) : 999 + a.pid.localeCompare('');
            const ib = aiOrder.has(b.pid) ? aiOrder.get(b.pid) : 999 + b.pid.localeCompare('');
            return ia - ib;
        });

        // --- Emitir top-level fields ---
        // src.bi (esquema bi_blocks) ganha guarda bi_valid — nunca publica bit chutado.
        topLevelFields.forEach(({ key, src }) => {
            const guard = src.bi ? `if (_ds${idx}.bi_valid) ` : '';
            if (src.format === 'hex') {
                cpp += `    ${guard}{ char _h[8]; snprintf(_h, sizeof(_h), "%x", (uint16_t)(${src.expr})); d["${this._escStr(key)}"] = String(_h); }\n`;
            } else {
                cpp += `    ${guard}d["${this._escStr(key)}"] = ${src.expr};\n`;
            }
        });

        // --- Reordenar groups conforme tipo.group_order (se definido) ---
        if (tipo && Array.isArray(tipo.group_order)) {
            const ordered = {};
            for (const g of tipo.group_order) if (groups[g]) ordered[g] = groups[g];
            for (const g of Object.keys(groups)) if (!ordered[g]) ordered[g] = groups[g];
            // sobrescreve
            Object.keys(groups).forEach(k => delete groups[k]);
            Object.assign(groups, ordered);
        }

        // --- Emitir grupos aninhados (pula grupos vazios) ---
        for (const [groupKey, fields] of Object.entries(groups)) {
            if (fields.length === 0 && groupKey !== 'status') continue;
            const gvar = `g_${groupKey.replace(/[^a-zA-Z0-9_]/g, '_')}`;
            cpp += `    JsonObject ${gvar} = d.createNestedObject("${this._escStr(groupKey)}");\n`;
            fields.forEach(({ subKey, src }) => {
                const guard = src.bi ? `if (_ds${idx}.bi_valid) ` : '';
                if (src.format === 'hex') {
                    cpp += `    ${guard}{ char _h[8]; snprintf(_h, sizeof(_h), "%x", (uint16_t)(${src.expr})); ${gvar}["${this._escStr(subKey)}"] = String(_h); }\n`;
                } else {
                    cpp += `    ${guard}${gvar}["${this._escStr(subKey)}"] = ${src.expr};\n`;
                }
            });
            // status.work_state_text: se o grupo for 'status' e tivermos work_state, adiciona o texto tambem
            if (groupKey === 'status' && fieldSources['work_state']) {
                cpp += `    ${gvar}["work_state_text"] = _work_state_text((uint16_t)${fieldSources['work_state'].expr});\n`;
            }
        }

        // --- Timestamp no fim, se configurado ---
        if (tsPosition === 'last') {
            cpp += `    d["timestamp"] = ${tsExpr};\n`;
        }

        cpp += `
    // Payload na heap — mesma razao do JSON doc acima.
    char* payload = (char*)malloc(3072);
    if (!payload) {
        Serial.println("[RS485] malloc payload falhou — pulando publish");
        return;
    }
    size_t sz = serializeJson(d, payload, 3072);
    if (sz > 0) {
        publish("${deviceName}/data", payload);
        Serial.printf("\\n===== PUBLICADO: ${topicName} (%d amostras) =====\\n", n);
        Serial.println(payload);
        Serial.println();
    }
    free(payload);

    // Reset do ciclo (preserva 'first_delta' da ultima amostra para o proximo intervalo)
`;
        if (deltaFields.length > 0) {
            // Copia o último para primeiro do próximo ciclo (delta continuo)
            deltaFields.forEach((_, i) => {
                const lastI = avgFields.length + lastFields.length + i;
                cpp += `    _ds${idx}.first_delta_[${i}] = _ds${idx}.last_[${lastI}];\n`;
            });
        }
        cpp += `    for (int i = 0; i < ${Math.max(avgFields.length, 1)}; i++) _ds${idx}.sum_[i] = 0;
    _ds${idx}.samples = 0;
}
`;
        return cpp;
    }

    // Traduz dataType + scale em expressao C++ que devolve float
    // wordOrder: 'high_first' (default, big-endian word: reg[N]=high, reg[N+1]=low)
    //         ou 'low_first' (Sungrow: reg[N]=low, reg[N+1]=high)
    _decodeExpr(dataType, buf, idx0, scale, meta, wordOrder = 'high_first') {
        const s = Number(scale) || 1;
        const scaleExpr = s === 1 ? '' : ` / ${s.toFixed(6).replace(/0+$/, '').replace(/\.$/, '.0')}`;
        const hi = wordOrder === 'low_first' ? `${buf}[${idx0}+1]` : `${buf}[${idx0}]`;
        const lo = wordOrder === 'low_first' ? `${buf}[${idx0}]`   : `${buf}[${idx0}+1]`;
        switch (dataType) {
            case 'U16':
                return `(float)${buf}[${idx0}]${scaleExpr}`;
            case 'S16':
                return `(float)(int16_t)${buf}[${idx0}]${scaleExpr}`;
            case 'U32':
                return `(float)(((uint32_t)${hi} << 16) | ${lo})${scaleExpr}`;
            case 'S32':
                return `(float)(int32_t)(((uint32_t)${hi} << 16) | ${lo})${scaleExpr}`;
            case 'FLOAT':
                // IEEE 754 32-bit em 2 regs Modbus. word_order respeitado via hi/lo.
                return `(_u32_to_float(${hi}, ${lo})${scaleExpr})`;
            case 'COSFI':
                return `(float)((${buf}[${idx0}] & 0x8000) ? -1 : 1) * (float)(${buf}[${idx0}] & 0x7FFF)${scaleExpr}`;
            case 'U32_SUM3': {
                const count = Number(meta.count) || 3;
                const regsPer = Number(meta.regs_per) || 2;
                const items = [];
                for (let k = 0; k < count; k++) {
                    const a = `${buf}[${idx0}+${k*regsPer}]`;
                    const b = `${buf}[${idx0}+${k*regsPer+1}]`;
                    items.push(`(int32_t)(((uint32_t)${a} << 16) | ${b})`);
                }
                return `(float)(${items.join(' + ')})${scaleExpr}`;
            }
            default:
                return `(float)${buf}[${idx0}]${scaleExpr}`;
        }
    }

    _resolveScale(scale, scales) {
        if (scale === undefined || scale === null) return 1;
        if (typeof scale === 'number') return scale;
        if (typeof scale === 'string' && scales[scale] !== undefined) return scales[scale];
        return 1;
    }

    // Sanitiza valor de override de escala vindo do props do diagrama.
    // Aceita number positivo. Retorna null pra valores vazios/invalidos
    // (fallback: usa scale original do catalogo).
    _parseScaleOverride(val) {
        if (val === undefined || val === null || val === '') return null;
        const n = Number(val);
        return (Number.isFinite(n) && n > 0) ? n : null;
    }

    // pids reconhecidos como CORRENTE (ia/ib/ic e variantes capitalizadas/maiusculas).
    _isCurrentPid(pid) {
        return /^(i[abc]|I[abc]|ia|ib|ic|Ia|Ib|Ic)$/.test(pid);
    }

    // pids reconhecidos como TENSAO (va/vb/vc + V fase-fase + variantes capitalizadas).
    _isVoltagePid(pid) {
        return /^(v[abc]|V[abc]|v(ab|bc|ca)|V(ab|bc|ca))$/.test(pid);
    }

    // Aplica overrides de escala do componente (props.current_scale_override e
    // props.voltage_scale_override) sobre os campos correspondentes do ai_map.
    // NAO MUTA o ai_map original do catalogo — devolve uma copia rasa modificada.
    // Usado tanto pelo gerador RS485 quanto TCP.
    _applyScaleOverrides(aiMap, dev) {
        const iOver = dev && dev.current_scale_override;
        const vOver = dev && dev.voltage_scale_override;
        if (!iOver && !vOver) return aiMap;
        const out = {};
        for (const [pid, m] of Object.entries(aiMap)) {
            if (iOver && this._isCurrentPid(pid)) {
                out[pid] = { ...m, scale: iOver };
            } else if (vOver && this._isVoltagePid(pid)) {
                out[pid] = { ...m, scale: vOver };
            } else {
                out[pid] = m;
            }
        }
        return out;
    }

    // Flag de diagnóstico — quando true, generator NÃO emite leitura de TP/TC
    // nem multiplicação dos decoders. Usado pra isolar regressões da feature.
    // Setar no console do browser: window.IOT_DISABLE_TP_TC = true
    _tpTcDisabled() {
        try { return typeof window !== 'undefined' && window.IOT_DISABLE_TP_TC === true; }
        catch (_) { return false; }
    }

    // Flag de MODO SIMULACAO/LAB. Quando ativo, os leitores Modbus (RS485/TCP)
    // preenchem o buffer com valores PLAUSIVEIS em vez de ler dos perifericos
    // (que nao existem na bancada). O decode+publish REAIS rodam por cima e o
    // topico ganha prefixo "TESTE/". Ativar via window.IOT_SIMULATE=true (browser)
    // ou editor.simulate=true (harness/headless).
    _simMode() {
        try { if (typeof window !== 'undefined' && window.IOT_SIMULATE === true) return true; } catch (_) {}
        return !!(this.editor && this.editor.simulate);
    }

    // Flag de FALLBACK do fluxo LoRa. Por padrao (false) o gerador emite o modo
    // MESTRE-PUXA (polling orquestrado): o gateway POLLa os satelites um a um e o
    // satelite responde DATA(req_id) so' quando perguntado — nada de push por timer.
    // Quando ativo (window.IOT_LORA_AUTONOMOUS===true OU editor.loraAutonomous),
    // volta o comportamento ANTIGO: o satelite EMPURRA telemetria sozinho por
    // timer e o gateway nao orquestra. Usado como escape-hatch/retrocompat.
    _loraAutonomousPush() {
        try { if (typeof window !== 'undefined' && window.IOT_LORA_AUTONOMOUS === true) return true; } catch (_) {}
        return !!(this.editor && this.editor.loraAutonomous);
    }

    // Heuristica de valor PLAUSIVEL por campo (sim mode). Devolve o RAW que, apos
    // dividir pela `scale` no decode, aproxima o `target` de engenharia.
    // Prioriza m.json/m.unit/pid (lowercase). Assume equipamento OK — so' plausivel.
    _simRawForField(pid, m) {
        const hint = `${(m && m.json) || ''} ${(m && m.unit) || ''} ${pid || ''}`.toLowerCase();
        let target;
        if (/cosfi|cosphi|\bfp\b|fp[_-]?|\bpf\b/.test(hint)) target = 0.92;
        else if (/temp/.test(hint)) target = 45;
        else if (/\bhz\b|freq/.test(hint)) target = 60;
        else if (/var/.test(hint)) target = 800;          // antes de "v" (substring)
        else if (/\bkw\b|\bw\b|pot|power|\bpt\b|\bpa\b/.test(hint)) target = 5000;
        else if (/\ba\b|amp|corrente|curr|\bi[abc]\b/.test(hint)) target = 30;
        else if (/\bv\b|volt|tens|\bv[abc]\b/.test(hint)) target = 220;
        else target = 100;
        let scale = (typeof (m && m.scale) === 'number' && m.scale > 0) ? m.scale : 100;
        let raw = Math.round(target * scale);
        if (raw < 0) raw = 0;
        if (raw > 65535) raw = 65535;
        return raw;
    }

    // Gera o bloco C++ de preenchimento do buf com valores plausiveis (sim mode).
    // Compartilhado entre RS485 (_read_dev) e TCP (_read_tcp_inv): mesma heuristica.
    // Zera buf inteiro, escreve cada campo do aiMap via blockOffsets, aplica wobble
    // leve em ate 2 correntes pra os graficos mexerem. Retorna true (pula leitura real).
    _genSimFill(aiMap, blocks, blockOffsets, indent = '    ') {
        let total = 0;
        for (const b of blocks) total += (Number(b.count) || 0);
        total = Math.max(total, 1);
        let cpp = `${indent}// MODO SIMULACAO/LAB: sem periferico real — preenche valores plausiveis.\n`;
        cpp += `${indent}uint32_t _w = (millis() / 1000) % 7;  // wobble leve p/ graficos nao congelarem\n`;
        cpp += `${indent}(void)_w;\n`;
        cpp += `${indent}for (uint16_t i = 0; i < ${total}; i++) buf[i] = 0;\n`;
        let wobbleLeft = 2;
        for (const [pid, m] of Object.entries(aiMap)) {
            if (m.block === undefined || m.offset === undefined) continue;
            if (m.block >= blocks.length) continue;
            const off = blockOffsets[m.block] + m.offset;
            const raw = this._simRawForField(pid, m);
            const regsPer = Number(m.regs_per) || ((m.dataType === 'U32' || m.dataType === 'S32' || m.dataType === 'FLOAT' || m.dataType === 'U32_SUM3') ? 2 : 1);
            const isCurrent = this._isCurrentPid(pid);
            const wob = (isCurrent && wobbleLeft > 0) ? ' + _w' : '';
            if (wob) wobbleLeft--;
            if (regsPer >= 2) {
                // U32/U32_SUM3 etc: valor no registrador BAIXO, 0 no alto.
                cpp += `${indent}buf[${off}] = 0; buf[${off} + 1] = (uint16_t)(${raw}${wob});  // ${pid}\n`;
            } else {
                cpp += `${indent}buf[${off}] = (uint16_t)(${raw}${wob});  // ${pid}\n`;
            }
        }
        cpp += `${indent}return true;\n`;
        return cpp;
    }

    _escStr(s) {
        return String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    // ---- Máquina de estados do pivô (Cenário B) ----
    // Emitida só quando spec.pivo existe e a TON tem relés. Reusa:
    //   - inputs_get_state()  -> leitura das BI (entradas digitais)
    //   - relay_set(num, on)  -> acionamento das BO (relés)
    //   - mqtt_publish_sub / lora_publish_data -> publicacao de status
    // BI/BO == 0 significam "não usa" e são omitidos (sem monitoramento/acionamento).
    _genPivot(spec) {
        const p = spec.pivo;
        const biPress = p.bi_pressostato;   // 1-6 ou 0
        const biEmerg = p.bi_emergencia;
        const biDesal = p.bi_desalinhamento;
        const boMov   = p.bo_movimento;
        const boDir   = p.bo_sentido_dir;
        const boEsq   = p.bo_sentido_esq;
        const tempo   = p.tempo_pressao_s;

        // Helpers de geração: leitura de BI (1=ativo). Numero 0 => expressao "false".
        const biRead = (n) => n ? `((inputs_get_state() >> ${n - 1}) & 1)` : 'false';

        // Status publish: usa o mesmo mecanismo dos demais I/O.
        let pubLine = `    Serial.printf("[PIVO] %s\\n", payload);`;
        if (spec.wifi) {
            pubLine = `    mqtt_publish_sub("pivo", payload);`;
        } else if (spec.lora_role === 'satellite') {
            pubLine = `    lora_publish_data("pivo", payload);`;
        }

        let cpp = `// ===== PIVÔ: máquina de estados (Cenário B — a TON é o cérebro) =====
// Painel "burro": a TON aciona os relés (BO) e lê o painel pelas entradas (BI).
// Config (do diagrama): BI pressostato=${biPress || '—'}, BI emergencia=${biEmerg || '—'},
//   BI desalinhamento=${biDesal || '—'}; BO movimento=${boMov || '—'}, BO dir=${boDir || '—'},
//   BO esq=${boEsq || '—'}; timeout pressão=${tempo}s.
`;
        // Forward-decl: em satellite o helper lora_publish_data e' definido mais
        // abaixo (no router LoRa). O modulo do pivo o referencia antes — declara aqui.
        if (!spec.wifi && spec.lora_role === 'satellite') {
            cpp += `static void lora_publish_data(const char* subtopic, const char* payload_json);  // def. no router LoRa abaixo
`;
        }
        cpp += `
enum PivotState {
    PIVO_OCIOSO = 0,        // parado, aguardando comando "pivot on"
    PIVO_ESPERANDO_PRESSAO, // comando recebido; esperando pressostato (água chegar)
    PIVO_RODANDO,           // água OK; BO movimento acionado
    PIVO_FALHA_PRESSAO,     // timeout sem pressão
    PIVO_PARADO,            // parado por comando "pivot off" ou por falha de segurança
};

static PivotState   _pivot_state    = PIVO_OCIOSO;
static unsigned long _pivot_t_wait   = 0;     // millis em que entrou em ESPERANDO_PRESSAO
static char          _pivot_dir      = 'R';   // sentido pedido ('L'/'R'); aplicado ao rodar
static const char*   _pivot_falha    = "";    // motivo da ultima parada por seguranca
#define PIVO_TIMEOUT_MS  ${tempo}000UL        // ${tempo}s para a água chegar

static const char* _pivot_state_str(PivotState s) {
    switch (s) {
        case PIVO_OCIOSO:            return "ocioso";
        case PIVO_ESPERANDO_PRESSAO: return "esperando_pressao";
        case PIVO_RODANDO:           return "rodando";
        case PIVO_FALHA_PRESSAO:     return "falha_pressao";
        case PIVO_PARADO:            return "parado";
        default:                     return "?";
    }
}

// Abre TODOS os BO do pivô (movimento + sentidos). Chamado ao parar.
static void _pivot_relays_off() {
`;
        if (boMov) cpp += `    relay_set(${boMov}, false);  // BO movimento\n`;
        if (boDir) cpp += `    relay_set(${boDir}, false);  // BO sentido direita\n`;
        if (boEsq) cpp += `    relay_set(${boEsq}, false);  // BO sentido esquerda\n`;
        cpp += `}

// Aplica o sentido atual (_pivot_dir) aos BO de sentido (se configurados).
static void _pivot_apply_dir() {
`;
        if (boDir || boEsq) {
            if (boDir) cpp += `    relay_set(${boDir}, _pivot_dir == 'R');  // direita\n`;
            if (boEsq) cpp += `    relay_set(${boEsq}, _pivot_dir == 'L');  // esquerda\n`;
        } else {
            cpp += `    // Sem BO de sentido configurado (pivô só liga/desliga).\n`;
        }
        cpp += `}

`;
        // Publica status do pivô — espelha inputs/relays.
        cpp += `// Publica estado do pivô em <BASE>/pivo (ou via LoRa em satellite).
static void _pivot_publish_status() {
    // Payload COMPACTO pra caber no MTU 200 do LoRa (envelope + payload). Chaves:
    // estado, ps (pressostato), dir (sentido), falha. "rodando" foi removido —
    // e' derivavel de estado=="rodando". (Consumidor backend ainda e' stub.)
    char payload[120];
    snprintf(payload, sizeof(payload),
        "{\\"estado\\":\\"%s\\",\\"ps\\":%d,\\"dir\\":\\"%c\\",\\"falha\\":\\"%s\\"}",
        _pivot_state_str(_pivot_state),
        ${biPress ? biRead(biPress) : '0'},
        _pivot_dir,
        _pivot_falha);
${pubLine}
}

// ----- Comandos (chamados pelo parser em _process_command_inner) -----
static void pivot_cmd_start() {
    _pivot_falha = "";
    _pivot_t_wait = millis();
    _pivot_state = PIVO_ESPERANDO_PRESSAO;
    Serial.println("[PIVO] start -> ESPERANDO_PRESSAO");
    _pivot_publish_status();
}

static void pivot_cmd_stop() {
    _pivot_relays_off();
    _pivot_state = PIVO_PARADO;
    Serial.println("[PIVO] stop -> PARADO");
    _pivot_publish_status();
}

static void pivot_cmd_dir(char d) {
    _pivot_dir = (d == 'L') ? 'L' : 'R';
    Serial.printf("[PIVO] sentido = %c\\n", _pivot_dir);
    // Se ja' esta rodando, aplica imediatamente.
    if (_pivot_state == PIVO_RODANDO) _pivot_apply_dir();
    _pivot_publish_status();
}

// ----- Loop da máquina de estados (chamado no loop() principal) -----
void pivot_loop() {
    bool press = ${biRead(biPress)};
`;
        // Monitoramento de segurança: só os sinais configurados (BI != 0) geram
        // checagem de parada — emitidos condicionalmente no case RODANDO abaixo.
        cpp += `
    switch (_pivot_state) {
        case PIVO_OCIOSO:
        case PIVO_PARADO:
        case PIVO_FALHA_PRESSAO:
            // Estados terminais/idle: nada a fazer ate' o proximo comando.
            break;

        case PIVO_ESPERANDO_PRESSAO:
            if (press) {
                // Água chegou: aciona movimento + sentido e vai para RODANDO.
`;
        if (boMov) cpp += `                relay_set(${boMov}, true);  // BO movimento\n`;
        cpp += `                _pivot_apply_dir();
                _pivot_state = PIVO_RODANDO;
                Serial.println("[PIVO] pressao OK -> RODANDO");
                _pivot_publish_status();
            } else if (millis() - _pivot_t_wait >= PIVO_TIMEOUT_MS) {
                _pivot_relays_off();
                _pivot_falha = "timeout";
                _pivot_state = PIVO_FALHA_PRESSAO;
                Serial.println("[PIVO] timeout sem pressao -> FALHA_PRESSAO");
                _pivot_publish_status();
            }
            break;

        case PIVO_RODANDO: {
            // Monitora condicoes de parada de seguranca.
            bool stop = false;
            const char* motivo = "";
            if (!press) { stop = true; motivo = "press_caiu"; }
`;
        if (biEmerg) cpp += `            if (${biRead(biEmerg)}) { stop = true; motivo = "emergencia"; }\n`;
        if (biDesal) cpp += `            if (${biRead(biDesal)}) { stop = true; motivo = "desalinhamento"; }\n`;
        cpp += `            if (stop) {
                _pivot_relays_off();
                _pivot_falha = motivo;
                _pivot_state = PIVO_PARADO;
                Serial.printf("[PIVO] parada de seguranca (%s) -> PARADO\\n", motivo);
                _pivot_publish_status();
            }
            break;
        }
    }
}

`;
        return cpp;
    }

    // ======================================================================
    // POSTO DE COMBUSTIVEL — bomba controlada pela TON (V1 ton3/ton4, V2 ton3v2/ton4v2).
    // Logica = lib pura `bomba_posto` (firmware-libs/bomba_posto, testada no host);
    // aqui so' o glue: BI/BO/AI por PAPEL (ton_bi/ton_bo/ton_ai resolvidos no front e
    // injetados em _bombaIoByEquip), MQTT (auth/req|resp, abastecimento, evento,
    // bomba, cmd/rfid_sync), NVS (lista com versao + sessao em andamento), comandos
    // de bancada (card/mat/fluxo/status/rearme/net/lista) e guarda de OTA.
    // Doc: "Posto de Combustivel na Fazenda — Como funciona" + "Teste em bancada".
    // ======================================================================
    _processBomba(ton, other, result) {
        if (result.bomba) return;  // so uma bomba por TON
        const p = other.props || {};
        const num = (v, max) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 1 && n <= (max || 8) ? n : 0; };
        const flt = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
        const pint = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : d; };
        const bool = (v, d) => (v === undefined || v === null || v === '') ? d : !(v === false || v === 'false' || v === 0 || v === '0' || v === 'nao' || v === 'não');
        const eqId = (p.equipamento_id || '').trim();
        // BO/BI/AI vem do mapeamento PADRAO da TON (sheet da TON -> Comando/Status/Medicoes
        // -> ton_bo/ton_bi/ton_ai), resolvido por PAPEL no frontend (nome do ponto da bomba)
        // e injetado em _bombaIoByEquip[equipamento_id]. Fallback pras props = harness/override.
        const io  = (this._bombaIoByEquip && eqId && this._bombaIoByEquip[eqId]) || {};
        const iob = io.bo || {}, ioi = io.bi || {}, ioa = io.ai || {};
        const ain = ioa.nivel || null;  // {ch, mv0, mv100} do ton_ai
        result.bomba = {
            componentId: other.id,
            name: p.name || COMPONENT_TYPES[other.type].label,
            equipamento_id: eqId,
            // saidas (papel -> BO)
            bo_liga:       iob.liga      || num(p.bo_liga),
            bo_permissao:  iob.permissao || num(p.bo_permissao),
            bo_solenoide:  iob.solenoide || num(p.bo_solenoide),
            bo_sinaleiro:  iob.sinaleiro || num(p.bo_sinaleiro),
            // entradas (papel -> BI); NF = contato fechado e' o estado normal
            bi_contator:   ioi.contator  || num(p.bi_contator),
            bi_auto:       ioi.automatico|| num(p.bi_auto),
            bi_emerg:      ioi.estop     || num(p.bi_emerg),
            bi_bico:       ioi.bico      || num(p.bi_bico),
            bi_boia_min:   ioi.boia_min  || num(p.bi_boia_min),
            bi_boia_alta:  ioi.boia_alta || num(p.bi_boia_alta),
            // nivel (AI)
            ai_nivel:       (() => { const n = parseInt(ain ? ain.ch : p.ai_nivel, 10); return (n === 1 || n === 2) ? n : 0; })(),
            ai_nivel_0_mv:   ain ? (parseInt(ain.mv0, 10) || 0) : pint(p.ai_nivel_0_mv, 0) || 0,
            ai_nivel_100_mv: ain ? pint(ain.mv100, 3000) : pint(p.ai_nivel_100_mv, 3000),
            // parametros (bancada: fluxo_parado 10 s / timeout 30 s; campo: 30 s / 600 s)
            pulso_ms:        pint(p.pulso_ms, 500),
            espera_bi1_ms:   pint(p.espera_bi1_ms, 1000),
            janela_mat_s:    pint(p.janela_mat_s, 60),
            auth_timeout_s:  pint(p.auth_timeout_s, 3),
            fluxo_parado_s:  pint(p.fluxo_parado_s, 30),
            timeout_s:       pint(p.timeout_s, 600),
            nivel_min_pct:   flt(p.nivel_min_pct, 10),
            exigir_matricula: bool(p.exigir_matricula, true),
            matricula_livre:  bool(p.matricula_livre, false),   // fail-closed por padrao: lista sem matriculas NEGA
            telemetria_s:    pint(p.telemetria_s, 30),
            k_fator:         flt(p.k_fator, 450),
            uid_teste:       (p.uid_teste || 'PC-07').trim().toUpperCase(),
            mat_teste:       (p.mat_teste || '1234').trim(),
        };
        const b = result.bomba;
        if (!result.has_relays) {
            result.warnings.push('Bomba conectada a uma TON sem relés (BO) — o contator não pode ser acionado. Use TON3/TON4 (ton2 não tem BO).');
        } else {
            if (!b.bo_liga || !b.bo_permissao) result.warnings.push('Bomba: mapeie na TON os BO "Liga" (pulso) e "Permissão" (mantida) — sheet da TON → Comando.');
            if (!b.bo_solenoide) result.warnings.push('Bomba: BO "Solenoide" não mapeado (a válvula não será comandada).');
            if (!b.bi_contator) result.warnings.push('Bomba: BI "Contator" (contato auxiliar do K1) não mapeado — partida/colado não serão confirmados (modo sem confirmação).');
            if (!b.bi_auto) result.warnings.push('Bomba: BI "Auto/Manual" não mapeado — a TON assume chave em Automático.');
            if (!b.bi_emerg) result.warnings.push('Bomba: BI "Emergência" não mapeado.');
            if (!b.bi_bico) result.warnings.push('Bomba: BI "Bico" não mapeado — o fim por bico devolvido não existirá.');
        }
    }

    // main.cpp: so' o include (as definicoes vivem em src/bomba.cpp)
    _genBomba(spec) {
        return `#include "bomba.h"   // posto de combustivel: maquina de estados em src/bomba.cpp (lib bomba_posto)
bool g_cmd_from_serial = false;   // origem do comando em curso (Serial USB = acesso fisico); MQTT = false
`;
    }

    _genBombaH(spec) {
        return `// bomba.h — posto de combustivel na TON (glue gerado; logica na lib bomba_posto)
#ifndef BOMBA_H
#define BOMBA_H
#include <Arduino.h>

typedef void (*bomba_publish_fn)(const char* subtopic, const char* payload);

void bomba_init();                          // NVS (lista + sessao), config; reles ficam desligados
void bomba_loop(bomba_publish_fn publish);  // le BI/AI, roda a maquina, aplica BO, publica
bool bomba_ota_permitida();                 // so' em ociosa/bloqueada

// MQTT (chamadas pelo _onMessage do mqtt.cpp)
void bomba_set_lista(const char* json);     // <BASE>/cmd/rfid_sync (retido): lista de autorizados
void bomba_auth_resp(const char* json);     // <BASE>/auth/resp: resposta do NexON

// Comandos (Serial / <BASE>/cmd): retornam true e preenchem msg
bool bomba_cmd(const String& cmd, char* msg, size_t msg_sz);
#endif
`;
    }

    _genBombaCpp(spec) {
        const b = spec.bomba;
        // Comandos de SIMULACAO (card/mat/fluxo/net) via MQTT so' em build de bancada: topico base
        // comecando por TESTE/ ou modo Simular. Em build de CAMPO ficam so' no Serial (acesso fisico).
        const topicBase = String(spec.topicBase || (spec.mqtt && spec.mqtt.topic_base) || '');
        const bench = this._simMode() || /^TESTE\//i.test(topicBase);
        const biRead = (n) => n ? `((st >> ${n - 1}) & 1)` : null;
        // adc_read_mv(channel) da base e' 1-BASED (1=AN1, 2=AN2; V2: 3/4=AN_C). Bug anterior: passava ai_nivel-1 => AI1 lia o AN2.
        const aiCh = b.ai_nivel ? b.ai_nivel : -1;
        return `// bomba.cpp — glue gerado: POSTO DE COMBUSTIVEL na TON. A logica (estados, validacao,
// fins, contator colado, manual) esta em bomba_posto.cpp (lib pura, testada no host).
// Mapa: BO liga=${b.bo_liga || '—'} permissao=${b.bo_permissao || '—'} solenoide=${b.bo_solenoide || '—'} sinaleiro=${b.bo_sinaleiro || '—'};
//       BI contator=${b.bi_contator || '—'} auto=${b.bi_auto || '—'} emerg=${b.bi_emerg || '—'} bico=${b.bi_bico || '—'} boia_min=${b.bi_boia_min || '—'} boia_alta=${b.bi_boia_alta || '—'};
//       AI nivel=${b.ai_nivel || '—'} (${b.ai_nivel_0_mv}..${b.ai_nivel_100_mv} mV = 0..100 %).
// Convencao BI: contato fechado ao GND = 1 (inputs_get_state). Emergencia/boias sao NF (aberto = atuado).
#include "bomba.h"
#include "config.h"
#include "bomba_posto.h"
#include "inputs.h"
#include "relays.h"
#include "adc.h"
#include "mqtt.h"
#include <WiFi.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>
#include <esp_system.h>

extern bool g_cmd_from_serial;   // main.cpp

#define BOMBA_PULSO_MS         ${b.pulso_ms}UL
#define BOMBA_ESPERA_BI1_MS    ${b.espera_bi1_ms}UL
#define BOMBA_JANELA_MAT_MS    ${b.janela_mat_s}000UL
#define BOMBA_AUTH_TIMEOUT_MS  ${b.auth_timeout_s}000UL
#define BOMBA_FLUXO_PARADO_MS  ${b.fluxo_parado_s}000UL
#define BOMBA_TEMPO_MAX_MS     ${b.timeout_s}000UL
#define BOMBA_NIVEL_MIN_PCT    ${Number(b.nivel_min_pct).toFixed(2)}f
#define BOMBA_EXIGIR_MAT       ${b.exigir_matricula ? 1 : 0}
#define BOMBA_MAT_LIVRE        ${b.matricula_livre ? 1 : 0}   // 1 = matricula digitada nao e' conferida (opcao explicita)
#define BOMBA_SIM_CMDS         ${bench ? 1 : 0}   // 1 = bancada (TESTE/ ou Simular): card/mat/fluxo/net aceitos por MQTT; 0 = campo: so' pelo Serial
#define BOMBA_TELEMETRIA_MS    ${b.telemetria_s}000UL
#define BOMBA_NIVEL_BAIXO_MS   3000UL   // AI abaixo do minimo precisa persistir isto p/ encerrar (amostra ruim nao corta)
#define BOMBA_BOOT_SETTLE_MS   500UL    // espera as entradas do MCP estabilizarem (3 scans de 50 ms) antes do 1o tick
#define BOMBA_AI_0_MV          ${Number(b.ai_nivel_0_mv || 0).toFixed(1)}f
#define BOMBA_AI_100_MV        ${Number(b.ai_nivel_100_mv).toFixed(1)}f
#define BOMBA_K_FATOR          ${Number(b.k_fator).toFixed(2)}f
#define BOMBA_UID_TESTE        "${b.uid_teste}"
#define BOMBA_MAT_TESTE        "${b.mat_teste}"

static bomba::Maquina*  _m = nullptr;
static bomba_publish_fn _pub = nullptr;
static char   _pubPend[3][256]; static uint8_t _pubPendN = 0;   // eventos gerados antes do publish existir
static float  _fluxo_lpm = 0;         // bancada: comando "fluxo"; campo: fluxometro (bomba_set_fluxo)
static bool   _net_forcado_off = false;
static unsigned long _lastTel = 0, _lastSessaoSave = 0;
static bool   _relayLast[5] = {false,false,false,false,false};
static uint32_t _seqEvento = 0;
static bool   _sessaoAberta = false;

static void _emitir(const char* sub, const char* payload) {
    if (_pub) { _pub(sub, payload); return; }
    if (_pubPendN < 3) { strncpy(_pubPend[_pubPendN], payload, 255); _pubPend[_pubPendN][255] = 0; _pubPendN++; }
}
static long _epochDe(uint32_t ms) {
    time_t now = time(nullptr);
    if (now < 1700000000) return 0;   // sem NTP: 0 (o backend usa a hora de chegada)
    long delta = (long)((millis() - ms) / 1000UL);
    return (long)now - delta;
}
// Nivel (AI): MEDIANA das ultimas 9 amostras (1 a cada 20 ms). Uma amostra ruim (contato, ruido,
// glitch do ADC) nao vira "nivel baixo". Bancada 22/09: pilha com mau contato caia a 0 por 1 amostra.
static float _nivelPct() {
${aiCh >= 0 ? `    static float am[9]; static uint8_t n = 0, idx = 0; static uint32_t t_am = 0;
    uint32_t now = millis();
    if (n == 0 || now - t_am >= 20) { t_am = now; am[idx] = adc_read_mv(${aiCh}); idx = (uint8_t)((idx + 1) % 9); if (n < 9) n++; }
    float s[9]; for (uint8_t i = 0; i < n; i++) s[i] = am[i];
    for (uint8_t i = 1; i < n; i++) { float v = s[i]; int j = i - 1; while (j >= 0 && s[j] > v) { s[j + 1] = s[j]; j--; } s[j + 1] = v; }
    float mv = s[n / 2];
    float span = (BOMBA_AI_100_MV - BOMBA_AI_0_MV); if (span < 1.0f) span = 1.0f;
    float pct = (mv - BOMBA_AI_0_MV) / span * 100.0f;
    if (pct < 0) pct = 0; if (pct > 100) pct = 100;
    return pct;` : `    return -1.0f;   // sem transmissor de nivel mapeado`}
}

// ---- persistencia (NVS ns "posto"): lista (JSON retido) + sessao em andamento ----
// Bloqueio (falha_partida / contator_colado) PERSISTE no NVS: reset ou queda de energia nao destrava —
// so' o comando/botao 'rearme' (bancada 22/09: o bloqueio sumia ao religar a TON).
static void _salvarBloqueio(const char* motivo) {
    Preferences pr; if (!pr.begin("posto", false)) return;
    if (motivo && motivo[0]) pr.putString("bloq", motivo); else pr.remove("bloq");
    pr.end();
}
static void _salvarSessao(bool aberta) {
    Preferences pr; if (!pr.begin("posto", false)) return;
    if (!aberta) { pr.remove("sessao"); pr.end(); _sessaoAberta = false; return; }
    char j[200];
    snprintf(j, sizeof(j), "{\\"uid\\":\\"%s\\",\\"matricula\\":\\"%s\\",\\"inicio\\":%ld,\\"nivel_antes\\":%.0f,\\"litros\\":%.2f,\\"validacao\\":\\"%s\\"}",
             _m->uidAtual(), _m->matAtual(), _epochDe(millis()), _m->entradas().nivel_pct, _m->litros(), bomba::validacaoNome(_m->validacaoAtual()));
    pr.putString("sessao", j); pr.end(); _sessaoAberta = true;
}
static void _publicarSessaoInterrompida() {
    Preferences pr; if (!pr.begin("posto", true)) return;
    String s = pr.getString("sessao", ""); pr.end();
    if (!s.length()) return;
    StaticJsonDocument<256> d; if (deserializeJson(d, s)) { _salvarSessao(false); return; }
    char p[300];
    snprintf(p, sizeof(p), "{\\"uid\\":\\"%s\\",\\"matricula\\":\\"%s\\",\\"litros\\":%.2f,\\"inicio\\":%ld,\\"fim\\":0,\\"nivel_antes\\":%.0f,\\"nivel_depois\\":%.0f,\\"fim_motivo\\":\\"queda_energia\\",\\"validacao\\":\\"%s\\",\\"status\\":\\"queda_energia\\"}",
             d["uid"] | "", d["matricula"] | "", (float)(d["litros"] | 0.0f), (long)(d["inicio"] | 0L), (float)(d["nivel_antes"] | -1.0f), _nivelPct(), d["validacao"] | "offline");
    _emitir("abastecimento", p);
    Serial.println("[BOMBA] sessao interrompida por queda de energia/reset: transacao publicada");
    _salvarSessao(false);
}
static void _carregarLista(bomba::Lista& L, const char* json, bool persistir) {
    // v2: {"versao":N,"tags":[{"uid":"PC-07","mats":["1234"],"limite":0}],"mats":["1234"]}
    // legado: {"uids":["AABBCCDD"]}
    DynamicJsonDocument d(6144);
    if (deserializeJson(d, json)) { Serial.println("[BOMBA] lista invalida (JSON)"); return; }
    L.limpar();
    L.versao = d["versao"] | 0;
    for (JsonVariant v : d["uids"].as<JsonArray>()) L.adicionarTag(v.as<const char*>(), 0);
    for (JsonObject t : d["tags"].as<JsonArray>()) {
        const char* uid = t["uid"] | ""; if (!*uid) continue;
        L.adicionarTag(uid, t["limite"] | 0.0f);
        for (JsonVariant m : t["mats"].as<JsonArray>()) L.adicionarMatDaTag(uid, m.as<const char*>());
    }
    for (JsonVariant m : d["mats"].as<JsonArray>()) L.adicionarMat(m.as<const char*>());
    Serial.printf("[BOMBA] lista v%lu: %d tags, %d matriculas\\n", (unsigned long)L.versao, L.ntags(), L.nmats());
    if (L.ntags() == 0) Serial.println("[BOMBA] AVISO: lista SEM tags — ninguem autorizado offline (fail-closed)");
#if BOMBA_EXIGIR_MAT && !BOMBA_MAT_LIVRE
    if (L.nmats() > 0) { /* ok */ } else {
        bool algumaTagComMat = false;
        for (int i = 0; i < L.ntags(); i++) { /* Lista nao expoe tags; o glue so' avisa pelo total */ (void)i; }
        (void)algumaTagComMat;
        Serial.println("[BOMBA] AVISO: lista sem matriculas — com 'exigir matricula' toda matricula sera NEGADA offline (ligue 'matricula livre' se for intencional)");
    }
#endif
    if (persistir) {
        size_t n = strlen(json);
        Preferences pr; if (pr.begin("posto", false)) { if (n < 3900) pr.putString("lista", json); else Serial.println("[BOMBA] lista > 3,9 kB: nao persistida"); pr.end(); }
    }
}

// ---- ouvinte: maquina -> MQTT ----
struct _Ouv : public bomba::Ouvinte {
    void aoPedirAutorizacao(const char* req_id, const char* uid, const char* mat) override {
        char p[160];
        snprintf(p, sizeof(p), "{\\"req_id\\":\\"%s\\",\\"uid\\":\\"%s\\",\\"matricula\\":\\"%s\\",\\"mac\\":\\"%s\\"}", req_id, uid, mat, WiFi.macAddress().c_str());
        _emitir("auth/req", p);
        Serial.printf("[BOMBA] auth/req %s uid=%s mat=%s\\n", req_id, uid, mat);
    }
    void aoEvento(const char* tipo, const char* motivo, const char* uid, const char* mat) override {
        char p[220];
        snprintf(p, sizeof(p), "{\\"tipo\\":\\"%s\\",\\"motivo\\":\\"%s\\",\\"uid\\":\\"%s\\",\\"matricula\\":\\"%s\\",\\"seq\\":%lu,\\"ts\\":%ld}",
                 tipo, motivo, uid ? uid : "", mat ? mat : "", (unsigned long)(++_seqEvento), _epochDe(millis()));
        _emitir("evento", p);
        Serial.printf("[BOMBA] evento %s (%s) uid=%s mat=%s\\n", tipo, motivo, uid ? uid : "", mat ? mat : "");
    }
    void aoTransacao(const bomba::Transacao& t) override {
        char p[360];
        snprintf(p, sizeof(p),
            "{\\"uid\\":\\"%s\\",\\"matricula\\":\\"%s\\",\\"litros\\":%.2f,\\"inicio\\":%ld,\\"fim\\":%ld,\\"nivel_antes\\":%.0f,\\"nivel_depois\\":%.0f,"
            "\\"fim_motivo\\":\\"%s\\",\\"validacao\\":\\"%s\\",\\"status\\":\\"%s\\"}",
            t.uid, t.matricula, t.litros, _epochDe(t.inicio_ms), _epochDe(t.fim_ms), t.nivel_antes, t.nivel_depois,
            t.fim_motivo, bomba::validacaoNome(t.validacao), t.fim_motivo);
        _emitir("abastecimento", p);
        _salvarSessao(false);
        Serial.printf("[BOMBA] TRANSACAO %s uid=%s mat=%s litros=%.2f (%s)\\n", t.fim_motivo, t.uid, t.matricula, t.litros, bomba::validacaoNome(t.validacao));
    }
    void aoMudarEstado(bomba::Estado de, bomba::Estado para) override {
        static unsigned long _tEstado = 0;
        unsigned long agora = millis();
        Serial.printf("[BOMBA] %s -> %s  (+%lu ms | t=%lu)\\n", bomba::estadoNome(de), bomba::estadoNome(para), _tEstado ? (agora - _tEstado) : 0UL, agora);
        _tEstado = agora;
        if (para == bomba::ABASTECENDO) _salvarSessao(true);
        if (para == bomba::BLOQUEADA) _salvarBloqueio(_m ? _m->motivoBloqueio() : "restaurado");
        if (de == bomba::BLOQUEADA) _salvarBloqueio(nullptr);
        _lastTel = 0;   // forca telemetria na proxima volta
    }
};
static _Ouv _ouv;

static void _telemetria() {
    const bomba::Entradas& e = _m->entradas();
    char p[420];
    snprintf(p, sizeof(p),
        "{\\"estado\\":\\"%s\\",\\"nivel_pct\\":%.0f,\\"litros\\":%.2f,\\"uid\\":\\"%s\\",\\"matricula\\":\\"%s\\",\\"lista_versao\\":%lu,\\"lista_tags\\":%d,"
        "\\"contator\\":%d,\\"automatico\\":%d,\\"emergencia\\":%d,\\"bico_no_suporte\\":%d,\\"boia_min\\":%d,\\"boia_alta\\":%d,\\"fluxo_lpm\\":%.1f,"
        "\\"online\\":%d,\\"validacao\\":\\"%s\\",\\"motivo_bloqueio\\":\\"%s\\",\\"ver\\":\\"%s\\"}",
        bomba::estadoNome(_m->estado()), e.nivel_pct, _m->litros(), _m->uidAtual(), _m->matAtual(),
        (unsigned long)_m->lista().versao, _m->lista().ntags(),
        e.contator ? 1 : 0, e.automatico ? 1 : 0, e.emergencia ? 1 : 0, e.bico_no_suporte ? 1 : 0, e.nivel_baixo_boia ? 1 : 0, e.boia_alta ? 1 : 0,
        _fluxo_lpm, _m->online() ? 1 : 0, bomba::validacaoNome(_m->validacaoAtual()), _m->motivoBloqueio(), FIRMWARE_VERSION);
    _emitir("bomba", p);
}

static void _aplicarRele(int idx, int bo, bool on) {
    if (!bo) return;
    if (_relayLast[idx] == on) return;
    _relayLast[idx] = on;
    relay_set(bo, on);
}

// ---- API ----
// Entradas BI com anti-repique (debounce): chave seletora, botao de emergencia, gancho do bico e
// contato auxiliar sao mecanicos. A maquina so' ve o novo valor depois de BOMBA_DEBOUNCE_MS estavel,
// bit a bit (um contato oscilando nao segura os outros). Bancada 22/09: jumper da chave Auto mal
// preso gerou 8 trocas ociosa<->manual em 90 s (evento + transacao a cada troca).
#ifndef BOMBA_DEBOUNCE_MS
#define BOMBA_DEBOUNCE_MS 100
#endif
static uint8_t _lerBiFiltrado() {
    static uint8_t raw_ant = 0, estavel = 0; static uint32_t t_bit[8]; static bool init = false;
    uint8_t raw = inputs_get_state(); uint32_t now = millis();
    if (!init) { init = true; raw_ant = estavel = raw; for (int i = 0; i < 8; i++) t_bit[i] = now; return raw; }
    for (int i = 0; i < 8; i++) {
        uint8_t m = (uint8_t)(1u << i);
        if ((raw & m) != (raw_ant & m)) { raw_ant = (uint8_t)((raw_ant & ~m) | (raw & m)); t_bit[i] = now; }
        else if ((estavel & m) != (raw & m) && now - t_bit[i] >= BOMBA_DEBOUNCE_MS) {
            estavel = (uint8_t)((estavel & ~m) | (raw & m));
            Serial.printf("[BOMBA] BI%d -> %d (t=%lu)\\n", i + 1, (raw & m) ? 1 : 0, (unsigned long)now);
        }
    }
    return estavel;
}

void bomba_init() {
    // Serial USB-CDC: se o host (monitor) parar de ler, escrever NAO pode bloquear o loop da bomba.
    Serial.setTxTimeoutMs(0);
    // WiFi: modem-sleep DESLIGADO neste firmware. Com o power-save padrao do ESP32 a entrega MQTT
    // chegava em rajadas 3..50 s atrasadas (perda de pacote + retransmissao TCP) e o auth/req tem
    // so' 3 s p/ ir e voltar. WIFI_PS_NONE custa ~60 mA a mais (TON e' alimentada por fonte 5 V/2 A).
    WiFi.setSleep(false);
    bomba::Config c;
    c.pulso_bo1_ms = BOMBA_PULSO_MS; c.espera_bi1_ms = BOMBA_ESPERA_BI1_MS; c.janela_mat_ms = BOMBA_JANELA_MAT_MS;
    c.auth_timeout_ms = BOMBA_AUTH_TIMEOUT_MS; c.fluxo_parado_ms = BOMBA_FLUXO_PARADO_MS; c.tempo_max_ms = BOMBA_TEMPO_MAX_MS;
    c.nivel_min_pct = BOMBA_NIVEL_MIN_PCT; c.nivel_baixo_ms = BOMBA_NIVEL_BAIXO_MS; c.exigir_matricula = BOMBA_EXIGIR_MAT != 0; c.matricula_livre = BOMBA_MAT_LIVRE != 0;
    c.tem_contator_aux = ${b.bi_contator ? 'true' : 'false'};
    c.rng = esp_random;   // req_id do auth/req com nonce (T8.3)
    static bomba::Maquina m(c, &_ouv);
    _m = &m;
    // reles: garantidamente desligados no boot (relays_init ja fez; reforca)
${[b.bo_liga, b.bo_permissao, b.bo_solenoide, b.bo_sinaleiro].filter(Boolean).map(n => `    relay_set(${n}, false);`).join('\n')}
    Preferences pr;
    String bloq;
    if (pr.begin("posto", true)) {
        String lista = pr.getString("lista", ""); bloq = pr.getString("bloq", ""); pr.end();
        if (lista.length()) _carregarLista(_m->lista(), lista.c_str(), false);
    }
    if (bloq.length()) {
        _m->bloquear(bloq.c_str(), millis());
        Serial.printf("[BOMBA] BLOQUEIO restaurado do NVS (%s): reset nao destrava, use 'rearme'\\n", bloq.c_str());
    }
    Serial.printf("[OK] Posto de combustivel: maquina de estados (lista v%lu, %d tags) — comandos: card/mat/fluxo/status/rearme/net/lista\\n",
                  (unsigned long)_m->lista().versao, _m->lista().ntags());
}

bool bomba_ota_permitida() { return !_m || _m->otaPermitida(); }

void bomba_set_lista(const char* json) { if (_m) _carregarLista(_m->lista(), json, true); }

void bomba_auth_resp(const char* json) {
    if (!_m) return;
    StaticJsonDocument<256> d;
    if (deserializeJson(d, json)) { Serial.println("[BOMBA] auth/resp invalida"); return; }
    _m->respostaAuth(d["req_id"] | "", d["ok"] | false, d["motivo"] | "", d["limite_litros"] | 0.0f, millis());
}

void bomba_loop(bomba_publish_fn publish) {
    if (!_m) return;
    // Boot: o MCP so' tem estado valido apos 3 scans (150 ms); antes disso tudo le "aberto" e a maquina
    // entraria em MANUAL (evento espurio a cada boot). O filtro das BI inicializa depois da espera.
    static uint32_t t_boot = 0; if (!t_boot) t_boot = millis() ? millis() : 1;
    if (millis() - t_boot < BOMBA_BOOT_SETTLE_MS) return;
    if (publish && _pub != publish) {
        _pub = publish;
        _publicarSessaoInterrompida();
        for (uint8_t i = 0; i < _pubPendN; i++) _pub("evento", _pubPend[i]);
        _pubPendN = 0;
    }
    uint8_t st = _lerBiFiltrado();   // BI com anti-repique (100 ms, bit a bit)
    bomba::Entradas in;
    in.contator         = ${biRead(b.bi_contator) || 'false'};
    in.automatico       = ${b.bi_auto ? biRead(b.bi_auto) : 'true'};
    in.emergencia       = ${b.bi_emerg ? `!${biRead(b.bi_emerg)}` : 'false'};          // NF: aberto = atuado
    in.bico_no_suporte  = ${b.bi_bico ? biRead(b.bi_bico) : 'true'};
    in.nivel_baixo_boia = ${b.bi_boia_min ? `!${biRead(b.bi_boia_min)}` : 'false'};     // NF
    in.boia_alta        = ${b.bi_boia_alta ? `!${biRead(b.bi_boia_alta)}` : 'false'};   // NF
    in.nivel_pct        = _nivelPct();
    in.fluxo_lpm        = _fluxo_lpm;
    (void)st;
    // C4 anti-travamento: reles sem controle no I2C com a bomba fora de ociosa/bloqueada
    // por mais de 5 s -> bloqueia (persistido no NVS) e reinicia a TON (reinicializa os MCP
    // com tudo desligado). A emergencia FISICA em serie com a bobina do K1 e' a protecao final.
    {
        static unsigned long _tIoFalha = 0;
        if (relays_io_fault() && _m->estado() != bomba::OCIOSA && _m->estado() != bomba::BLOQUEADA) {
            if (!_tIoFalha) _tIoFalha = millis();
            if (millis() - _tIoFalha > 5000UL) {
                Serial.println("[BOMBA] reles sem controle (I2C) - BLOQUEANDO e reiniciando a TON");
                _ouv.aoEvento("io_falha", "i2c", _m->uidAtual(), _m->matAtual());
                _m->bloquear("io_falha", millis());
                mqtt_request_restart("io_falha", 2000);
                _tIoFalha = 0;
            }
        } else _tIoFalha = 0;
    }
    _m->setOnline(!_net_forcado_off && mqtt_connected());
    _m->tick(millis(), in);
    const bomba::Saidas& o = _m->saidas();
    _aplicarRele(0, ${b.bo_liga || 0}, o.liga);
    _aplicarRele(1, ${b.bo_permissao || 0}, o.permissao);
    _aplicarRele(2, ${b.bo_solenoide || 0}, o.solenoide);
    _aplicarRele(3, ${b.bo_sinaleiro || 0}, o.sinaleiro);
    if (_m->estado() == bomba::ABASTECENDO && millis() - _lastSessaoSave > 5000) { _lastSessaoSave = millis(); _salvarSessao(true); }
    if (millis() - _lastTel > BOMBA_TELEMETRIA_MS) { _lastTel = millis(); _telemetria(); }
}

bool bomba_cmd(const String& cmdIn, char* msg, size_t msg_sz) {
    if (!_m) return false;
    String cmd = cmdIn; cmd.trim();
    String low = cmd; low.toLowerCase();
#if !BOMBA_SIM_CMDS
    // Build de CAMPO: simulacao (card/mat/fluxo/net) so' com acesso fisico (Serial USB). Por MQTT: recusa.
    if (!g_cmd_from_serial && (low.startsWith("card") || low.startsWith("mat") || low.startsWith("fluxo") || low.startsWith("net "))) {
        Serial.printf("[BOMBA] comando de simulacao recusado por MQTT em build de campo: %s\\n", cmd.c_str());
        snprintf(msg, msg_sz, "sim_cmd_recusado_build_campo"); return true;
    }
#endif
    if (low.startsWith("card ")) {
        String u = cmd.substring(5); u.trim(); u.toUpperCase();
        if (!u.length()) u = BOMBA_UID_TESTE;
        _m->cartao(u.c_str(), millis()); snprintf(msg, msg_sz, "card_%s_%s", u.c_str(), bomba::estadoNome(_m->estado())); return true;
    }
    if (low == "card") { _m->cartao(BOMBA_UID_TESTE, millis()); snprintf(msg, msg_sz, "card_%s", BOMBA_UID_TESTE); return true; }
    if (low.startsWith("mat ")) {
        String m = cmd.substring(4); m.trim();
        if (!m.length()) m = BOMBA_MAT_TESTE;
        _m->matricula(m.c_str(), millis()); snprintf(msg, msg_sz, "mat_%s_%s", m.c_str(), bomba::estadoNome(_m->estado())); return true;
    }
    if (low == "mat") { _m->matricula(BOMBA_MAT_TESTE, millis()); snprintf(msg, msg_sz, "mat_%s", BOMBA_MAT_TESTE); return true; }
    if (low.startsWith("fluxo")) {
        String v = cmd.substring(5); v.trim();
        _fluxo_lpm = v.length() ? v.toFloat() : 0.0f; if (_fluxo_lpm < 0) _fluxo_lpm = 0;
        snprintf(msg, msg_sz, "fluxo_%.1f_lpm", _fluxo_lpm); return true;
    }
    if (low == "rearme") { _m->rearme(millis()); snprintf(msg, msg_sz, "rearme_%s", bomba::estadoNome(_m->estado())); return true; }
    if (low == "net off") { _net_forcado_off = true;  snprintf(msg, msg_sz, "net_off_forcado"); return true; }
    if (low == "net on")  { _net_forcado_off = false; snprintf(msg, msg_sz, "net_on"); return true; }
    if (low == "lista") {
        const bomba::Lista& L = _m->lista();
        Serial.printf("[BOMBA] lista v%lu: %d tags, %d matriculas\\n", (unsigned long)L.versao, L.ntags(), L.nmats());
        snprintf(msg, msg_sz, "lista_v%lu_%dtags", (unsigned long)L.versao, L.ntags()); return true;
    }
    if (low == "status") {
        const bomba::Entradas& e = _m->entradas();
        Serial.printf("[BOMBA] estado=%s uid=%s mat=%s litros=%.2f nivel=%.0f%% (an1=%.0f an2=%.0f mV) fluxo=%.1f L/min | contator=%d auto=%d emerg=%d bico=%d boia_min=%d boia_alta=%d | online=%d lista=v%lu(%d) ver=%s\\n",
            bomba::estadoNome(_m->estado()), _m->uidAtual(), _m->matAtual(), _m->litros(), e.nivel_pct, adc_read_mv(1), adc_read_mv(2), _fluxo_lpm,
            e.contator, e.automatico, e.emergencia, e.bico_no_suporte, e.nivel_baixo_boia, e.boia_alta,
            _m->online() ? 1 : 0, (unsigned long)_m->lista().versao, _m->lista().ntags(), FIRMWARE_VERSION);
        _telemetria();
        snprintf(msg, msg_sz, "status_%s", bomba::estadoNome(_m->estado())); return true;
    }
    return false;
}
`;
    }

    _genBombaLibH() {
        return `// ============================================================================
// bomba_posto — maquina de estados do POSTO DE COMBUSTIVEL na TON (V1 ton3/ton4 e
// V2 ton3v2/ton4v2). Implementa "Posto de Combustivel na Fazenda — Como funciona"
// + "Teste em bancada" (2026-09-21): identificacao dupla (tag + matricula),
// validacao online (NexON) com fallback na lista local, permissao MANTIDA (BO2),
// partida por pulso (BO1) confirmada pelo contato auxiliar do contator (BI1),
// solenoide (BO3), condicoes de fim, contator colado, modo manual, bloqueio.
//
// C++ PURO (sem Arduino): compila no host (test_bomba.cpp) e no ESP32 dentro do
// firmware gerado. Quem le as entradas fisicas, aciona reles, publica MQTT e
// persiste NVS e' o glue gerado (bomba.cpp) — esta lib so' decide.
// Fonte canonica: AupusNexOn/firmware-libs/bomba_posto/. O gerador (V1 e V2)
// embute uma COPIA identica (smoke confere byte a byte).
//
// Convencao das ENTRADAS (semanticas, ja com a polaridade resolvida pelo glue):
//   contator        = contato auxiliar do K1 fechado (bomba ligada)
//   automatico      = chave do painel em Automatico (BI fechada)
//   emergencia      = botao de emergencia ATUADO (contato NF: BI aberta = atuado)
//   bico_no_suporte = bico devolvido/no suporte (BI fechada)
//   nivel_baixo_boia= boia de nivel minimo ATUADA (contato NF: BI aberta = tanque no fundo)
//   boia_alta       = boia de nivel alto ATUADA (alarme na descarga; nao intertrava)
//   nivel_pct       = transmissor de nivel (AI), <0 quando nao ha transmissor
//   fluxo_lpm       = vazao instantanea (fluxometro real ou comando "fluxo" na bancada)
// ============================================================================
#ifndef BOMBA_POSTO_H
#define BOMBA_POSTO_H

#include <stdint.h>
#include <stddef.h>

namespace bomba {

enum Estado : uint8_t {
    OCIOSA = 0, AGUARDANDO_MATRICULA, VALIDANDO, PARTINDO, ABASTECENDO,
    ENCERRANDO, BLOQUEADA, MANUAL
};
const char* estadoNome(Estado e);

enum Validacao : uint8_t { VAL_NENHUMA = 0, VAL_ONLINE, VAL_OFFLINE, VAL_MANUAL };
const char* validacaoNome(Validacao v);

// Limites (RAM do ESP32 e' generosa; a lista vai em NVS via glue)
static const int LISTA_MAX_TAGS = 64;
static const int LISTA_MAX_MATS = 64;
static const int TAG_MAX_MATS   = 8;
static const int UID_LEN        = 24;
static const int MAT_LEN        = 16;
static const int MOTIVO_LEN     = 24;
static const int REQ_LEN        = 24;

struct Config {
    uint32_t pulso_bo1_ms       = 500;     // toque de "liga" no K1
    uint32_t espera_bi1_ms      = 1000;    // espera pelo contato auxiliar na partida e no desligamento
    uint32_t janela_mat_ms      = 60000;   // entre a tag e a matricula
    uint32_t auth_timeout_ms    = 3000;    // resposta do NexON antes de validar offline
    uint32_t fluxo_parado_ms    = 10000;   // bancada 10 s / campo 30 s
    uint32_t tempo_max_ms       = 30000;   // bancada 30 s / campo 10 min
    float    nivel_min_pct      = 10.0f;   // AI1 abaixo disso nao libera (<0 desliga a regra)
    uint32_t nivel_baixo_ms     = 3000;    // durante o abastecimento, AI abaixo do minimo precisa PERSISTIR isto p/ encerrar
                                           //   (uma amostra ruim — contato, ruido, glitch do ADC — nao corta o combustivel)
    uint32_t estabilizacao_ms   = 1000;    // apos o boot: nada de pulso ate as entradas estabilizarem
    bool     exigir_matricula   = true;    // false = posto sem IHM: autoriza so' pela tag
    bool     matricula_livre    = false;   // true = matricula digitada NAO e' conferida (so' registrada). Default: conferir
                                           //   na lista (operadores/pares); lista vazia => NEGA (fail-closed)
    bool     tem_contator_aux   = true;    // false = sem BI1 ligada (nao espera confirmacao)
    uint32_t (*rng)()           = nullptr; // fonte de aleatoriedade p/ o req_id do auth/req (esp_random no ESP32);
                                           //   nullptr = so' sequencial (previsivel — evitar em campo)
};

struct Entradas {
    bool  contator         = false;
    bool  automatico       = true;
    bool  emergencia       = false;
    bool  bico_no_suporte  = true;
    bool  nivel_baixo_boia = false;
    bool  boia_alta        = false;
    float nivel_pct        = -1.0f;
    float fluxo_lpm        = 0.0f;
};

struct Saidas {
    bool liga      = false;   // BO1 (pulso)
    bool permissao = false;   // BO2 (mantida)
    bool solenoide = false;   // BO3 (mantida)
    bool sinaleiro = false;   // BO4 (opcional: aceso enquanto autorizado/abastecendo)
};

struct Tag {
    char  uid[UID_LEN];
    char  mats[TAG_MAX_MATS][MAT_LEN];   // matriculas permitidas p/ esta maquina (vazio = qualquer cadastrada)
    uint8_t nmats;
    float limite_litros;                 // 0 = sem limite
};

// Lista local de autorizados (copia do NexON, sincronizada por MQTT retido).
class Lista {
public:
    Lista() { limpar(); }
    void limpar();
    bool adicionarTag(const char* uid, float limite);
    bool adicionarMatDaTag(const char* uid, const char* mat);
    bool adicionarMat(const char* mat);
    const Tag* tag(const char* uid) const;
    bool matCadastrada(const char* mat) const;
    // Decide offline. motivo: "tag" | "matricula" | "par" | "" ; limite_out = limite da tag.
    // exigirMat: a matricula precisa existir na lista (global ou da tag) — lista sem matriculas NEGA
    // (fail-closed: um sync vazio ou cadastro apagado nunca "abre" o posto). matLivre: com exigirMat,
    // aceita qualquer matricula nao-vazia sem conferir (opcao explicita do cadastro).
    bool validar(const char* uid, const char* mat, bool exigirMat, char* motivo, float* limite_out, bool matLivre = false) const;
    uint32_t versao = 0;
    int ntags() const { return _ntags; }
    int nmats() const { return _nmats; }
private:
    Tag  _tags[LISTA_MAX_TAGS]; int _ntags;
    char _mats[LISTA_MAX_MATS][MAT_LEN]; int _nmats;
};

struct Transacao {
    char      uid[UID_LEN];
    char      matricula[MAT_LEN];
    float     litros;
    uint32_t  inicio_ms, fim_ms;      // millis (o glue converte p/ epoch)
    float     nivel_antes, nivel_depois;
    char      fim_motivo[MOTIVO_LEN]; // concluido|fluxo_parado|emergencia|timeout|limite|nivel_baixo|manual|contator_colado|contator_caiu
    Validacao validacao;
};

// Quem consome os eventos (glue: MQTT/Serial; teste: coletor).
struct Ouvinte {
    virtual ~Ouvinte() {}
    virtual void aoPedirAutorizacao(const char* req_id, const char* uid, const char* mat) = 0;
    virtual void aoEvento(const char* tipo, const char* motivo, const char* uid, const char* mat) = 0;
    virtual void aoTransacao(const Transacao& t) = 0;
    virtual void aoMudarEstado(Estado de, Estado para) = 0;
};

class Maquina {
public:
    Maquina(const Config& cfg, Ouvinte* ouv);

    // Chamar a cada volta do loop com as entradas ja' lidas. Depois aplicar saidas().
    void tick(uint32_t now_ms, const Entradas& in);
    const Saidas& saidas() const { return _out; }
    Estado estado() const { return _st; }

    // Estimulos externos
    void cartao(const char* uid, uint32_t now_ms);
    void matricula(const char* mat, uint32_t now_ms);
    void respostaAuth(const char* req_id, bool ok, const char* motivo, float limite_litros, uint32_t now_ms);
    void rearme(uint32_t now_ms);
    // Restaura um bloqueio persistido (glue: NVS) apos reset/queda de energia: um contator colado ou
    // falha de partida NAO pode ser "resolvido" desligando e ligando a TON — so' por rearme().
    void bloquear(const char* motivo, uint32_t now);
    void setOnline(bool online) { _online = online; }
    bool online() const { return _online; }
    bool otaPermitida() const { return _st == OCIOSA || _st == BLOQUEADA; }

    Lista& lista() { return _lista; }
    const Lista& lista() const { return _lista; }

    // Observabilidade (status/telemetria)
    float    litros() const { return _litros; }
    const char* uidAtual() const { return _uid; }
    const char* matAtual() const { return _mat; }
    const char* motivoBloqueio() const { return _motivo_bloq; }
    Validacao validacaoAtual() const { return _val; }
    const Entradas& entradas() const { return _in; }

private:
    void _ir(Estado novo, uint32_t now);
    void _negar(const char* motivo, uint32_t now);
    void _validar(uint32_t now);
    void _decidir(bool ok, const char* motivo, float limite, Validacao val, uint32_t now);
    bool _precondicoes(char* motivo) const;
    void _partir(uint32_t now);
    void _encerrar(const char* motivo, uint32_t now);
    void _fecharTransacao(uint32_t now);
    void _iniciarManual(uint32_t now);
    void _fecharManual(uint32_t now);

    Config   _cfg;
    Ouvinte* _ouv;
    Lista    _lista;
    Estado   _st;
    Saidas   _out;
    Entradas _in;
    bool     _online;
    uint32_t _t_estado;        // millis da entrada no estado atual
    uint32_t _t_boot;
    bool     _primeiroTick;
    uint32_t _last_tick;
    // sessao
    char     _uid[UID_LEN];
    char     _mat[MAT_LEN];
    char     _req[REQ_LEN];
    uint32_t _req_seq;
    float    _limite;
    Validacao _val;
    float    _litros;
    uint32_t _t_ini;
    float    _nivel_ini;
    bool     _bico_saiu;       // o bico saiu do suporte durante o abastecimento
    bool     _ai_baixo;        // AI abaixo do minimo (persistencia nivel_baixo_ms)
    uint32_t _t_ai_baixo;      // desde quando
    uint32_t _t_fluxo_zero;    // desde quando o fluxo esta zerado (0 = fluindo)
    bool     _fluxo_zero;
    char     _fim_motivo[MOTIVO_LEN];
    char     _motivo_bloq[MOTIVO_LEN];
    bool     _contator_ant;
    // manual
    bool     _man_ligado;
    uint32_t _man_t_ini;
    float    _man_litros;
    float    _man_nivel_ini;
};

} // namespace bomba

#endif // BOMBA_POSTO_H
`;
    }

    _genBombaLibCpp() {
        return `// bomba_posto.cpp — ver bomba_posto.h. C++ puro.
#include "bomba_posto.h"
#include <string.h>
#include <stdio.h>

namespace bomba {

static void _cp(char* dst, size_t n, const char* src) {
    if (!dst || n == 0) return;
    size_t i = 0;
    if (src) for (; i + 1 < n && src[i]; i++) dst[i] = src[i];
    dst[i] = 0;
}
static bool _eq(const char* a, const char* b) {
    if (!a || !b) return false;
    while (*a && *b) {
        char ca = (*a >= 'a' && *a <= 'z') ? (char)(*a - 32) : *a;
        char cb = (*b >= 'a' && *b <= 'z') ? (char)(*b - 32) : *b;
        if (ca != cb) return false;
        a++; b++;
    }
    return *a == 0 && *b == 0;
}

const char* estadoNome(Estado e) {
    switch (e) {
        case OCIOSA: return "ociosa";
        case AGUARDANDO_MATRICULA: return "aguardando_matricula";
        case VALIDANDO: return "validando";
        case PARTINDO: return "partindo";
        case ABASTECENDO: return "abastecendo";
        case ENCERRANDO: return "encerrando";
        case BLOQUEADA: return "bloqueada";
        case MANUAL: return "manual";
    }
    return "?";
}
const char* validacaoNome(Validacao v) {
    switch (v) {
        case VAL_ONLINE: return "online";
        case VAL_OFFLINE: return "offline";
        case VAL_MANUAL: return "manual";
        default: return "nenhuma";
    }
}

// ---------------------------------------------------------------- Lista
void Lista::limpar() { _ntags = 0; _nmats = 0; versao = 0; memset(_tags, 0, sizeof(_tags)); memset(_mats, 0, sizeof(_mats)); }

bool Lista::adicionarTag(const char* uid, float limite) {
    if (!uid || !*uid) return false;
    for (int i = 0; i < _ntags; i++) if (_eq(_tags[i].uid, uid)) { _tags[i].limite_litros = limite; return true; }
    if (_ntags >= LISTA_MAX_TAGS) return false;
    Tag& t = _tags[_ntags++];
    memset(&t, 0, sizeof(t));
    _cp(t.uid, UID_LEN, uid);
    t.limite_litros = limite;
    return true;
}
bool Lista::adicionarMatDaTag(const char* uid, const char* mat) {
    if (!mat || !*mat) return false;
    for (int i = 0; i < _ntags; i++) {
        if (!_eq(_tags[i].uid, uid)) continue;
        Tag& t = _tags[i];
        for (int j = 0; j < t.nmats; j++) if (_eq(t.mats[j], mat)) return true;
        if (t.nmats >= TAG_MAX_MATS) return false;
        _cp(t.mats[t.nmats++], MAT_LEN, mat);
        return true;
    }
    return false;
}
bool Lista::adicionarMat(const char* mat) {
    if (!mat || !*mat) return false;
    for (int i = 0; i < _nmats; i++) if (_eq(_mats[i], mat)) return true;
    if (_nmats >= LISTA_MAX_MATS) return false;
    _cp(_mats[_nmats++], MAT_LEN, mat);
    return true;
}
const Tag* Lista::tag(const char* uid) const {
    for (int i = 0; i < _ntags; i++) if (_eq(_tags[i].uid, uid)) return &_tags[i];
    return nullptr;
}
bool Lista::matCadastrada(const char* mat) const {
    for (int i = 0; i < _nmats; i++) if (_eq(_mats[i], mat)) return true;
    return false;
}
bool Lista::validar(const char* uid, const char* mat, bool exigirMat, char* motivo, float* limite_out, bool matLivre) const {
    if (motivo) motivo[0] = 0;
    if (limite_out) *limite_out = 0;
    const Tag* t = tag(uid);
    if (!t) { _cp(motivo, MOTIVO_LEN, "tag"); return false; }
    if (exigirMat) {
        if (!mat || !*mat) { _cp(motivo, MOTIVO_LEN, "matricula"); return false; }
        if (!matLivre) {
            // matricula precisa existir: na lista global OU na lista da tag. Sem NENHUMA
            // matricula cadastrada => nega (fail-closed), nunca "liberado para todos".
            bool conhecida = matCadastrada(mat);
            for (int j = 0; j < t->nmats && !conhecida; j++) if (_eq(t->mats[j], mat)) conhecida = true;
            if (!conhecida) { _cp(motivo, MOTIVO_LEN, "matricula"); return false; }
        }
        // par: se a tag restringe matriculas, a matricula tem que estar nela (vale mesmo com matricula livre)
        if (t->nmats > 0) {
            bool par = false;
            for (int j = 0; j < t->nmats; j++) if (_eq(t->mats[j], mat)) { par = true; break; }
            if (!par) { _cp(motivo, MOTIVO_LEN, "par"); return false; }
        }
    }
    if (limite_out) *limite_out = t->limite_litros;
    return true;
}

// ---------------------------------------------------------------- Maquina
Maquina::Maquina(const Config& cfg, Ouvinte* ouv)
    : _cfg(cfg), _ouv(ouv), _st(OCIOSA), _online(false), _t_estado(0), _t_boot(0), _primeiroTick(true),
      _last_tick(0), _req_seq(0), _limite(0), _val(VAL_NENHUMA), _litros(0), _t_ini(0), _nivel_ini(-1),
      _bico_saiu(false), _ai_baixo(false), _t_ai_baixo(0), _t_fluxo_zero(0), _fluxo_zero(false), _contator_ant(false),
      _man_ligado(false), _man_t_ini(0), _man_litros(0), _man_nivel_ini(-1) {
    _uid[0] = _mat[0] = _req[0] = _fim_motivo[0] = _motivo_bloq[0] = 0;
}

void Maquina::_ir(Estado novo, uint32_t now) {
    if (novo == _st) return;
    Estado de = _st;
    _st = novo; _t_estado = now;
    if (_ouv) _ouv->aoMudarEstado(de, novo);
}

bool Maquina::_precondicoes(char* motivo) const {
    if (_in.emergencia) { _cp(motivo, MOTIVO_LEN, "emergencia"); return false; }
    if (!_in.automatico) { _cp(motivo, MOTIVO_LEN, "manual"); return false; }
    // bico fora do suporte na hora de liberar = nao parte (alguem pode estar com o gatilho aberto).
    // BI do bico nao mapeada => o glue passa sempre true (sem intertravamento).
    if (!_in.bico_no_suporte) { _cp(motivo, MOTIVO_LEN, "bico_fora"); return false; }
    if (_in.nivel_baixo_boia) { _cp(motivo, MOTIVO_LEN, "nivel_baixo"); return false; }
    if (_in.nivel_pct >= 0 && _cfg.nivel_min_pct >= 0 && _in.nivel_pct < _cfg.nivel_min_pct) { _cp(motivo, MOTIVO_LEN, "nivel_baixo"); return false; }
    return true;
}

void Maquina::_negar(const char* motivo, uint32_t now) {
    if (_ouv) _ouv->aoEvento("negado", motivo, _uid, _mat);
    _uid[0] = _mat[0] = _req[0] = 0;
    if (_st == AGUARDANDO_MATRICULA || _st == VALIDANDO) _ir(OCIOSA, now);
}

void Maquina::cartao(const char* uid, uint32_t now) {
    if (!uid || !*uid) return;
    if (_st == BLOQUEADA) { _cp(_uid, UID_LEN, uid); _negar("bloqueada", now); return; }
    if (_st == MANUAL)    { _cp(_uid, UID_LEN, uid); _negar("manual", now); return; }
    if (_st != OCIOSA)    { char u[UID_LEN]; _cp(u, UID_LEN, uid); if (_ouv) _ouv->aoEvento("negado", "ocupado", u, ""); return; }
    if (_primeiroTick || (uint32_t)(now - _t_boot) < _cfg.estabilizacao_ms) { _cp(_uid, UID_LEN, uid); _negar("inicializando", now); return; }
    _cp(_uid, UID_LEN, uid); _mat[0] = 0;
    if (_cfg.exigir_matricula) _ir(AGUARDANDO_MATRICULA, now);
    else _validar(now);
}

void Maquina::matricula(const char* mat, uint32_t now) {
    if (_st != AGUARDANDO_MATRICULA || !mat || !*mat) return;
    _cp(_mat, MAT_LEN, mat);
    _validar(now);
}

void Maquina::_validar(uint32_t now) {
    _ir(VALIDANDO, now);
    if (_online) {
        // req_id = sequencia + nonce aleatorio (quando ha rng): uma resposta forjada precisa
        // acertar o id exato; quem consegue LER o broker ainda responde — isso e' ACL/HMAC (backend)
        if (_cfg.rng) snprintf(_req, REQ_LEN, "r%lu-%04lx", (unsigned long)(++_req_seq), (unsigned long)(_cfg.rng() & 0xFFFF));
        else          snprintf(_req, REQ_LEN, "r%lu", (unsigned long)(++_req_seq));
        if (_ouv) _ouv->aoPedirAutorizacao(_req, _uid, _mat);
        return;   // aguarda respostaAuth() ou o timeout no tick()
    }
    char motivo[MOTIVO_LEN]; float lim = 0;
    bool ok = _lista.validar(_uid, _mat, _cfg.exigir_matricula, motivo, &lim, _cfg.matricula_livre);
    _decidir(ok, motivo, lim, VAL_OFFLINE, now);
}

void Maquina::respostaAuth(const char* req_id, bool ok, const char* motivo, float limite, uint32_t now) {
    if (_st != VALIDANDO || !req_id || !_eq(req_id, _req)) return;
    _decidir(ok, motivo ? motivo : "", limite, VAL_ONLINE, now);
}

void Maquina::_decidir(bool ok, const char* motivo, float limite, Validacao val, uint32_t now) {
    _req[0] = 0;
    if (!ok) { _negar((motivo && *motivo) ? motivo : "negado", now); return; }
    char pre[MOTIVO_LEN];
    if (!_precondicoes(pre)) { _negar(pre, now); return; }
    _limite = limite; _val = val;
    _partir(now);
}

void Maquina::_partir(uint32_t now) {
    _litros = 0; _bico_saiu = false; _fluxo_zero = false; _t_fluxo_zero = 0;
    _nivel_ini = _in.nivel_pct;
    _ir(PARTINDO, now);
}

void Maquina::_encerrar(const char* motivo, uint32_t now) {
    _cp(_fim_motivo, MOTIVO_LEN, motivo);
    _ir(ENCERRANDO, now);
}

void Maquina::_fecharTransacao(uint32_t now) {
    Transacao t; memset(&t, 0, sizeof(t));
    _cp(t.uid, UID_LEN, _uid); _cp(t.matricula, MAT_LEN, _mat);
    t.litros = _litros; t.inicio_ms = _t_ini; t.fim_ms = now;
    t.nivel_antes = _nivel_ini; t.nivel_depois = _in.nivel_pct;
    _cp(t.fim_motivo, MOTIVO_LEN, _fim_motivo); t.validacao = _val;
    if (_ouv) _ouv->aoTransacao(t);
    _uid[0] = _mat[0] = 0; _litros = 0; _limite = 0; _val = VAL_NENHUMA;
}

void Maquina::_iniciarManual(uint32_t now) {
    _man_ligado = true; _man_t_ini = now; _man_litros = 0; _man_nivel_ini = _in.nivel_pct;
}
void Maquina::_fecharManual(uint32_t now) {
    if (!_man_ligado) return;
    _man_ligado = false;
    Transacao t; memset(&t, 0, sizeof(t));
    t.litros = _man_litros; t.inicio_ms = _man_t_ini; t.fim_ms = now;
    t.nivel_antes = _man_nivel_ini; t.nivel_depois = _in.nivel_pct;
    _cp(t.fim_motivo, MOTIVO_LEN, "manual"); t.validacao = VAL_MANUAL;
    if (_ouv) _ouv->aoTransacao(t);
}

void Maquina::rearme(uint32_t now) {
    if (_st != BLOQUEADA) return;
    if (_cfg.tem_contator_aux && _in.contator) {
        if (_ouv) _ouv->aoEvento("rearme_negado", "contator_colado", "", "");
        return;
    }
    if (_ouv) _ouv->aoEvento("rearme", _motivo_bloq, "", "");
    _motivo_bloq[0] = 0;
    _ir(OCIOSA, now);
}

void Maquina::bloquear(const char* motivo, uint32_t now) {
    if (_st == BLOQUEADA) return;
    _cp(_motivo_bloq, MOTIVO_LEN, (motivo && motivo[0]) ? motivo : "restaurado");
    _uid[0] = _mat[0] = 0; _val = VAL_NENHUMA;
    _ir(BLOQUEADA, now);
}

void Maquina::tick(uint32_t now, const Entradas& in) {
    if (_primeiroTick) { _primeiroTick = false; _t_boot = now; _last_tick = now; _t_estado = now; _contator_ant = in.contator; }
    uint32_t dt = now - _last_tick; _last_tick = now;
    _in = in;
    const bool contEdgeUp = in.contator && !_contator_ant;
    _contator_ant = in.contator;

    // fluxo parado: cronometro desde que a vazao zerou
    if (in.fluxo_lpm <= 0.0005f) { if (!_fluxo_zero) { _fluxo_zero = true; _t_fluxo_zero = now; } }
    else _fluxo_zero = false;

    Saidas o;   // tudo desligado por padrao — so' PARTINDO/ABASTECENDO ligam algo
    switch (_st) {
    case OCIOSA:
        if (!in.automatico) {
            if (_ouv) _ouv->aoEvento("manual", "chave", "", "");
            _ir(MANUAL, now);
            break;
        }
        if (_cfg.tem_contator_aux && contEdgeUp) {
            if (_ouv) _ouv->aoEvento("nao_autorizado", "contator_fechou_sem_comando", "", "");
        }
        break;

    case AGUARDANDO_MATRICULA:
        if (!in.automatico) { _negar("manual", now); break; }
        if ((uint32_t)(now - _t_estado) > _cfg.janela_mat_ms) _negar("timeout_matricula", now);
        break;

    case VALIDANDO:
        if (!in.automatico) { _negar("manual", now); break; }
        if (_req[0] && (uint32_t)(now - _t_estado) > _cfg.auth_timeout_ms) {
            // NexON nao respondeu: decide pela lista local
            char motivo[MOTIVO_LEN]; float lim = 0;
            bool ok = _lista.validar(_uid, _mat, _cfg.exigir_matricula, motivo, &lim, _cfg.matricula_livre);
            _decidir(ok, motivo, lim, VAL_OFFLINE, now);
        }
        break;

    case PARTINDO: {
        uint32_t el = now - _t_estado;
        o.permissao = true; o.solenoide = true; o.sinaleiro = true;
        o.liga = el < _cfg.pulso_bo1_ms;
        if (in.emergencia) { _encerrar("emergencia", now); o = Saidas(); break; }
        bool ligou = _cfg.tem_contator_aux ? in.contator : (el >= _cfg.pulso_bo1_ms);
        if (ligou) {
            _t_ini = now; _litros = 0; _bico_saiu = false; _ai_baixo = false; _fluxo_zero = false; _t_fluxo_zero = 0;
            _ir(ABASTECENDO, now);
            o.liga = false;
            break;
        }
        if (el >= _cfg.espera_bi1_ms && el >= _cfg.pulso_bo1_ms) {
            // K1 nao confirmou: desliga tudo e bloqueia ate reconhecimento
            o = Saidas();
            if (_ouv) _ouv->aoEvento("falha_partida", "sem_confirmacao_bi1", _uid, _mat);
            _cp(_motivo_bloq, MOTIVO_LEN, "falha_partida");
            _uid[0] = _mat[0] = 0; _val = VAL_NENHUMA;
            _ir(BLOQUEADA, now);
        }
        break;
    }

    case ABASTECENDO: {
        o.permissao = true; o.solenoide = true; o.sinaleiro = true;
        _litros += in.fluxo_lpm * (float)dt / 60000.0f;
        if (!in.bico_no_suporte) _bico_saiu = true;
        // AI abaixo do minimo so' encerra se PERSISTIR nivel_baixo_ms (uma amostra ruim nao corta o combustivel)
        bool aiBaixo = in.nivel_pct >= 0 && _cfg.nivel_min_pct >= 0 && in.nivel_pct < _cfg.nivel_min_pct;
        if (aiBaixo && !_ai_baixo) { _ai_baixo = true; _t_ai_baixo = now; }
        else if (!aiBaixo) _ai_baixo = false;
        bool aiBaixoPersistiu = _ai_baixo && (uint32_t)(now - _t_ai_baixo) >= _cfg.nivel_baixo_ms;
        const char* fim = nullptr;
        if (in.emergencia)                                              fim = "emergencia";
        else if (!in.automatico)                                        fim = "manual";
        else if (_cfg.tem_contator_aux && !in.contator)                 fim = "contator_caiu";
        else if (in.nivel_baixo_boia)                                   fim = "nivel_baixo";
        else if (aiBaixoPersistiu)                                      fim = "nivel_baixo";
        else if (_limite > 0 && _litros >= _limite)                     fim = "limite";
        else if ((uint32_t)(now - _t_ini) >= _cfg.tempo_max_ms)         fim = "timeout";
        else if (_bico_saiu && in.bico_no_suporte)                      fim = "concluido";
        else if (_fluxo_zero && (uint32_t)(now - _t_fluxo_zero) >= _cfg.fluxo_parado_ms) fim = "fluxo_parado";
        if (fim) { _encerrar(fim, now); o = Saidas(); }
        break;
    }

    case ENCERRANDO: {
        // permissao e solenoide ja' cairam (saidas zeradas): espera o K1 abrir
        bool abriu = !_cfg.tem_contator_aux || !in.contator;
        if (abriu) { _fecharTransacao(now); _ir(OCIOSA, now); break; }
        if ((uint32_t)(now - _t_estado) >= _cfg.espera_bi1_ms) {
            if (_ouv) _ouv->aoEvento("contator_colado", _fim_motivo, _uid, _mat);
            _fecharTransacao(now);
            _cp(_motivo_bloq, MOTIVO_LEN, "contator_colado");
            _ir(BLOQUEADA, now);
        }
        break;
    }

    case BLOQUEADA:
        break;   // so' sai por rearme()

    case MANUAL:
        if (_man_ligado) _man_litros += in.fluxo_lpm * (float)dt / 60000.0f;
        if (in.automatico) {
            if (_man_ligado) _fecharManual(now);
            _ir(OCIOSA, now);
            break;
        }
        if (_cfg.tem_contator_aux) {
            if (in.contator && !_man_ligado) _iniciarManual(now);
            else if (!in.contator && _man_ligado) _fecharManual(now);
        }
        break;
    }
    _out = o;
}

} // namespace bomba
`;
    }

    // Emitida so quando spec.carregador && spec.has_relays.
    _genCarregador(spec) {
        const c = spec.carregador;
        const biReadConn = c.bi_conectado ? `((inputs_get_state() >> ${c.bi_conectado - 1}) & 1)` : 'true';
        let cpp = `// ===== CARREGADOR ELETRICO: controle da vaga (a TON habilita/corta + detecta desconexao) =====
// Comando <BASE>/cmd {carregador:habilitar|desabilitar}; BI Conectado=${c.bi_conectado || '—'} detecta o carro.
// Ao DESCONECTAR corta o rele (BO habilitar=${c.bo_habilitar || '—'}) e publica <BASE>/carregador {evento:desconectado}.
// kWh vem de medidor Modbus (fonte 'ton') OU do carregador no broker — nao daqui.
`;
        if (!spec.wifi && spec.lora_role === 'satellite') {
            cpp += `static void lora_publish_data(const char* subtopic, const char* payload_json);\n`;
        }
        const pubBody = spec.wifi ? '    mqtt_publish_sub(sub, payload);'
            : (spec.lora_role === 'satellite' ? '    lora_publish_data(sub, payload);'
            : '    Serial.printf("[CARGA] %s: %s\\n", sub, payload);');
        cpp += `
enum CargaState { CARGA_LIVRE = 0, CARGA_CARREGANDO };
static CargaState _carga_state = CARGA_LIVRE;

static void _carga_pub(const char* sub, const char* payload) {
${pubBody}
}
static bool _carga_conectado() { return ${biReadConn}; }
static void _carga_rele(bool on) {
`;
        if (c.bo_habilitar) cpp += `    relay_set(${c.bo_habilitar}, on);\n`;
        if (c.bo_desabilitar) cpp += `    if (!on) { relay_set(${c.bo_desabilitar}, true); delay(300); relay_set(${c.bo_desabilitar}, false); }\n`;
        cpp += `}
static void _carga_pub_estado() {
    char payload[96];
    snprintf(payload, sizeof(payload), "{\\"estado\\":\\"%s\\",\\"conectado\\":%s}",
        _carga_state == CARGA_CARREGANDO ? "carregando" : "livre", _carga_conectado() ? "true" : "false");
    _carga_pub("carregador", payload);
}
void carregador_habilitar() {
    _carga_rele(true);
    _carga_state = CARGA_CARREGANDO;
    Serial.println("[CARGA] habilitado");
    _carga_pub_estado();
}
void carregador_desabilitar() {
    _carga_rele(false);
    _carga_state = CARGA_LIVRE;
    Serial.println("[CARGA] desabilitado");
    _carga_pub_estado();
}
static void _carga_encerrar(const char* motivo) {
    _carga_rele(false);
    char payload[96];
    snprintf(payload, sizeof(payload), "{\\"evento\\":\\"desconectado\\",\\"conectado\\":false,\\"motivo\\":\\"%s\\"}", motivo);
    _carga_pub("carregador", payload);
    Serial.printf("[CARGA] FIM (%s)\\n", motivo);
    _carga_state = CARGA_LIVRE;
    _carga_pub_estado();
}
void carregador_loop() {
    static bool prevConn = true;
    static unsigned long lastTel = 0;
    bool conn = _carga_conectado();
    if (_carga_state == CARGA_CARREGANDO && prevConn && !conn) { _carga_encerrar("desconectado"); }
    prevConn = conn;
    if (millis() - lastTel > 30000) { lastTel = millis(); _carga_pub_estado(); }
}

`;
        return cpp;
    }


    // ---- main.cpp ----
    _genMainCpp(spec) {
        let cpp = `// ==============================================================================
// ${spec.name} (${spec.tonType.toUpperCase()}) - Gerado pelo NexOn IoT
// ==============================================================================

#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>          // WiFi.macAddress() — log de identidade no boot
#include <ArduinoJson.h>
#include <esp_task_wdt.h>

#include "hal.h"
#include "config.h"
#include "inputs.h"
#include "outputs.h"
#include "adc.h"
#include "sd_buffer.h"
#include "diag.h"
#include "eth.h"
`;

        if (spec.has_relays) cpp += `#include "relays.h"\n`;
        // mqtt.h sempre incluido: mesmo sem WiFi, o stub (mqtt.cpp gerado para
        // LoRa-only) define mqtt_publish/mqtt_connected como no-op, e os helpers
        // de comando (_publish_cmd_ack) e o bloco de I/O os referenciam. ota.h
        // depende de WiFi (download HTTP) — só quando ha rede.
        cpp += `#include "mqtt.h"\n`;
        if (spec.wifi) cpp += `#include "ota.h"\n`;
        if (spec.has_lora) cpp += `#include "lora.h"\n`;
        if (spec.rs485_devices.length > 0) cpp += `#include "modbus_meter.h"\n`;
        if (spec.tcp_devices.length > 0) cpp += `#include "inverter_tcp.h"\n`;

        cpp += `
// Estado / timers
static unsigned long last_input_scan = 0;
static unsigned long last_evt        = 0;  // SOE: drenagem da fila de eventos do rele
static unsigned long last_sample     = 0;  // leitura Modbus RS485 (round-robin)
static unsigned long last_publish    = 0;  // publicacao MQTT RS485 (medias/deltas)
static unsigned long last_sample_tcp = 0;  // leitura Modbus TCP (round-robin via datalogger)
static unsigned long last_publish_tcp = 0; // publicacao MQTT TCP (medias/deltas)
static unsigned long last_evt_tcp    = 0;  // SOE: drenagem de eventos de rele TCP direto

`;

        if (spec.wifi) {
            cpp += `// Publica em TOPIC_BASE/<sub>. Helper para modulos que nao conhecem o prefixo.
static void mqtt_publish_sub(const char* sub, const char* payload) {
    char topic[160];
    snprintf(topic, sizeof(topic), "%s/%s", MQTT_TOPIC_BASE, sub);
    mqtt_publish(topic, payload);
}

`;
        }

        cpp += `// ===== ACK aplicacao-level para comandos =====
// Protocolo:
//   Backend publica em <BASE>/cmd com envelope: {"cmd_id":"<uuid>","cmd": <inner>}
//   <inner> pode ser string ("r1 on") ou objeto ({"device":"X","cmd":"cmd_fechar"})
//   TON publica resposta em <BASE>/cmd/ack: {"cmd_id","status","msg","ts"}
//   status: "ok" | "error" | "duplicate"
// Backward-compat: se nao houver cmd_id, executa sem publicar ack (legado).
// Dedup ring-buffer: tamanho 32 da' folga pra ate ~10s de retries do backend
// (timeout 5s x 3 attempts) e do gateway LoRa (timeout 2s x 3 attempts) sem
// que cmd_ids antigos sejam sobrescritos.
#define CMD_DEDUP_SIZE 32
static char _cmdSeen[CMD_DEDUP_SIZE][40];
static int  _cmdSeenIdx = 0;

static bool _cmd_seen_or_add(const char* cmd_id) {
    for (int i = 0; i < CMD_DEDUP_SIZE; i++) {
        if (_cmdSeen[i][0] && strcmp(_cmdSeen[i], cmd_id) == 0) return true;
    }
    strncpy(_cmdSeen[_cmdSeenIdx], cmd_id, sizeof(_cmdSeen[0]) - 1);
    _cmdSeen[_cmdSeenIdx][sizeof(_cmdSeen[0]) - 1] = 0;
    _cmdSeenIdx = (_cmdSeenIdx + 1) % CMD_DEDUP_SIZE;
    return false;
}

static void _publish_cmd_ack(const char* cmd_id, const char* status, const char* msg) {
    char topic[160];
    snprintf(topic, sizeof(topic), "%s/cmd/ack", MQTT_TOPIC_BASE);
    char payload[256];
    snprintf(payload, sizeof(payload),
             "{\\"cmd_id\\":\\"%s\\",\\"status\\":\\"%s\\",\\"msg\\":\\"%s\\",\\"ts\\":%lu}",
             cmd_id, status, msg ? msg : "", (unsigned long)(millis() / 1000));
    mqtt_publish(topic, payload);
}

`;
        // ===== Maquina de estados do Pivô (Cenário B: TON é o cérebro) =====
        // Emitida apenas quando ha um pivô conectado a esta TON (spec.pivo) e a
        // TON tem relés (BO). Reusa inputs_get_state() (BI) e relay_set() (BO).
        if (spec.pivo && spec.has_relays) {
            cpp += this._genPivot(spec);
        }
        if (spec.bomba && spec.has_relays) {
            cpp += this._genBomba(spec);
        }
        if (spec.carregador && spec.has_relays) {
            cpp += this._genCarregador(spec);
        }

        cpp += `// Executa o comando bruto (sem envelope). Preenche result_msg com descricao curta.
// Retorna true em sucesso, false em erro.
static bool _process_command_inner(const char* raw, char* result_msg, size_t msg_sz) {
    if (!raw || !*raw) { snprintf(result_msg, msg_sz, "empty"); return false; }

    // Comando estruturado: {"device":"X","cmd":"cmd_fechar"}
    if (raw[0] == '{') {
        StaticJsonDocument<256> j;
        DeserializationError jerr = deserializeJson(j, raw);
        if (!jerr) {
            const char* dev = j["device"] | "";
            const char* cid = j["cmd"] | "";
            if (dev[0] && cid[0]) {
`;
        // Despacho: RS485 primeiro (match por nome; false = nao achou OU write falhou),
        // depois devices TCP diretos (inverter_tcp_exec_command). Cada modulo so' tem
        // seus proprios devices, entao no maximo um deles reconhece o nome.
        if (spec.rs485_devices.length > 0 && spec.tcp_devices.length > 0) {
            cpp += `                bool ok = modbus_exec_command(dev, cid);
                if (!ok) ok = inverter_tcp_exec_command(dev, cid);
                snprintf(result_msg, msg_sz, "%s/%s:%s", dev, cid, ok ? "OK" : "FAIL");
                return ok;
`;
        } else if (spec.rs485_devices.length > 0) {
            cpp += `                bool ok = modbus_exec_command(dev, cid);
                snprintf(result_msg, msg_sz, "%s/%s:%s", dev, cid, ok ? "OK" : "FAIL");
                return ok;
`;
        } else if (spec.tcp_devices.length > 0) {
            cpp += `                bool ok = inverter_tcp_exec_command(dev, cid);
                snprintf(result_msg, msg_sz, "%s/%s:%s", dev, cid, ok ? "OK" : "FAIL");
                return ok;
`;
        } else {
            cpp += `                snprintf(result_msg, msg_sz, "no_modbus_in_firmware");
                return false;
`;
        }
        cpp += `            }
        }
    }

    String cmd = String(raw); cmd.trim(); cmd.toLowerCase();
    if (cmd.length() == 0) { snprintf(result_msg, msg_sz, "empty"); return false; }

    // Reinicio remoto (MQTT <base>/cmd ou Serial): "reboot" | "reiniciar". Recusa com OTA
    // em curso ou posto abastecendo; o ack sai antes (reinicia 2 s depois).
    if (cmd == "reboot" || cmd == "reiniciar" || cmd == "restart") {
        if (!mqtt_restart_permitido()) { snprintf(result_msg, msg_sz, "reboot_recusado_ton_ocupada"); return false; }
        // Mensagem RETIDA no broker chega logo apos conectar: ignorar evita loop de reinicio.
        if (mqtt_conn_age_ms() < 20000UL) { snprintf(result_msg, msg_sz, "reboot_ignorado_recem_conectado"); return false; }
        mqtt_request_restart("comando", 2000);
        snprintf(result_msg, msg_sz, "reiniciando_em_2s");
        return true;
    }

    if (cmd.length() >= 4 && cmd[0] == 'r' && cmd[1] >= '1' && cmd[1] <= '6') {
`;
        if (spec.has_relays) {
            cpp += `        bool on = cmd.indexOf("on") >= 0;
        relay_set(cmd[1] - '0', on);
        snprintf(result_msg, msg_sz, "rele_%c_%s", cmd[1], on ? "on" : "off");
        return true;
`;
        } else {
            cpp += `        snprintf(result_msg, msg_sz, "no_relays_in_model");
        return false;
`;
        }
        cpp += `    }
    if (cmd.startsWith("tr") && cmd[2] >= '1' && cmd[2] <= '4') {
        bool on = cmd.indexOf("on") >= 0;
        output_set(cmd[2] - '0', on);
        snprintf(result_msg, msg_sz, "tr%c_%s", cmd[2], on ? "on" : "off");
        return true;
    }
`;
        // ===== Comandos do posto de combustivel (bancada/Serial/MQTT): card, mat, fluxo, status, rearme, net, lista =====
        if (spec.bomba && spec.has_relays) {
            cpp += `    if (bomba_cmd(cmd, result_msg, msg_sz)) return true;   // posto: card <UID> | mat <n> | fluxo <L/min> | status | rearme | net off|on | lista
`;
        }
        // ===== Comando do carregador: {carregador:habilitar|desabilitar} (backend/porteiro) =====
        if (spec.carregador && spec.has_relays) {
            cpp += `    if (cmd.indexOf("desabilitar") >= 0) { carregador_desabilitar(); snprintf(result_msg, msg_sz, "carga_off"); return true; }
    if (cmd.indexOf("habilitar") >= 0)   { carregador_habilitar();   snprintf(result_msg, msg_sz, "carga_on");  return true; }
`;
        }
        // ===== Comandos do pivô (só quando ha um pivô conectado a esta TON) =====
        // pivot on/start  -> liga (entra em ESPERANDO_PRESSAO)
        // pivot off/stop  -> para (abre os BO)
        // pivot dir l/r   -> sentido esquerda/direita
        if (spec.pivo && spec.has_relays) {
            cpp += `    if (cmd.startsWith("pivot")) {
        if (cmd.indexOf("off") >= 0 || cmd.indexOf("stop") >= 0) {
            pivot_cmd_stop();
            snprintf(result_msg, msg_sz, "pivot_off");
            return true;
        }
        if (cmd.indexOf("dir") >= 0) {
            // "pivot dir l" / "pivot dir r" — define sentido (aplicado ao iniciar/rodando)
            char d = (cmd.indexOf(" l") >= 0 || cmd.endsWith("l")) ? 'L'
                   : (cmd.indexOf(" r") >= 0 || cmd.endsWith("r")) ? 'R' : 0;
            if (d) { pivot_cmd_dir(d); snprintf(result_msg, msg_sz, "pivot_dir_%c", d); return true; }
            snprintf(result_msg, msg_sz, "pivot_dir_invalida");
            return false;
        }
        if (cmd.indexOf("on") >= 0 || cmd.indexOf("start") >= 0) {
            pivot_cmd_start();
            snprintf(result_msg, msg_sz, "pivot_on");
            return true;
        }
        snprintf(result_msg, msg_sz, "pivot_cmd_desconhecido");
        return false;
    }
`;
        }
        cpp += `    if (cmd == "status") {
        Serial.printf("Entradas: %02X  Saidas: %02X\\n", inputs_get_state(), outputs_get_state());
        snprintf(result_msg, msg_sz, "status_printed");
        return true;
    }

    snprintf(result_msg, msg_sz, "unknown_cmd");
    return false;
}

// Wrapper publico: detecta envelope com cmd_id, faz dedup e publica ack.
static void process_command(const char* raw) {
    if (!raw) return;

    char cmd_id[40] = {0};
    const char* effective = raw;
    static char inner_buf[512];

    // Detecta envelope: { "cmd_id": "...", "cmd": <inner> }
    if (raw[0] == '{') {
        StaticJsonDocument<512> env;
        if (deserializeJson(env, raw) == DeserializationError::Ok) {
            const char* id = env["cmd_id"] | "";
            if (id[0]) {
                strncpy(cmd_id, id, sizeof(cmd_id) - 1);

                if (_cmd_seen_or_add(cmd_id)) {
                    Serial.printf("[CMD] Duplicate cmd_id=%s ignorado\\n", cmd_id);
                    _publish_cmd_ack(cmd_id, "duplicate", "already_seen");
                    return;
                }

                JsonVariantConst inner = env["cmd"];
                // ArduinoJson 7: em JsonVariantConst, is<JsonObject>() retorna false
                // mesmo pra objetos — precisa usar JsonObjectConst. Bug observado em
                // 2026-06-02 (ack "missing_cmd_field" mesmo com {"cmd":{...}} valido).
                if (inner.is<const char*>()) {
                    snprintf(inner_buf, sizeof(inner_buf), "%s", inner.as<const char*>());
                    effective = inner_buf;
                } else if (inner.is<JsonObjectConst>()) {
                    serializeJson(inner, inner_buf, sizeof(inner_buf));
                    effective = inner_buf;
                } else {
                    _publish_cmd_ack(cmd_id, "error", "missing_cmd_field");
                    return;
                }
            }
        }
    }

    char msg[64] = {0};
    bool ok = _process_command_inner(effective, msg, sizeof(msg));
    Serial.printf("[CMD] %s -> %s (%s)\\n", effective, ok ? "OK" : "FAIL", msg);

    if (cmd_id[0]) {
        _publish_cmd_ack(cmd_id, ok ? "ok" : "error", msg);
    }
}

`;
        // ===== Handler LoRa RX (gateway vs satellite) =====
        if (spec.has_lora) {
            cpp += this._genLoraRouter(spec);
        } else {
            // Sem LoRa: stub vazio (chamado sempre no loop)
            cpp += `static inline void lora_handle_rx(const char*) {}\n`;
        }

        cpp += `// Motivo do ultimo reset (diagnostico)
static const char* _resetReason() {
    switch (esp_reset_reason()) {
        case ESP_RST_POWERON:  return "Power-on";
        case ESP_RST_SW:       return "Software";
        case ESP_RST_PANIC:    return "Panic (crash)";
        case ESP_RST_INT_WDT:  return "Watchdog (interrupt)";
        case ESP_RST_TASK_WDT: return "Watchdog (task)";
        case ESP_RST_WDT:      return "Watchdog";
        case ESP_RST_BROWNOUT: return "Brownout (tensao baixa)";
        case ESP_RST_DEEPSLEEP:return "Deep-sleep wake";
        case ESP_RST_EXT:      return "External reset";
        default:               return "Unknown";
    }
}

// Alimentar o watchdog (chamar em loops longos / esperas)
static inline void feedWatchdog() { esp_task_wdt_reset(); }

void setup() {
    Serial.begin(115200);
    delay(2000);
    Serial.printf("\\n  %s v%s - %s\\n", DEVICE_ID, FIRMWARE_VERSION, DEVICE_MODEL);
    Serial.println("  [BOOT] RS485-fix v1.1: drain RX, flush preTx, retry 0xE0, delays 80/1000us");
    Serial.println("  [BOOT] MQTT-fix v1.2: setKeepAlive(60), setSocketTimeout(8), mqtt_loop entre blocos");
    Serial.println("  [BOOT] Cycle v1.2.1: METER_CYCLE_MS=4000 (era 2000) — menos pressao no Modbus/MQTT");
    Serial.println("  [BOOT] TCPlog v1.2.2: log inclui slave id pra desambiguar inversores TCP");
    Serial.println("  [BOOT] ClientID v1.3.0: MQTT_CLIENT_ID derivado do MAC (unico por hardware)");
    Serial.println("  [BOOT] CmdHR v1.4.0: bo_map suporta func 0x06 (writeSingleRegister) — Schneider VI");
    Serial.println("  [BOOT] CmdEnvFix v1.4.1: envelope {cmd_id, cmd:{...}} agora reconhece objeto aninhado");
    Serial.println("  [BOOT] SBO v1.5.0: bo_map suporta comandos compostos (steps[]) — Schneider Object control");
    Serial.printf("  [BOOT] MAC: %s\\n", WiFi.macAddress().c_str());
    Serial.printf("  Motivo do reset: %s\\n", _resetReason());
    Serial.printf("  Heap livre: %u bytes\\n\\n", ESP.getFreeHeap());

    // Diagnosticos: contadores globais (uptime, modbus_ok/err, mqtt_pub, sd_*, etc.)
    diag_init();

    // Watchdog em panic mode: reinicia a placa se travar
    esp_task_wdt_init(WATCHDOG_TIMEOUT_S, true);
    esp_task_wdt_add(NULL);
    Serial.printf("[OK] Watchdog %ds (panic=reboot)\\n", WATCHDOG_TIMEOUT_S);

    // I2C
    Wire.begin(I2C_SDA, I2C_SCL);
    Wire.setClock(I2C_CLOCK_HZ);

    // Ethernet W5500: inicializar ANTES do SD Card.
    // Razao: no TON-TESTE de bancada (validado), o W5500 e' inicializado primeiro.
    // Iniciar SD antes do W5500 estava deixando o chip nao-detectado pelo SPI.
    eth_hw_init();

    // Perifericos
    if (inputs_init()) Serial.println("[OK] Entradas (6x optoacopladas)");
    else Serial.println("[FAIL] Entradas");
`;

        if (spec.has_relays) {
            cpp += `
    if (relays_init()) Serial.println("[OK] Reles (6x ULN2803)");
    else Serial.println("[FAIL] Reles");
`;
        }

        cpp += `
    outputs_init();
    Serial.println("[OK] Transistores (TR1-TR4)");

    adc_init();
${spec.bomba && spec.has_relays ? '    bomba_init();   // posto de combustivel: reles desligados, lista/sessao do NVS\n' : ''}    Serial.println("[OK] ADC (AN1/AN2)");

    // SD Card - buffer offline para MQTT
    if (sd_buffer_init()) {
        Serial.println("[OK] SD Buffer");
    } else {
        Serial.println("[WARN] SD nao disponivel - mensagens offline serao perdidas");
    }
`;

        if (spec.rs485_devices.length > 0) {
            cpp += `
    // RS485 + Modbus (dispositivos vem do catalogo, sem scan no boot)
    modbus_init();
`;
        }

        if (spec.tcp_devices.length > 0) {
            cpp += `
    // Modbus TCP (via Datalogger/Gateway)
    inverter_tcp_init();
`;
        }

        if (spec.has_lora) {
            cpp += `
    // LoRa
    lora_init();
`;
        }

        if (spec.wifi) {
            cpp += `
    // WiFi + MQTT + OTA
    mqtt_init(process_command);
    ota_init();
    // Detecta boot pos-OTA: se em PENDING_VERIFY, arma contador de validacao.
    // Se travarmos antes de N publicacoes OK, bootloader reverte para anterior.
    ota_check_pending_verify();
`;
        }

        cpp += `
    esp_task_wdt_reset();
    Serial.println("\\nPronto!");
}
`;

        // MESTRE-PUXA — satellite REATIVO. Quando o mestre POLLa, esta funcao le o
        // device (medias ja' acumuladas pelo sample_one no loop) + faz os calculos
        // (decode/escala EXISTENTE via modbus_publish_all/inverter_tcp_publish_all)
        // e ENVIA a telemetria pelo MESMO caminho do push antigo (lora_publish_data),
        // fechando com pollresp(req_id). O corpo so' le device quando satReactive
        // (default + tem device). lora_poll_respond e' SEMPRE definida no satellite
        // (o handler de POLL em lora.cpp a referencia) — em fallback/no-device vira
        // um stub que so' responde pollresp (inerte: nenhum POLL chega no fallback).
        const satReactive = spec.lora_role === 'satellite' && !this._loraAutonomousPush() && this._satelliteHasDevice(spec);
        if (spec.lora_role === 'satellite') {
            cpp += `
// MESTRE-PUXA: responde um POLL do mestre. Le+publica a telemetria do device
// (mesmo decode/escala/empacotamento do push antigo) e sinaliza fim com pollresp.
void lora_poll_respond(const char* gw_mac, const char* req_id) {
    Serial.printf("[LORA-SAT] POLL req_id=%s -> lendo device e respondendo p/ %s\\n",
                  req_id && req_id[0] ? req_id : "(sem)", gw_mac ? gw_mac : "*");
`;
            if (satReactive && spec.rs485_devices.length > 0) {
                cpp += `    // RS485: publica medias acumuladas (mesmo caminho do modo autonomo).
    modbus_publish_all([](const char* sub, const char* payload){ lora_publish_data(sub, payload); });
`;
            }
            const TCP_READABLE_TYPES = ['inversor', 'power_meter', 'medidor_comum', 'rele_protecao'];
            if (satReactive && (spec.tcp_devices || []).filter(d => TCP_READABLE_TYPES.includes(d.type)).length > 0) {
                cpp += `    // Modbus TCP (datalogger/conversor): publica medias acumuladas via LoRa.
    inverter_tcp_publish_all([](const char* sub, const char* payload){ lora_publish_data(sub, payload); });
`;
            }
            if (satReactive && spec.pivo && spec.has_relays) {
                cpp += `    // Pivo: republica o estado atual da maquina (mesmo helper do push).
    _pivot_publish_status();
`;
            }
            cpp += `    // Fecha o ciclo: o mestre casa pelo req_id, republica o que chegou e avanca.
    lora_send_pollresp(gw_mac, req_id);
}
`;
        }

        cpp += `
void loop() {
    esp_task_wdt_reset();
    diag_tick();  // atualiza min_free_heap a cada loop
    unsigned long now = millis();
`;

        if (spec.wifi) {
            cpp += `    mqtt_loop();
    diag_publish_periodic();  // publica MQTT_TOPIC_BASE/diagnostics a cada DIAG_INTERVAL_MS

    // Durante OTA nao fazer mais nada (flash em andamento)
    if (ota_in_progress()) { delay(1); return; }
`;
        }

        cpp += `
    // I/O edge-triggered: publica entradas/saidas SOMENTE quando mudam.
    // Estado inicial publicado no boot e republicado apos cada reconexao MQTT
    // (pra o backend nunca ficar sem o estado atual). Substitui o antigo status
    // periodico de ${'$'}{MQTT_STATUS_MS}ms que poluia o broker com publicacoes redundantes.
    if (now - last_input_scan >= INPUT_SCAN_MS) {
        last_input_scan = now;
        inputs_scan();
${spec.has_relays ? '        relays_health_tick();   // C3 anti-travamento: confere os reles no I2C a cada 2 s\n' : ''}
        static bool _io_force = true;        // forca publicacao inicial (boot)
        static bool _mqtt_was_up = false;
        static uint8_t _prev_out = 0;
`;
        if (spec.has_relays) cpp += `        static uint8_t _prev_rl = 0;\n`;
        cpp += `
        // Detecta reconexao MQTT (false->true) pra republicar estado atual
        bool _mqtt_up = mqtt_connected();
        if (_mqtt_up && !_mqtt_was_up) _io_force = true;
        _mqtt_was_up = _mqtt_up;

        // Entradas digitais (on-change via debounce de inputs_changed)
        bool _in_changed = inputs_changed();   // sempre chama pra consumir o flag
        if (_io_force || _in_changed) {
            uint8_t s = inputs_get_state();
            char buf[80];
            snprintf(buf, sizeof(buf), "{\\"d1\\":%d,\\"d2\\":%d,\\"d3\\":%d,\\"d4\\":%d,\\"d5\\":%d,\\"d6\\":%d}",
                s&1, (s>>1)&1, (s>>2)&1, (s>>3)&1, (s>>4)&1, (s>>5)&1);
`;
        // I/O usa mqtt_publish_raw — NAO grava no SD quando offline.
        // I/O eh ESTADO, nao dado historico. Se MQTT cair, _io_force=true na
        // proxima reconexao republica o estado atual. Antes (mqtt_publish) lotava
        // o SD com milhares de copias do mesmo estado quando MQTT oscilava.
        if (spec.wifi) cpp += `            mqtt_publish_raw(MQTT_TOPIC_INPUTS, buf);\n`;
        if (spec.lora_role === 'satellite') cpp += `            lora_publish_data("inputs", buf);\n`;
        cpp += `        }

        // Saidas transistor (TR1-4) on-change. Em satellite vai via LoRa.
        uint8_t os = outputs_get_state();
        if (_io_force || os != _prev_out) {
            _prev_out = os;
            char obuf[60];
            snprintf(obuf, sizeof(obuf), "{\\"tr1\\":%d,\\"tr2\\":%d,\\"tr3\\":%d,\\"tr4\\":%d}",
                os&1, (os>>1)&1, (os>>2)&1, (os>>3)&1);
`;
        if (spec.wifi) cpp += `            mqtt_publish_raw(MQTT_TOPIC_OUTPUTS, obuf);\n`;
        if (spec.lora_role === 'satellite') cpp += `            lora_publish_data("outputs", obuf);\n`;
        cpp += `        }
`;
        if (spec.has_relays) {
            cpp += `
        // Reles (R1-6) on-change.
        uint8_t rl = relays_get_state();
        if (_io_force || rl != _prev_rl) {
            _prev_rl = rl;
            char rbuf[80];
            snprintf(rbuf, sizeof(rbuf), "{\\"r1\\":%d,\\"r2\\":%d,\\"r3\\":%d,\\"r4\\":%d,\\"r5\\":%d,\\"r6\\":%d}",
                (rl>>1)&1, (rl>>2)&1, (rl>>3)&1, (rl>>4)&1, (rl>>5)&1, (rl>>6)&1);
`;
            if (spec.wifi) cpp += `            mqtt_publish_raw(MQTT_TOPIC_RELAYS, rbuf);\n`;
            if (spec.lora_role === 'satellite') cpp += `            lora_publish_data("relays", rbuf);\n`;
            cpp += `        }
`;
        }
        cpp += `        _io_force = false;
    }
`;

        // Máquina de estados do pivô — roda a cada loop (timing interno próprio).
        if (spec.pivo && spec.has_relays) {
            cpp += `
    // Pivô: máquina de estados (lê BI das entradas, aciona BO via relés).
    pivot_loop();
`;
        }
        if (spec.bomba && spec.has_relays) {
            const bombaPub = spec.wifi ? 'mqtt_publish_sub'
                : (spec.lora_role === 'satellite' ? '[](const char* sub, const char* payload){ lora_publish_data(sub, payload); }'
                : '[](const char* sub, const char* payload){ Serial.printf("[BOMBA] %s: %s\\n", sub, payload); }');
            cpp += `
    // Posto de combustivel: le BI/AI, roda a maquina de estados (lib bomba_posto), aplica BO, publica.
    bomba_loop(${bombaPub});
`;
        }
        if (spec.carregador && spec.has_relays) {
            cpp += `
    // Carregador: habilita/corta + detecta desconexao (BI Conectado).
    carregador_loop();
`;
        }

        if (spec.rs485_devices.length > 0) {
            const pubCall = spec.wifi
                ? `modbus_publish_all(mqtt_publish_sub);`
                : (spec.lora_role === 'satellite'
                    ? `modbus_publish_all([](const char* sub, const char* payload){ lora_publish_data(sub, payload); });`
                    : `modbus_publish_all([](const char* sub, const char* payload){ Serial.printf("[MB] %s %s\\n", sub, payload); });`);
            cpp += `
    // Modbus: sample 1 device por ciclo (round-robin) a cada METER_CYCLE_MS
    if (now - last_sample >= METER_CYCLE_MS) {
        last_sample = now;
        modbus_sample_one();
    }
    // C1 anti-travamento: NENHUMA leitura RS485 boa ha 15 min -> reinicia a UART/driver
    // (1x a cada 15 min). Nao reinicia a TON: inversor desligado a noite e' normal.
    {
        static unsigned long _lastUartReinit = 0;
        if (diag_last_successful_read_ms > 0 && now - diag_last_successful_read_ms > 900000UL
            && now - _lastUartReinit > 900000UL) {
            _lastUartReinit = now;
            Serial.println("[RS485] barramento mudo ha 15 min - reiniciando a UART");
            modbus_init();
        }
    }
`;
            // SOE: drenagem da fila de eventos (só se algum device expõe buffer no catálogo).
            // Barato: 1 registrador (EVENTCOUNT) quando não há evento — por isso pode rodar
            // mais rápido que o sample sem pesar no barramento 9600.
            const evtDevs = spec.rs485_devices.filter((d) => d.catalog_device && d.catalog_device.eventos);
            if (evtDevs.length > 0) {
                const evtMs = Math.max(
                    500,
                    Math.min(...evtDevs.map((d) => Number(d.catalog_device.eventos.poll_ms) || 2000)),
                );
                const evtPub = spec.wifi
                    ? `mqtt_publish_sub`
                    : (spec.lora_role === 'satellite'
                        ? `[](const char* sub, const char* payload){ lora_publish_data(sub, payload); }`
                        : `[](const char* sub, const char* payload){ Serial.printf("[EVT] %s %s\\n", sub, payload); }`);
                cpp += `
    // SOE: drena a fila de eventos do rele a cada ${evtMs}ms. O evento ja vem carimbado
    // pelo rele (ms na fonte) — poll rapido de estado NAO substitui isso.
    if (now - last_evt >= ${evtMs}) {
        last_evt = now;
        modbus_events_poll(${evtPub});
    }
`;
            }
            // MESTRE-PUXA: o satellite reativo NAO publica por timer — quem dispara o
            // publish e' o POLL do mestre (via lora_poll_respond). O sample_one acima
            // continua rodando pra acumular as medias que serao enviadas no proximo poll.
            if (satReactive) {
                cpp += `    // (mestre-puxa) sem publish autonomo: a telemetria sai em lora_poll_respond
    // quando o mestre POLLa. O accumulator (sample_one) segue rodando pra ter
    // media fresca pronta na hora do POLL. (void)last_publish;
    (void)last_publish;
`;
            } else {
                cpp += `
    // Publicacao periodica: medias + deltas + last a cada PUBLISH_INTERVAL_MS
    if (now - last_publish >= PUBLISH_INTERVAL_MS) {
        last_publish = now;
        ${pubCall}
    }
`;
            }
        }

        // Leitura de devices via TCP (datalogger) — inclui inversores, power_meters, etc.
        // Antes só filtrava 'inversor' — power_meter via datalogger era ignorado.
        const TCP_READABLE_TYPES = ['inversor', 'power_meter', 'medidor_comum', 'rele_protecao'];
        const tcpInvs = (spec.tcp_devices || []).filter(d => TCP_READABLE_TYPES.includes(d.type));
        if (tcpInvs.length > 0) {
            const tcpPubCall = spec.wifi
                ? `inverter_tcp_publish_all(mqtt_publish_sub);`
                : `inverter_tcp_publish_all([](const char* sub, const char* payload){ Serial.printf("[TCP] %s %s\\n", sub, payload); });`;
            cpp += `
    // Modbus TCP (Datalogger): sample round-robin 1 inversor por ciclo a cada METER_CYCLE_MS,
    // publica medias/last/delta a cada PUBLISH_INTERVAL_MS (igual padrao RS485).
    if (now - last_sample_tcp >= METER_CYCLE_MS) {
        last_sample_tcp = now;
        inverter_tcp_sample_one();
    }
`;
            // MESTRE-PUXA: idem RS485 — o satellite reativo so' publica TCP quando POLLado.
            if (satReactive) {
                cpp += `    // (mestre-puxa) publish TCP sai em lora_poll_respond no POLL do mestre.
    (void)last_publish_tcp;
`;
            } else {
                cpp += `    if (now - last_publish_tcp >= PUBLISH_INTERVAL_MS) {
        last_publish_tcp = now;
        ${tcpPubCall}
    }
`;
            }

            // SOE via TCP: espelho do timer RS485 — so se algum device TCP direto (MBAP)
            // expoe buffer de eventos no catalogo. Barato: 1 reg (EVENTCOUNT) sem evento.
            const tcpEvtDevs = tcpInvs.filter((d) =>
                d.catalog_device && d.catalog_device.eventos &&
                d.gateway && d.gateway.mode !== 'rtu_tcp');
            if (tcpEvtDevs.length > 0) {
                const tcpEvtMs = Math.max(
                    500,
                    Math.min(...tcpEvtDevs.map((d) => Number(d.catalog_device.eventos.poll_ms) || 2000)),
                );
                const tcpEvtPub = spec.wifi
                    ? `mqtt_publish_sub`
                    : (spec.lora_role === 'satellite'
                        ? `[](const char* sub, const char* payload){ lora_publish_data(sub, payload); }`
                        : `[](const char* sub, const char* payload){ Serial.printf("[EVT] %s %s\\n", sub, payload); }`);
                cpp += `
    // SOE (TCP): drena a fila de eventos do rele a cada ${tcpEvtMs}ms — evento ja vem
    // carimbado pelo rele (ms na fonte).
    if (now - last_evt_tcp >= ${tcpEvtMs}) {
        last_evt_tcp = now;
        inverter_tcp_events_poll(${tcpEvtPub});
    }
`;
            } else {
                cpp += `    (void)last_evt_tcp;\n`;
            }
        }

        cpp += `
    // Serial commands
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\\n');
${spec.bomba && spec.has_relays ? '        g_cmd_from_serial = true;\n' : ''}        process_command(cmd.c_str());
${spec.bomba && spec.has_relays ? '        g_cmd_from_serial = false;\n' : ''}    }
`;

        if (spec.has_lora) {
            cpp += `
    // LoRa RX — dispatcher consciente do papel (gateway vs satellite).
    if (lora_available()) {
        String msg = lora_read();
        if (msg.length() > 0) {
            Serial.printf("[LORA] RX: %s\\n", msg.c_str());
            lora_handle_rx(msg.c_str());
        }
    }
`;
            if (spec.lora_role === 'gateway' || spec.lora_role === 'satellite') {
                cpp += `
    // LoRa tick — gateway processa retries do pending queue; satellite emite heartbeat.
    lora_loop_tick();
`;
            }
        }

        cpp += `}
`;
        return cpp;
    }

    // ================================================================
    // PUBLIC — Generate all TON projects
    // ================================================================
    generateAll() {
        const specs = this.analyze();
        return specs.map(spec => this.generateProject(spec));
    }
};
