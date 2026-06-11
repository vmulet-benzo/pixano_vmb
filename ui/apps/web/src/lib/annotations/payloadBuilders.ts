/*-------------------------------------
Copyright: CEA-LIST/DIASI/SIALV/LVA
Author : pixano@cea.fr
License: CECILL-C
-------------------------------------*/

import { ENTITY_RESOURCE } from "$lib/api/resourceNames.js";

import type {
  AnnotationCollection,
  AnnotationKind,
  LocalAnnotation,
} from "./annotationCollection.svelte.js";
import type { BuildContext } from "./buildPayloads.js";
import { bboxPayloadBuilder } from "./kinds/2d/bbox/bboxPayloadBuilder.js";
import { keypointsPayloadBuilder } from "./kinds/2d/keypoints/keypointsPayloadBuilder.js";
import { bbox3dPayloadBuilder } from "./kinds/3d/bbox3d/bbox3dPayloadBuilder.js";
import type { MutationSink } from "./tools/types2d.js";
import type { ResourceMutation } from "./types.js";

/**
 * Per-kind knowledge of how a `LocalAnnotation` becomes backend payloads.
 * One entry per kind in `PAYLOAD_BUILDERS`; nothing outside the kind's
 * module knows its resource name or body shape.
 */
export interface PayloadBuilder<G = unknown> {
  kind: AnnotationKind;
  /** Backend collection name, e.g. "bboxes". */
  resource: string;
  /** Mutations creating the annotation and its parent entity. */
  buildCreate(ctx: BuildContext, annotation: LocalAnnotation<G>, widgetId: string): ResourceMutation[];
  /** Update body for an existing annotation whose geometry changed. */
  buildUpdate(ctx: BuildContext, annotation: LocalAnnotation<G>): Record<string, unknown>;
}

const PAYLOAD_BUILDERS: ReadonlyMap<AnnotationKind, PayloadBuilder> = new Map<
  AnnotationKind,
  PayloadBuilder
>([
  [bboxPayloadBuilder.kind, bboxPayloadBuilder as PayloadBuilder],
  [bbox3dPayloadBuilder.kind, bbox3dPayloadBuilder as PayloadBuilder],
  [keypointsPayloadBuilder.kind, keypointsPayloadBuilder as PayloadBuilder],
]);

export function payloadBuilderFor(kind: AnnotationKind): PayloadBuilder {
  const builder = PAYLOAD_BUILDERS.get(kind);
  if (!builder) throw new Error(`No payload builder registered for annotation kind "${kind}"`);
  return builder;
}

/**
 * Delete mutations for a persisted annotation: the annotation row plus its
 * parent entity. Kind-agnostic — only the resource name comes from the
 * kind's builder.
 */
export function buildDeleteMutations(
  annotation: LocalAnnotation,
  widgetId: string,
): ResourceMutation[] {
  const { resource } = payloadBuilderFor(annotation.kind);
  return [
    { op: "delete", resource, id: annotation.id, widgetId, localAnnotationId: annotation.id },
    {
      op: "delete",
      resource: ENTITY_RESOURCE,
      id: annotation.entityId,
      widgetId,
      localAnnotationId: annotation.id,
    },
  ];
}

/**
 * Kind-agnostic local delete: queues the backend deletes for a persisted
 * annotation, or drops the not-yet-flushed creates for a draft, then removes
 * it from the collection. Used by select tools and widget delete buttons.
 */
export function deleteLocalAnnotation(
  annotation: LocalAnnotation,
  collection: AnnotationCollection,
  mutations: MutationSink,
  widgetId: string,
): void {
  if (annotation.persisted) {
    for (const m of buildDeleteMutations(annotation, widgetId)) mutations.queue(m);
  } else {
    mutations.dropForLocalAnnotation(annotation.id);
  }
  collection.remove(annotation.id);
}
