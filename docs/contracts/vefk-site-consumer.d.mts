export type VefkFrame = {
  timeMs: number;
  durationMs: number;
  visibility: Array<{ pathId: string; fraction: number }>;
  pen: null | {
    pathId: string;
    position: { x: number; y: number };
    fraction: number;
    penDown: boolean;
    phase?: "drawing" | "travel" | "hold" | "ready";
  };
  complete: boolean;
};
export function createVefkPlayer(document: unknown): {
  durationMs: number;
  frameAt(timeMs: number): VefkFrame;
};
export function vefkFrameAt(document: unknown, timeMs: number): VefkFrame;
export function readVefkPublication(raw: unknown, scene?: unknown): Promise<unknown>;
export function validateSceneBinding(binding: unknown, scene?: unknown): boolean;
