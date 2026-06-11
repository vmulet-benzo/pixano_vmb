/*-------------------------------------
Copyright: CEA-LIST/DIASI/SIALV/LVA
Author : pixano@cea.fr
License: CECILL-C
-------------------------------------*/

import type { ToolDefinition } from "./toolDefinition.js";

/** Id of the default (navigate) 3D tool. */
export const DEFAULT_TOOL_3D = "navigate";

/**
 * A 3D tool. Today this is toolbar metadata only: the pointer handling for
 * the single 3D kind lives in its editor service (`kinds/3d/bbox3d/
 * boxEditor.svelte.ts`), which is constructed inside the Threlte scene where
 * the camera and controls exist. A `createHandler(ctx: Scene3DContext)`
 * factory mirroring `Tool2D` should be introduced when a second 3D kind
 * needs to share the scene.
 */
export type Tool3D = ToolDefinition;
