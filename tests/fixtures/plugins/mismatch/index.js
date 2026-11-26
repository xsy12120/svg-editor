export default {
  activate(context) {
    context.registerCommand({
      name: "actual-command",
      usage: "actual-command",
      create() {
        return {
          kind: "query",
          validate() {},
          execute() {
            return {
              success: true,
              message: "actual",
              affectedIds: []
            };
          }
        };
      }
    });
  }
};
