import type {
  Shape,
  ShapeAttribute,
  ShapeDescriptor
} from "svg-editor-pj1/plugin-api";
import { ContainerShape, Rect, Text } from "svg-editor-pj1/plugin-api";

export class Box extends ContainerShape {
  constructor(
    id: string,
    readonly body: Rect,
    readonly label: Text,
    additionalChildren: readonly Shape[] = []
  ) {
    super(id);
    this.addChild(body);
    this.addChild(label);
    for (const child of additionalChildren) {
      this.addChild(child);
    }
  }

  override get canUngroup(): boolean {
    return false;
  }

  override get semanticTypeName(): string {
    return "box";
  }

  override get creationDetails(): readonly string[] {
    return [
      `g#${this.id}`,
      `rect#${this.body.id}`,
      `text#${this.label.id}`
    ];
  }

  override get svgTagName(): string {
    return "g";
  }

  override toSvgAttributes(): readonly ShapeAttribute[] {
    return [{ name: "data-kind", value: "box" }];
  }

  override getAttribute(name: string): string | undefined {
    if (name === "fill") {
      return this.body.getAttribute("fill");
    }
    if (name === "label") {
      return this.label.getAttribute("text");
    }
    throw new Error(`unknown attribute: ${name}`);
  }

  override setAttribute(name: string, value: string | undefined): void {
    if (name === "fill") {
      this.body.setAttribute("fill", value);
      return;
    }
    if (name === "label" && value !== undefined) {
      this.label.setAttribute("text", value);
      return;
    }
    throw new Error(`unknown attribute: ${name}`);
  }

  override toDescriptor(): ShapeDescriptor {
    return {
      typeName: "g",
      id: this.id,
      attributes: []
    };
  }

  override validateChildRemoval(child: Shape): void {
    if (child.id === this.body.id || child.id === this.label.id) {
      throw new Error(`cannot remove required child: ${child.id}`);
    }
  }
}
