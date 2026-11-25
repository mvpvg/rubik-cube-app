const SVG = 'http://www.w3.org/2000/svg';
const QUIET = 4; // empty modules around the code, so phone cameras can find its edge

// A black-on-white QR code as an SVG. The library loads only when a code is first shown.
export async function qrCode(text: string, label: string): Promise<SVGSVGElement> {
  const { default: qrcode } = await import('qrcode-generator');
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const size = n + QUIET * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
  const svg = document.createElementNS(SVG, 'svg');
  const set = (el: Element, attrs: Record<string, string | number>) => Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  set(svg, { viewBox: `0 0 ${size} ${size}`, width: 200, height: 200, role: 'img', 'aria-label': label, 'shape-rendering': 'crispEdges' });
  const back = document.createElementNS(SVG, 'rect');
  set(back, { width: size, height: size, fill: '#fff' });
  const dark = document.createElementNS(SVG, 'path');
  set(dark, { d, fill: '#000' });
  svg.append(back, dark);
  return svg;
}
