/*-------------------------------------
Copyright: CEA-LIST/DIASI/SIALV/LVA
Author : pixano@cea.fr
License: CECILL-C
-------------------------------------*/

import { drawBBoxTool } from "../kinds/2d/bbox/drawBBoxTool.js";
import { selectTool2D } from "./selectTool2D.js";
import type { Tool2D } from "./types2d.js";

/**
 * Every 2D tool, in toolbar order. Adding an annotation kind means adding
 * its tool import here — widgets render their toolbar from this list and
 * never reference individual tools.
 */
export const TOOLS_2D: readonly Tool2D[] = [selectTool2D, drawBBoxTool];

export { DEFAULT_TOOL_2D } from "./types2d.js";

export function getTool2D(id: string): Tool2D | undefined {
  return TOOLS_2D.find((tool) => tool.id === id);
}
