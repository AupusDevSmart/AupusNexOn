// ============================================================================
// pivo_local — maquina de estados do PIVO na TON (sequencia local, sem internet).
// Spec: docs/IOT-PIVO-TON-LOCAL.md (11/11/2026).
//
// O NexON manda o PLANO (direcao, agua, percentimetro, canhao, parada, segmentos);
// a TON liga, irriga, confere as paradas a cada posicao do encoder e desliga sozinha.
//
// C++ PURO (sem Arduino): compila no host (test_pivo.cpp) e no ESP32 dentro do
// firmware gerado. Quem le as BI, aciona reles, roda o ciclo do percentimetro,
// publica MQTT e guarda NVS e' o glue gerado — esta lib so' decide.
// Fonte canonica: AupusNexOn/firmware-libs/pivo_local/. Os geradores (V1 e V2)
// embutem uma COPIA identica (smoke confere byte a byte).
//
// I/O padrao (alteravel no NexON):
//   BO01 bombeamento  BO02 valvula  BO03 girar dir  BO04 girar esq  BO05 percentimetro  BO06 canhao
//   BI01 pressao ok   BI02 tensao ok BI03 girando dir BI04 girando esq BI05 seguranca     BI06 canhao ligado
// ENTRADAS aqui sao SEMANTICAS: a polaridade de cada BI ja foi resolvida pelo glue
// (configuravel por BI). desalinhado = true => seguranca atuou.
// Direcao: 'D' = direita = Avanco = angulo do encoder CRESCENTE; 'E' = esquerda.
// ============================================================================
#ifndef PIVO_LOCAL_H
#define PIVO_LOCAL_H

#include <stdint.h>
#include <stddef.h>

namespace pivo {

enum Estado : uint8_t { PARADO = 0, LIGANDO, IRRIGANDO, DESLIGANDO };
const char* estadoNome(Estado e);

// Passo em curso (o que a sequencia esta esperando agora).
enum Passo : uint8_t {
    P_NENHUM = 0,
    L_TENSAO,        // ligar 1: espera tensao (BI02)
    L_PRESSAO,       // ligar 3: bomba ligada, espera pressao (BI01)
    L_LADO,          // ligar 5: lado acionado, espera girando (BI03/BI04)
    D_BOMBA,         // desligar 2: bomba desligada, espera pressao cair
    D_LADO,          // desligar 5: lados desligados, espera girando cair
};
const char* passoNome(Passo p);

enum Parada : uint8_t { POR_VOLTAS = 0, POR_ANGULO, POR_DURACAO };

static const int MAX_SEG    = 8;
static const int ID_LEN     = 28;
static const int MOTIVO_LEN = 24;

struct Config {
    // Quais sinais estao ligados (BO/BI mapeados). Sinal ausente = o passo nao confere.
    bool tem_valvula    = false;   // BO02
    bool tem_canhao     = true;    // BO06
    bool tem_pressao    = true;    // BI01
    bool tem_tensao     = true;    // BI02
    bool tem_gir_dir    = true;    // BI03
    bool tem_gir_esq    = true;    // BI04
    bool tem_seguranca  = true;    // BI05
    bool tem_canhao_st  = true;    // BI06
    uint32_t tensao_ms          = 2000;     // ligar 1: tensao tem de aparecer em ate
    uint32_t pressurizacao_ms   = 120000;   // ligar 3: pressao em ate (sem BI01 = espera fixa)
    uint32_t confirma_giro_ms   = 30000;    // ligar 5
    uint32_t confirma_canhao_ms = 30000;    // ligar 8 (nao para a irrigacao, so' avisa)
    uint32_t confirma_bomba_ms  = 30000;    // desligar 2 (nao bloqueia, so' avisa)
    uint32_t confirma_parada_ms = 60000;    // desligar 5 (sem parar = falha "nao_parou")
    uint32_t tolerancia_ms      = 0;        // queda de pressao/tensao/lado irrigando (0 = instantaneo; decidido 11/11)
    uint32_t sem_posicao_ms     = 300000;   // parada por posicao sem leitura do encoder
    uint32_t janela_giro_ms     = 600000;   // "girando" = angulo mudou dentro desta janela (encoder de 360 pos. anda em passos de 1 grau)
};

// Faixa de angulo ABSOLUTO [ini_grau, ini do proximo) com o proprio percentimetro/canhao.
struct Segmento { float ini_grau; int16_t pm; bool canhao; };

struct Plano {
    char     id[ID_LEN] = {0};        // id da irrigacao no NexON (casa os eventos)
    char     dir        = 'D';        // 'D' | 'E'
    bool     com_agua   = true;
    int16_t  pm         = 1000;       // percentimetro em permil (0..1000). Sem agua => 1000
    bool     canhao     = false;
    Parada   parada     = POR_VOLTAS;
    float    voltas     = 1.0f;       // POR_VOLTAS (>0)
    float    angulo     = 0.0f;       // POR_ANGULO: angulo final absoluto (0..360)
    uint32_t duracao_s  = 0;          // POR_DURACAO (>0); horario de parada vira duracao no NexON
    uint8_t  nseg       = 0;          // 0 = sem segmentos
    Segmento seg[MAX_SEG];
};
// Valida e normaliza; false + motivo se invalido.
bool validarPlano(Plano& p, char* motivo, size_t msz);

struct Entradas {
    bool pressao     = false;   // BI01
    bool tensao      = false;   // BI02
    bool gir_dir     = false;   // BI03
    bool gir_esq     = false;   // BI04
    bool desalinhado = false;   // BI05 (seguranca atuou)
    bool canhao      = false;   // BI06
};

struct Saidas {
    bool    bomba   = false;    // BO01 (mantida)
    bool    valvula = false;    // BO02
    bool    dir     = false;    // BO03
    bool    esq     = false;    // BO04
    bool    canhao  = false;    // BO06
    int16_t perc_pm = -1;       // BO05: ciclo local do percentimetro; -1 = desligado
};

// Eventos para o NexON (glue: <base>/pivo/evento) e para o Serial.
//   tipo: "ligar" | "passo" | "irrigando" | "segmento" | "aviso" | "desligar" | "parado" | "falha"
struct Ouvinte {
    virtual ~Ouvinte() {}
    virtual void aoEvento(const char* tipo, const char* detalhe) = 0;
    virtual void aoMudarEstado(Estado de, Estado para) = 0;
};

class Maquina {
public:
    Maquina(const Config& cfg, Ouvinte* ouv);
    void configurar(const Config& cfg) { _cfg = cfg; }
    const Config& config() const { return _cfg; }

