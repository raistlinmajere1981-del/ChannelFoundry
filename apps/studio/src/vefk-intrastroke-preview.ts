import {createVefkPlayer} from "../../../docs/contracts/vefk-site-consumer.mjs";

/** Research-only preview. These profiles are NOT part of the published document.
 * All visible ink AND nib travel use the same time warp. Never serialize this
 * as an S1 drawPlan field before the server and site agree on a new contract. */
export type IntraStrokeCurve = "linear" | "ease-in" | "ease-out" | "ease-in-out";
const supported: readonly IntraStrokeCurve[] =
  ["linear", "ease-in", "ease-out", "ease-in-out"];

export function warpStrokeFraction(value: number, curve: IntraStrokeCurve): number {
  if (!Number.isFinite(value)) throw new TypeError("Çizim ilerlemesi sonlu olmalı.");
  if (!supported.includes(curve)) throw new RangeError("Bilinmeyen çizgi içi eğri.");
  const t = Math.min(1, Math.max(0, value));
  if (curve === "ease-in") return t * t;
  if (curve === "ease-out") return t * (2 - t);
  if (curve === "ease-in-out") return t * t * (3 - 2 * t);
  return t;
}

/** Drive the EXISTING canonical player with a warped time, keeping all of its
 * segment, pen-up, viewBox and ink-fraction semantics. The returned timestamp
 * is the requested real time (not the internal, warped sample timestamp).
 * Pass only a Studio runtime document, never mutate/persist/re-hash it. */
export function createIntraStrokePreviewPlayer(
  document: StudioVefkDocument, curve: IntraStrokeCurve,
) {
  if (!supported.includes(curve)) throw new RangeError("Bilinmeyen çizgi içi eğri.");
  const player = createVefkPlayer(document);
  const strokes = document.drawPlan.strokes;
  return {
    durationMs: player.durationMs,
    frameAt(timeMs: number) {
      if (!Number.isFinite(timeMs)) throw new TypeError("Oynatma zamanı sonlu olmalı.");
      const realTime = Math.max(0, Math.min(player.durationMs, timeMs));
      // A binary search avoids scanning the entire plan for each animation frame.
      let lo = 0, hi = strokes.length - 1;
      let active: typeof strokes[number] | undefined;
      while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        const stroke = strokes[mid];
        if (realTime < stroke.startMs) hi = mid - 1;
        else if (realTime >= stroke.startMs + stroke.durationMs) lo = mid + 1;
        else {active = stroke;break;}
      }
      if (!active || curve === "linear") return player.frameAt(realTime);
      const fraction = (realTime - active.startMs) / active.durationMs;
      const warpedTime = active.startMs
        + warpStrokeFraction(fraction, curve) * active.durationMs;
      const frame = player.frameAt(warpedTime);
      return {...frame, timeMs: realTime};
    },
  };
}
