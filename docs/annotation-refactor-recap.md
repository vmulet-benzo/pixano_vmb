# Annotation tooling refactor — team recap & technical analysis

**Branch:** `refactor/annotation-tools` (off `frontend/next-ui-init`, base `316a1592`)
**Scope:** `ui/apps/web` — the next-UI workspace app only. No backend changes.
**Size:** 13 commits, 50 files, +2 800 / −829. 217 unit tests green; `svelte-check`
unchanged from baseline (43 pre-existing errors, **0 added**); production build OK.
**Status:** local branch, not yet pushed/merged.

Companion docs: [`ARCHITECTURE.md`](./ARCHITECTURE.md) (the agreed design + decisions
D1–D6 + "Known debts"), [`annotation-tools-overview.md`](./annotation-tools-overview.md)
(diagram + the "add a kind" recipe), [`CODING_STANDARDS.md`](./CODING_STANDARDS.md).

---

## 1. Why we did this

The workspace renders a dataset record across **widgets** — a 2D image canvas
(Konva) and a 3D point-cloud viewer (Threlte/Three.js) — and lets users create and
edit annotations. Before the refactor, a widget *was* the feature: `ImageWidget` and
`PointCloudWidget` each contained their toolbar, drawing logic, rendering, save
payloads, and **their own private copy of the annotations**.

Concretely, that produced five problems:

1. **Tools weren't a concept.** Toolbars, a `mode` union (`"select" | "draw-bbox"`),
   and per-mode event routing were hard-coded in the widget. Every new tool widened
   unions and added branches in existing files (OCP violation).
2. **Three representations of one idea.** `LocalBBox` (2D), `DraftBBox3D` + a separate
   `overrides` map (3D) all modelled "a local annotation with optimistic state",
   with diverging shapes and duplicated lifecycle.
3. **bbox naming leaked into generic infrastructure** (`localBBoxId`, `LocalBBoxLocator`).
4. **Payload building was a closed set** of near-duplicate functions.
5. **SRP strain** in `useBoxEditor` (raycasting + gizmo geometry + drag FSM + bookkeeping).

And the structural flaw that motivated the biggest change: **each widget owned its own
annotation list.** Two widgets showing the same record held two copies of the same
truth — edit a 3D box and the 2D projection wouldn't follow; two save queues could hold
conflicting mutations for the same row. With more kinds and more widgets coming, this
multiplies.

**Goal:** make "add an annotation kind" cost *one new module + one registration*, with
zero edits to widgets or the save pipeline.

---

## 2. The shape of the new architecture

One sentence: **widgets are dumb hosts; everything annotation-specific is a small
plugin that signs up in a list; the data is one shared record-scoped object.**

```
        Widget (host)                      ← ImageWidget / PointCloudWidget
        scene setup · toolbar from registry · event delegation
                │ builds one
                ▼
        Scene2DContext  (Konva: stage·layer·hit-testing + collection·mutations)
          ├── TOOLS_2D            (input, one active)   select · draw-bbox
          └── RENDERER_FACTORIES_2D (display, all on)   bboxRenderer2D
                │ tools commit (write) │ renderers read
                ▼
        AnnotationCollection  ← record-scoped, on WorkspaceSession, shared by all widgets
                │ PAYLOAD_BUILDERS (local→REST)        ▲ SEED_LOADERS (REST→local)
                ▼                                      │
        MutationQueue ── flush ──▶ REST API ── fetch ─┘
```

The 3D pipeline is the mirror image (`TOOLS_3D`, the `boxEditor` in the Threlte scene),
sharing **only the data**, never the scene context (decision **D3**: Konva hit-testing
and Three.js raycasting have nothing in common but a name).

### The five seams

| Seam | File(s) | Responsibility |
|---|---|---|
| **Data model** | `annotations/annotationCollection.svelte.ts` | `LocalAnnotation<G>` + `AnnotationCollection` + `ViewScopedAnnotations` |
| **Tools** (input) | `tools/registry2d.ts`, `tools/registry3d.ts`, `kinds/*/draw*Tool.ts`, `tools/selectTool2D.ts` | one active; commits to the collection |
| **Renderers** (display) | `tools/types2d.ts` (`AnnotationRenderer2D`), `kinds/2d/bbox/bboxRenderer2D.ts` | all on; read the collection |
| **Transport out** | `annotations/payloadBuilders.ts`, `kinds/*/*PayloadBuilder.ts` | local → REST bodies |
| **Transport in** | `annotations/seedLoaders.ts`, `kinds/*/*SeedLoader.ts` | REST rows → local, once per record |

