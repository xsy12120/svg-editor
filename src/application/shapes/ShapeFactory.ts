import type { Shape } from "../../domain/shapes/Shape.js";
import type {
  SvgShapeReadRequest,
  SvgShapeReader
} from "../ports/SvgShapeReader.js";
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

  has(typeName: string): boolean {
    return this.providers.has(typeName);
  }

  create(init: ShapeInit): Shape {
    return this.requireProvider(init.typeName).create(init);
  }

  readSvgElement(request: SvgShapeReadRequest): Shape {
    return this.resolveSvgProvider(request.element).createFromSvg(
      request
    );
  }

  createFromCliArgs(typeName: string, args: readonly string[]): Shape {
    const provider = this.requireProvider(typeName);
    return this.create(provider.createFromCliArgs(args));
  }

  resolveSvgType(element: {
    readonly tagName: string;
    readonly attributes: Readonly<Record<string, string>>;
  }): string {
    return this.resolveSvgProvider(element).typeName;
  }

  private resolveSvgProvider(element: {
    readonly tagName: string;
    readonly attributes: Readonly<Record<string, string>>;
  }): ShapeProvider {
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
    return provider;
  }

  private requireProvider(typeName: string): ShapeProvider {
    const provider = this.providers.get(typeName);
    if (provider === undefined) {
      throw new Error(`unknown shape type: ${typeName} (is the plugin loaded?)`);
    }

    return provider;
  }
}
