import type { Readable, Writable } from "node:stream";

import { EditorSession } from "../application/EditorSession.js";
import { AddToCommandProvider } from "../application/commands/AddToCommandProvider.js";
import { BackCommandProvider } from "../application/commands/BackCommandProvider.js";
import { CanvasCommandProvider } from "../application/commands/CanvasCommandProvider.js";
import { CreateCommandProvider } from "../application/commands/CreateCommandProvider.js";
import { DeleteCommandProvider } from "../application/commands/DeleteCommandProvider.js";
import { FrontCommandProvider } from "../application/commands/FrontCommandProvider.js";
import { GroupCommandProvider } from "../application/commands/GroupCommandProvider.js";
import { HelpCommandProvider } from "../application/commands/HelpCommandProvider.js";
import { InitCommandProvider } from "../application/commands/InitCommandProvider.js";
import { MoveCommandProvider } from "../application/commands/MoveCommandProvider.js";
import { ReadDocumentCommandProvider } from "../application/commands/ReadDocumentCommandProvider.js";
import { RedoCommandProvider } from "../application/commands/RedoCommandProvider.js";
import { SaveDocumentCommandProvider } from "../application/commands/SaveDocumentCommandProvider.js";
import { ScaleCommandProvider } from "../application/commands/ScaleCommandProvider.js";
import { SetAttributeCommandProvider } from "../application/commands/SetAttributeCommandProvider.js";
import { ShowCommandProvider } from "../application/commands/ShowCommandProvider.js";
import { TreeCommandProvider } from "../application/commands/TreeCommandProvider.js";
import { UngroupCommandProvider } from "../application/commands/UngroupCommandProvider.js";
import { UndoCommandProvider } from "../application/commands/UndoCommandProvider.js";
import { CommandRegistry } from "../application/extensions/CommandRegistry.js";
import { AttributeHandlerRegistry } from "../application/extensions/AttributeHandlerRegistry.js";
import { TreeDecoratorRegistry } from "../application/extensions/TreeDecoratorRegistry.js";
import { CommandInvoker } from "../application/history/CommandInvoker.js";
import { CommandProcessor } from "../application/history/CommandProcessor.js";
import { ShapeDetailsSnapshotBuilder } from "../application/queries/ShapeDetailsSnapshotBuilder.js";
import { TreeSnapshotBuilder } from "../application/queries/TreeSnapshotBuilder.js";
import { ShapeFactory } from "../application/shapes/ShapeFactory.js";
import { CliApplication } from "../interfaces/cli/CliApplication.js";
import { CliPresenter } from "../interfaces/cli/CliPresenter.js";
import { CliShapeDetailsRenderer } from "../interfaces/cli/CliShapeDetailsRenderer.js";
import { CliTreeRenderer } from "../interfaces/cli/CliTreeRenderer.js";
import { CliPluginDiagnosticFormatter } from "../interfaces/cli/CliPluginDiagnosticFormatter.js";
import { NodeFileStore } from "../infrastructure/fs/NodeFileStore.js";
import { NodeDirectoryReader } from "../infrastructure/fs/NodeDirectoryReader.js";
import { XmlSvgCodec } from "../infrastructure/svg/XmlSvgCodec.js";
import { PluginHost } from "../host/PluginHost.js";
import { PluginLoader } from "../host/PluginLoader.js";
import {
  builtinShapesManifest,
  builtinShapesPlugin
} from "../plugins/builtin-shapes/index.js";

export interface CreateCliApplicationOptions {
  readonly configPath?: string;
}

export async function createCliApplication(
  input: Readable,
  output: Writable,
  options: CreateCliApplicationOptions = {}
): Promise<CliApplication> {
  const session = new EditorSession();
  const invoker = new CommandInvoker(session);
  const processor = new CommandProcessor(invoker);
  const commands = new CommandRegistry<EditorSession>();
  const attributeHandlers = new AttributeHandlerRegistry();
  const treeDecorators = new TreeDecoratorRegistry();
  const files = new NodeFileStore();
  const directories = new NodeDirectoryReader();
  const shapes = new ShapeFactory();
  const pluginHost = new PluginHost(
    {
      shapes,
      commands,
      decorators: treeDecorators,
      attributes: attributeHandlers
    },
    { directoryReader: directories }
  );
  const diagnosticFormatter = new CliPluginDiagnosticFormatter();
  const builtinResult = pluginHost.activate(
    builtinShapesPlugin,
    builtinShapesManifest
  );
  if (!builtinResult.success) {
    throw new Error(
      diagnosticFormatter.format(builtinResult.diagnostic)
    );
  }
  const svgCodec = new XmlSvgCodec(shapes);

  commands.register(new InitCommandProvider());
  commands.register(new ReadDocumentCommandProvider(files, svgCodec));
  commands.register(new SaveDocumentCommandProvider(files, svgCodec));
  commands.register(new CanvasCommandProvider());
  commands.register(new CreateCommandProvider(shapes));
  commands.register(new MoveCommandProvider());
  commands.register(new ScaleCommandProvider());
  commands.register(new SetAttributeCommandProvider(attributeHandlers));
  commands.register(new DeleteCommandProvider());
  commands.register(new GroupCommandProvider());
  commands.register(new UngroupCommandProvider());
  commands.register(new AddToCommandProvider());
  commands.register(new FrontCommandProvider());
  commands.register(new BackCommandProvider());
  commands.register(
    new TreeCommandProvider(new TreeSnapshotBuilder(treeDecorators))
  );
  commands.register(
    new ShowCommandProvider(new ShapeDetailsSnapshotBuilder())
  );
  commands.register(new UndoCommandProvider(invoker));
  commands.register(new RedoCommandProvider(invoker));
  commands.register(new HelpCommandProvider(commands));

  if (options.configPath !== undefined) {
    const loader = new PluginLoader(pluginHost);
    const result = await loader.loadConfigFile(options.configPath);
    for (const diagnostic of result.diagnostics) {
      output.write(`${diagnosticFormatter.format(diagnostic)}\n`);
    }
  }

  const treeRenderer = new CliTreeRenderer();
  const shapeDetailsRenderer = new CliShapeDetailsRenderer();
  return new CliApplication(
    input,
    output,
    commands,
    processor,
    new CliPresenter(output, treeRenderer, shapeDetailsRenderer)
  );
}