---

## 3. The data layer (the load-bearing change)

```ts
interface LocalAnnotation<G = unknown> {
  id; entityId; kind;        // discriminator: "bbox" | "bbox3d" | "mask"
  viewId;                    // which view it belongs to; record-scoped kinds keep ""
  geometry: G;               // per-kind, typed in the kind's module
  persisted: boolean;        // false = on screen only; true = the server has it
  entity?;                   // entity snapshot for labels
}
```

- **`AnnotationCollection`** is the single source of truth for one loaded record: the
  list, selection, in-place geometry edits, membership. Exactly **one instance per
  record**, owned by `WorkspaceSession.annotations`, **replaced wholesale on every
  record load** (kills "stale state bleeds across records" structurally).
- **`ViewScopedAnnotations`** is a thin facade implementing the same `AnnotationStore`
  interface: an image widget's window onto the shared collection, showing *its* view's
  2D annotations plus all record-scoped kinds (`RECORD_SCOPED_KINDS = {bbox3d}`). Reads
  filter; writes pass through. Because both classes implement `AnnotationStore`, tools
  and renderers never know which they hold.

**What this buys, for free:** moving a 3D box updates the object every widget reads
(live 2D projection becomes trivial); selection is cross-widget; and two widgets can
never queue conflicting mutations for diverging copies, because there are none.

`id` doubles as the backend row id, so a freshly-drawn box can be updated/deleted after
its create flushes — this fixed a latent bug where the local id and server id diverged.

---

## 4. Tools, renderers, transport — the plugin model

- **Tools** (`Tool2D = ToolDefinition + createHandler(ctx)`): `select` and `draw-bbox`
  are plugins in `TOOLS_2D`; the widget renders its toolbar with `{#each TOOLS_2D}` and
  forwards pointer/keyboard events to the active handler. **No `if (mode === …)` branches
  anywhere.** "Select/edit" is itself a tool.
- **Renderers** (`AnnotationRenderer2D`): separate objects from tools (decision **D4** —
  displaying persisted annotations must work with no tool active). `sync()` reconciles
  Konva nodes with the collection.
- **Transport is a symmetric pair per kind**, side by side in the kind's folder:
  `*PayloadBuilder.ts` (local→REST, registered in `PAYLOAD_BUILDERS`) and `*SeedLoader.ts`
  (REST→local, registered in `SEED_LOADERS`). Seed loaders run **once per record** —
  previously `listBBoxes` fired once *per camera view* (6× on a 6-camera NuScenes record);
  now once total.
- **Extensions only describe the view they claim** (`seed.view = {id, logicalName, width,
  height}`); `RecordLoader` indexes claimed views and runs every loader. Extensions
  contain zero annotation-mapping code.

### The "add a kind" recipe (e.g. mask RLE)
1. Add the kind literal + geometry type in `annotationCollection.svelte.ts`.
2. Create `kinds/2d/mask/` with `*PayloadBuilder`, `*SeedLoader`, `*Renderer2D`,
   `draw*Tool` (+ tests).
3. Register in `PAYLOAD_BUILDERS`, `SEED_LOADERS`, `RENDERER_FACTORIES_2D`, `TOOLS_2D`.
4. **Nothing else changes** — no widget, no queue, no loader edits. (Proven: keypoints
   was added exactly this way during the build, then removed cleanly when descoped.)

### 3D is deliberately asymmetric (decision D3)
`Tool3D = ToolDefinition` (metadata only). The 3D pointer FSM — place box, drag gizmos,
rotate rings, resize faces — lives in `kinds/3d/bbox3d/boxEditor.svelte.ts`, constructed
inside the Threlte scene where the camera/controls already are. A `Scene3DContext` +
handler factory is intentionally deferred until a 2nd 3D kind needs to share the scene
(tracked as DEBT-2).

---

## 5. How it was delivered (commit-by-commit)

Each commit ships independently with tests green. Phases map to the migration plan in
`ARCHITECTURE.md`.

