// Testes no host da lib wiegand.
//   g++ -std=c++17 -O2 -Wall -Wextra -o test_wiegand test_wiegand.cpp wiegand.cpp && ./test_wiegand
#include "wiegand.h"
#include <stdio.h>
#include <string.h>
#include <string>
#include <vector>

using namespace wiegand;

static int falhas = 0, total = 0;
#define CHECK(cond, msg) do { total++; if (cond) printf("ok   %s\n", msg); else { falhas++; printf("FALHOU %s  (%s:%d)\n", msg, __FILE__, __LINE__); } } while (0)

// Monta o quadro Wiegand 26 com paridades corretas a partir de 24 bits de dados.
static std::vector<int> quadro26(uint32_t dados) {
    std::vector<int> b(26);
    for (int i = 0; i < 24; i++) b[1 + i] = (dados >> (23 - i)) & 1;
    int p1 = 0; for (int i = 1; i <= 12; i++) p1 += b[i];
    int p2 = 0; for (int i = 13; i <= 24; i++) p2 += b[i];
    b[0] = p1 % 2;          // par
    b[25] = 1 - (p2 % 2);   // impar
    return b;
}
static std::vector<int> bitsDe(uint32_t v, int n) {
    std::vector<int> b(n); for (int i = 0; i < n; i++) b[i] = (v >> (n - 1 - i)) & 1; return b;
}

// ---------------------------------------------------------------------------
// Simulacao do ADC: 2 canais intercalados, uma conversao a cada PER us (80 kHz no
// total -> 25 us por canal). Repouso ~2800 (5 V / 7,67 com atenuacao 0 dB), pulso ~30.
// ---------------------------------------------------------------------------
struct Sim {
    Detector d0, d1;
    Decodificador dec;
    std::vector<Evento> eventos;
    uint32_t t = 0;              // us
    static const uint32_t PER = 12;   // ~12,5 us entre conversoes (80 kHz no total)
    uint16_t repouso = 2800, baixo = 30;
    explicit Sim(Config c = Config()) : dec(c) {}
    void passo(bool baixo0, bool baixo1) {
        // uma conversao em cada canal (alternando), como o padrao do DMA
        Pulso p;
        if (d0.amostra(baixo0 ? baixo : repouso, t, p)) dec.adicionarBit(0, p.inicio_us, p.largura_us);
        t += PER;
        if (d1.amostra(baixo1 ? baixo : repouso, t, p)) dec.adicionarBit(1, p.inicio_us, p.largura_us);
        t += PER;
        Evento ev;
        if (dec.tick(t, ev)) eventos.push_back(ev);
    }
    void espera(uint32_t us) { uint32_t fim = t + us; while (t < fim) passo(false, false); }
    // envia os bits: pulso de `larg` us, intervalo de `intervalo` us entre inicios
    void envia(const std::vector<int>& bits, uint32_t larg = 50, uint32_t intervalo = 1000) {
        for (int b : bits) {
            uint32_t ini = t;
            while (t - ini < larg) passo(b == 0, b == 1);
            while (t - ini < intervalo) passo(false, false);
        }
    }
    void fecha() { espera(40000); }
};

