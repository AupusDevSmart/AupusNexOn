/*
 * Agenda de leitura Modbus por TIPO de equipamento — compartilhado pelos geradores V1
 * (iot-firmware-generator.v2.js) e TON-V2 (iot-firmware-generator.ton-v2.js).
 *
 * De onde vem o intervalo de cada device (segundos):
 *   1. modelo do catálogo  — `leitura_s` no mapeamento do modelo (exceção de um modelo)
 *   2. tipo do catálogo    — `leitura_s` do tipo (inversor, power_meter, ...): o padrão
 *   3. nenhum              — o rodízio de sempre (1 device a cada METER_CYCLE_MS)
 *
 * Sem intervalo em NENHUM device o gerador emite o código antigo, byte a byte (regressão).
 * Com algum intervalo: a cada AGENDA_SLOT_MS lê UM device (barramento compartilhado) — o
 * mais atrasado entre os que já venceram. Device sem intervalo fica com o ritmo de hoje
 * (METER_CYCLE_MS × quantidade de devices). A publicação só leva quem foi lido desde a
 * última: um inversor lido a cada 5 min sai a cada 5 min, sem "no_samples" no meio.
 */
var AgendaLeituraGen = (function () {
    var SLOT_MS = 1000;          // ritmo do barramento com agenda: no máximo 1 leitura por segundo
    var MIN_S = 1, MAX_S = 3600;

    function segundos(v) {
        var n = Number(v);
        if (!isFinite(n) || n <= 0) return null;
        return Math.min(MAX_S, Math.max(MIN_S, Math.round(n)));
    }

    /** Intervalo do device em segundos (modelo > tipo) ou null. */
    function intervaloS(dev) {
        var cat = (dev && dev.catalog_device) || {};
        var doModelo = segundos(cat.leitura_s);
        if (doModelo) return doModelo;
        var tipo = cat.tipo || (dev && dev.type);
        var pts = (typeof DEVICE_POINTS !== 'undefined' && tipo) ? DEVICE_POINTS[tipo] : null;
        return segundos(pts && pts.leitura_s);
    }

    /** Intervalos (ms) por device, na ordem dada; null = ninguém tem intervalo (código antigo). */
    function plano(devs, cicloMs) {
        var s = (devs || []).map(intervaloS);
        if (!s.some(Boolean)) return null;
        var padrao = cicloMs * devs.length;
        return s.map(function (x) { return x ? x * 1000 : padrao; });
    }

    /**
     * C++ da agenda: substitui o rodízio (`fnSample`) e o publish de todos (`fnPublish`).
     *   o: { prefixo, devs, cicloMs, fnSample, fnPublish, assinaturaPublish, sample(idx), publish(idx), nome(idx) }
     */
    function gerar(o) {
        var ms = plano(o.devs, o.cicloMs);
        var n = o.devs.length, p = o.prefixo;
        var cpp = '\n// Agenda de leitura por tipo de equipamento (catalogo: leitura_s do tipo ou do modelo).\n'
            + '// A cada ' + SLOT_MS + ' ms le UM device: o mais atrasado entre os que ja venceram.\n'
            + '// Intervalos (ms): ' + o.devs.map(function (d, i) { return (o.nome ? o.nome(i) : ('dev' + i)) + '=' + ms[i]; }).join(', ') + '\n'
            + 'static const uint32_t ' + p + '_int_ms[' + n + '] = {' + ms.map(function (x) { return x + 'UL'; }).join(', ') + '};\n'
            + 'static unsigned long ' + p + '_ult[' + n + '] = {0};\n'
            + 'static bool ' + p + '_lido[' + n + '] = {false};   // lido (ou tentado) desde a ultima publicacao\n'
            + '\n'
            + 'void ' + o.fnSample + '() {\n'
            + '    unsigned long now = millis();\n'
            + '    int best = -1;\n'
            + '    unsigned long atrasoMax = 0;\n'
            + '    for (int i = 0; i < ' + n + '; i++) {\n'
            + '        // nunca lido = o mais atrasado de todos\n'
            + '        unsigned long atraso = ' + p + '_ult[i] ? now - ' + p + '_ult[i] : 0xFFFFFFFFUL;\n'
            + '        if (' + p + '_ult[i] && atraso < ' + p + '_int_ms[i]) continue;\n'
            + '        if (' + p + '_ult[i]) atraso -= ' + p + '_int_ms[i];\n'
            + '        if (best < 0 || atraso > atrasoMax) { best = i; atrasoMax = atraso; }\n'
            + '    }\n'
            + '    if (best < 0) return;\n'
            + '    ' + p + '_ult[best] = now ? now : 1;\n'
            + '    ' + p + '_lido[best] = true;\n'
            + '    switch (best) {\n';
        o.devs.forEach(function (_, i) { cpp += '        case ' + i + ': ' + o.sample(i) + '; break;\n'; });
        cpp += '    }\n'
            + '}\n'
            + '\n'
            + 'void ' + o.fnPublish + '(' + o.assinaturaPublish + ') {\n'
            + '    if (!publish) return;\n';
        o.devs.forEach(function (_, i) {
            cpp += '    if (' + p + '_lido[' + i + ']) { ' + p + '_lido[' + i + '] = false; ' + o.publish(i) + '; }\n';
        });
        cpp += '}\n';
        return cpp;
    }

    return { SLOT_MS: SLOT_MS, intervaloS: intervaloS, plano: plano, gerar: gerar };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { AgendaLeituraGen: AgendaLeituraGen };
