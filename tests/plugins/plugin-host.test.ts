import { describe, expect, it, vi } from "vitest";

import { EditorSession } from "../../src/application/EditorSession.js";
import { CommandRegistry } from "../../src/application/extensions/CommandRegistry.js";
import { AttributeHandlerRegistry } from "../../src/application/extensions/AttributeHandlerRegistry.js";
import { TreeDecoratorRegistry } from "../../src/application/extensions/TreeDecoratorRegistry.js";
import { ShapeFactory } from "../../src/application/shapes/ShapeFactory.js";
import { Group } from "../../src/domain/shapes/Group.js";
import type {
  PluginManifest,
  SvgPlugin
} from "../../src/plugin-api/Plugin.js";
import { PluginHost } from "../../src/host/PluginHost.js";

function commandPlugin(
  name: string,
  execute: () => string
): SvgPlugin {
  return {
    activate(context): void {
      context.registerCommand({
        name,
        usage: name,
        create(): {
          kind: "query";
          validate(): void;
          execute(): {
            success: true;
            message: string;
            affectedIds: never[];
          };
        } {
          return {
            kind: "query",
            validate(): void {},
            execute(): {
              success: true;
              message: string;
              affectedIds: never[];
            } {
              return {
                success: true,
                message: execute(),
                affectedIds: []
              };
            }
          };
        }
      });
    }
  };
}

function createHost() {
  const commands = new CommandRegistry<EditorSession>();
  const shapes = new ShapeFactory();
  const decorators = new TreeDecoratorRegistry();
  const attributes = new AttributeHandlerRegistry();
  const host = new PluginHost({
    commands,
    shapes,
    decorators,
    attributes
  });
  return { host, commands, shapes, decorators, attributes };
}

function manifest(
  name: string,
  contributes: PluginManifest["contributes"]
): PluginManifest {
  return { name, contributes };
}

describe("PluginHost", () => {
  it("commits registered contributions and passes options to activation", () => {
    const { host, commands } = createHost();
    const activate = vi.fn<SvgPlugin["activate"]>(
      (context, options) => {
        expect(options).toEqual({ value: 42 });
        commandPlugin("hello", () => "hello")?.activate(context, options);
      }
    );

    const result = host.activate(
      { activate },
      manifest("@fixture/hello", { commands: ["hello"] }),
      { value: 42 }
    );

    expect(result).toEqual({ success: true });
    expect(commands.listHelpEntries()).toContainEqual({
      name: "hello",
      usage: "hello"
    });
  });

  it("discards staged registrations when activation throws", () => {
    const { host, commands } = createHost();
    const plugin: SvgPlugin = {
      activate(context): void {
        commandPlugin("temporary", () => "temporary")?.activate(context);
        throw new Error("boom");
      }
    };

    const result = host.activate(
      plugin,
      manifest("@fixture/failure", { commands: ["temporary"] })
    );

    expect(result).toEqual({
      success: false,
      diagnostic: {
        code: "activation-failed",
        plugin: "@fixture/failure",
        reason: "boom"
      }
    });
    expect(commands.listHelpEntries()).toEqual([]);
  });

  it("rejects a manifest mismatch without committing registrations", () => {
    const { host, commands } = createHost();

    const result = host.activate(
      commandPlugin("actual-command", () => "ok"),
      manifest("@fixture/mismatch", {
        commands: ["declared-command"]
      })
    );

    expect(result).toEqual({
      success: false,
      diagnostic: {
        code: "manifest-mismatch",
        plugin: "@fixture/mismatch",
        declared: { commands: ["declared-command"] },
        registered: { commands: ["actual-command"] }
      }
    });
    expect(commands.listHelpEntries()).toEqual([]);
  });

  it("rejects duplicate registrations and preserves earlier plugins", () => {
    const { host, commands } = createHost();
    expect(
      host.activate(
        commandPlugin("duplicate", () => "first"),
        manifest("@fixture/first", { commands: ["duplicate"] })
      )
    ).toEqual({ success: true });

    const result = host.activate(
      commandPlugin("duplicate", () => "second"),
      manifest("@fixture/second", { commands: ["duplicate"] })
    );

    expect(result).toEqual({
      success: false,
      diagnostic: {
        code: "duplicate-registration",
        category: "commands",
        name: "duplicate"
      }
    });
    expect(commands.listHelpEntries()).toEqual([
      { name: "duplicate", usage: "duplicate" }
    ]);
  });

  it("commits all four registration categories", () => {
    const { host, shapes, decorators, attributes, commands } = createHost();
    const plugin: SvgPlugin = {
      activate(context): void {
        context.registerShape({
          typeName: "dummy-shape",
          svgMatchPriority: 0,
          matchesSvgElement: () => false,
          createFromCliArgs: () => ({
            typeName: "dummy-shape",
            id: "dummy",
            attributes: {}
          }),
          create: (init) => new Group(init.id),
          createFromSvg: (request) => new Group(request.id)
        });
        commandPlugin("dummy-command", () => "dummy")?.activate(context);
        context.registerTreeDecorator({
          name: "dummy-decorator",
          priority: 0,
          decorate: () => []
        });
        context.registerAttributeHandler({
          name: "dummy-attribute",
          handles: () => false,
          prepare: () => {
            throw new Error("not used");
          }
        });
      }
    };

    const result = host.activate(
      plugin,
      manifest("@fixture/all-categories", {
        shapes: ["dummy-shape"],
        commands: ["dummy-command"],
        decorators: ["dummy-decorator"],
        attributes: ["dummy-attribute"]
      })
    );

    expect(result).toEqual({ success: true });
    expect(shapes.has("dummy-shape")).toBe(true);
    expect(commands.has("dummy-command")).toBe(true);
    expect(decorators.has("dummy-decorator")).toBe(true);
    expect(attributes.has("dummy-attribute")).toBe(true);
  });
});