    // Chamar a cada volta do loop com as entradas lidas. Depois aplicar saidas().
    void tick(uint32_t now_ms, const Entradas& in);
    const Saidas& saidas() const { return _out; }

    // Posicao do encoder (graus 0..360, ja com zero/sentido). Chamar a cada leitura nova.
    void posicao(float graus, uint32_t now_ms);

    // Comandos. Retornam false + motivo quando recusam.
    bool ligar(const Plano& p, uint32_t now_ms, char* motivo, size_t msz);
    bool desligar(const char* motivo, uint32_t now_ms);    // motivo: "comando", "ponta", ...
    bool ajustarPercentimetro(int16_t pm, char* motivo, size_t msz);
    bool comandarCanhao(bool ligar, uint32_t now_ms, char* motivo, size_t msz);

    // Observabilidade
    Estado      estado() const { return _st; }
    Passo       passo() const { return _passo; }
    const Plano& plano() const { return _plano; }
    const char* falha() const { return _falha; }           // "" = sem falha (ultima parada normal)
    const char* motivoParada() const { return _motivo; }   // por que desligou por ultimo
    bool        temPosicao() const { return _tem_pos; }
    float       angulo() const { return _ang; }
    float       percorrido() const { return _percorrido; } // graus no sentido do plano desde o ligar
    float       alvo() const { return _alvo; }             // graus a percorrer (<0 = ainda sem posicao / por duracao)
    int         segmentoAtual() const { return _seg; }     // -1 = sem segmentos
    bool        girando(uint32_t now_ms) const;            // percentimetro > 0 e angulo mudando
    uint32_t    duracaoMs(uint32_t now_ms) const { return _st == PARADO ? 0 : now_ms - _t_ligar; }
    const Entradas& entradas() const { return _in; }
    bool        otaPermitida() const { return _st == PARADO; }
    bool        reinicioPermitido() const { return _st == PARADO; }

private:
    void _ir(Estado e, uint32_t now);
    void _passoPara(Passo p, uint32_t now, const char* nome);
    void _ligarBomba(uint32_t now);
    void _acionarLado(uint32_t now);
    void _entrarIrrigando(uint32_t now);
    void _iniciarDesligar(const char* motivo, bool falha, uint32_t now);
    void _depoisBomba(uint32_t now);
    void _terminar(uint32_t now);
    bool _segurancaLigando(uint32_t now);
    void _aplicarSegmento(uint32_t now, bool forcar);
    void _canhao(bool on, uint32_t now);
    bool _gir() const { return _plano.dir == 'D' ? _in.gir_dir : _in.gir_esq; }
    bool _temGir() const { return _plano.dir == 'D' ? _cfg.tem_gir_dir : _cfg.tem_gir_esq; }
    bool _queda(bool ok, uint32_t& desde, uint32_t now);

    Config   _cfg;
    Ouvinte* _ouv;
    Estado   _st = PARADO;
    Passo    _passo = P_NENHUM;
    Saidas   _out;
    Entradas _in;
    Plano    _plano;
    uint32_t _now = 0;
    uint32_t _t_passo = 0;
    uint32_t _t_ligar = 0;
    char     _falha[MOTIVO_LEN] = {0};
    char     _motivo[MOTIVO_LEN] = {0};
    bool     _falha_desligar = false;   // o desligar em curso foi por falha
    // posicao
    bool     _tem_pos = false;
    float    _ang = 0;
    uint32_t _t_pos = 0;
    uint32_t _t_ang_mudou = 0;
    float    _ang_ref = 0;               // ultimo angulo em que contou "mudou" (pivo lento anda <0,2 grau por leitura)
    bool     _ang_mudou_ok = false;
    bool     _contando = false;          // ja' tem a referencia do ligar
    float    _percorrido = 0;
    float    _alvo = -1;
    int      _seg = -1;
    // canhao
    uint32_t _canhao_conf_ate = 0;       // 0 = nada a confirmar
    // quedas (0 = sinal ok)
    uint32_t _q_pressao = 0, _q_tensao = 0, _q_lado = 0;
};

} // namespace pivo

#endif // PIVO_LOCAL_H
