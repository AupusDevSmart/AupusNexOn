#!/usr/bin/env python3
# Gera o HTML do "Material teórico — P, Q, FP, indutivo/capacitivo e os octetos da SSU".
# As figuras são SVG calculadas aqui (senoides, fasores, plano P×Q) — nada desenhado à mão.
import math

def sine_path(x0, y0, w, h, cycles, phase_rad, amp=1.0, n=240):
    """Caminho SVG de amp*cos(2π·cycles·t − phase) para t em [0,1], mapeado na caixa (x0,y0,w,h)."""
    pts = []
    for k in range(n + 1):
        t = k / n
        v = amp * math.cos(2 * math.pi * cycles * t - phase_rad)
        x = x0 + w * t
        y = y0 + h / 2 - v * (h / 2) * 0.9
        pts.append(f"{'M' if k == 0 else 'L'}{x:.1f} {y:.1f}")
    return " ".join(pts)

def prod_path(x0, y0, w, h, cycles, phase_rad, n=240):
    """p(t) = v·i com v=cos(ωt), i=cos(ωt−φ)  (normalizado a Vm·Im = 1)."""
    pts = []
    for k in range(n + 1):
        t = k / n
        v = math.cos(2 * math.pi * cycles * t)
        i = math.cos(2 * math.pi * cycles * t - phase_rad)
        p = v * i
        x = x0 + w * t
        y = y0 + h / 2 - p * (h / 2) * 0.9
        pts.append(f"{'M' if k == 0 else 'L'}{x:.1f} {y:.1f}")
    return " ".join(pts)

def fig_ondas(phi_deg, titulo, cor_i):
    """Figura: v(t), i(t) e p(t) para um dado ângulo φ (positivo = corrente atrasada)."""
    phi = math.radians(phi_deg)
    W, H = 340, 120
    cos_phi = math.cos(phi)
    return f'''
<svg viewBox="0 0 360 300" width="100%" role="img" aria-label="{titulo}">
  <g font-size="10" fill="#16213e">
    <text x="180" y="14" text-anchor="middle" font-weight="bold">{titulo}</text>
    <!-- v e i -->
    <line x1="10" y1="{20+H/2:.0f}" x2="350" y2="{20+H/2:.0f}" stroke="#c9ced8"/>
    <path d="{sine_path(10, 20, W, H, 2, 0)}" fill="none" stroke="#16213e" stroke-width="1.8"/>
    <path d="{sine_path(10, 20, W, H, 2, phi)}" fill="none" stroke="{cor_i}" stroke-width="1.8"/>
    <text x="180" y="152" text-anchor="middle" font-size="9.5">v(t) em azul · <tspan fill="{cor_i}">i(t) em vermelho</tspan> · eixo: t</text>
    <!-- p -->
    <line x1="10" y1="{160+H/2:.0f}" x2="350" y2="{160+H/2:.0f}" stroke="#c9ced8"/>
    <path d="{prod_path(10, 160, W, H, 2, phi)}" fill="none" stroke="#d97706" stroke-width="1.8"/>
    <line x1="10" y1="{160+H/2 - cos_phi/2*(H/2)*0.9:.1f}" x2="350" y2="{160+H/2 - cos_phi/2*(H/2)*0.9:.1f}" stroke="#2aa63a" stroke-dasharray="4,3"/>
    <text x="180" y="292" text-anchor="middle" font-size="9.5"><tspan fill="#d97706">p(t) = v·i</tspan> · <tspan fill="#2aa63a">média = P</tspan> · φ = {phi_deg:+d}° → cos φ = {cos_phi:.2f}</text>
  </g>
</svg>'''

def fig_fasores():
    """Fasores V e I: atrasado (indutivo) e adiantado (capacitivo)."""
    def arrow(cx, cy, ang_deg, L, cor, label):
        a = math.radians(ang_deg)
        x2, y2 = cx + L * math.cos(a), cy - L * math.sin(a)
        return (f'<line x1="{cx}" y1="{cy}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{cor}" stroke-width="2.2" marker-end="url(#arf)"/>'
                f'<text x="{x2 + 6*math.cos(a):.1f}" y="{y2 - 6*math.sin(a) + 4:.1f}" fill="{cor}" font-size="11" font-weight="bold">{label}</text>')
    def arc(cx, cy, r, a1, a2, cor):
        p1 = (cx + r*math.cos(math.radians(a1)), cy - r*math.sin(math.radians(a1)))
        p2 = (cx + r*math.cos(math.radians(a2)), cy - r*math.sin(math.radians(a2)))
        sweep = 0 if a2 > a1 else 1
        return f'<path d="M{p1[0]:.1f} {p1[1]:.1f} A{r} {r} 0 0 {sweep} {p2[0]:.1f} {p2[1]:.1f}" fill="none" stroke="{cor}" stroke-width="1.2"/>'
    return f'''
<svg viewBox="0 0 700 210" width="100%" role="img" aria-label="Fasores: corrente atrasada (indutivo) e adiantada (capacitivo)">
  <defs><marker id="arf" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="context-stroke"/></marker></defs>
  <g font-size="10" fill="#16213e">
    <text x="175" y="18" text-anchor="middle" font-weight="bold">Indutivo — corrente ATRASADA (φ = +35°)</text>
    <line x1="40" y1="120" x2="330" y2="120" stroke="#c9ced8"/><line x1="175" y1="30" x2="175" y2="200" stroke="#c9ced8"/>
    {arrow(175, 120, 0, 120, '#16213e', 'V')}
    {arrow(175, 120, -35, 105, '#b91c1c', 'I')}
    {arc(175, 120, 40, 0, -35, '#b91c1c')}
    <text x="222" y="146" fill="#b91c1c">φ</text>
    <text x="175" y="196" text-anchor="middle" font-size="9" fill="#4b5563">motores, transformadores, reatores → Q &gt; 0 ("consome reativo")</text>

    <text x="525" y="18" text-anchor="middle" font-weight="bold">Capacitivo — corrente ADIANTADA (φ = −35°)</text>
    <line x1="390" y1="120" x2="680" y2="120" stroke="#c9ced8"/><line x1="525" y1="30" x2="525" y2="200" stroke="#c9ced8"/>
    {arrow(525, 120, 0, 120, '#16213e', 'V')}
    {arrow(525, 120, 35, 105, '#0e7490', 'I')}
    {arc(525, 120, 40, 0, 35, '#0e7490')}
    <text x="572" y="102" fill="#0e7490">φ</text>
    <text x="525" y="196" text-anchor="middle" font-size="9" fill="#4b5563">bancos de capacitores, cabos longos, filtros → Q &lt; 0 ("fornece reativo")</text>
  </g>
</svg>'''

