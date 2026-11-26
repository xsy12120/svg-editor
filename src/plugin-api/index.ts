export type {
  AttributeChange,
  AttributeHandler,
  AttributeHandlerResolver
} from "../application/extensions/AttributeHandler.js";
export type {
  EditorCommandContext,
  EditorDocumentContext,
  EditorShapeContext
} from "../application/context/EditorCommandContext.js";
export type { Command } from "../application/commands/Command.js";
export type { CommandResult } from "../application/commands/CommandResult.js";
export type {
  ControlCommand,
  DocumentCommand,
  ExecutableCommand,
  QueryCommand
} from "../application/commands/ExecutableCommand.js";
export type { PreparedEdit } from "../application/commands/PreparedEdit.js";
export type { UndoableCommand } from "../application/commands/UndoableCommand.js";
export type {
  CommandHelpEntry,
  CommandLookup
} from "../application/extensions/CommandLookup.js";
export type { CommandProvider } from "../application/extensions/CommandProvider.js";
export type {
  TreeDecorationContext,
  TreeDecorator,
  TreeDecorationResolver,
  TreeDecorationTarget
} from "../application/extensions/TreeDecorator.js";
export type { ShapeCatalog } from "../application/shapes/ShapeCatalog.js";
export type { ShapeInit } from "../application/shapes/ShapeInit.js";
export type { ShapeProvider } from "../application/shapes/ShapeProvider.js";
export type {
  PluginActivationResult,
  PluginContributions,
  PluginManifest,
  PluginOptions,
  PluginRegistrationContext,
  SvgPlugin
} from "./Plugin.js";
export type {
  SvgElementDescriptor,
  SvgShapeReader
} from "../application/ports/SvgShapeReader.js";
export type { Document } from "../domain/model/Document.js";
export { Circle } from "../domain/shapes/Circle.js";
export { ContainerShape } from "../domain/shapes/ContainerShape.js";
export { Ellipse } from "../domain/shapes/Ellipse.js";
export { Group } from "../domain/shapes/Group.js";
export { Line } from "../domain/shapes/Line.js";
export { Rect } from "../domain/shapes/Rect.js";
export { Shape } from "../domain/shapes/Shape.js";
export { Text } from "../domain/shapes/Text.js";
export type {
  ShapeAttribute,
  ShapeDescriptor
} from "../domain/shapes/ShapeDescriptor.js";
