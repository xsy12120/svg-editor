export default {
  activate(context) {
    context.registerCommand({
      name: "fixture-terminal",
      usage: "fixture-terminal",
      create() {
        return {
          kind: "query",
          validate() {},
          execute() {
            return {
              success: true,
              message: "fixture-terminal loaded",
              affectedIds: []
            };
          }
        };
      }
    });
  }
};
