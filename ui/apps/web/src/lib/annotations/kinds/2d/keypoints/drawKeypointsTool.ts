/*-------------------------------------
Copyright: CEA-LIST/DIASI/SIALV/LVA
Author : pixano@cea.fr
License: CECILL-C
-------------------------------------*/

import Konva from "konva";
import { CircleDot } from "lucide-svelte";

import type { LocalKeypoints } from "$lib/annotations/annotationCollection.svelte.js";
import { generateShortId } from "$lib/annotations/buildPayloads.js";
import { BBOX_COLOR_DRAFT, getPixelFrame } from "$lib/annotations/tools/scene2dGeometry.js";
import {
  DEFAULT_TOOL_2D,
  type Scene2DContext,
  type Tool2D,
  type ToolHandler2D,
} from "$lib/annotations/tools/types2d.js";

import { KEYPOINT_RADIUS } from "./keypointsRenderer2D.js";
import { keypointsPayloadBuilder } from "./keypointsPayloadBuilder.js";

/**
 * Click-to-place keypoints. Each click inside the image adds a point;
 * Enter commits the set as one annotation, Escape cancels. Hands control
 * back to the select tool when done.
 */
class DrawKeypointsHandler implements ToolHandler2D {
  private points: { x: number; y: number }[] = [];
  private previewCircles: Konva.Circle[] = [];

  constructor(private readonly ctx: Scene2DContext) {}

  onPointerDown(event: Konva.KonvaEventObject<MouseEvent>): void {
    event.cancelBubble = true;
    const pos = this.ctx.stage.getPointerPosition();
    const frame = getPixelFrame(this.ctx.getKonvaImage());
    if (!pos || !frame || frame.w <= 0 || frame.h <= 0) return;
    if (pos.x < frame.x || pos.x > frame.x + frame.w || pos.y < frame.y || pos.y > frame.y + frame.h) {
      return;
    }

    this.points.push({ x: (pos.x - frame.x) / frame.w, y: (pos.y - frame.y) / frame.h });

    const circle = new Konva.Circle({
      x: pos.x,
      y: pos.y,
      radius: KEYPOINT_RADIUS,
      stroke: BBOX_COLOR_DRAFT,
      strokeWidth: 2,
      listening: false,
    });
    this.previewCircles.push(circle);
    this.ctx.annotationLayer.add(circle);
    this.ctx.annotationLayer.batchDraw();
  }

  onKeyDown(event: KeyboardEvent): boolean {
    if (event.key === "Enter") {
      this._commit();
      return true;
    }
    if (event.key === "Escape") {
      this._clearPreview();
      this.ctx.setActiveTool(DEFAULT_TOOL_2D);
      return true;
    }
    return false;
  }

  deactivate(): void {
    this._clearPreview();
  }

  private _commit(): void {
    if (this.points.length === 0) {
      this.ctx.setActiveTool(DEFAULT_TOOL_2D);
      return;
    }

    const annotation: LocalKeypoints = {
      id: generateShortId(),
      entityId: generateShortId(),
      kind: "keypoints",
      viewId: this.ctx.buildContext.viewId,
      geometry: { points: this.points },
      persisted: false,
    };
    this._clearPreview();
    this.ctx.collection.add(annotation);

    for (const m of keypointsPayloadBuilder.buildCreate(this.ctx.buildContext, annotation, this.ctx.widgetId)) {
      this.ctx.mutations.queue(m);
    }

    this.ctx.setActiveTool(DEFAULT_TOOL_2D);
    this.ctx.collection.select(annotation.id);
    this.ctx.requestRedraw();
  }

  private _clearPreview(): void {
    for (const circle of this.previewCircles) circle.destroy();
    if (this.previewCircles.length > 0) this.ctx.annotationLayer.batchDraw();
    this.previewCircles = [];
    this.points = [];
  }
}

export const drawKeypointsTool: Tool2D = {
  id: "draw-keypoints",
  label: "Add keypoints — click to place, Enter to finish (K)",
  icon: CircleDot,
  kind: "keypoints",
  cursor: "crosshair",
  createHandler: (ctx: Scene2DContext) => new DrawKeypointsHandler(ctx),
};
