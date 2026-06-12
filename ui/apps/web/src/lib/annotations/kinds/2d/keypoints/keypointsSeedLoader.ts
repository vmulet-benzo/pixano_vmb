/*-------------------------------------
Copyright: CEA-LIST/DIASI/SIALV/LVA
Author : pixano@cea.fr
License: CECILL-C
-------------------------------------*/

import type { LocalKeypoints } from "$lib/annotations/annotationCollection.svelte.js";
import type { AnnotationSeedLoader, SeedLoadContext } from "$lib/annotations/seedLoaders.js";
import type { KeyPointsRow } from "$lib/api/annotations.js";

import { KEYPOINTS_RESOURCE } from "./keypointsPayloadBuilder.js";

/**
 * REST→local mapping for 2D keypoints. Coords follow our normalized [0,1]
 * convention (the backend KeyPoints schema carries no is_normalized flag).
 */
export const keypointsSeedLoader: AnnotationSeedLoader = {
  kind: "keypoints",

  async load(ctx: SeedLoadContext) {
    const rows = await ctx.gateway
      .listAnnotations<KeyPointsRow>(ctx.datasetId, KEYPOINTS_RESOURCE, { recordId: ctx.recordId })
      .catch(() => [] as KeyPointsRow[]);

    const annotations: LocalKeypoints[] = [];
    for (const row of rows) {
      const view = ctx.views.get(row.view_id);
      if (!view || !Array.isArray(row.coords) || row.coords.length % 2 !== 0) continue;

      const points: { x: number; y: number }[] = [];
      for (let i = 0; i < row.coords.length; i += 2) {
        points.push({ x: row.coords[i], y: row.coords[i + 1] });
      }

      annotations.push({
        id: row.id,
        entityId: row.entity_id,
        kind: "keypoints",
        viewId: view.id,
        geometry: { points },
        persisted: true,
        entity: ctx.entitiesById.get(row.entity_id),
      });
    }
    return annotations;
  },
};
