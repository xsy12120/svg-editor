import type {
  PluginManifest,
  SvgPlugin
} from "svg-editor-pj1/plugin-api";

import { BoxAttributeHandler } from "./BoxAttributeHandler.js";
import { BoxProvider } from "./BoxProvider.js";

export const boxPluginManifest: PluginManifest = {
  name: "@svgframe/plugin-shape-box",
  contributes: {
    shapes: ["box"],
    attributes: ["box-attributes"]
  }
};

export const boxPlugin: SvgPlugin = {
  activate(context): void {
    context.registerShape(new BoxProvider());
    context.registerAttributeHandler(new BoxAttributeHandler());
  }
};

export { Box } from "./Box.js";
export { BoxAttributeHandler } from "./BoxAttributeHandler.js";
export { BoxProvider } from "./BoxProvider.js";
export default boxPlugin;