def fig_triangulo():
    # P=100, Q=62 (FP 0,85) em escala
    P, Q = 100, 61.97
    sx = 2.6
    x0, y0 = 60, 170
    xP, yQ = x0 + P*sx, y0 - Q*sx
    phi = math.degrees(math.atan2(Q, P))
    return f'''
<svg viewBox="0 0 520 200" width="100%" role="img" aria-label="Triângulo de potências: P na horizontal, Q na vertical, S na hipotenusa">
  <g font-size="10.5" fill="#16213e">
    <line x1="{x0}" y1="{y0}" x2="{xP:.0f}" y2="{y0}" stroke="#16213e" stroke-width="2.5"/>
    <line x1="{xP:.0f}" y1="{y0}" x2="{xP:.0f}" y2="{yQ:.0f}" stroke="#b91c1c" stroke-width="2.5"/>
    <line x1="{x0}" y1="{y0}" x2="{xP:.0f}" y2="{yQ:.0f}" stroke="#d97706" stroke-width="2.5"/>
    <path d="M{x0+40} {y0} A40 40 0 0 0 {x0 + 40*math.cos(math.radians(phi)):.1f} {y0 - 40*math.sin(math.radians(phi)):.1f}" fill="none" stroke="#4b5563"/>
    <text x="{x0+46}" y="{y0-8}" fill="#4b5563">φ = {phi:.1f}°</text>
    <text x="{(x0+xP)/2:.0f}" y="{y0+16}" text-anchor="middle" font-weight="bold">P = 100 kW (ativa: vira trabalho e calor)</text>
    <text x="{xP+8:.0f}" y="{(y0+yQ)/2+4:.0f}" fill="#b91c1c" font-weight="bold">Q = 62 kvar</text>
    <text x="{xP+8:.0f}" y="{(y0+yQ)/2+18:.0f}" fill="#b91c1c" font-size="9">(reativa: não vira trabalho)</text>
    <text x="{(x0+xP)/2 - 60:.0f}" y="{(y0+yQ)/2 - 10:.0f}" fill="#d97706" font-weight="bold">S = 118 kVA</text>
    <text x="{(x0+xP)/2 - 60:.0f}" y="{(y0+yQ)/2 + 4:.0f}" fill="#d97706" font-size="9">(aparente: o que os cabos carregam)</text>
    <text x="260" y="192" text-anchor="middle" font-size="9.5" fill="#4b5563">S² = P² + Q² · FP = P/S = cos φ = 0,85</text>
  </g>
</svg>'''

def fig_quadrantes():
    # plano P×Q com o cone de FP >= 0,92 (±23,07°)
    cx, cy, R = 200, 150, 120
    ang = math.degrees(math.acos(0.92))  # 23.07
    def pt(a_deg, r):
        a = math.radians(a_deg); return (cx + r*math.cos(a), cy - r*math.sin(a))
    cone = ""
    for base in (0, 180):
        for s in (+1, -1):
            x, y = pt(base + s*ang, R)
            cone += f'<line x1="{cx}" y1="{cy}" x2="{x:.1f}" y2="{y:.1f}" stroke="#2aa63a" stroke-dasharray="5,3" stroke-width="1.3"/>'
    return f'''
<svg viewBox="0 0 400 320" width="100%" role="img" aria-label="Plano P×Q: quadrantes, registradores da SSU e o cone de fator de potência 0,92">
  <g font-size="10" fill="#16213e">
    <rect x="{cx}" y="{cy-R}" width="{R}" height="{R}" fill="#fde8e8" opacity="0.6"/>
    <rect x="{cx-R}" y="{cy-R}" width="{R}" height="{R}" fill="#e8f1fd" opacity="0.6"/>
    <rect x="{cx-R}" y="{cy}" width="{R}" height="{R}" fill="#e8fdf0" opacity="0.6"/>
    <rect x="{cx}" y="{cy}" width="{R}" height="{R}" fill="#fff6e0" opacity="0.6"/>
    {cone}
    <line x1="{cx-R-15}" y1="{cy}" x2="{cx+R+15}" y2="{cy}" stroke="#16213e" stroke-width="1.5"/>
    <line x1="{cx}" y1="{cy-R-15}" x2="{cx}" y2="{cy+R+15}" stroke="#16213e" stroke-width="1.5"/>
    <text x="{cx+R+14}" y="{cy-6}" text-anchor="end">+P importa (consome)</text>
    <text x="{cx-R-14}" y="{cy-6}">−P exporta (gera)</text>
    <text x="{cx+6}" y="{cy-R-4}">+Q indutivo</text>
    <text x="{cx+6}" y="{cy+R+12}">−Q capacitivo</text>
    <g font-weight="bold" font-size="12">
      <text x="{cx+R*0.62:.0f}" y="{cy-R*0.72:.0f}" text-anchor="middle">Q1</text>
      <text x="{cx-R*0.62:.0f}" y="{cy-R*0.72:.0f}" text-anchor="middle">Q2</text>
      <text x="{cx-R*0.62:.0f}" y="{cy+R*0.62:.0f}" text-anchor="middle">Q3</text>
      <text x="{cx+R*0.62:.0f}" y="{cy+R*0.62:.0f}" text-anchor="middle">Q4</text>
    </g>
    <g font-size="8.8" fill="#374151">
      <text x="{cx+R*0.62:.0f}" y="{cy-R*0.72+13:.0f}" text-anchor="middle">consumindo, atrasado</text>
      <text x="{cx+R*0.62:.0f}" y="{cy-R*0.72+25:.0f}" text-anchor="middle">REG1 phf · REG3 qhfi</text>
      <text x="{cx-R*0.62:.0f}" y="{cy-R*0.72+13:.0f}" text-anchor="middle">gerando, absorve reativo</text>
      <text x="{cx-R*0.62:.0f}" y="{cy-R*0.72+25:.0f}" text-anchor="middle">REG2 phr · REG4 qhri</text>
      <text x="{cx-R*0.62:.0f}" y="{cy+R*0.62+13:.0f}" text-anchor="middle">gerando, fornece reativo</text>
      <text x="{cx-R*0.62:.0f}" y="{cy+R*0.62+25:.0f}" text-anchor="middle">REG2 phr · REG5 qhrc</text>
      <text x="{cx+R*0.62:.0f}" y="{cy+R*0.62+13:.0f}" text-anchor="middle">consumindo, adiantado</text>
      <text x="{cx+R*0.62:.0f}" y="{cy+R*0.62+25:.0f}" text-anchor="middle">REG1 phf · REG6 qhfc</text>
    </g>
    <text x="200" y="303" text-anchor="middle" font-size="9" fill="#2aa63a">cone tracejado: FP ≥ 0,92 (φ = ±23,07°, Q ≤ 0,426·P)</text>
    <text x="200" y="316" text-anchor="middle" font-size="9" fill="#4b5563">fora do cone há excedente de reativo (UFER/DMCR)</text>
  </g>
</svg>'''

