import type { Shape } from "../../domain/shapes/Shape.js";
import type { SvgShapeReader } from "../ports/SvgShapeReader.js";
import type { ShapeCatalog } from "./ShapeCatalog.js";
import type { ShapeProvider } from "./ShapeProvider.js";
import type { ShapeInit } from "./ShapeInit.js";

export class ShapeFactory implements ShapeCatalog, SvgShapeReader {
  private readonly providers = new Map<string, ShapeProvider>();

  register(provider: ShapeProvider): void {
    if (this.providers.has(provider.typeName)) {
      throw new Error(`shape type already registered: ${provider.typeName}`);
    }

    this.providers.set(provider.typeName, provider);
  }

  create(init: ShapeInit): Shape {
    const shape = this.requireProvider(init.typeName).create(init);
    for (const name of ["fill", "stroke", "stroke-width"]) {
      const value = init.attributes[name];
      if (value !== undefined) {
        shape.setAttribute(name, value);
      }
    }
    return shape;
  }

  createFromCliArgs(typeName: string, args: readonly string[]): Shape {
    const provider = this.requireProvider(typeName);
    return this.create(provider.createFromCliArgs(args));
  }

  resolveSvgType(element: {
    readonly tagName: string;
    readonly attributes: Readonly<Record<string, string>>;
  }): string {
    const matches = [...this.providers.values()].filter((provider) =>
      provider.matchesSvgElement(element)
    );
    if (matches.length === 0) {
      throw new Error(`unknown SVG element type: ${element.tagName}`);
    }

    const highestPriority = Math.max(
      ...matches.map((provider) => provider.svgMatchPriority ?? 0)
    );
    const selected = matches.filter(
      (provider) => (provider.svgMatchPriority ?? 0) === highestPriority
    );
    if (selected.length > 1) {
      throw new Error(
        `ambiguous SVG element providers: ${element.tagName}`
      );
    }

    const provider = selected[0];
    if (provider === undefined) {
      throw new Error(`unknown SVG element type: ${element.tagName}`);
    }
    return provider.typeName;
  }

  private requireProvider(typeName: string): ShapeProvider {
    const provider = this.providers.get(typeName);
    if (provider === undefined) {
      throw new Error(`unknown shape type: ${typeName} (is the plugin loaded?)`);
    }

    return provider;
  }
}
