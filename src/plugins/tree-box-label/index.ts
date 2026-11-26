import type {
  PluginManifest,
  SvgPlugin
} from "svg-editor-pj1/plugin-api";

import { BoxTypeLabelDecorator } from "./BoxTypeLabelDecorator.js";

const decorator = new BoxTypeLabelDecorator();

export const boxTypeLabelManifest: PluginManifest = {
  name: "@svgframe/plugin-tree-box-label",
  contributes: {
    decorators: ["box-type-label"]
  }
};

export const boxTypeLabelPlugin: SvgPlugin = {
  activate(context): void {
    context.registerTreeDecorator(decorator);
  }
};

export const boxTypeLabelDecorator = decorator;
export { BoxTypeLabelDecorator };
export default boxTypeLabelPlugin;
