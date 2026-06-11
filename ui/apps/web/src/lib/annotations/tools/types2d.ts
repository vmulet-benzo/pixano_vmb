/*-------------------------------------
Copyright: CEA-LIST/DIASI/SIALV/LVA
Author : pixano@cea.fr
License: CECILL-C
-------------------------------------*/

import type Konva from "konva";
import type { IconProps } from "lucide-svelte";
import type { ComponentType, SvelteComponent } from "svelte";

import type { AnnotationCollection, AnnotationKind } from "../annotationCollection.svelte.js";
import type { BuildContext } from "../buildPayloads.js";
import type { ResourceMutation } from "../types.js";

/**
 * Id of the default (select) tool. Lives here rather than in the registry so
 * konva-free modules (extensions, tests) can import it without dragging the
 * tool implementations — and their Konva dependency — into their bundle.
 */
export const DEFAULT_TOOL_2D = "select";

/**
 * Metadata shared by every tool, 2D or 3D. This is the only type the two
 * scene families have in common (docs/ARCHITECTURE.md, decision D3).
 */
export interface ToolDefinition {
  /** Unique id, e.g. "select", "draw-bbox". */
  id: string;
  /** Toolbar tooltip text. */
  label: string;
  /** Lucide icon component rendered in the toolbar. */
  icon: ComponentType<SvelteComponent<IconProps>>;
  /** Annotation kind this tool produces; omitted for kind-agnostic tools. */
  kind?: AnnotationKind;
  /** CSS cursor applied to the canvas while the tool is active. */
  cursor?: string;
}

/**
 * Narrow view of the mutation queue handed to tools: enough to queue work
 * and reconcile pending creates, nothing more.
 */
export interface MutationSink {
  readonly pending: readonly ResourceMutation[];
  queue(mutation: ResourceMutation): void;
  dropForLocalAnnotation(localAnnotationId: string): void;
}

/**
 * Everything a 2D tool handler may touch. The widget builds one per
 * instance; tools and renderers depend on this interface, never on the
 * widget or the WorkspaceManager directly.
 */
export interface Scene2DContext {
  readonly widgetId: string;
  readonly buildContext: BuildContext;
  readonly collection: AnnotationCollection;
  readonly mutations: MutationSink;
  readonly stage: Konva.Stage;
  readonly annotationLayer: Konva.Layer;
  getKonvaImage(): Konva.Image | null;
  /** Switch the widget's active tool (e.g. back to "select" after a draw). */
  setActiveTool(id: string): void;
  /** Ask the widget to re-sync annotation rendering. */
  requestRedraw(): void;
  /**
   * Delete the selected annotation (queues the backend mutations).
   * Temporary seam: moves into per-kind modules with the payload-builder
   * registry (Phase 4).
   */
  deleteSelected(): void;
}

/** Per-activation handler instance created by a tool for one widget. */
export interface ToolHandler2D {
  activate?(): void;
  deactivate?(): void;
  onPointerDown?(event: Konva.KonvaEventObject<MouseEvent>): void;
  onPointerMove?(event: Konva.KonvaEventObject<MouseEvent>): void;
  onPointerUp?(event: Konva.KonvaEventObject<MouseEvent>): void;
  /** Return true when the event was consumed. */
  onKeyDown?(event: KeyboardEvent): boolean | void;
}

/** A 2D tool: toolbar metadata plus a handler factory. */
export interface Tool2D extends ToolDefinition {
  createHandler(ctx: Scene2DContext): ToolHandler2D;
}
