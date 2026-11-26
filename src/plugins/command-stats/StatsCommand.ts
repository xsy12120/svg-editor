import type {
  CommandResult,
  EditorCommandContext,
  EditorShapeContext,
  QueryCommand
} from "../../plugin-api/index.js";

export class StatsCommand implements QueryCommand<EditorCommandContext> {
  readonly kind = "query";

  validate(context: EditorCommandContext): void {
    if (context.document === null) {
      throw new Error("no document. use 'init' or 'read' first");
    }
  }

  execute(context: EditorCommandContext): CommandResult {
    const document = context.document;
    if (document === null) {
      throw new Error("no document. use 'init' or 'read' first");
    }

    const counts = new Map<string, number>();
    let containers = 0;
    let total = 0;

    const visit = (shape: EditorShapeContext): void => {
      const children = shape.children;
      if (children !== undefined) {
        containers += 1;
        for (const child of children) {
          visit(child);
        }
        return;
      }

      const typeName = shape.toDescriptor().typeName;
      counts.set(typeName, (counts.get(typeName) ?? 0) + 1);
      total += 1;
    };

    for (const shape of document.shapes) {
      visit(shape);
    }

    const segments = [...counts.entries()].map(
      ([typeName, count]) => `${typeName}: ${count}`
    );
    const countsText =
      segments.length === 0 ? "" : `${segments.join("  ")}  `;
    return {
      success: true,
      message: `${countsText}(total ${total}, containers ${containers})`,
      affectedIds: []
    };
  }
}
