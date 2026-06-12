/*-------------------------------------
Copyright: CEA-LIST/DIASI/SIALV/LVA
Author : pixano@cea.fr
License: CECILL-C
-------------------------------------*/

import type Konva from "konva";
import { describe, expect, it, vi } from "vitest";

import {
  AnnotationCollection,
  type LocalAnnotation,
} from "../../annotationCollection.svelte.js";
import { PlaybackClock } from "../../playbackClock.svelte.js";
import type { AnnotationRenderer2D, Scene2DContext } from "../types2d.js";

/**
 * Spike validation for the temporal rendering contract (decision D6):
 * a temporal kind must be expressible with ONLY the additive seams —
 * `Scene2DContext.clock` and `AnnotationRenderer2D.tick(timeMs)` — with
 * `sync()` reconciling nodes on collection change and `tick()` adjusting
 * visibility per frame without creating or destroying anything.
 *
 * The fake kind below stands in for a future video/audio kind: each
 * annotation has an interval geometry and is visible while the playhead is
 * inside it. It (ab)uses the declared-but-unimplemented "mask" literal so
 * the test stays type-clean without polluting the production registries.
 */

interface IntervalGeometry {
  startMs: number;
  endMs: number;
}

function makeInterval(id: string, startMs: number, endMs: number): LocalAnnotation<IntervalGeometry> {
  return { id, entityId: `e-${id}`, kind: "mask", viewId: "view", geometry: { startMs, endMs }, persisted: true };
}

/** Minimal fake scene node: visibility toggles, no Konva needed. */
class FakeNode {
  visible = true;
  destroyed = false;
  destroy(): void {
    this.destroyed = true;
  }
}

class FakeTemporalRenderer implements AnnotationRenderer2D {
  readonly kind = "mask" as const;
  readonly nodeById = new Map<string, FakeNode>();
  creations = 0;

  constructor(private readonly ctx: Scene2DContext) {}

  sync(): void {
    const active = new Set<string>();
    for (const annotation of this.ctx.collection.byKind<IntervalGeometry>("mask")) {
      active.add(annotation.id);
      if (!this.nodeById.has(annotation.id)) {
        this.nodeById.set(annotation.id, new FakeNode());
        this.creations++;
      }
    }
    for (const [id, node] of this.nodeById) {
      if (!active.has(id)) {
        node.destroy();
        this.nodeById.delete(id);
      }
    }
    // Initial visibility for the current playhead.
    this.tick(this.ctx.clock?.currentTimeMs ?? 0);
  }

  tick(timeMs: number): void {
    for (const annotation of this.ctx.collection.byKind<IntervalGeometry>("mask")) {
      const node = this.nodeById.get(annotation.id);
      if (!node) continue;
      node.visible = timeMs >= annotation.geometry.startMs && timeMs < annotation.geometry.endMs;
    }
  }

  destroy(): void {
    for (const node of this.nodeById.values()) node.destroy();
    this.nodeById.clear();
  }
}

function makeContext(collection: AnnotationCollection, clock: PlaybackClock): Scene2DContext {
  return {
    widgetId: "w1",
    buildContext: { datasetId: "ds", recordId: "rec", viewId: "view" },
    collection,
    mutations: { pending: [], queue: vi.fn(), dropForLocalAnnotation: vi.fn() },
    stage: {} as Konva.Stage,
    annotationLayer: {} as Konva.Layer,
    getKonvaImage: () => null,
    setActiveTool: vi.fn(),
    requestRedraw: vi.fn(),
    clock,
  };
}

describe("temporal rendering contract (D6 spike)", () => {
  it("tick adjusts visibility for the playhead without creating or destroying nodes", () => {
    const collection = new AnnotationCollection([
      makeInterval("early", 0, 100),
      makeInterval("late", 200, 300),
    ]);
    const clock = new PlaybackClock();
    const renderer = new FakeTemporalRenderer(makeContext(collection, clock));

    renderer.sync();
    expect(renderer.creations).toBe(2);
    expect(renderer.nodeById.get("early")!.visible).toBe(true);
    expect(renderer.nodeById.get("late")!.visible).toBe(false);

    // Simulate playback frames: only visibility changes, no node churn.
    clock.durationMs = 1000;
    clock.play();
    clock.advanceBy(250);
    renderer.tick(clock.currentTimeMs);

    expect(renderer.creations).toBe(2);
    expect(renderer.nodeById.get("early")!.visible).toBe(false);
    expect(renderer.nodeById.get("late")!.visible).toBe(true);
    expect([...renderer.nodeById.values()].every((n) => !n.destroyed)).toBe(true);
  });

  it("scrubbing while paused drives the same path", () => {
    const collection = new AnnotationCollection([makeInterval("a", 100, 200)]);
    const clock = new PlaybackClock();
    const renderer = new FakeTemporalRenderer(makeContext(collection, clock));
    renderer.sync();

    clock.seek(150);
    renderer.tick(clock.currentTimeMs);
    expect(renderer.nodeById.get("a")!.visible).toBe(true);

    clock.seek(500);
    renderer.tick(clock.currentTimeMs);
    expect(renderer.nodeById.get("a")!.visible).toBe(false);
  });

  it("collection changes go through sync, not tick", () => {
    const collection = new AnnotationCollection([makeInterval("a", 0, 100)]);
    const clock = new PlaybackClock();
    const renderer = new FakeTemporalRenderer(makeContext(collection, clock));
    renderer.sync();

    collection.add(makeInterval("b", 50, 150));
    renderer.sync();
    expect(renderer.creations).toBe(2);

    collection.remove("a");
    renderer.sync();
    expect(renderer.nodeById.has("a")).toBe(false);
    expect(renderer.nodeById.has("b")).toBe(true);
  });

  it("non-temporal renderers are unaffected: tick is optional on the interface", () => {
    const plain: AnnotationRenderer2D = {
      kind: "bbox",
      sync: () => {},
      destroy: () => {},
    };
    expect(plain.tick).toBeUndefined();
  });
});
