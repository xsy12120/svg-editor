import type {
  PluginManifest,
  SvgPlugin
} from "svg-editor-pj1/plugin-api";

import { ModifiedStarDecorator } from "./ModifiedStarDecorator.js";

const decorator = new ModifiedStarDecorator();

export const modifiedStarManifest: PluginManifest = {
  name: "@svgframe/plugin-tree-star",
  contributes: {
    decorators: ["modified-star"]
  }
};

export const modifiedStarPlugin: SvgPlugin = {
  activate(context): void {
    context.registerTreeDecorator(decorator);
  }
};

export const modifiedStarDecorator = decorator;
export { ModifiedStarDecorator };
export default modifiedStarPlugin;
