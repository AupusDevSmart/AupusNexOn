# Investigação: TON sendo derrubada do broker MQTT (Last Will disparando)

**Data**: 2026-05-27
**Status**: investigação pendente — sintoma confirmado, causa raiz não identificada
**Escopo**: broker MQTT em `72.60.158.163:1883` e clientes que conectam nele
**Não-escopo**: firmware da TON (já tem v1.2.1-cycle4s com setKeepAlive(60), setSocketTimeout(30), mqtt_loop entre blocos — esgotamos o lado client)

---

## 1. Sintoma

TON no CF Investments 01 (MAC `28:37:2F:9D:82:C0`, IP local `192.168.0.149`, hostname `TON1`, topic_base `JOAO/GO/CF/UFV`) conecta no broker e **é desconectada repetidamente em ciclos de ~4 segundos**, mesmo com:

- WiFi estável (confirmado pelo cliente)
- Hardware RS485 OK (terminação 120Ω confirmada)
- Firmware atualizado v1.2.1 com keepalive 60s e socketTimeout 30s

**Evidência capturada** via `mosquitto_sub -h 72.60.158.163 -t 'JOAO/GO/CF/UFV/#'`:

```
JOAO/GO/CF/UFV/status {"online":true,"version":"1.2.1-cycle4s","model":"TON1","mac":"28:37:2F:9D:82:C0","ip":"192.168.0.149","iface":"wifi"}
JOAO/GO/CF/UFV/status {"online":false}    ← Last Will disparado pelo broker
JOAO/GO/CF/UFV/status {"online":true,...}
JOAO/GO/CF/UFV/status {"online":false}
...
```

**Significado**: Last Will (`{"online":false}`) só é publicado pelo broker quando ele decide unilateralmente que o cliente está morto (sem PINGRESP a tempo, ou recebeu FIN/RST do socket TCP). Portanto:

> **A TON não desconecta — é o broker que está chutando-a.**

---

## 2. O que JÁ foi testado e descartado

| Hipótese | Como foi testada | Resultado |
|---|---|---|
| Keepalive default 15s muito apertado | `setKeepAlive(60)` no firmware v1.2.0 | Não resolveu |
| Socket TCP idle timeout | `setSocketTimeout(30)` no firmware v1.2.0 | Não resolveu |
| `mqtt_loop()` não chamado durante samples longos | Adicionado entre blocos Modbus em v1.2.0 | Não resolveu |
| WiFi instável caindo TCP em background | Cliente confirmou WiFi estável | Descartado |
| Hardware RS485 causando bloqueio extremo | Hardware confirmado OK | Descartado |
| Sample Modbus passando de 15s e quebrando keepalive | `METER_CYCLE_MS` aumentado pra 4000ms em v1.2.1 (16s/slave em vez de 8s) | A confirmar (aguardando reflash) |

---

## 3. Hipóteses ranqueadas para investigação

### H1 (MAIS PROVÁVEL): Cliente duplicado com mesmo `client_id`

O firmware atual usa `MQTT_CLIENT_ID = "TON1-" DEVICE_ID`. Para esta TON, o ID é `TON1-TON1` (visível em todos os logs: `Conectando a 72.60.158.163:1883 (TON1-TON1)...`).

**MQTT spec (3.1.1 e 5.0)**: o broker **só permite um client_id conectado por vez**. Quando um segundo cliente conecta com o mesmo ID, o broker **chuta o primeiro** (este é o comportamento spec, não opcional).

Sintoma observado bate **exatamente** com isso:
- Cliente A conecta → broker mata Cliente B (Last Will dispara)
- Cliente B reconecta → broker mata Cliente A (Last Will dispara)
- Loop de ping-pong, ~4s entre eventos = tempo do MQTT_RECONNECT_MS (5s) + tempo de connect/sub

Possíveis fontes de duplicação:
1. **Outra TON em outro site** configurada com hostname `TON1` (cadastro errado na UI)
2. **Cliente MQTT de teste** aberto em algum lugar (MQTTX, MQTT Explorer, mosquitto_sub) com ID `TON1-TON1`
3. **App PM2 `iot-firmware-gen`** ou outro app conectando com esse ID
4. **Cache de uma TON antiga** que ficou em algum repo/script test

### H2: Config do broker (max_keepalive enforced, limit de conexões)

Broker mosquitto/EMQX pode ter:
- `max_keepalive` que sobrescreve o keepalive negociado pelo cliente (se cliente pede 60s mas broker tem max 30s, broker usa 30s)
- Limite de número total de conexões com mesma IP/credencial
- Auth plugin que expira tokens

### H3: Problema de rede entre broker e TON

NAT no roteador do CF Investments 01 pode estar matando a conexão TCP idle (timeout NAT típico 30-300s, depende do hardware). Mas usuário confirmou rede estável, então é hipótese baixa.

---

## 4. Procedimento de investigação

### Pré-requisitos

```bash
# Em qualquer máquina com mosquitto-clients instalado
which mosquitto_sub  # confirmar disponível
```

