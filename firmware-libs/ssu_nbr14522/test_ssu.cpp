// Testes no host da lib ssu_nbr14522 — vetores e casos obrigatorios da spec (§10).
//   g++ -std=c++17 -O2 -Wall -Wextra -o test_ssu test_ssu.cpp ssu_nbr14522.cpp && ./test_ssu
#include "ssu_nbr14522.h"
#include <stdio.h>
#include <string.h>

using namespace ssu;

static int falhas = 0, total = 0;
#define CHECK(cond, msg) do { total++; if (cond) printf("ok   %s\n", msg); else { falhas++; printf("FALHOU %s  (%s:%d)\n", msg, __FILE__, __LINE__); } } while (0)

// Monta bloco estendido com CRC correto a partir dos 7 octetos de dados.
static void ext(uint8_t* out, uint16_t seg, uint8_t oct2hi, uint8_t oct3, uint16_t pa, uint16_t pr) {
    out[0] = seg & 0xFF; out[1] = (uint8_t)(((seg >> 8) & 0x0F) | (oct2hi & 0xF0)); out[2] = oct3;
    out[3] = pa & 0xFF; out[4] = pa >> 8; out[5] = pr & 0xFF; out[6] = pr >> 8;
    uint16_t c = crc16(out, 7); out[7] = c & 0xFF; out[8] = c >> 8;
}
// oct3 estendido: postoHorario(bits0-1) | quadranteBits(bits4-5) | tarifa(bit7)
static uint8_t oct3(uint8_t posto, uint8_t quad, bool tarifa) {
    static const uint8_t BITS[5] = { 0, 0x00, 0x20, 0x30, 0x10 };   // Q1=00 Q2=10 Q3=11 Q4=01
    return (uint8_t)((posto & 3) | BITS[quad] | (tarifa ? 0x80 : 0));
}

// Alimenta N blocos iguais pra travar o formato (BLOCOS_PARA_TRAVAR).
static void travar(Leitor& L, const uint8_t* b, size_t n) {
    Resultado r;
    for (int i = 0; i < Leitor::BLOCOS_PARA_TRAVAR; i++) L.alimentarBloco(b, n, r);
}

