/**
 * Curated palettes — the color soul of the instrument.
 * Every palette is 4–6 stops; the display shader interpolates them.
 * Muddy red/green/brown mixes are deliberately absent.
 */
export interface Palette { name: string; stops: string[]; spectral?: boolean }

export const PALETTES: Palette[] = [
  { name: 'ACID TROPIC', stops: ['#ff2079', '#00f0ff', '#b6ff00', '#8a2be2', '#fff200'] },
  { name: 'ULTRAVIOLET BLOOM', stops: ['#7b2ff7', '#f107a3', '#00e5ff', '#3d5afe', '#b388ff'] },
  { name: 'RADIOACTIVE CITRUS', stops: ['#ccff00', '#00ffa3', '#00b8ff', '#ff5e00', '#f0f0f0'] },
  { name: 'CANDY COBALT', stops: ['#0047ff', '#ff9100', '#ff2ec4', '#00ffd5', '#ffe600'] },
  { name: 'PEARLY ABALONE', stops: ['#ffd9e8', '#a8f0e8', '#c5b3ff', '#ffe9b8', '#b3fff0'], spectral: true },
  { name: 'OPAL FIRE', stops: ['#00fff9', '#ff005d', '#ffb300', '#6a00ff', '#eaff00'] },
  { name: 'HOTHOUSE', stops: ['#ff3131', '#ff914d', '#ffe45c', '#3ddc84', '#00c2ff'] },
  { name: 'ANEMONE', stops: ['#ff71ce', '#01cdfe', '#05ffa1', '#b967ff', '#fffb96'] },
  { name: 'DEEP REEF', stops: ['#00b3a4', '#0b5fff', '#9b5de5', '#f15bb5', '#fee440'] },
  { name: 'BLACKLIGHT POSTER', stops: ['#ff006e', '#8338ec', '#3a86ff', '#06ffa5', '#ffbe0b'] },
  { name: 'WARM FEVER', stops: ['#ff2e00', '#ff8c00', '#ffd000', '#ff5aa0', '#fff3b0'] },
  { name: 'COOL ABYSS', stops: ['#0affef', '#00b3ff', '#4d6bff', '#8f6bff', '#c1fff2'] },
];

export function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

export function shufflePalette(stops: string[], rng: () => number): string[] {
  const s = [...stops];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}
