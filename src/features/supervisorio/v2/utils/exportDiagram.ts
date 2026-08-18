/**
 * EXPORT DO DIAGRAMA UNIFILAR (PNG / SVG / JPEG)
 *
 * Serializa o <svg> do viewport enquadrado no conteúdo (bbox de equipamentos +
 * conexões) e baixa como arquivo. Funciona porque os ícones agora são SVG nativo
 * (não mais <foreignObject>/<img>, que não rasterizam). Por segurança, o clone
 * remove grid, portas, seleção, foreignObject (data boxes HTML) e filtros — o que
 * garante rasterização limpa e um export "de apresentação".
 */

export type ExportFormat = 'png' | 'svg' | 'jpeg';

const SVG_NS = 'http://www.w3.org/2000/svg';

function baixarBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitize(nome: string): string {
  return (nome || 'unifilar')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase() || 'unifilar';
}

/**
 * Constrói um SVG "de apresentação" enquadrado no conteúdo, a partir do SVG vivo.
 * Retorna { svgString, width, height, background }.
 */
function construirSvgLimpo(): { svgString: string; width: number; height: number; background: string } {
  const live = document.querySelector<SVGSVGElement>('.diagram-viewport-container svg');
  if (!live) throw new Error('SVG do diagrama não encontrado na página');

  const content = live.querySelector<SVGGElement>('.diagram-content');
  if (!content) throw new Error('Conteúdo do diagrama não encontrado');

  const bb = content.getBBox();
  if (!bb.width || !bb.height) throw new Error('Diagrama vazio — nada para exportar');

  const pad = 48;
  const vbX = bb.x - pad;
  const vbY = bb.y - pad;
  const vbW = bb.width + pad * 2;
  const vbH = bb.height + pad * 2;

  // Cor de fundo do tema (viewport-wrapper)
  const wrapper = live.closest('.viewport-wrapper') as HTMLElement | null;
  const background =
    (wrapper && getComputedStyle(wrapper).backgroundColor) || '#ffffff';

  const clone = live.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute('style'); // remove transform (zoom/pan) e position:absolute
  clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('width', String(vbW));
  clone.setAttribute('height', String(vbH));
  clone.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
  clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // Remove o que não deve ir no export / não rasteriza
  clone
    .querySelectorAll('.grid, .grid-rect, foreignObject, .equipment-port, .ports, .selection-box')
    .forEach(n => n.remove());
  // Filtros (sombra) fora do export → rasterização garantida
  clone.querySelectorAll('[filter]').forEach(n => n.removeAttribute('filter'));

  // Fundo sólido do tema como primeiro elemento
  const bgRect = document.createElementNS(SVG_NS, 'rect');
  bgRect.setAttribute('x', String(vbX));
  bgRect.setAttribute('y', String(vbY));
  bgRect.setAttribute('width', String(vbW));
  bgRect.setAttribute('height', String(vbH));
  bgRect.setAttribute('fill', background);
  clone.insertBefore(bgRect, clone.firstChild);

  const svgString = new XMLSerializer().serializeToString(clone);
  return { svgString, width: vbW, height: vbH, background };
}

/**
 * Exporta o diagrama no formato pedido e dispara o download.
 */
export async function exportDiagram(format: ExportFormat, nome = 'unifilar'): Promise<void> {
  const { svgString, width, height, background } = construirSvgLimpo();
  const file = sanitize(nome);

  if (format === 'svg') {
    const blob = new Blob(
      ['<?xml version="1.0" encoding="UTF-8"?>\n', svgString],
      { type: 'image/svg+xml;charset=utf-8' },
    );
    baixarBlob(blob, `${file}.svg`);
    return;
  }

  // PNG / JPEG → rasteriza via canvas
  const scale = 2; // nitidez (2x)
  const svgBlob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', svgString], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Falha ao renderizar o SVG para imagem'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas não suportado');

    // JPEG não tem transparência → pinta o fundo
    if (format === 'jpeg') {
      ctx.fillStyle = background || '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, mime, 0.95),
    );
    if (!blob) throw new Error('Falha ao gerar a imagem');
    baixarBlob(blob, `${file}.${ext}`);
  } finally {
    URL.revokeObjectURL(url);
  }
}
