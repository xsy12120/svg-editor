import type { TreeDecorator } from "svg-editor-pj1/plugin-api";

export class BoxTypeLabelDecorator implements TreeDecorator {
  readonly name = "box-type-label";
  readonly priority = 10;

  decorate(target: {
    readonly semanticTypeName: string;
  }): readonly string[] {
    return target.semanticTypeName === "box" ? ["(box)"] : [];
  }
}
