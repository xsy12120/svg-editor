import type {
  Shape,
  ShapeInit,
  ShapeProvider,
  SvgShapeReadRequest
} from "svg-editor-pj1/plugin-api";
import { Rect, Text } from "svg-editor-pj1/plugin-api";

import { Box } from "./Box.js";

const DEFAULT_FILL = "#4a90d9";

export class BoxProvider implements ShapeProvider {
  readonly typeName = "box";
  readonly svgMatchPriority = 10;

  matchesSvgElement(element: {
    readonly tagName: string;
    readonly attributes: Readonly<Record<string, string>>;
  }): boolean {
    return (
      element.tagName === "g" &&
      element.attributes["data-kind"] === "box"
    );
  }

  createFromCliArgs(args: readonly string[]): ShapeInit {
    if (args.length !== 6) {
      throw new Error(
        'usage: create box <id> <x> <y> <width> <height> "<label>"'
      );
    }
    const [id, x, y, width, height, label] = args;
    if (id === undefined || id.length === 0) {
      throw new Error("box id is required");
    }
    return {
      typeName: this.typeName,
      id,
      attributes: {
        x: requireValue(x, "box x"),
        y: requireValue(y, "box y"),
        width: requireValue(width, "box width"),
        height: requireValue(height, "box height"),
        label: requireValue(label, "box label")
      }
    };
  }

  create(init: ShapeInit): Shape {
    if (init.typeName !== this.typeName) {
      throw new Error(
        `box provider cannot create shape type: ${init.typeName}`
      );
    }
    const x = parseFinite(init.attributes["x"], "box x");
    const y = parseFinite(init.attributes["y"], "box y");
    const width = parsePositive(init.attributes["width"], "box width");
    const height = parsePositive(init.attributes["height"], "box height");
    const label = requireValue(init.attributes["label"], "box label");
    const body = new Rect({
      id: `${init.id}-rect`,
      x,
      y,
      width,
      height
    });
    body.setAttribute(
      "fill",
      init.attributes["fill"] ?? DEFAULT_FILL
    );
    return new Box(
      init.id,
      body,
      new Text({
        id: `${init.id}-label`,
        x: x + 20,
        y: y + 35,
        content: label
      })
    );
  }

  createFromSvg(request: SvgShapeReadRequest): Shape {
    const body = request.children.find(
      (child) => child.id === `${request.id}-rect`
    );
    const label = request.children.find(
      (child) => child.id === `${request.id}-label`
    );
    if (!(body instanceof Rect) || !(label instanceof Text)) {
      throw new Error(`invalid box: ${request.id}`);
    }
    const additional = request.children.filter(
      (child) => child !== body && child !== label
    );
    return new Box(request.id, body, label, additional);
  }
}

function requireValue(
  value: string | undefined,
  name: string
): string {
  if (value === undefined) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseFinite(
  value: string | undefined,
  name: string
): number {
  const parsed = Number(requireValue(value, name));
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a finite number`);
  }
  return parsed;
}

function parsePositive(
  value: string | undefined,
  name: string
): number {
  const parsed = parseFinite(value, name);
  if (parsed <= 0) {
    throw new Error(`${name} must be positive`);
  }
  return parsed;
}
