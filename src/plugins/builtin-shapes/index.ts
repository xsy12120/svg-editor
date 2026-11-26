import type {
  PluginContributions,
  PluginManifest,
  SvgPlugin
} from "../../plugin-api/index.js";

import { CircleProvider } from "./CircleProvider.js";
import { EllipseProvider } from "./EllipseProvider.js";
import { GroupProvider } from "./GroupProvider.js";
import { LineProvider } from "./LineProvider.js";
import { RectProvider } from "./RectProvider.js";
import { TextProvider } from "./TextProvider.js";

const contributions: PluginContributions = {
  shapes: ["circle", "ellipse", "g", "line", "rect", "text"]
};

export const builtinShapesManifest: PluginManifest = {
  name: "@svgframe/plugin-builtin-shapes",
  contributes: contributions
};

export const builtinShapesPlugin: SvgPlugin = {
  activate(context): void {
    context.registerShape(new CircleProvider());
    context.registerShape(new EllipseProvider());
    context.registerShape(new GroupProvider());
    context.registerShape(new LineProvider());
    context.registerShape(new RectProvider());
    context.registerShape(new TextProvider());
  }
};

export {
  CircleProvider,
  EllipseProvider,
  GroupProvider,
  LineProvider,
  RectProvider,
  TextProvider
};

export default builtinShapesPlugin;