def fig_energia_pulsos():
    """P(t) ao longo de um intervalo de 15 min; área = energia; pulsos a cada Ke kWh."""
    W, H, x0, y0 = 560, 110, 40, 30
    n = 120
    pts = []; area = 0; Ke = 0.048; pul = []
    # perfil: rampa + patamar (kW), 15 min
    def P(t):  # t em [0,1]
        return 120 + 180*math.sin(math.pi*t)**1.5
    acc = 0.0; last_pulse = 0.0
    path = ""
    for k in range(n+1):
        t = k/n
        p = P(t)
        x = x0 + W*t; y = y0 + H - p/320*H
        path += f"{'M' if k==0 else 'L'}{x:.1f} {y:.1f} "
        if k:
            dE = (p + P((k-1)/n))/2 * (0.25/n)   # kWh no passo
            acc += dE
            while acc - last_pulse >= Ke:
                last_pulse += Ke; pul.append(x)
    E = 0.0
    for k in range(1, n+1):
        E += (P(k/n) + P((k-1)/n))/2 * (0.25/n)
    ticks = "".join(f'<line x1="{x:.1f}" y1="{y0+H+6}" x2="{x:.1f}" y2="{y0+H+16}" stroke="#16213e" stroke-width="0.8"/>' for x in pul[::6])
    return f'''
<svg viewBox="0 0 640 190" width="100%" role="img" aria-label="Potência ao longo de um intervalo de 15 minutos: a área sob a curva é a energia, e cada Ke kWh gera um pulso">
  <g font-size="10" fill="#16213e">
    <path d="{path} L{x0+W} {y0+H} L{x0} {y0+H} Z" fill="#e6ecff" stroke="none"/>
    <path d="{path}" fill="none" stroke="#16213e" stroke-width="1.8"/>
    <line x1="{x0}" y1="{y0+H}" x2="{x0+W}" y2="{y0+H}" stroke="#16213e"/>
    <line x1="{x0}" y1="{y0}" x2="{x0}" y2="{y0+H}" stroke="#16213e"/>
    <text x="{x0-4}" y="{y0+4}" text-anchor="end" font-size="9">320 kW</text>
    <text x="{x0-4}" y="{y0+H}" text-anchor="end" font-size="9">0</text>
    <text x="{x0+W/2:.0f}" y="{y0+H/2+4:.0f}" text-anchor="middle" font-weight="bold">E = ∫ P dt = {E:.1f} kWh no intervalo</text>
    {ticks}
    <text x="{x0+W/2:.0f}" y="{y0+H+30}" text-anchor="middle" font-size="9">pulsos (1 a cada Ke = 0,048 kWh) → {len(pul)} pulsos ≈ {len(pul)*Ke:.1f} kWh · mostrados 1 a cada 6</text>
    <text x="{x0}" y="{y0+H+46}" font-size="9" fill="#4b5563">segundos restantes: 899 → 0</text>
    <text x="{x0+W}" y="{y0+H+46}" text-anchor="end" font-size="9" fill="#4b5563">demanda do intervalo = E / 0,25 h = {E/0.25:.0f} kW (média)</text>
  </g>
</svg>''', E, len(pul)

CSS = open(__file__.replace("gera_teoria.py", "css_base.css")).read() if False else None

fig_e, E_int, n_pul = fig_energia_pulsos()

