export default {
  activate(context) {
    context.registerCommand({
      name: "fixture-good",
      usage: "duplicate",
      create() {
        return {
          kind: "query",
          validate() {},
          execute() {
            return {
              success: true,
              message: "duplicate",
              affectedIds: []
            };
          }
        };
      }
    });
  }
};
