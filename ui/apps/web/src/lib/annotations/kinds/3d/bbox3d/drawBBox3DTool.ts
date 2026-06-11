/*-------------------------------------
Copyright: CEA-LIST/DIASI/SIALV/LVA
Author : pixano@cea.fr
License: CECILL-C
-------------------------------------*/

import { Box } from "lucide-svelte";

import type { Tool3D } from "$lib/annotations/tools/types3d.js";

/**
 * Toolbar entry for 3D box drawing/editing. While this tool is active the
 * kind's editor service (`boxEditor.svelte.ts`, constructed inside the
 * Threlte scene) owns the pointer interaction: clicking empty space places
 * a new box, clicking an existing box starts editing it.
 */
export const drawBBox3DTool: Tool3D = {
  id: "draw-bbox3d",
  label: "Draw 3D box",
  icon: Box,
  kind: "bbox3d",
  cursor: "crosshair",
};
