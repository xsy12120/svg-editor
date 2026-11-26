import type {
  TreeDecorationContext,
  TreeDecorator,
  TreeDecorationTarget
} from "svg-editor-pj1/plugin-api";

export class ModifiedStarDecorator implements TreeDecorator {
  readonly name = "modified-star";
  readonly priority = 20;

  private documentDirty = false;
  private readonly changedIds = new Set<string>();

  decorate(
    target: TreeDecorationTarget,
    context: TreeDecorationContext
  ): readonly string[] {
    this.documentDirty = context.changes.isDirty;
    this.changedIds.clear();
    for (const id of context.changes.changedIds) {
      this.changedIds.add(id);
    }

    if (target.isRoot) {
      return this.documentDirty ? ["*"] : [];
    }
    return this.changedIds.has(target.id) ? ["*"] : [];
  }
}
