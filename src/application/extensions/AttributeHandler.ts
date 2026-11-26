import type { Shape } from "../../domain/shapes/Shape.js";

export interface AttributeChange {
  readonly affectedIds: readonly string[];
  readonly message: string;
  readonly undoMessage: string;
  apply(): void;
  revert(): void;
}

export interface AttributeHandler {
  readonly name: string;
  handles(shape: Shape, attribute: string): boolean;
  prepare(
    shape: Shape,
    attribute: string,
    value: string
  ): AttributeChange;
}

export interface AttributeHandlerResolver {
  resolve(shape: Shape, attribute: string): AttributeHandler | undefined;
}
