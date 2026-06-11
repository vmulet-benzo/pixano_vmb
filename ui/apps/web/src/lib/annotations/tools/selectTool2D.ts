/*-------------------------------------
Copyright: CEA-LIST/DIASI/SIALV/LVA
Author : pixano@cea.fr
License: CECILL-C
-------------------------------------*/

import { MousePointer2 } from "lucide-svelte";

import { DEFAULT_TOOL_2D, type Scene2DContext, type Tool2D, type ToolHandler2D } from "./types2d.js";

/**
 * Default 2D tool: click an annotation to select it (the renderer's nodes
 * handle their own click-to-select), click empty canvas to deselect,
 * Delete/Backspace removes the selection, Escape deselects.
 */
class SelectHandler2D implements ToolHandler2D {
  constructor(private readonly ctx: Scene2DContext) {}

  onPointerDown(event: Parameters<NonNullable<ToolHandler2D["onPointerDown"]>>[0]): void {
    if (event.target === this.ctx.stage) {
      this.ctx.collection.select(null);
      this.ctx.requestRedraw();
    }
  }

  onKeyDown(event: KeyboardEvent): boolean {
    if (event.key === "Escape") {
      this.ctx.collection.select(null);
      this.ctx.requestRedraw();
      return true;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && this.ctx.collection.selectedId) {
      this.ctx.deleteSelected();
      return true;
    }
    return false;
  }
}

export const selectTool2D: Tool2D = {
  id: DEFAULT_TOOL_2D,
  label: "Select / move (V)",
  icon: MousePointer2,
  createHandler: (ctx: Scene2DContext) => new SelectHandler2D(ctx),
};
