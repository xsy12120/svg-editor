import boxPlugin, {
  boxPluginManifest
} from "@svgframe/plugin-shape-box";
import dirPlugin, {
  dirPluginManifest
} from "@svgframe/plugin-command-dir";
import statsPlugin, {
  statsPluginManifest
} from "@svgframe/plugin-command-stats";
import boxTypeLabelPlugin, {
  boxTypeLabelManifest
} from "@svgframe/plugin-tree-box-label";
import modifiedStarPlugin, {
  modifiedStarManifest
} from "@svgframe/plugin-tree-star";

export const codePlugins = [
  { plugin: statsPlugin, manifest: statsPluginManifest },
  { plugin: dirPlugin, manifest: dirPluginManifest },
  { plugin: boxPlugin, manifest: boxPluginManifest },
  {
    plugin: boxTypeLabelPlugin,
    manifest: boxTypeLabelManifest
  },
  {
    plugin: modifiedStarPlugin,
    manifest: modifiedStarManifest
  }
];
