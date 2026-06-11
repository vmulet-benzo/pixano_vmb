/*-------------------------------------
Copyright: CEA-LIST/DIASI/SIALV/LVA
Author : pixano@cea.fr
License: CECILL-C
-------------------------------------*/

import type { CoordsNorm } from "./types.js";

/**
 * Every annotation kind the workspace can hold. Adding a kind means adding a
 * literal here plus a module under `lib/annotations/kinds/` — see
 * docs/ARCHITECTURE.md "Adding a new annotation kind".
 */
export type AnnotationKind = "bbox" | "bbox3d" | "keypoints" | "mask";

/**
 * The one local representation shared by every annotation kind. Pure data:
 * rendering, input handling and payload building live in per-kind modules,
 * never as methods here (see docs/ARCHITECTURE.md, decision D4).
 */
export interface LocalAnnotation<G = unknown> {
  id: string;
  entityId: string;
  kind: AnnotationKind;
  /** Per-kind geometry payload, typed in the kind's module. */
  geometry: G;
  /** True once the annotation (and its entity) have been POSTed to the backend. */
  persisted: boolean;
  /**
   * Snapshot of the parent entity's fields, populated for persisted
   * annotations so UIs can display labels without an extra fetch.
   */
  entity?: Record<string, unknown>;
}

/** Normalized xywh in [0, 1] — same convention as the backend BBox rows. */
export type BBoxGeometry = CoordsNorm;

/** Lance/backend space (Z-up); rotation is a row-major 3×3 matrix. */
export interface BBox3DGeometry {
  coords: [number, number, number, number, number, number];
  /** Server rows may arrive as either; editor output is always "xyzwhd". */
  format: "xyzwhd" | "xyzxyz";
  rotation?: number[];
}

export type LocalBBox = LocalAnnotation<BBoxGeometry>;
export type LocalBBox3DAnnotation = LocalAnnotation<BBox3DGeometry>;

/**
 * Owns the local annotation list of one widget instance: membership,
 * selection, geometry edits and the persisted flip. This is the single
 * lifecycle implementation shared by 2D and 3D widgets — widgets and tools
 * call into it instead of owning draft/override bookkeeping themselves.
 *
 * Optimistic edits mutate `geometry` in place; the pending mutation queue is
 * the ledger of what still has to reach the backend (matching the original
 * 2D behavior; the 3D `overrides` map this replaces did the same job).
 */
export class AnnotationCollection {
  items = $state<LocalAnnotation[]>([]);
  selectedId = $state<string | null>(null);

  readonly count = $derived(this.items.length);
  readonly selected = $derived(this.items.find((a) => a.id === this.selectedId));

  constructor(initial: LocalAnnotation[] = []) {
    this.items = initial;
  }

  find(id: string): LocalAnnotation | undefined {
    return this.items.find((a) => a.id === id);
  }

  byKind<G>(kind: AnnotationKind): LocalAnnotation<G>[] {
    return this.items.filter((a) => a.kind === kind) as LocalAnnotation<G>[];
  }

  add(annotation: LocalAnnotation): void {
    this.items.push(annotation);
  }

  /** Remove from the list; clears the selection when it pointed at the removed id. */
  remove(id: string): void {
    this.items = this.items.filter((a) => a.id !== id);
    if (this.selectedId === id) this.selectedId = null;
  }

  select(id: string | null): void {
    this.selectedId = id;
  }

  setGeometry<G>(id: string, geometry: G): void {
    const annotation = this.find(id);
    if (annotation) annotation.geometry = geometry;
  }

  markPersisted(id: string): void {
    const annotation = this.find(id);
    if (annotation) annotation.persisted = true;
  }
}