**Acesso necessário**:
- Conexão de rede para `72.60.158.163:1883`
- Idealmente: SSH no servidor do broker (para ler `mosquitto.log` ou rodar `mosquitto_sub` com permissão admin em `$SYS/#`)

### Passo 1 — Confirmar sintoma reproduz hoje

```bash
timeout 30 mosquitto_sub -h 72.60.158.163 -p 1883 \
  -t 'JOAO/GO/CF/UFV/status' -v -W 25 2>&1
```

**Esperado**: pares de `{"online":true,...}` e `{"online":false}` se repetindo a cada poucos segundos.

**Se não reproduzir**: problema sumiu (talvez o `cycle4s` resolveu, ou o cliente duplicado parou). Encerre a investigação.

**Se reproduzir**: vá pro Passo 2.

### Passo 2 — Investigar H1 (cliente duplicado)

#### 2.1 — Verificar quantos clientes estão conectados no broker

```bash
timeout 15 mosquitto_sub -h 72.60.158.163 -p 1883 \
  -t '$SYS/broker/clients/connected' \
  -t '$SYS/broker/clients/active' \
  -t '$SYS/broker/clients/total' \
  -v -W 12 2>&1
```

**Anotar números**: total, active, connected. Se `active` está oscilando muito (subindo e descendo) = vai-vem de conexões.

#### 2.2 — Tentar ver lista de client_ids conectados (depende de permissão)

```bash
timeout 15 mosquitto_sub -h 72.60.158.163 -p 1883 \
  -t '$SYS/broker/clients/+/connection' \
  -t '$SYS/broker/log/#' \
  -v -W 12 2>&1
```

**Se retornar dados**: procurar por `TON1-TON1` aparecendo MAIS DE UMA VEZ ou em rápida sucessão de connect/disconnect. Anotar IPs de origem.

**Se retornar vazio ou `Connection Refused`**: não tem permissão admin, pule para 2.3.

#### 2.3 — Conectar como SPOILER intencional para confirmar a hipótese

Isso vai **PIORAR temporariamente** o problema mas **confirma a causa**. Em uma janela de terminal:

```bash
# ⚠️ CUIDADO: vai derrubar a TON enquanto rodar
# Pare em 30s no máximo (Ctrl+C)
mosquitto_sub -h 72.60.158.163 -p 1883 \
  -i 'TON1-TON1' \
  -t 'JOAO/GO/CF/UFV/cmd' -v
```

Em outra janela, monitore status da TON:
```bash
mosquitto_sub -h 72.60.158.163 -p 1883 -t 'JOAO/GO/CF/UFV/status' -v
```

**Se a TON começar a reconectar EM ALTA FREQUÊNCIA** (ou seja, MUITO mais que antes) durante os 30s que você roda o spoofer: **H1 CONFIRMADA**. Existe um duplicado em algum lugar.

**Se a frequência não mudar visivelmente**: o problema não é client_id duplicado. Vá para H2.

#### 2.4 — Caçar o duplicado se H1 confirmada

```bash
# Procurar em todos os repos/configs no servidor por "TON1-TON1" hardcoded
grep -rn "TON1-TON1" /var/www/ 2>/dev/null | grep -v node_modules | grep -v dist | head -10

# Procurar processos suspeitos rodando
ps aux | grep -iE "mqtt|mosquitto" | grep -v grep

# Verificar conexões TCP saindo pra 72.60.158.163:1883
ss -tan | grep ':1883'

# Procurar em logs de PM2 últimas conexões MQTT
for app in aupus-nexon-api aupus-service-api iot-firmware-gen aupus-firmware-compiler; do
  echo "=== $app ==="
  pm2 logs $app --lines 100 --nostream 2>&1 | grep -iE "TON1-TON1|client_id" | tail -5
done
```

**Procurar especialmente**:
- Outro TON cadastrado na UI com hostname `TON1` (verificar tabela `iot_componentes` no PostgreSQL):
  ```sql
  SELECT id, propriedades->>'name', propriedades->>'mqtt_topic_base' 
  FROM iot_componentes 
  WHERE tipo='ton1' 
    AND propriedades->>'mqtt_topic_base' LIKE 'JOAO/GO/CF/UFV%';
  ```
  Se mais de uma linha = duplicidade no cadastro.
- Diagramas IoT antigos não-deletados com mesmo topic_base

### Passo 3 — Investigar H2 (config do broker)

**Requer acesso SSH ao servidor do broker (72.60.158.163)**. Comandos no servidor:

```bash
# Identificar broker
ps aux | grep -iE "mosquitto|emqx" | grep -v grep

# Mosquitto config
cat /etc/mosquitto/mosquitto.conf
ls /etc/mosquitto/conf.d/
cat /etc/mosquitto/conf.d/*.conf

# Logs do mosquitto últimas 200 linhas
tail -n 200 /var/log/mosquitto/mosquitto.log

# Em particular, procurar por:
#   "Client TON1-TON1 already connected, closing old connection"
#   "Client TON1-TON1 disconnected due to keepalive timeout"
#   "Bad socket read/write"
grep "TON1-TON1" /var/log/mosquitto/mosquitto.log | tail -30
```

