/*-------------------------------------
Copyright: CEA-LIST/DIASI/SIALV/LVA
Author : pixano@cea.fr
License: CECILL-C
-------------------------------------*/

import type Konva from "konva";
import { describe, expect, it, vi } from "vitest";

// Konva requires a native canvas in node; the tool only needs Circle.
vi.mock("konva", () => ({
  default: {
    Circle: class {
      constructor(public config: Record<string, unknown>) {}
      destroy(): void {}
    },
  },
}));

import { AnnotationCollection } from "$lib/annotations/annotationCollection.svelte.js";
import type { Scene2DContext } from "$lib/annotations/tools/types2d.js";

import { drawKeypointsTool } from "../drawKeypointsTool.js";

function makeContext() {
  const collection = new AnnotationCollection();
  let pointer: { x: number; y: number } | null = null;
  // 100×100 image frame at origin so pixel == percent for easy assertions.
  const konvaImage = { x: () => 0, y: () => 0, width: () => 100, height: () => 100 } as unknown as Konva.Image;
  const ctx: Scene2DContext = {
    widgetId: "w1",
    buildContext: { datasetId: "ds", recordId: "rec", viewId: "view" },
    collection,
    mutations: { pending: [], queue: vi.fn(), dropForLocalAnnotation: vi.fn() },
    stage: { getPointerPosition: () => pointer } as unknown as Konva.Stage,
    annotationLayer: { add: vi.fn(), batchDraw: vi.fn() } as unknown as Konva.Layer,
    getKonvaImage: () => konvaImage,
    setActiveTool: vi.fn(),
    requestRedraw: vi.fn(),
  };
  return { ctx, collection, setPointer: (p: { x: number; y: number } | null) => (pointer = p) };
}

function pointerEvent(): Parameters<NonNullable<ReturnType<typeof drawKeypointsTool.createHandler>["onPointerDown"]>>[0] {
  return { cancelBubble: false } as Parameters<
    NonNullable<ReturnType<typeof drawKeypointsTool.createHandler>["onPointerDown"]>
  >[0];
}

describe("drawKeypointsTool", () => {
  it("clicks add normalized points; Enter commits one annotation with queued mutations", () => {
    const { ctx, collection, setPointer } = makeContext();
    const handler = drawKeypointsTool.createHandler(ctx);

    setPointer({ x: 10, y: 20 });
    handler.onPointerDown!(pointerEvent());
    setPointer({ x: 50, y: 80 });
    handler.onPointerDown!(pointerEvent());

    expect(handler.onKeyDown!(new KeyboardEvent("keydown", { key: "Enter" }))).toBe(true);

    expect(collection.count).toBe(1);
    const annotation = collection.items[0];
    expect(annotation.kind).toBe("keypoints");
    expect(annotation.persisted).toBe(false);
    expect(annotation.geometry).toEqual({
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.5, y: 0.8 },
      ],
    });
    expect(collection.selectedId).toBe(annotation.id);

    // Entity create + keypoints create.
    expect(ctx.mutations.queue).toHaveBeenCalledTimes(2);
    expect(ctx.setActiveTool).toHaveBeenCalledWith("select");
  });

  it("ignores clicks outside the image frame", () => {
    const { ctx, collection, setPointer } = makeContext();
    const handler = drawKeypointsTool.createHandler(ctx);

    setPointer({ x: 150, y: 20 });
    handler.onPointerDown!(pointerEvent());
    handler.onKeyDown!(new KeyboardEvent("keydown", { key: "Enter" }));

    expect(collection.count).toBe(0);
    expect(ctx.mutations.queue).not.toHaveBeenCalled();
  });

  it("Escape cancels the draft without committing", () => {
    const { ctx, collection, setPointer } = makeContext();
    const handler = drawKeypointsTool.createHandler(ctx);

    setPointer({ x: 10, y: 20 });
    handler.onPointerDown!(pointerEvent());
    expect(handler.onKeyDown!(new KeyboardEvent("keydown", { key: "Escape" }))).toBe(true);

    expect(collection.count).toBe(0);
    expect(ctx.mutations.queue).not.toHaveBeenCalled();
    expect(ctx.setActiveTool).toHaveBeenCalledWith("select");
  });

  it("Enter with no points just hands back to select", () => {
    const { ctx, collection } = makeContext();
    const handler = drawKeypointsTool.createHandler(ctx);

    handler.onKeyDown!(new KeyboardEvent("keydown", { key: "Enter" }));

    expect(collection.count).toBe(0);
    expect(ctx.mutations.queue).not.toHaveBeenCalled();
    expect(ctx.setActiveTool).toHaveBeenCalledWith("select");
  });
});
