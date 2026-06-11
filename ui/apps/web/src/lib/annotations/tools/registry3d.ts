/*-------------------------------------
Copyright: CEA-LIST/DIASI/SIALV/LVA
Author : pixano@cea.fr
License: CECILL-C
-------------------------------------*/

import { MousePointer2 } from "lucide-svelte";

import { drawBBox3DTool } from "../kinds/3d/bbox3d/drawBBox3DTool.js";
import { DEFAULT_TOOL_3D, type Tool3D } from "./types3d.js";

/** Default 3D tool: orbit/pan the camera, no annotation interaction. */
const navigateTool3D: Tool3D = {
  id: DEFAULT_TOOL_3D,
  label: "Navigate",
  icon: MousePointer2,
};

/**
 * Every 3D tool, in toolbar order. Adding a 3D annotation kind means adding
 * its tool import here — widgets render their toolbar from this list and
 * never reference individual tools.
 */
export const TOOLS_3D: readonly Tool3D[] = [navigateTool3D, drawBBox3DTool];

export { DEFAULT_TOOL_3D } from "./types3d.js";
