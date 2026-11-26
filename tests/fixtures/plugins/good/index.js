export default {
  activate(context, options) {
    const suffix =
      typeof options?.suffix === "string" ? ` [${options.suffix}]` : "";
    context.registerCommand({
      name: "fixture-good",
      usage: "fixture-good [text]",
      create(args) {
        return {
          kind: "query",
          validate() {},
          execute() {
            return {
              success: true,
              message: `fixture-good ${args.join(" ")}${suffix}`,
              affectedIds: []
            };
          }
        };
      }
    });
  }
};
