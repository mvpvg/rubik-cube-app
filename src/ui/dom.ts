type Attrs = Record<string, string | number | boolean | EventListener | undefined>;
type Child = Node | string | null | undefined | false;

// Small element builder so screens never inject data through innerHTML.
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') el.className = String(value);
    else if (key === 'style') el.setAttribute('style', String(value));
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

// Inline stroke icons used across screens.
const ICONS = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 18l6-6-6-6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  check: '<path d="M5 13l4 4L19 7"/>',
  exit: '<path d="M6 6l12 12M18 6L6 18"/>',
  hand: '<path d="M7 11V6a2 2 0 014 0v5M11 10V4a2 2 0 014 0v7M15 10V6a2 2 0 014 0v8a6 6 0 01-6 6h-1a6 6 0 01-5-3l-3-5a2 2 0 013-2l2 2"/>',
};

export type IconName = keyof typeof ICONS;

export function icon(name: IconName, size = 22, color = 'currentColor'): SVGSVGElement {
  const wrap = document.createElement('span');
  wrap.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  return wrap.firstElementChild as SVGSVGElement;
}
