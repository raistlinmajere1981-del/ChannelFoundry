import { createVefkPlayer } from "../../../docs/contracts/vefk-site-consumer.mjs";
import { createIntraStrokePreviewPlayer, type IntraStrokeCurve } from "./vefk-intrastroke-preview.ts";
import { reconcileDrawPlan } from "./vefk-timeline-model.ts";

/** The save/regeneration bridge always receives the document's explicit version. */
export function editorInput(doc: StudioVefkDocument): StudioVefkCreateInput {
  return {
    schemaVersion: doc.schemaVersion,
    id: doc.id, revision: doc.revision, title: doc.title, description: doc.description,
    language: doc.language, kind: doc.construction.kind,
    parameters: doc.construction.kind === "magicSquare" ? {
      order: doc.construction.parameters.order,
      first: doc.construction.parameters.first,
      step: doc.construction.parameters.step,
    } : undefined,
    grid: doc.construction.kind === "manualSquare" ? doc.construction.grid : undefined,
    geometry: doc.geometry,
    drawPlan: reconcileDrawPlan(doc.geometry, doc.drawPlan, doc.schemaVersion),
    provenance: doc.provenance, accessibility: doc.accessibility,
  };
}

/** Explicit UI action only. Generate/validate this input through the bridge
 * before applying it to history; never change identity or review state here. */
export function persistentMotionInput(
  doc: StudioVefkDocument, status: StudioVefkStatus | "new",
): StudioVefkCreateInput {
  if (status !== "new" && status !== "draft") {
    throw new Error("Kalıcı eğri için önce düzenlenebilir taslak veya yeni revizyon oluşturmalısın.");
  }
  if (doc.schemaVersion !== 1) throw new Error("Bu belge zaten v2 kullanıyor.");
  const input = editorInput(doc);
  return { ...input, schemaVersion: 2, drawPlan: {
    ...input.drawPlan!,
    strokes: input.drawPlan!.strokes.map(stroke => ({ ...stroke, easing: "linear" })),
  } };
}

/** A saved v2 curve always uses the canonical player, regardless of v1 lab state. */
export function createEditorPreviewPlayer(doc: StudioVefkDocument, curve: IntraStrokeCurve) {
  return doc.schemaVersion === 2 || curve === "linear"
    ? createVefkPlayer(doc)
    : createIntraStrokePreviewPlayer(doc, curve);
}
