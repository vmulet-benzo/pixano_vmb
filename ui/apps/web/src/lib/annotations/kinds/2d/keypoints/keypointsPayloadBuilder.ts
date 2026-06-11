/*-------------------------------------
Copyright: CEA-LIST/DIASI/SIALV/LVA
Author : pixano@cea.fr
License: CECILL-C
-------------------------------------*/

import type { KeypointsGeometry, LocalAnnotation } from "$lib/annotations/annotationCollection.svelte.js";
import { DEFAULT_SOURCE, type BuildContext } from "$lib/annotations/buildPayloads.js";
import type { ResourceMutation } from "$lib/annotations/types.js";

export const KEYPOINTS_RESOURCE = "keypoints";

/** Backend keypoint visibility state; we only author visible points. */
const STATE_VISIBLE = "visible";

/**
 * Shared body for create and update. Matches the backend `KeyPoints` schema:
 * a flat `coords` list (x,y pairs, normalized [0,1] by our convention) and
 * one `states` entry per point. No `template_id` until templates exist in
 * the workspace UI.
 */
function keypointsBody(
  ctx: BuildContext,
  annotation: LocalAnnotation<KeypointsGeometry>,
): Record<string, unknown> {
  return {
    id: annotation.id,
    record_id: ctx.recordId,
    entity_id: annotation.entityId,
    view_id: ctx.viewId,
    template_id: "",
    coords: annotation.geometry.points.flatMap((p) => [p.x, p.y]),
    states: annotation.geometry.points.map(() => STATE_VISIBLE),
    ...DEFAULT_SOURCE,
  };
}

/** Payload knowledge for 2D keypoints; the local annotation id is the row id. */
export const keypointsPayloadBuilder = {
  kind: "keypoints" as const,
  resource: KEYPOINTS_RESOURCE,

  buildCreate(
    ctx: BuildContext,
    annotation: LocalAnnotation<KeypointsGeometry>,
    widgetId: string,
  ): ResourceMutation[] {
    const entityBody: Record<string, unknown> = {
      id: annotation.entityId,
      record_id: ctx.recordId,
      parent_id: "",
    };
    const body: Record<string, unknown> = {
      ...keypointsBody(ctx, annotation),
      frame_id: ctx.viewId,
      frame_index: -1,
      tracklet_id: "",
      entity_dynamic_state_id: "",
    };
    return [
      {
        op: "create",
        resource: "entities",
        body: entityBody,
        widgetId,
        localAnnotationId: annotation.id,
      },
      {
        op: "create",
        resource: KEYPOINTS_RESOURCE,
        body,
        widgetId,
        localAnnotationId: annotation.id,
      },
    ];
  },

  buildUpdate(
    ctx: BuildContext,
    annotation: LocalAnnotation<KeypointsGeometry>,
  ): Record<string, unknown> {
    return keypointsBody(ctx, annotation);
  },
};