html = f'''<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Potência ativa, reativa, fator de potência e os octetos da SSU — teoria</title>
<style>
  @page {{ size: A4; margin: 0; }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: "DejaVu Sans", Arial, sans-serif; font-size: 10.2pt; line-height: 1.45; color: #1f2430; margin: 0; }}
  .page {{ page-break-after: always; }}
  .page:last-child {{ page-break-after: auto; }}
  .content {{ padding: 16mm 20mm 16mm 20mm; }}
  h1 {{ font-size: 22pt; color: #16213e; margin: 0 0 4pt 0; }}
  h2 {{ font-size: 14.5pt; color: #16213e; margin: 14pt 0 6pt 0; padding-bottom: 3pt; border-bottom: 2px solid #16213e; page-break-after: avoid; }}
  h2 .n {{ display: inline-block; min-width: 24pt; color: #3fe04f; font-weight: 700; }}
  h3 {{ font-size: 11.5pt; color: #16213e; margin: 11pt 0 4pt 0; page-break-after: avoid; }}
  p {{ margin: 0 0 6pt 0; text-align: justify; }}
  ul, ol {{ margin: 0 0 6pt 0; padding-left: 18pt; }}
  li {{ margin-bottom: 2pt; }}
  code, .mono {{ font-family: "DejaVu Sans Mono", monospace; font-size: 9pt; background: #f1f3f7; padding: 0 3px; border-radius: 2px; }}
  .eq {{ font-family: "DejaVu Serif", serif; font-size: 11pt; text-align: center; margin: 6pt 0 8pt 0; }}
  table {{ border-collapse: collapse; width: 100%; margin: 4pt 0 8pt 0; font-size: 9.2pt; page-break-inside: avoid; }}
  th, td {{ border: 1px solid #c9ced8; padding: 3pt 5pt; vertical-align: top; text-align: left; }}
  th {{ background: #16213e; color: #fff; font-weight: 600; }}
  tr:nth-child(even) td {{ background: #f7f8fb; }}
  .callout {{ border: 1px solid #16213e; border-left: 5px solid #3fe04f; background: #f5fbf6; padding: 6pt 9pt; margin: 6pt 0 8pt 0; page-break-inside: avoid; }}
  .warn {{ border-left-color: #d97706; background: #fff8ec; }}
  .ex {{ border: 1px solid #c9ced8; background: #fafbfd; padding: 6pt 9pt; margin: 6pt 0 8pt 0; page-break-inside: avoid; }}
  .ex b.t {{ color: #16213e; }}
  .grid2 {{ display: table; width: 100%; table-layout: fixed; }}
  .grid2 > div {{ display: table-cell; vertical-align: top; padding-right: 10pt; }}
  .grid2 > div:last-child {{ padding-right: 0; }}
  figure {{ margin: 6pt 0 8pt 0; page-break-inside: avoid; }}
  figcaption {{ font-size: 8.6pt; color: #4b5563; margin-top: 3pt; }}
  .small {{ font-size: 8.6pt; color: #4b5563; }}
  .cover {{ height: 297mm; padding: 28mm 22mm 20mm 22mm; position: relative; }}
  .cover .logo {{ height: 46pt; }}
  .cover h1 {{ font-size: 28pt; margin-top: 60pt; line-height: 1.15; }}
  .cover .sub {{ font-size: 13.5pt; color: #4b5563; margin-top: 8pt; }}
  .cover .meta {{ position: absolute; bottom: 20mm; left: 22mm; right: 22mm; font-size: 9.5pt; color: #4b5563; border-top: 1px solid #c9ced8; padding-top: 8pt; }}
  svg text {{ font-family: "DejaVu Sans", Arial, sans-serif; }}
  .dense table {{ font-size: 8.4pt; margin-bottom: 5pt; }}
  .dense th, .dense td {{ padding: 2pt 4pt; }}
  .dense h3 {{ margin: 7pt 0 3pt 0; font-size: 10.5pt; }}
  .dense p {{ font-size: 9.2pt; }}
</style></head>
<body>

<div class="page cover">
  <img class="logo" src="file:///var/www/Logo Aupus - Whatsapp.png" alt="Aupus Energia">
  <h1>Potência ativa, reativa e fator de potência —<br>a teoria por trás dos octetos da SSU</h1>
  <div class="sub">Da tensão e da corrente aos seis registradores do medidor (ABNT NBR 14522) — o que a TON-V2 está lendo, fisicamente</div>
  <p style="margin-top:28pt;max-width:150mm;text-align:left">Este material explica <b>o que</b> as grandezas da saída serial do medidor significam eletricamente, antes de explicar <b>como</b> elas são codificadas. Começa na forma de onda, passa por P, Q, S e fator de potência, explica por que "indutivo" e "capacitivo" são cobrados de formas diferentes pela concessionária, chega aos quatro quadrantes e aos seis registradores — e só então mostra onde cada conceito mora em cada octeto. Todos os exemplos são numéricos e conferidos.</p>
  <div class="meta">Aupus Energia · Engenharia IoT · 18/09/2026 · v1.0 · complemento do "Material de estudo — Leitura da SSU na TON-V2"</div>
</div>

<!-- ===================== 0. NOTAÇÃO ===================== -->
<div class="page content dense">
  <h2><span class="n">0</span>Notação — o que é exatamente cada símbolo e unidade</h2>
  <p>Leia esta página com o texto ao lado. Convenções fixas neste material: <b>φ positivo = corrente atrasada (indutivo)</b>; grandezas vistas do <b>ponto de entrega</b> (convenção de carga: P &gt; 0 importa da rede); valores <b>eficazes</b> (RMS) quando não houver o índice "m".</p>
  <div class="grid2">
    <div>
      <h3>Onda e tempo</h3>
      <table>
        <tr><th>Símbolo</th><th>O que é</th><th>Unidade</th></tr>
        <tr><td>t</td><td>tempo</td><td>s</td></tr>
        <tr><td>f</td><td>frequência da rede (60 ciclos por segundo no Brasil)</td><td>Hz</td></tr>
        <tr><td>ω</td><td>frequência angular = 2π·f; a 60 Hz, ω = 377 rad/s. "ωt" é a fase instantânea da onda</td><td>rad/s</td></tr>
        <tr><td>φ</td><td>ângulo de fase entre corrente e tensão; φ &gt; 0 = corrente atrasada (indutivo), φ &lt; 0 = adiantada (capacitivo)</td><td>° ou rad</td></tr>
        <tr><td>v(t), i(t)</td><td>tensão e corrente <i>instantâneas</i> (o valor naquele instante t)</td><td>V, A</td></tr>
        <tr><td>p(t)</td><td>potência instantânea = v(t)·i(t)</td><td>W</td></tr>
      </table>
      <h3>Amplitudes</h3>
      <table>
        <tr><th>Símbolo</th><th>O que é</th><th>Unidade</th></tr>
        <tr><td>V<sub>m</sub>, I<sub>m</sub></td><td>valores de <b>pico</b> (máximo) da senoide de tensão e de corrente</td><td>V, A</td></tr>
        <tr><td>V, I</td><td>valores <b>eficazes</b> (RMS) = pico ÷ √2; é o que o voltímetro/amperímetro mostram (220 V, 380 V…)</td><td>V, A</td></tr>
        <tr><td>cos φ, sin φ, tan φ</td><td>cosseno, seno e tangente do ângulo de fase; tan φ = Q/P</td><td>—</td></tr>
      </table>
      <h3>Potências</h3>
      <table>
        <tr><th>Símbolo</th><th>O que é</th><th>Unidade</th></tr>
        <tr><td>P</td><td>potência <b>ativa</b>: média de p(t); a que vira trabalho, luz, calor. P = V·I·cos φ</td><td>W, kW</td></tr>
        <tr><td>Q</td><td>potência <b>reativa</b>: amplitude da parcela de p(t) que oscila com média zero. Q = V·I·sin φ; sinal + indutivo, − capacitivo</td><td>var, kvar</td></tr>
        <tr><td>S</td><td>potência <b>aparente</b> = V·I; o que cabos, transformadores e proteções precisam suportar. S² = P² + Q²</td><td>VA, kVA</td></tr>
        <tr><td>FP</td><td>fator de potência = P/S = cos φ (senoidal); 0…1, sem unidade. "0,92 indutivo" indica também o sinal de Q</td><td>—</td></tr>
        <tr><td>f<sub>R</sub></td><td>FP de <b>referência</b> da regulação = 0,92 (φ = 23,07°; Q = 0,426·P)</td><td>—</td></tr>
      </table>
      <h3>Elementos de circuito</h3>
      <table>
        <tr><th>Símbolo</th><th>O que é</th><th>Unidade</th></tr>
        <tr><td>R</td><td>resistência (só consome P)</td><td>Ω</td></tr>
        <tr><td>L</td><td>indutância (bobina): v = L·di/dt — a corrente "demora" a subir → atrasa</td><td>H</td></tr>
        <tr><td>C</td><td>capacitância: i = C·dv/dt — a corrente "chega antes" → adianta</td><td>F</td></tr>
        <tr><td>di/dt, dv/dt</td><td>taxa de variação no tempo (derivada) da corrente / da tensão</td><td>A/s, V/s</td></tr>
      </table>
      <h3>Quadrantes e registradores</h3>
      <table>
        <tr><th>Símbolo</th><th>O que é</th></tr>
        <tr><td>Q1…Q4</td><td>quadrantes do plano P×Q: Q1 importa+indutivo, Q2 exporta+indutivo, Q3 exporta+capacitivo, Q4 importa+capacitivo</td></tr>
        <tr><td>REG1…REG6</td><td>os seis registradores de energia do medidor (2 de ativa, 4 de reativa)</td></tr>
        <tr><td>phf / phr</td><td>ativa <b>f</b>orward (direta, importada) / <b>r</b>everse (reversa, exportada) — "p" = ativa, "h" = energia (hora)</td></tr>
        <tr><td>qhfi qhri qhrc qhfc</td><td>reativa "q": f/r = direta/reversa (sentido da ativa), i/c = indutiva/capacitiva → Q1, Q2, Q3, Q4</td></tr>
      </table>
    </div>
    <div>
      <h3>Energia, pulsos e demanda</h3>
      <table>
        <tr><th>Símbolo</th><th>O que é</th><th>Unidade</th></tr>
        <tr><td>E</td><td>energia = ∫ P dt (área sob a curva de potência no tempo)</td><td>kWh</td></tr>
        <tr><td>kvarh</td><td>energia reativa (mesma integral, com Q)</td><td>kvarh</td></tr>
        <tr><td>Ke (Kd)</td><td><b>constante do medidor</b>: energia por pulso (ex.: 0,048 kWh/pulso). "kd" é o mesmo no catálogo/backend</td><td>kWh/pulso</td></tr>
        <tr><td>pulso</td><td>incremento inteiro do contador a cada Ke de energia; os octetos 4–7 contam pulsos, sem unidade</td><td>—</td></tr>
        <tr><td>Δ (delta)</td><td>diferença entre duas leituras consecutivas do <b>mesmo</b> registrador</td><td>pulsos</td></tr>
        <tr><td>D</td><td>demanda = potência <b>média</b> num intervalo de 15 min = E<sub>intervalo</sub> ÷ 0,25 h</td><td>kW</td></tr>
        <tr><td>bucket</td><td>soma dos deltas de um intervalo, publicada no fechamento</td><td>pulsos</td></tr>
      </table>
      <h3>Tarifa (REN ANEEL 1000)</h3>
      <table>
        <tr><th>Símbolo</th><th>O que é</th><th>Unidade</th></tr>
        <tr><td>T</td><td>índice do intervalo de medição (1 h para energia reativa; 15 min para demanda)</td><td>—</td></tr>
        <tr><td>E<sub>A,T</sub></td><td>energia ativa medida no intervalo T</td><td>kWh</td></tr>
        <tr><td>D<sub>A,T</sub></td><td>demanda ativa medida no intervalo T</td><td>kW</td></tr>
        <tr><td>f<sub>T</sub></td><td>fator de potência apurado no intervalo T</td><td>—</td></tr>
        <tr><td>D<sub>F</sub></td><td>demanda faturável (contratada ou medida, conforme o contrato)</td><td>kW</td></tr>
        <tr><td>E<sub>RE</sub></td><td>energia reativa <b>excedente</b> — cobrada como UFER (Unidade de Faturamento de Energia Reativa)</td><td>kWh</td></tr>
        <tr><td>D<sub>RE</sub></td><td>demanda reativa excedente — cobrada como DMCR (Demanda Máxima Corrigida)</td><td>kW</td></tr>
        <tr><td>posto</td><td>período tarifário: ponta (3 h consecutivas, mais cara) / fora de ponta / quarto posto</td><td>—</td></tr>
      </table>
      <h3>Octetos e matemática</h3>
      <table>
        <tr><th>Símbolo</th><th>O que é</th></tr>
        <tr><td>octeto, bit, nibble</td><td>8 bits; 1 dígito binário; 4 bits (meio octeto). Bits numerados de 0 (menos significativo) a 7</td></tr>
        <tr><td>LSB / MSB, little-endian</td><td>byte menos / mais significativo; little-endian = o byte baixo vem primeiro (valor = lo + hi·256)</td></tr>
        <tr><td>LRC, CRC-16</td><td>verificadores de integridade: complemento do XOR (bloco normal) / polinômio 0xA001 (estendido)</td></tr>
        <tr><td>NSU, cdo, sts</td><td>no JSON do A-966: número sequencial, intervalo em minutos, status do enlace</td></tr>
        <tr><td>∫, Σ, máx, √, arccos</td><td>integral (acumular no tempo), somatório, maior valor, raiz quadrada, ângulo cujo cosseno é o valor</td></tr>
        <tr><td>k, M</td><td>prefixos ×1 000 e ×1 000 000 (kW, MW, kWh, kvar, kVA)</td></tr>
      </table>
    </div>
  </div>
</div>

<!-- ===================== 1. ONDAS E POTÊNCIA INSTANTÂNEA ===================== -->
<div class="page content">
  <h2><span class="n">1</span>Tensão, corrente e potência instantânea</h2>
  <p>Em corrente alternada senoidal, tensão e corrente são ondas de mesma frequência (60 Hz) que podem estar <b>defasadas</b> entre si. Chamando de <b>φ</b> o ângulo com que a corrente se <i>atrasa</i> em relação à tensão:</p>
  <div class="eq">v(t) = V<sub>m</sub>·cos(ωt) &nbsp;&nbsp;&nbsp; i(t) = I<sub>m</sub>·cos(ωt − φ)</div>
  <p>A potência instantânea é simplesmente o produto <b>p(t) = v(t)·i(t)</b>. Multiplicando as duas senoides e usando a identidade do produto de cossenos, ela se separa em duas parcelas com naturezas completamente diferentes:</p>
  <div class="eq">p(t) = <b>P</b>·[1 + cos(2ωt)] &nbsp;+&nbsp; <b>Q</b>·sin(2ωt) &nbsp;&nbsp;&nbsp; com &nbsp; P = V·I·cos φ, &nbsp; Q = V·I·sin φ &nbsp;(V, I eficazes)</div>
  <ul>
    <li>A primeira parcela nunca fica negativa: é energia que <b>sempre flui da fonte para a carga</b> e vira trabalho, luz ou calor. Sua média é <b>P</b>, a <b>potência ativa</b> (W, kW).</li>
    <li>A segunda parcela tem média <b>zero</b>: metade do ciclo a energia vai para a carga, na outra metade <b>volta</b> para a fonte. Ela não realiza trabalho — fica "balançando" entre a fonte e o campo magnético (ou elétrico) da carga. Sua amplitude é <b>Q</b>, a <b>potência reativa</b> (var, kvar).</li>
  </ul>
  <div class="grid2">
    <div>{fig_ondas(0, "Carga resistiva — φ = 0°", "#b91c1c")}</div>
    <div>{fig_ondas(60, "Carga indutiva — φ = +60°", "#b91c1c")}</div>
  </div>
  <figure><figcaption>À esquerda, corrente em fase: p(t) nunca é negativo, tudo é potência ativa. À direita, corrente atrasada 60°: parte de cada ciclo tem p(t) &lt; 0 — energia devolvida à rede — e a média (linha verde) cai para cos 60° = 0,5 do valor máximo possível.</figcaption></figure>
  <div class="callout"><b>Por que isso importa para a concessionária:</b> a corrente que circula para "levar e trazer" o reativo é <b>real</b>: aquece condutores, ocupa transformadores e linhas, e derruba a tensão — mas não gera receita de energia ativa. Por isso o reativo em excesso é <b>cobrado</b> (§5) e por isso o medidor o registra separado, por sentido e por natureza (§4).</div>
</div>

<!-- ===================== 2. INDUTIVO × CAPACITIVO ===================== -->
<div class="page content">
  <h2><span class="n">2</span>Indutivo × capacitivo: o sinal de Q</h2>
  <p>O que decide se a corrente se atrasa ou se adianta é a <b>natureza da carga</b>:</p>
  <ul>
    <li><b>Indutor</b> (bobina): a tensão tem que "empurrar" primeiro para a corrente crescer — v = L·di/dt — logo a corrente <b>atrasa</b> (φ &gt; 0). A energia oscila no <b>campo magnético</b>. Motores, transformadores, reatores de lâmpadas, fornos a indução. Convenção: <b>Q &gt; 0</b>, "carga que consome reativo".</li>
    <li><b>Capacitor</b>: a corrente é quem "chega primeiro" — i = C·dv/dt — a corrente <b>adianta</b> (φ &lt; 0). A energia oscila no <b>campo elétrico</b>. Bancos de capacitores, cabos longos, filtros de eletrônica, inversores operando com FP adiantado. Convenção: <b>Q &lt; 0</b>, "carga que fornece reativo".</li>
  </ul>
  <figure>{fig_fasores()}<figcaption>Diagrama fasorial: cada onda vira uma seta girando a 60 Hz; o ângulo entre elas é φ. "Atrasada" = a seta da corrente vem <i>depois</i> da tensão no sentido de rotação (anti-horário).</figcaption></figure>
  <p>Indutivo e capacitivo <b>se cancelam</b>: um capacitor em paralelo com um motor devolve localmente o reativo que o motor pede, e a rede deixa de transportá-lo. É a <b>correção de fator de potência</b>. O medidor, porém, não sabe o que há atrás do ponto de entrega — ele só vê o <b>resultado líquido</b> (o sinal de Q naquele instante) e o registra como indutivo <i>ou</i> capacitivo.</p>

  <h2><span class="n">3</span>P, Q, S e o fator de potência</h2>
  <div class="grid2">
    <div>
      <figure>{fig_triangulo()}<figcaption>Triângulo de potências de um motor de 100 kW com FP 0,85 indutivo.</figcaption></figure>
    </div>
    <div>
      <p><b>Potência aparente S = V·I</b> (VA, kVA) é o que os condutores, o transformador e a proteção precisam suportar — a corrente não sabe se está "carregando" P ou Q. As três se relacionam pelo teorema de Pitágoras:</p>
      <div class="eq">S² = P² + Q² &nbsp;&nbsp;&nbsp; FP = P / S = cos φ &nbsp;&nbsp;&nbsp; Q = P·tan φ</div>
      <p>O <b>fator de potência</b> diz que fração da corrente está realmente produzindo trabalho. FP = 1 é o ideal; FP = 0,85 significa que 15 % da "capacidade" da instalação circula reativo. Diz-se "0,85 <b>indutivo</b>" ou "0,85 <b>capacitivo</b>" para indicar o sinal de Q — o número sozinho não diz.</p>
      <p>A referência regulatória brasileira é <b>FP = 0,92</b>, que corresponde a <b>φ = 23,07°</b> e a <b>Q = 0,426·P</b>: até 42,6 % de reativo em relação à ativa é tolerado sem cobrança.</p>
    </div>
  </div>
  <div class="ex"><b class="t">Exemplo 1 — corrigir o FP de um motor.</b> P = 100 kW, FP = 0,85 → S = 100/0,85 = 117,6 kVA; φ = arccos 0,85 = 31,8°; Q = 117,6·sen 31,8° = 62,0 kvar. Para chegar a 0,92: Q<sub>alvo</sub> = 100·tan 23,07° = 42,6 kvar. Banco de capacitores necessário: Q<sub>C</sub> = 62,0 − 42,6 = <b>19,4 kvar</b>. Corrente cai de 117,6 kVA para 108,7 kVA (−7,6 %) sem mudar o trabalho realizado.</div>
</div>

<!-- ===================== 4. QUADRANTES E REGISTRADORES ===================== -->
<div class="page content">
  <h2><span class="n">4</span>Os quatro quadrantes e os seis registradores</h2>
  <p>Numa unidade <b>com geração</b> (usina, autoprodutor, GD) a potência ativa também muda de <b>sentido</b>: de dia a instalação <b>exporta</b> (P &lt; 0 visto do medidor), à noite <b>importa</b> (P &gt; 0). Combinando o sinal de P (sentido) com o sinal de Q (natureza) surgem quatro regiões — os <b>quadrantes</b> da medição (IEC 62053-23):</p>
  <div class="grid2">
    <div><figure>{fig_quadrantes()}<figcaption>Plano P×Q na convenção do medidor (carga): consumo à direita, geração à esquerda; indutivo acima, capacitivo abaixo. Em cada quadrante, os dois registradores da NBR 14522 que estão acumulando.</figcaption></figure></div>
    <div>
      <p>Por que <b>seis</b> registradores e não dois? Porque a tarifa trata cada combinação de forma diferente:</p>
      <ul>
        <li><b>Ativa importada (REG1, kWh-d)</b> é energia comprada; <b>ativa exportada (REG2, kWh-r)</b> é energia injetada (compensada no SCEE ou vendida). Não podem se misturar.</li>
        <li>O reativo é separado por <b>quadrante</b> porque a cobrança (§5) usa o reativo <b>indutivo</b> num período do dia e o <b>capacitivo</b> em outro — e porque a natureza do reativo de quem gera é avaliada em separado da de quem consome.</li>
      </ul>
      <table>
        <tr><th>Quadrante</th><th>P</th><th>Q</th><th>Registradores</th></tr>
        <tr><td>Q1</td><td>importa</td><td>indutivo</td><td>REG1 + REG3</td></tr>
        <tr><td>Q2</td><td>exporta</td><td>indutivo</td><td>REG2 + REG4</td></tr>
        <tr><td>Q3</td><td>exporta</td><td>capacitivo</td><td>REG2 + REG5</td></tr>
        <tr><td>Q4</td><td>importa</td><td>capacitivo</td><td>REG1 + REG6</td></tr>
      </table>
      <p class="small">Repare que a ativa só tem dois registradores: Q1 e Q4 alimentam o mesmo REG1, Q2 e Q3 o mesmo REG2. Uma usina que passa de Q1 para Q4 (muda só a natureza do reativo) <b>não interrompe</b> a contagem de ativa — só a reativa troca de "raia". Isso acontece todo amanhecer e entardecer.</p>
    </div>
  </div>
  <div class="ex"><b class="t">Exemplo 2 — usina exportando.</b> Inversores injetando P = 1 200 kW com FP 0,98 e reativo capacitivo visto do medidor: φ = arccos 0,98 = 11,5°; |Q| = 1 200·tan 11,5° = <b>244 kvar</b>. Ponto no plano: P = −1 200, Q = −244 → <b>Q3</b> → o bloco da SSU transmite REG2 (phr) e REG5 (qhrc). Se o controle de reativo do inversor passar a absorver reativo (indutivo), o ponto sobe para Q2 e os contadores passam a mostrar REG2 + REG4 — <b>a ativa continua em REG2</b>.</div>

  <h2><span class="n">5</span>Por que o reativo é cobrado — UFER e DMCR</h2>
  <p>A regulação brasileira (REN ANEEL 1000/2021, que consolidou a REN 414/2010; detalhes técnicos no PRODIST Módulo 8) fixa o <b>fator de potência de referência f<sub>R</sub> = 0,92</b> e cobra o <b>excedente</b> de reativo de duas maneiras, ambas calculadas pelo próprio medidor a partir dos registradores acima:</p>
  <div class="eq">E<sub>RE</sub> = Σ<sub>T</sub> E<sub>A,T</sub>·( f<sub>R</sub> / f<sub>T</sub> − 1 ) &nbsp;&nbsp;&nbsp;&nbsp; D<sub>RE</sub> = máx<sub>T</sub>[ D<sub>A,T</sub>·( f<sub>R</sub> / f<sub>T</sub> ) ] − D<sub>F</sub></div>
  <ul>
    <li><b>E<sub>RE</sub> — energia reativa excedente (UFER):</b> somada em intervalos <b>T de 1 hora</b>; entra só a hora em que f<sub>T</sub> &lt; 0,92. É cobrada ao preço da energia ativa do posto.</li>
    <li><b>D<sub>RE</sub> — demanda reativa excedente (DMCR):</b> avaliada em intervalos de <b>15 minutos</b>; o que passa da demanda faturável D<sub>F</sub> é cobrado ao preço da demanda.</li>
    <li><b>Períodos:</b> das <b>6h às 24h</b> só o reativo <b>indutivo</b> conta (é quando a rede está carregada e o indutivo derruba a tensão); das <b>0h às 6h</b> só o <b>capacitivo</b> (madrugada, carga leve — o capacitivo eleva a tensão). É exatamente isto que os campos "posto reativo" e "tarifação de reativo" da SSU refletem.</li>
  </ul>
  <div class="ex"><b class="t">Exemplo 3 — UFER de uma hora.</b> Numa hora T a instalação consumiu E<sub>A</sub> = 500 kWh com f<sub>T</sub> = 0,85 indutivo (período diurno). E<sub>RE</sub> = 500·(0,92/0,85 − 1) = 500·0,0824 = <b>41,2 kWh</b> de excedente — cobrados como se fossem energia ativa. Com f<sub>T</sub> ≥ 0,92 a parcela é zero.</div>
</div>

<!-- ===================== 6. ENERGIA, PULSOS, DEMANDA ===================== -->
<div class="page content">
  <h2><span class="n">6</span>De potência a energia, de energia a pulsos, de pulsos a demanda</h2>
  <p>O medidor não transmite potência. Ele integra: <b>E = ∫ P dt</b>. A cada <b>Ke</b> kWh acumulados (a <i>constante do medidor</i>, p. ex. 0,048 kWh/pulso) ele conta <b>um pulso</b>. O mesmo vale para a reativa (kvarh). Os contadores dos octetos 4–7 são esses pulsos — <b>inteiros, sem unidade</b> — acumulados desde o início do intervalo de demanda.</p>
  <figure>{fig_e}<figcaption>Um intervalo de demanda de 15 min. A área sob P(t) é a energia; a cada Ke kWh o contador avança um pulso. A demanda do intervalo é a potência <i>média</i>: E/0,25 h.</figcaption></figure>
  <h3>Demanda</h3>
  <p><b>Demanda</b> é a potência média num intervalo de <b>15 minutos</b> — não a potência instantânea. O consumidor do Grupo A contrata uma demanda (kW) e paga por ela; se ultrapassa, paga ultrapassagem. Por isso o medidor conta os segundos restantes do intervalo (octetos 1–2, regressivo de 899 a 0) e reinicia os contadores a cada 15 min: <b>demanda = pulsos do intervalo × Ke ÷ 0,25 h</b>. A demanda máxima do mês fica guardada no medidor até a <b>reposição</b> (leitura de faturamento) — daí o bit 4 do octeto 2 alternar mensalmente.</p>
  <div class="ex"><b class="t">Exemplo 4 — do bucket real do A-966 ao kW.</b> Bucket de 15 min: phr = 1 532, phf = 0, qhfc = 4, qhfi = 0, Ke = 0,048. Energia exportada: 1 532 × 0,048 = <b>73,5 kWh</b> → potência média <b>294,1 kW</b> (é o P_rev que o NexON mostra). Reativa capacitiva: 4 × 0,048 = 0,19 kvarh → 0,77 kvar. FP = 294,1/√(294,1² + 0,77²) ≈ <b>1,00</b> — dentro do cone de 0,92 com folga; nenhum excedente.</div>
  <div class="ex"><b class="t">Exemplo 5 — o que 2 pulsos/s significam.</b> Se o contador de ativa avança 2 pulsos por segundo com Ke = 0,048: 0,096 kWh/s = 345,6 kWh/h → <b>P = 345,6 kW</b>. Em 15 min: 1 800 pulsos → 86,4 kWh → demanda 345,6 kW. O contador de 16 bits (65 535) só daria a volta acima de ≈ 12,6 MW com esse Ke — mas com Ke menor (medidor de alta precisão) ou intervalo de 30/60 min o <i>wrap</i> é real, e por isso o firmware o trata.</div>
  <h3>Intervalo reativo</h3>
  <p>A UFER usa <b>1 hora</b>; por isso o medidor mantém um segundo relógio de intervalo e sinaliza o fim de cada hora alternando o <b>bit 5</b> do octeto 2. Com demanda de 15 min, espera-se 1 transição a cada 4 fechamentos — a "verificação de sanidade" do firmware.</p>
</div>

<!-- ===================== 7. MAPA CONCEITO -> OCTETO ===================== -->
<div class="page content">
  <h2><span class="n">7</span>Onde cada conceito mora em cada octeto (bloco estendido)</h2>
  <table>
    <tr><th>Grandeza física / tarifária</th><th>Octeto · bits</th><th>Codificação</th><th>Como o firmware da TON usa</th></tr>
    <tr><td><b>Tempo até o fim do intervalo de demanda</b> (§6)</td><td>1 [7:0] + 2 [3:0]</td><td>12 bits, 0…4095 s, regressivo (899→0 em 15 min)</td><td>Salto para cima = intervalo novo → fecha o bucket, zera a base dos 6 registradores</td></tr>
    <tr><td><b>Reposição de demanda</b> (leitura/fatura mensal)</td><td>2 · bit 4</td><td>Alterna a cada reposição</td><td>Evento por <i>mudança</i>; marca o ciclo de faturamento</td></tr>
    <tr><td><b>Fim do intervalo reativo</b> (hora da UFER, §5)</td><td>2 · bit 5</td><td>Alterna a cada hora</td><td>Sanidade: 1 transição a cada 4 fechamentos de 15 min</td></tr>
    <tr><td><b>Natureza do reativo em cômputo</b> (indutivo/capacitivo, §2)</td><td>2 · bits 6–7</td><td>0 nenhum · 1 capacitivo · 2 indutivo · 3 ambos</td><td>Diz <i>o que</i> está sendo computado para UFER/DMCR; vai como metadado</td></tr>
    <tr><td><b>Posto tarifário</b> (ponta / fora de ponta)</td><td>3 · bits 0–1</td><td>1 ponta · 2 fora · 3 quarto posto</td><td>Metadado (<span class="mono">posto</span>); permite separar energia por posto no NexON</td></tr>
    <tr><td><b>Quadrante</b> = sinal de P × sinal de Q (§4)</td><td>3 · bits 4–5</td><td>00→Q1 · 01→Q4 · 10→Q2 · 11→Q3 (tabela!)</td><td>Escolhe <b>qual registrador</b> cada contador representa: REG1/REG2 e REG3…REG6</td></tr>
    <tr><td><b>Reativo sendo tarifado agora</b> (f<sub>T</sub> &lt; 0,92 no período certo, §5)</td><td>3 · bit 7</td><td>1 = tarifando</td><td>Metadado; distingue "está computando" de "está cobrando"</td></tr>
    <tr><td><b>Energia ativa do intervalo</b> (E = ∫P dt, em pulsos de Ke)</td><td>4–5</td><td>16 bits little-endian</td><td>Delta vs. último valor <b>do mesmo registrador</b>; soma em phf ou phr</td></tr>
    <tr><td><b>Energia reativa do intervalo</b> (kvarh em pulsos)</td><td>6–7</td><td>16 bits little-endian</td><td>Delta idem; soma em qhfi/qhri/qhrc/qhfc conforme o quadrante</td></tr>
    <tr><td><b>Integridade</b></td><td>8–9</td><td>CRC-16 0xA001, init 0, LSB primeiro</td><td>Bloco inválido não entra em cálculo algum</td></tr>
  </table>
  <p>No <b>bloco normal</b> (8 octetos) o octeto 3 troca de significado — bits 0–3 viram <i>segmento horário</i> e bits 4–5 o <i>tipo de tarifa</i> (azul, verde, irrigantes) — e <b>não há quadrante</b>: os contadores (15 bits) são "ativa" e "reativa" sem sentido de fluxo. Por isso uma instalação com geração <b>precisa</b> da saída estendida: no bloco normal a energia injetada seria somada ao consumo com checksum válido, sem nenhum erro detectável.</p>

  <h2><span class="n">8</span>Lendo um bloco com os olhos de engenheiro</h2>
  <p>Vetor da spec: <span class="mono">82 43 32 29 00 0C 00 98 63</span>.</p>
  <table>
    <tr><th>Campo</th><th>Valor</th><th>Interpretação física</th></tr>
    <tr><td>segundos</td><td>0x82 + 3·256 = 898</td><td>Intervalo de 15 min acabou de começar (faltam 898 s)</td></tr>
    <tr><td>octeto 2 = 0x43</td><td>bit4 = 0, bit5 = 0, bits 6–7 = 01</td><td>Está computando reativo <b>capacitivo</b> para UFER/DMCR</td></tr>
    <tr><td>octeto 3 = 0x32</td><td>posto 2; quadrante bits 11 → <b>Q3</b>; bit7 = 0</td><td>Fora de ponta; <b>exportando ativa com reativo capacitivo</b> (usina de dia, inversor adiantado); reativo <i>não</i> está sendo tarifado neste instante</td></tr>
    <tr><td>ativa = 41, reativa = 12</td><td>REG2 (phr) e REG5 (qhrc)</td><td>Em 2 s de intervalo, 41 pulsos: 41·0,048 = 1,97 kWh → ≈ 3,5 MW médios; 12 pulsos de reativo → 0,58 kvarh → FP ≈ 0,96 capacitivo</td></tr>
  </table>
  <div class="callout warn"><b>O erro que a teoria explica:</b> se o firmware lesse "quadrante = bits + 1" ele diria Q4 (importando, capacitivo) em vez de Q3 (exportando, capacitivo). A ativa iria para REG1 (consumo) em vez de REG2 (geração): a usina apareceria <i>consumindo</i> 3,5 MW. Número plausível, checksum válido, conta errada.</div>
</div>

<!-- ===================== 9. REFERÊNCIAS ===================== -->
<div class="page content">
  <h2><span class="n">9</span>Resumo em dez linhas</h2>
  <ol>
    <li>p(t) = v·i se divide em P (média, vira trabalho) e Q (oscila, média zero).</li>
    <li>Indutivo: corrente atrasa, Q &gt; 0. Capacitivo: corrente adianta, Q &lt; 0. Eles se cancelam.</li>
    <li>S² = P² + Q²; FP = P/S = cos φ; a rede transporta S, o cliente paga P — o excesso de Q é cobrado.</li>
    <li>Referência regulatória FP = 0,92 (φ = 23,07°, Q ≤ 0,426·P); indutivo conta das 6h às 24h, capacitivo das 0h às 6h.</li>
    <li>Com geração, P muda de sinal → quatro quadrantes → seis registradores (2 de ativa por sentido, 4 de reativa).</li>
    <li>O medidor integra E = ∫P dt e conta pulsos de Ke kWh; demanda = energia do intervalo de 15 min ÷ 0,25 h.</li>
    <li>Cada bloco da SSU traz os segundos restantes, o quadrante e <b>dois</b> contadores — os do quadrante atual.</li>
    <li>Energia = diferença entre leituras <b>do mesmo registrador</b>; troca de quadrante não é energia, wrap é.</li>
    <li>Bits 4 e 5 alternam (fatura mensal, hora reativa); posto reativo e "tarifando" separam o cômputo da cobrança.</li>
    <li>kWh = pulsos × Ke; kW = kWh ÷ 0,25 h; kvar idem; FP = P/√(P²+Q²) — é tudo o que o NexON calcula.</li>
  </ol>

  <h2><span class="n">10</span>Referências para aprofundar</h2>
  <table>
    <tr><th>Tema</th><th>Fonte</th></tr>
    <tr><td>Potência em CA, fasores, triângulo de potências, correção de FP</td><td>Alexander &amp; Sadiku, <i>Fundamentos de Circuitos Elétricos</i>, cap. "Análise de potência em CA"; Nilsson &amp; Riedel, <i>Circuitos Elétricos</i>, cap. "Potência em regime senoidal".</td></tr>
    <tr><td>Medição em quatro quadrantes e registradores</td><td>IEC 62053-23 (medidores estáticos de energia reativa); ABNT NBR 14522:2008 §3.4.2.6.</td></tr>
    <tr><td>Fator de potência de referência, UFER/DMCR, períodos indutivo/capacitivo, demanda</td><td>REN ANEEL 1000/2021 (Regras de Prestação do Serviço Público de Distribuição — seção de faturamento de reativo e demanda; consolidou a REN 414/2010); PRODIST Módulo 8 (qualidade — fator de potência).</td></tr>
    <tr><td>Codificação dos octetos, tempos, checksums</td><td>ABNT NBR 14522:2008 §3.4 (Saída Serial de Usuário); spec interna "Firmware de leitura da SSU"; material "Leitura da SSU na TON-V2 — material de estudo" (companheiro deste).</td></tr>
    <tr><td>Medidor</td><td>Manual técnico Landis+Gyr E750 (A2E3): constante Ke, modos da saída de usuário, mostrador de quadrante.</td></tr>
  </table>
  <p class="small">Convenções usadas: φ positivo = corrente atrasada (indutivo); convenção de carga vista do ponto de entrega (P &gt; 0 importa). Fórmulas de UFER/DMCR apresentadas na forma da regulação vigente; conferir na REN 1000 o artigo aplicável ao contrato da unidade.</p>
</div>

</body></html>
'''
open("/tmp/claude-0/-var-www/5a71f3ee-05d4-4e28-8159-cf9d625591b9/scratchpad/material-ssu/teoria.html", "w").write(html)
print("html ok; energia do exemplo =", round(E_int, 2), "kWh;", n_pul, "pulsos")
