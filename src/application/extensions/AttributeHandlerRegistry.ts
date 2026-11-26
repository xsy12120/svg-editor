import type { Shape } from "../../domain/shapes/Shape.js";
import type {
  AttributeHandler,
  AttributeHandlerResolver
} from "./AttributeHandler.js";

export class AttributeHandlerRegistry implements AttributeHandlerResolver {
  private readonly handlers = new Map<string, AttributeHandler>();

  register(handler: AttributeHandler): void {
    if (this.handlers.has(handler.name)) {
      throw new Error(
        `attribute handler already registered: ${handler.name}`
      );
    }
    this.handlers.set(handler.name, handler);
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  resolve(shape: Shape, attribute: string): AttributeHandler | undefined {
    const matches = [...this.handlers.values()].filter((handler) =>
      handler.handles(shape, attribute)
    );
    if (matches.length > 1) {
      throw new Error(
        `multiple attribute handlers: ${shape.id}/${attribute}`
      );
    }
    return matches[0];
  }
}
