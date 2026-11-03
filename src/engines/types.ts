import type { SimParams } from '@/state/params';

export interface PointerState {
  x: number; y: number;      // uv space 0..1 (pre-cover-crop)
  radius: number;             // uv units
  strength: number;           // + feed / - repel
  active: boolean;
}

export const NULL_POINTER: PointerState = { x: 0.5, y: 0.5, radius: 0.001, strength: 0, active: false };

export interface Engine {
  readonly name: string;
  reset(seed: number, p: SimParams): void;
  step(p: SimParams, frame: number, pointer: PointerState): void;
  render(p: SimParams, stops: [number, number, number][]): void;
  resize(cssW: number, cssH: number, dpr: number): void;
  checksum(): string;
  dispose(): void;
}
