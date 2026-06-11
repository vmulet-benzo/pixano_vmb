/*-------------------------------------
Copyright: CEA-LIST/DIASI/SIALV/LVA
Author : pixano@cea.fr
License: CECILL-C
-------------------------------------*/

import type Konva from "konva";
import { describe, expect, it, vi } from "vitest";

import { AnnotationCollection, type LocalBBox } from "../../annotationCollection.svelte.js";
import { selectTool2D } from "../selectTool2D.js";
import { DEFAULT_TOOL_2D, type Scene2DContext } from "../types2d.js";

function makeBBox(id: string): LocalBBox {
  return { id, entityId: `e-${id}`, kind: "bbox", geometry: [0.1, 0.1, 0.2, 0.2], persisted: true };
}

function makeContext(collection: AnnotationCollection) {
  const stage = {} as Konva.Stage;
  const ctx: Scene2DContext = {
    widgetId: "w1",
    buildContext: { datasetId: "ds", recordId: "rec", viewId: "view" },
    collection,
    mutations: { pending: [], queue: vi.fn(), dropForLocalAnnotation: vi.fn() },
    stage,
    annotationLayer: {} as Konva.Layer,
    getKonvaImage: () => null,
    setActiveTool: vi.fn(),
    requestRedraw: vi.fn(),
    deleteSelected: vi.fn(),
  };
  return { ctx, stage };
}

describe("selectTool2D", () => {
  it("is the default tool", () => {
    expect(selectTool2D.id).toBe(DEFAULT_TOOL_2D);
  });

  it("deselects when clicking the empty stage", () => {
    const collection = new AnnotationCollection([makeBBox("a")]);
    collection.select("a");
    const { ctx, stage } = makeContext(collection);
    const handler = selectTool2D.createHandler(ctx);

    handler.onPointerDown!({ target: stage } as Parameters<NonNullable<typeof handler.onPointerDown>>[0]);

    expect(collection.selectedId).toBeNull();
    expect(ctx.requestRedraw).toHaveBeenCalled();
  });

  it("keeps the selection when clicking a shape", () => {
    const collection = new AnnotationCollection([makeBBox("a")]);
    collection.select("a");
    const { ctx } = makeContext(collection);
    const handler = selectTool2D.createHandler(ctx);

    handler.onPointerDown!({ target: { notTheStage: true } } as unknown as Parameters<
      NonNullable<typeof handler.onPointerDown>
    >[0]);

    expect(collection.selectedId).toBe("a");
  });

  it("Escape deselects, Delete removes the selection", () => {
    const collection = new AnnotationCollection([makeBBox("a")]);
    collection.select("a");
    const { ctx } = makeContext(collection);
    const handler = selectTool2D.createHandler(ctx);

    expect(handler.onKeyDown!(new KeyboardEvent("keydown", { key: "Escape" }))).toBe(true);
    expect(collection.selectedId).toBeNull();

    collection.select("a");
    expect(handler.onKeyDown!(new KeyboardEvent("keydown", { key: "Delete" }))).toBe(true);
    expect(ctx.deleteSelected).toHaveBeenCalledTimes(1);
  });

  it("ignores Delete without a selection and unrelated keys", () => {
    const collection = new AnnotationCollection([makeBBox("a")]);
    const { ctx } = makeContext(collection);
    const handler = selectTool2D.createHandler(ctx);

    expect(handler.onKeyDown!(new KeyboardEvent("keydown", { key: "Delete" }))).toBe(false);
    expect(handler.onKeyDown!(new KeyboardEvent("keydown", { key: "a" }))).toBe(false);
    expect(ctx.deleteSelected).not.toHaveBeenCalled();
  });
});