int main() {
    // --- funcoes puras ---
    {
        uint32_t d = 0;
        std::vector<int> q = quadro26(0xA1B2C3);
        uint32_t v = 0; for (int b : q) v = (v << 1) | (uint32_t)b;
        CHECK(paridade26(v, d) && d == 0xA1B2C3, "paridade26 ok + dados");
        CHECK(!paridade26(v ^ (1u << 5), d), "paridade26 rejeita bit trocado");
        CHECK(!paridade26(v ^ (1u << 25), d), "paridade26 rejeita paridade par trocada");
        CHECK(tecla4(5) == 5 && tecla4(10) == 10 && tecla4(11) == 11 && tecla4(13) == -1, "tecla4");
        CHECK(tecla8(0xA5) == 5 && tecla8(0x4B) == 11 && tecla8(0x55) == -1, "tecla8 (complemento)");
        char h[12]; hexa(0x00A1B2, 6, h);
        CHECK(strcmp(h, "00A1B2") == 0, "hexa com zeros a esquerda");
        CHECK(caractereTecla(10) == '*' && caractereTecla(11) == '#' && caractereTecla(3) == '3', "caractereTecla");
    }

    // --- fluxo completo: tag 26 bits ---
    {
        Sim s; s.espera(5000);   // calibra o repouso
        s.envia(quadro26(0xA1B2C3)); s.fecha();
        CHECK(s.eventos.size() == 1 && s.eventos[0].tipo == TAG, "tag 26: 1 evento TAG");
        CHECK(s.eventos.size() == 1 && strcmp(s.eventos[0].uid, "A1B2C3") == 0, "tag 26: UID A1B2C3");
        CHECK(s.d0.pulsos() + s.d1.pulsos() == 26, "detector: 26 pulsos nas duas linhas");
        CHECK(s.dec.ultimoN() == 26 && s.dec.ultimaLargura(3) >= 26 && s.dec.ultimaLargura(3) <= 74, "diagnostico: largura ~50 us (+-1 amostra de 24 us)");
        CHECK(s.dec.ultimoIntervalo(5) >= 975 && s.dec.ultimoIntervalo(5) <= 1025, "diagnostico: intervalo ~1 ms");
        CHECK(s.d0.repouso() > 2700 && s.d0.repouso() < 2900, "detector: repouso calibrado ~2800");
    }

    // --- 20 leituras iguais com anti-repeticao desligada = 20 UIDs iguais ---
    {
        Config c; c.antirep_ms = 0; Sim s(c); s.espera(5000);
        for (int i = 0; i < 20; i++) { s.envia(quadro26(0x123456)); s.fecha(); }
        int ok = 0; for (auto& e : s.eventos) if (e.tipo == TAG && strcmp(e.uid, "123456") == 0) ok++;
        CHECK(ok == 20, "20 apresentacoes -> 20 UIDs iguais (antirep off)");
    }

    // --- anti-repeticao: tag mantida no leitor (reenvio a cada 500 ms) ---
    {
        Sim s; s.espera(5000);
        for (int i = 0; i < 6; i++) { s.envia(quadro26(0x0F0F0F)); s.espera(470000); }
        s.fecha();
        int tags = 0, rep = 0; for (auto& e : s.eventos) { if (e.tipo == TAG) tags++; if (e.tipo == REPETIDO) rep++; }
        CHECK(tags == 1 && rep == 5, "tag encostada: 1 TAG + 5 REPETIDO (janela anda)");
        s.espera(2500000);   // passou a janela
        s.envia(quadro26(0x0F0F0F)); s.fecha();
        CHECK(s.eventos.back().tipo == TAG, "depois da janela: TAG de novo");
    }

    // --- 3 tags diferentes ---
    {
        Sim s; s.espera(5000);
        uint32_t uids[3] = {0x000001, 0x7FFFFF, 0xC0FFEE};
        for (uint32_t u : uids) { s.envia(quadro26(u)); s.fecha(); }
        bool ok = s.eventos.size() == 3 && strcmp(s.eventos[0].uid, "000001") == 0 &&
                  strcmp(s.eventos[1].uid, "7FFFFF") == 0 && strcmp(s.eventos[2].uid, "C0FFEE") == 0;
        CHECK(ok, "3 tags -> 3 UIDs distintos");
    }

    // --- paridade errada e quadro com bits faltando ---
    {
        Sim s; s.espera(5000);
        std::vector<int> q = quadro26(0xA1B2C3); q[7] ^= 1;
        s.envia(q); s.fecha();
        CHECK(s.eventos.size() == 1 && s.eventos[0].tipo == INVALIDO && strcmp(s.eventos[0].motivo, "paridade") == 0, "paridade errada -> INVALIDO");
        std::vector<int> curto = quadro26(0xA1B2C3); curto.pop_back();
        s.envia(curto); s.fecha();
        CHECK(s.eventos.size() == 2 && s.eventos[1].tipo == INVALIDO && s.eventos[1].bits == 25, "25 bits -> INVALIDO (bits=25)");
        CHECK(s.dec.invalidos == 2 && s.dec.tags == 0, "nenhum UID entregue de quadro invalido");
    }

    // --- teclado 4 bits e 8 bits ---
    {
        Sim s; s.espera(5000);
        int teclas[] = {1, 2, 3, 4, 11};
        for (int k : teclas) { s.envia(bitsDe((uint32_t)k, 4)); s.espera(150000); }
        s.fecha();
        std::string dig;
        for (auto& e : s.eventos) if (e.tipo == TECLA) dig += caractereTecla((int)e.valor);
        CHECK(dig == "1234#", "teclado 4 bits: 1234#");
        Sim s8; s8.espera(5000);
        s8.envia(bitsDe(0xF0 | 0x0, 8)); s8.fecha();   // tecla 0 -> nibble alto F
        s8.envia(bitsDe(0x87, 8)); s8.fecha();          // 7 -> 0x87
        CHECK(s8.eventos.size() == 2 && s8.eventos[0].valor == 0 && s8.eventos[1].valor == 7, "teclado 8 bits: 0 e 7");
    }

    // --- Teclado (matricula) ---
    {
        Teclado t(15000, 6);
        bool f = false;
        f = t.tecla(1, 0); f = t.tecla(2, 100); f = t.tecla(3, 200);
        CHECK(!f && strcmp(t.parcial(), "123") == 0, "teclado: parcial 123");
        f = t.tecla(11, 300);
        CHECK(f && strcmp(t.texto(), "123") == 0 && t.parcial()[0] == 0, "teclado: # fecha 123");
        t.tecla(9, 400); t.tecla(10, 500);
        CHECK(t.parcial()[0] == 0, "teclado: * apaga");
        CHECK(!t.tecla(11, 600), "teclado: # sem digitos nao fecha");
        t.tecla(5, 1000); t.tick(20000);
        CHECK(t.parcial()[0] == 0, "teclado: timeout apaga");
        for (int i = 0; i < 9; i++) t.tecla(1, 30000 + (uint32_t)i);
        CHECK(strlen(t.parcial()) == 6, "teclado: limite de digitos");
    }

    // --- linha sem sinal (leitor desligado) e pulso longo ---
    {
        Detector d(600, 3000); Pulso p; int n = 0;
        for (uint32_t t = 0; t < 100000; t += 25) if (d.amostra(20, t, p)) n++;
        CHECK(n == 0 && !d.temSinal(), "linha sem repouso (desligada): nenhum pulso");
        Detector d2(600, 3000); n = 0;
        for (uint32_t t = 0; t < 5000; t += 25) d2.amostra(2800, t, p);
        for (uint32_t t = 5000; t < 20000; t += 25) if (d2.amostra(10, t, p)) n++;
        for (uint32_t t = 20000; t < 40000; t += 25) if (d2.amostra(2800, t, p)) n++;
        CHECK(n == 0 && d2.longos() >= 1, "pulso longo (fio solto) nao vira bit");
    }

    // --- pulso curto (20 us): com 25 us por canal ainda pode ser visto, mas nao garantido ---
    {
        Sim s; s.espera(5000);
        s.envia(quadro26(0x55AA55), 40); s.fecha();
        CHECK(s.eventos.size() == 1 && s.eventos[0].tipo == TAG, "pulso de 40 us ainda decodifica");
    }

    printf("\n%d/%d ok\n", total - falhas, total);
    return falhas ? 1 : 0;
}