| Commit | What |
|---|---|
| `ba92a495` | docs: agreed architecture + coding standards |
| `fec828eb` | Phase 0 — rename bbox-specific mutation metadata → annotation-generic |
| `43e4ef49` | Phase 1 — unify local state behind `AnnotationCollection` (kill `DraftBBox3D`/`overrides`) |
| `cdd147b2` | Phase 2 — 2D tools become registry plugins; toolbar data-driven; mode union gone |
| `b22b6beb` | Phase 3 — move 3D box editing into its kind module; registry-driven 3D toolbar |
| `1ee69715` | Phase 4 — payload-builder + renderer registries per kind |
| `21bee1e9` | Phase 6 — **record-scoped shared collection** + `ViewScopedAnnotations` + `viewId` |
| `86dd29e8` | seed-loader registry (REST→local symmetry; once-per-record fetch) |
| `67489c1d` | WIP checkpoint (`TO BE REWORKED`) |
| `eb466f7a` | code-review fixes round 1 (SOLID cleanups) |
| `e095ae1b` | finish edit-path dedup — `MutationQueue.patchPendingCreate` |
| `c21577f4` | review #3 — facade selection bug fix + dead-code removal |
| `cccc289f` | tests — `drawBBoxTool` lifecycle + 2D scene geometry |

> History note: an earlier temporal/video-clock experiment and a keypoints tool were
> built and then **removed via a history rewrite** at the team's request (descoped). The
> branch was force-pushed once; a `backup/refactor-pre-rewrite` tag preserves the prior
> state.

The branch then went through **three review rounds**. Notable findings fixed:

- **Cross-view delete (data loss).** `ViewScopedAnnotations.selected`/`selectedId` were
  unfiltered while `items`/`find` were view-scoped → in a multi-camera record, one
  widget's enabled Delete button could delete *another view's* box with no visible
  selection. Fixed: selection reads are now view-scoped too.
- **Half-done edit dedup + leaky abstraction.** The "patch a pending create in place"
  path was duplicated across the 2D renderer and 3D widget and mutated queue internals
  directly. Fixed: `MutationQueue.upsertUpdate` + `patchPendingCreate` own it.
- **Dead code.** `AnnotationStore.markPersisted` had no production caller (the queue
  flips `persisted` via `LocalAnnotationLocator`); removed.

---

## 6. SOLID scorecard

- **OCP — the headline win.** New kinds = module + registry line; the registries are
  closed for modification. Verified by building keypoints this way.
- **SRP / ISP / DIP — strong.** Narrow interfaces everywhere (`MutationSink`,
  `SeedListGateway`, `AnnotationStore`, `LocalAnnotationLocator`, `Scene2DContext`);
  tools/renderers depend on the context interface, never `WorkspaceManager`.
- **LSP** — `AnnotationCollection` and `ViewScopedAnnotations` are now consistently
  substitutable (the selection-scoping fix closed the last gap).

---

## 7. Known debts (tracked in `ARCHITECTURE.md`) — read before extending

These are **accepted weaker designs with a recorded fix-later** — not oversights:

- **DEBT-1** — bbox *edit* input still lives in `bboxRenderer2D` (transformer + drag
  commit), so a renderer writes. Move into the select tool + give renderers a read-only
  context. *Target: before mask RLE.*
- **DEBT-2** — the 3D write-path lives in `PointCloudWidget` (not a Tool3D handler), so
  the 3D pipeline isn't open/closed. Introduce `Scene3DContext` + a `Tool3D` handler.
  *Target: at the 2nd 3D kind.*
- **DEBT-3** — no renderer `sync()` tests (needs a Konva/Threlte mock harness).
- **DEBT-4** — **3D boxes can't be deleted** (no button/key/`remove` in the 3D pipeline;
  the helper supports it, just unwired). Needs a UX decision. *Target: next point-cloud
  pass, before GA.*

---

## 8. What reviewers/QA should check before merge

- **Multi-camera record:** select/edit/save/delete a 2D box in one camera widget and
  confirm no effect on the others (the cross-view bug class).
- **3D box flow:** draw → drag gizmos/rotate/resize → Save → reload (unit tests can't
  drive Threlte). Note **you cannot delete a 3D box yet** (DEBT-4).
- **Mixed record:** a 3D box's presence in the image widget's store is expected (it's
  record-scoped) but currently unrendered in 2D until the projection renderer lands.
- **Baselines:** `vitest run` (217 green), `pnpm run check` (43, no new), `pnpm run build`.

---

## 9. TL;DR for the team

We turned two monolithic annotation widgets into a plugin system: **one shared
record-scoped data model**, and per-kind **tools / renderers / payload-builders /
seed-loaders** registered in flat lists. Adding an annotation kind is now a self-contained
folder plus a few registry lines, with no edits to widgets or the save queue — proven by
adding (then descoping) keypoints. 2D and 3D stay separate by design and share only the
data. The work is split into reviewable phased commits, went through three review rounds
(catching a real multi-camera data-loss bug), and is fully test-backed at the seams, with
four honestly-tracked debts (the biggest: 3D delete isn't wired, and 3D editing isn't yet
behind a tool handler).
