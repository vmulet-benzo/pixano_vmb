/*-------------------------------------
Copyright: CEA-LIST/DIASI/SIALV/LVA
Author : pixano@cea.fr
License: CECILL-C
-------------------------------------*/

import Konva from "konva";

import type { KeypointsGeometry, LocalKeypoints } from "$lib/annotations/annotationCollection.svelte.js";
import {
  BBOX_COLOR_DRAFT,
  BBOX_COLOR_PERSISTED,
  getPixelFrame,
  type PixelFrame,
} from "$lib/annotations/tools/scene2dGeometry.js";
import type {
  AnnotationRenderer2D,
  AnnotationRenderer2DFactory,
  Scene2DContext,
} from "$lib/annotations/tools/types2d.js";

export const KEYPOINT_RADIUS = 4;
export const KEYPOINT_SELECTED_RADIUS = 6;
const KEYPOINT_STROKE_WIDTH = 1.5;
const KEYPOINT_FILL = "#0f172a";

/**
 * Renders the "keypoints" kind: one small circle per point, grouped per
 * annotation. Clicking any point selects the whole set (the selection is
 * shown by enlarging the circles); geometry edits are not supported yet.
 */
class KeypointsRenderer2D implements AnnotationRenderer2D {
  readonly kind = "keypoints" as const;

  private readonly groupById = new Map<string, Konva.Group>();

  constructor(private readonly ctx: Scene2DContext) {}

  sync(): void {
    const frame = getPixelFrame(this.ctx.getKonvaImage());

    // Rebuild groups wholesale: keypoint sets are small and immutable once
    // committed, so reconciliation would buy nothing over clarity.
    for (const group of this.groupById.values()) group.destroy();
    this.groupById.clear();
    if (!frame) return;

    for (const annotation of this.ctx.collection.byKind<KeypointsGeometry>("keypoints")) {
      const group = this._makeGroup(annotation, frame);
      this.groupById.set(annotation.id, group);
      this.ctx.annotationLayer.add(group);
    }
    this.ctx.annotationLayer.batchDraw();
  }

  destroy(): void {
    for (const group of this.groupById.values()) group.destroy();
    this.groupById.clear();
  }

  private _makeGroup(annotation: LocalKeypoints, frame: PixelFrame): Konva.Group {
    const group = new Konva.Group();
    const selected = this.ctx.collection.selectedId === annotation.id;
    const stroke = annotation.persisted ? BBOX_COLOR_PERSISTED : BBOX_COLOR_DRAFT;

    for (const point of annotation.geometry.points) {
      const circle = new Konva.Circle({
        x: frame.x + point.x * frame.w,
        y: frame.y + point.y * frame.h,
        radius: selected ? KEYPOINT_SELECTED_RADIUS : KEYPOINT_RADIUS,
        fill: KEYPOINT_FILL,
        stroke,
        strokeWidth: KEYPOINT_STROKE_WIDTH,
      });
      group.add(circle);
    }

    group.on("click tap", (e) => {
      e.cancelBubble = true;
      this.ctx.collection.select(annotation.id);
      this.ctx.requestRedraw();
    });
    return group;
  }
}

export const keypointsRenderer2DFactory: AnnotationRenderer2DFactory = {
  kind: "keypoints",
  create: (ctx: Scene2DContext) => new KeypointsRenderer2D(ctx),
};
