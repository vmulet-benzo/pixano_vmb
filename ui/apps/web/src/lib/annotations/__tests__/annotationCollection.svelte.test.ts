/*-------------------------------------
Copyright: CEA-LIST/DIASI/SIALV/LVA
Author : pixano@cea.fr
License: CECILL-C
-------------------------------------*/

import { describe, expect, it } from "vitest";

import {
  AnnotationCollection,
  type LocalAnnotation,
  type LocalBBox,
} from "../annotationCollection.svelte.js";

function makeBBox(id: string, persisted = false): LocalBBox {
  return { id, entityId: `e-${id}`, kind: "bbox", geometry: [0.1, 0.1, 0.2, 0.2], persisted };
}

function makeBBox3D(id: string): LocalAnnotation {
  return {
    id,
    entityId: `e-${id}`,
    kind: "bbox3d",
    geometry: { coords: [0, 0, 0, 1, 1, 1], format: "xyzwhd" },
    persisted: true,
  };
}

describe("AnnotationCollection", () => {
  it("starts from the seeded annotations", () => {
    const collection = new AnnotationCollection([makeBBox("a"), makeBBox3D("b")]);
    expect(collection.count).toBe(2);
    expect(collection.find("a")?.entityId).toBe("e-a");
  });

  it("byKind filters and types per kind", () => {
    const collection = new AnnotationCollection([makeBBox("a"), makeBBox3D("b"), makeBBox("c")]);
    expect(collection.byKind("bbox").map((a) => a.id)).toEqual(["a", "c"]);
    expect(collection.byKind("bbox3d").map((a) => a.id)).toEqual(["b"]);
    expect(collection.byKind("keypoints")).toEqual([]);
  });

  it("add appends and find retrieves", () => {
    const collection = new AnnotationCollection();
    collection.add(makeBBox("a"));
    expect(collection.count).toBe(1);
    expect(collection.find("a")).toBeDefined();
    expect(collection.find("missing")).toBeUndefined();
  });

  it("remove drops the annotation and clears a matching selection", () => {
    const collection = new AnnotationCollection([makeBBox("a"), makeBBox("b")]);
    collection.select("a");
    collection.remove("a");
    expect(collection.find("a")).toBeUndefined();
    expect(collection.selectedId).toBeNull();
  });

  it("remove keeps an unrelated selection", () => {
    const collection = new AnnotationCollection([makeBBox("a"), makeBBox("b")]);
    collection.select("b");
    collection.remove("a");
    expect(collection.selectedId).toBe("b");
  });

  it("selected exposes the selected annotation", () => {
    const collection = new AnnotationCollection([makeBBox("a")]);
    expect(collection.selected).toBeUndefined();
    collection.select("a");
    expect(collection.selected?.id).toBe("a");
  });

  it("setGeometry replaces the geometry in place", () => {
    const collection = new AnnotationCollection([makeBBox("a")]);
    collection.setGeometry("a", [0.5, 0.5, 0.1, 0.1]);
    expect(collection.find("a")?.geometry).toEqual([0.5, 0.5, 0.1, 0.1]);
  });

  it("markPersisted flips the flag", () => {
    const collection = new AnnotationCollection([makeBBox("a", false)]);
    collection.markPersisted("a");
    expect(collection.find("a")?.persisted).toBe(true);
  });
});