int main() {
    // ---------------- vetores da spec §10 ----------------
    {
        const uint8_t v[8] = { 0x1C, 0x82, 0x92, 0xD0, 0x20, 0x1C, 0x0C, 0x13 };
        Resultado r;
        CHECK(decodificarNormal(v, r), "vetor normal: LRC valido (XOR=EC, complemento=13)");
        CHECK(r.segundos == 540, "vetor normal: 540 s restantes");
        CHECK(r.pulsosAtiva == 8400 && r.pulsosReativa == 3100, "vetor normal: 8400 ativa / 3100 reativa");
        CHECK(r.segmentoHorario == 2 && r.tipoTarifa == 1, "vetor normal: fora de ponta, tarifa verde");
        CHECK(r.quadrante == 0, "vetor normal: sem quadrante");
    }
    {
        const uint8_t v[9] = { 0x3E, 0x80, 0x81, 0xC0, 0x2B, 0x8E, 0x12, 0x55, 0xB8 };
        Resultado r;
        CHECK(crc16(v, 7) == 0xB855, "vetor estendido Q1: CRC = B855");
        CHECK(decodificarEstendido(v, r), "vetor estendido Q1: valido");
        CHECK(r.segundos == 62 && r.postoHorario == 1 && r.postoReativo == 2, "vetor estendido Q1: 62 s, ponta, reativo indutivo");
        CHECK(r.quadrante == 1 && r.regAtiva == 1 && r.regReativa == 3, "vetor estendido Q1: Q1 -> REG1 + REG3");
        CHECK(r.pulsosAtiva == 11200 && r.pulsosReativa == 4750, "vetor estendido Q1: 11200 ativa / 4750 reativa");
        CHECK(r.tarifaReativos, "vetor estendido Q1: tarifacao de reativo ativa (bit 7)");
    }
    {
        const uint8_t v[9] = { 0x82, 0x43, 0x32, 0x29, 0x00, 0x0C, 0x00, 0x98, 0x63 };
        Resultado r;
        CHECK(crc16(v, 7) == 0x6398, "vetor estendido Q3: CRC = 6398");
        CHECK(decodificarEstendido(v, r), "vetor estendido Q3: valido");
        CHECK(r.segundos == 898 && r.postoHorario == 2 && r.postoReativo == 1, "vetor estendido Q3: 898 s, fora de ponta, capacitivo");
        CHECK(r.quadrante == 3 && r.regAtiva == 2 && r.regReativa == 5, "vetor estendido Q3: Q3 -> REG2 + REG5");
        CHECK(r.pulsosAtiva == 41 && r.pulsosReativa == 12, "vetor estendido Q3: 41 ativa / 12 reativa");
    }
    {
        const uint8_t v[8] = { 0x01, 0x00, 0x12, 0x16, 0x00, 0x0a, 0x00, 0xf0 };
        Resultado r;
        CHECK(decodificarNormal(v, r) && r.segundos == 1 && r.pulsosAtiva == 22 && r.pulsosReativa == 10 && r.segmentoHorario == 2 && r.tipoTarifa == 1,
              "referencia de campo (A-967): 1 s, fora de ponta, verde, 22 ativa, 10 reativa");
    }

    // ---------------- caso 1: bloco normal no parser estendido -> rejeitado ----------------
    {
        const uint8_t v[8] = { 0x1C, 0x82, 0x92, 0xD0, 0x20, 0x1C, 0x0C, 0x13 };
        uint8_t v9[9]; memcpy(v9, v, 8); v9[8] = 0x00;   // 8 bytes + 1 de ruido
        Resultado r;
        CHECK(!decodificarEstendido(v9, r), "caso 1: bloco normal (+ruido) NAO passa no parser estendido");
        Leitor L; L.travarFormato(FMT_ESTENDIDO);
        CHECK(!L.alimentarBloco(v, 8, r) && L.stats().blocosInvalidos == 1, "caso 1: travado em estendido, bloco de 8 = erro de frame (nao troca de formato)");
        CHECK(L.formato() == FMT_ESTENDIDO, "caso 1: formato continua estendido");
    }

    // ---------------- caso 2: Q1 -> Q3 nao gera pico (registrador diferente) ----------------
    {
        uint8_t q1[9], q3[9]; Resultado r; Leitor L;
        ext(q1, 62, 0x80, oct3(1, 1, true), 11200, 4750);
        travar(L, q1, 9);
        // 1a leitura apos travar: baseline (sem delta)
        ext(q1, 61, 0x80, oct3(1, 1, true), 11205, 4752);
        CHECK(L.alimentarBloco(q1, 9, r) && r.baseline && r.deltaAtiva == 0, "caso 2: primeira leitura do registrador = baseline, sem delta");
        ext(q1, 60, 0x80, oct3(1, 1, true), 11210, 4755);
        CHECK(L.alimentarBloco(q1, 9, r) && r.deltaAtiva == 5 && r.deltaReativa == 3, "caso 2: Q1 seguinte: delta 5 ativa / 3 reativa");
        ext(q3, 59, 0x40, oct3(2, 3, false), 41, 12);   // muda pra Q3: contadores mostram REG2/REG5
        CHECK(L.alimentarBloco(q3, 9, r) && r.quadrante == 3 && r.regAtiva == 2 && r.regReativa == 5, "caso 2: bloco Q3 -> REG2 + REG5");
        CHECK(r.baseline && r.deltaAtiva == 0 && r.deltaReativa == 0, "caso 2: ativa caiu 11210 -> 41 por TROCA de registrador: sem pico (baseline do REG2)");
        ext(q3, 58, 0x40, oct3(2, 3, false), 44, 13);
        CHECK(L.alimentarBloco(q3, 9, r) && r.deltaAtiva == 3 && r.deltaReativa == 1, "caso 2: Q3 seguinte: delta vs REG2/REG5 (3 / 1)");
    }

    // ---------------- caso 3: Q1 -> Q4 mantem REG1 (ativa segue), so' a reativa troca ----------------
    {
        uint8_t b[9]; Resultado r; Leitor L;
        ext(b, 500, 0x80, oct3(2, 1, false), 1000, 200); travar(L, b, 9);
        ext(b, 499, 0x80, oct3(2, 1, false), 1010, 202); L.alimentarBloco(b, 9, r);      // baseline
        ext(b, 498, 0x80, oct3(2, 4, false), 1020, 7);                                   // Q4: REG1 + REG6
        CHECK(L.alimentarBloco(b, 9, r) && r.quadrante == 4 && r.regAtiva == 1 && r.regReativa == 6, "caso 3: Q4 -> REG1 + REG6");
        CHECK(r.deltaAtiva == 10 && !(r.deltaReativa != 0), "caso 3: ativa continua no REG1 (delta 10); reativa e' baseline do REG6 (0)");
        CHECK(r.baseline, "caso 3: flag baseline (so' pela reativa/REG6)");
    }

    // ---------------- caso 4: tres blocos identicos de fechamento -> um evento ----------------
    {
        uint8_t b[9]; Resultado r; Leitor L;
        ext(b, 10, 0x80, oct3(2, 1, false), 500, 50); travar(L, b, 9);
        ext(b, 3, 0x80, oct3(2, 1, false), 520, 52); L.alimentarBloco(b, 9, r);   // baseline
        ext(b, 0, 0x80, oct3(2, 1, false), 530, 53);
        CHECK(L.alimentarBloco(b, 9, r) && !r.repetido && r.deltaAtiva == 10, "caso 4: bloco de fechamento (1o) acumula");
        CHECK(L.alimentarBloco(b, 9, r) && r.repetido && r.deltaAtiva == 0, "caso 4: 2a repeticao ignorada");
        CHECK(L.alimentarBloco(b, 9, r) && r.repetido && r.deltaAtiva == 0, "caso 4: 3a repeticao ignorada");
        CHECK(L.stats().fechamentosRepetidos == 2, "caso 4: 2 repeticoes contabilizadas");
        // intervalo novo: contador regressivo reinicia (0 -> 899), contadores recomecam de 0
        ext(b, 899, 0x80, oct3(2, 1, false), 2, 0);
        CHECK(L.alimentarBloco(b, 9, r) && r.fimIntervaloDemanda && r.deltaAtiva == 2 && r.deltaReativa == 0,
              "caso 4b: intervalo novo detectado (0 -> 899); base zerada, delta = 2 (nao 65008)");
    }

    // ---------------- caso 5: bits 4 e 5 alternando -> um evento por transicao ----------------
    {
        uint8_t b[9]; Resultado r; Leitor L;
        ext(b, 800, 0x80, oct3(2, 1, false), 100, 10); travar(L, b, 9);
        ext(b, 799, 0x80, oct3(2, 1, false), 101, 10); L.alimentarBloco(b, 9, r);
        CHECK(!r.fimIntervaloReativo && !r.reposicaoFatura, "caso 5: sem transicao -> sem evento");
        ext(b, 798, 0xA0, oct3(2, 1, false), 102, 10);            // bit5 0->1
        CHECK(L.alimentarBloco(b, 9, r) && r.fimIntervaloReativo && !r.reposicaoFatura, "caso 5: bit5 0->1 = fim de intervalo reativo");
        ext(b, 797, 0xA0, oct3(2, 1, false), 103, 10);
        CHECK(L.alimentarBloco(b, 9, r) && !r.fimIntervaloReativo, "caso 5: bit5 estavel em 1 -> sem novo evento (nao e' nivel)");
        ext(b, 796, 0x90, oct3(2, 1, false), 104, 10);            // bit5 1->0 e bit4 0->1
        CHECK(L.alimentarBloco(b, 9, r) && r.fimIntervaloReativo && r.reposicaoFatura, "caso 5: bit5 1->0 (evento) e bit4 0->1 (reposicao de fatura)");
    }

    // ---------------- caso 6: CRC/LRC com um bit alterado -> rejeicao ----------------
    {
        uint8_t v9[9] = { 0x3E, 0x80, 0x81, 0xC0, 0x2B, 0x8E, 0x12, 0x55, 0xB8 };
        v9[4] ^= 0x01; Resultado r;
        CHECK(!decodificarEstendido(v9, r), "caso 6: CRC com 1 bit alterado -> rejeitado");
        uint8_t v8[8] = { 0x1C, 0x82, 0x92, 0xD0, 0x20, 0x1C, 0x0C, 0x13 };
        v8[3] ^= 0x80;
        CHECK(!decodificarNormal(v8, r), "caso 6: LRC com 1 bit alterado -> rejeitado");
        Leitor L; L.travarFormato(FMT_ESTENDIDO);
        CHECK(!L.alimentarBloco(v9, 9, r) && L.stats().blocosInvalidos == 1 && L.stats().errosConsecutivos == 1, "caso 6: leitor conta o erro (nao entra em calculo algum)");
    }

    // ---------------- caso 7: wrap do contador no MESMO registrador ----------------
    {
        uint8_t b[9]; Resultado r; Leitor L;
        ext(b, 700, 0x80, oct3(2, 1, false), 65000, 100); travar(L, b, 9);
        ext(b, 699, 0x80, oct3(2, 1, false), 65500, 100); L.alimentarBloco(b, 9, r);   // baseline 65500
        ext(b, 698, 0x80, oct3(2, 1, false), 40, 100);
        CHECK(L.alimentarBloco(b, 9, r) && r.deltaAtiva == 76, "caso 7: wrap 65500 -> 40 no mesmo registrador = delta 76, sem pico");
    }

    // ---------------- autodeteccao + enlace degradado + enquadramento por gap ----------------
    {
        uint8_t e[9]; uint8_t n8[8] = { 0x1C, 0x82, 0x92, 0xD0, 0x20, 0x1C, 0x0C, 0x13 };
        Resultado r; Leitor L;
        ext(e, 100, 0x80, oct3(2, 1, false), 10, 1);
        bool nenhumTravou = true;
        for (int i = 0; i < 9; i++) { if (L.alimentarBloco(e, 9, r) || L.travado()) nenhumTravou = false; }
        CHECK(nenhumTravou, "deteccao: 9 blocos coerentes ainda nao travam (precisa de 10)");
        L.alimentarBloco(e, 9, r);
        CHECK(L.travado() && L.formato() == FMT_ESTENDIDO && L.stats().blocosDeteccao == 10, "deteccao: 10 blocos coerentes -> travado em estendido");
        CHECK(L.stats().blocosValidos == 0, "deteccao: blocos da deteccao NAO contam como validos/acumulados");
        // 30 erros consecutivos -> degradado + redeteccao
        for (int i = 0; i < 30; i++) L.alimentarBloco(n8, 8, r);
        CHECK(L.stats().enlaceDegradado && !L.travado() && L.stats().redeteccoes == 1, "degradado: 30 erros -> alarme + volta a DETECTANDO");
        // formato esperado do cadastro so' valida
        Leitor M; M.definirFormatoEsperado(FMT_ESTENDIDO);
        for (int i = 0; i < 10; i++) M.alimentarBloco(n8, 8, r);
        CHECK(M.travado() && M.formato() == FMT_NORMAL && M.formatoDivergente(), "coerencia: medidor em normal com cadastro estendido -> divergente (alarme), deteccao manda");
        // enquadramento por gap (caminho A): 9 bytes contiguos + silencio + proximo bloco
        Leitor G; G.travarFormato(FMT_ESTENDIDO);
        uint32_t t = 1000; bool fechou = false;
        for (int rep = 0; rep < 3; rep++) {
            for (int i = 0; i < 9; i++) { fechou = G.alimentarByte(e[i], t, r) || fechou; t += 91; }
            t += 182;   // silencio entre blocos
        }
        CHECK(fechou && G.stats().blocosValidos == 2, "gap: blocos fechados pelo silencio (>150 ms) entre eles");
        CHECK(G.fecharBloco(r) && G.stats().blocosValidos == 3, "gap: fecharBloco() entrega o ultimo pendente");
    }

    printf("\n%d/%d verificacoes ok%s\n", total - falhas, total, falhas ? "  <<< FALHAS" : "");
    return falhas ? 1 : 0;
}
