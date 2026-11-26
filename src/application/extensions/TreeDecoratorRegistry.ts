import type {
  TreeDecorationContext,
  TreeDecorator,
  TreeDecorationResolver,
  TreeDecorationTarget
} from "./TreeDecorator.js";

export class TreeDecoratorRegistry implements TreeDecorationResolver {
  private readonly decorators = new Map<string, TreeDecorator>();

  register(decorator: TreeDecorator): void {
    if (this.decorators.has(decorator.name)) {
      throw new Error(
        `tree decorator already registered: ${decorator.name}`
      );
    }
    this.decorators.set(decorator.name, decorator);
  }

  decorate(
    target: TreeDecorationTarget,
    context: TreeDecorationContext
  ): readonly string[] {
    return [...this.decorators.values()]
      .sort(
        (left, right) =>
          left.priority - right.priority ||
          compareNames(left.name, right.name)
      )
      .flatMap((decorator) => decorator.decorate(target, context));
  }
}

function compareNames(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