**O que procurar nos logs**:

| Log entry | Significado | Ação |
|---|---|---|
| `already connected, closing old connection` | H1 confirmada — duplicado conectando | Caçar duplicado (Passo 2.4) |
| `disconnected due to keepalive timeout` | Cliente não enviou PINGREQ a tempo | Investigar bloqueio do firmware mesmo após v1.2.1 |
| `Bad socket read` | Problema de rede entre TON e broker | Investigar NAT/firewall |
| `Connection refused: bad username/password` | Auth falhando | Verificar credenciais |
| Nada relevante | Logs muito verbosos ou broker sem log | Pular para H3 |

### Passo 4 — Investigar H3 (NAT/firewall)

Apenas se H1 e H2 forem descartadas.

No site CF Investments 01 (precisa de alguém lá ou acesso ao roteador):
- Modelo do roteador WiFi
- Configuração de NAT idle timeout (procurar por "Session Timeout", "TCP Idle Timeout")
- Logs do roteador se acessíveis

Comparar com configuração de outras instalações que funcionam.

---

## 5. Matriz de decisão (achado → ação)

| Investigação | Achado | Próxima ação |
|---|---|---|
| Passo 1 | Sintoma sumiu sozinho | Encerrar; preencher §10 do doc IOT-RS485-MELHORIAS com métricas finais |
| Passo 2.1 | `clients/total` muito > esperado | Confirma muita atividade; ir 2.2 |
| Passo 2.3 | Spoofer agrava | H1 CONFIRMADA → 2.4 |
| Passo 2.4 | Achou hostname `TON1` em outro cadastro | Renomear na UI (ex: `TON-CF01`, `TON-XYZ`) + regerar firmware da TON afetada + reflashar |
| Passo 2.4 | Achou app de teste rodando | Matar o processo |
| Passo 2.4 | Nada encontrado | Implementar **fix preventivo** (ver §6) |
| Passo 3 | Log mostra `already connected` | Mesma ação de 2.4 |
| Passo 3 | Log mostra `keepalive timeout` | Investigar bloqueio firmware (raro depois de v1.2.1) |
| Passo 4 | NAT timeout < 60s | Solicitar ajuste no roteador OU reduzir keepalive do firmware pra 30s |

---

## 6. Fix preventivo (se causa raiz não for encontrada)

Mudar o `MQTT_CLIENT_ID` do firmware para algo **garantidamente único** por TON:

```cpp
// Antes (gerador atual):
#define MQTT_CLIENT_ID "TON1-" DEVICE_ID
// = "TON1-TON1" (colide se outro TON1 existe)

// Depois (proposto):
// Concatena MAC address (último 3 bytes, hex) — único por placa.
// Mesmo se 2 TONs tiverem hostname "TON1", os MACs são diferentes.
String _mqtt_client_id() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char buf[32];
  snprintf(buf, sizeof(buf), "%s-%s-%02X%02X%02X",
           DEVICE_MODEL, DEVICE_ID, mac[3], mac[4], mac[5]);
  return String(buf);
}
// = "TON1-TON1-9D82C0" (único globalmente)
```

**Trade-off**: muda contrato — qualquer regra no broker baseada em client_id literal precisa ser atualizada. Last Will message stays the same (topic-based).

Implementar APÓS confirmar que H1 é a causa (não mexer no que tá funcionando se for H2/H3).

---

## 7. Apêndice — comandos prontos para emergência

### Ver status atual da TON em tempo real

```bash
mosquitto_sub -h 72.60.158.163 -p 1883 \
  -t 'JOAO/GO/CF/UFV/+' -t 'JOAO/GO/CF/UFV/+/data' \
  -v -F '%I %t %p'
```

### Contar reconexões da TON em 60 segundos

```bash
timeout 60 mosquitto_sub -h 72.60.158.163 -p 1883 \
  -t 'JOAO/GO/CF/UFV/status' 2>&1 \
  | grep -c '"online":true'
# Se >5: ainda tem problema
# Se 1-2: estabilizou
```

### Limpar retained `status` (se ficou bagunçado)

```bash
# CUIDADO: apaga o status atual. TON vai republicar no próximo connect.
mosquitto_pub -h 72.60.158.163 -p 1883 \
  -t 'JOAO/GO/CF/UFV/status' -r -n
```

### Forçar reconexão da TON (via reset remoto)

OTA reflash via UI ou pedir alguém em campo para apertar reset físico. Sem comando MQTT pra reset hoje.

---

## 8. Resultado da investigação

_Preencher quando executar._

| Passo | Resultado | Observações |
|---|---|---|
| 1 — Sintoma reproduz? | | |
| 2.1 — Clients connected | total= active= | |
| 2.3 — Spoofer agrava? | sim/não | |
| 2.4 — Duplicado achado? | onde= | |
| 3 — Logs do broker | | |
| Causa raiz identificada | | |
| Fix aplicado | | |
| Sintoma resolvido em | data= | métricas |
