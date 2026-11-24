import { beforeEach, describe, expect, it } from "vitest";

import { activate } from "../src/extension.js";
import {
  activeDocumentSymbolProviders,
  activeFileDecorationProviders,
  activeRegistrationKinds,
  createFakeExtensionContext,
  resetVscodeMock
} from "./support/vscodeMock.js";

describe("extension activation", () => {
  beforeEach(() => {
    resetVscodeMock();
  });

  it("registers one SVG badge provider and one SVG outline provider", () => {
    const context = createFakeExtensionContext();

    activate(context as never);

    expect(activeFileDecorationProviders()).toHaveLength(1);
    expect(activeDocumentSymbolProviders()).toHaveLength(1);
  });

  it("adds both provider subscriptions to the extension context", () => {
    const context = createFakeExtensionContext();

    activate(context as never);

    expect(context.subscriptions).toHaveLength(2);
    expect(activeRegistrationKinds()).toEqual([
      "file-decoration",
      "document-symbol"
    ]);
  });

  it("removes both provider registrations when the context is disposed", () => {
    const context = createFakeExtensionContext();
    activate(context as never);

    context.dispose();

    expect(activeFileDecorationProviders()).toHaveLength(0);
    expect(activeDocumentSymbolProviders()).toHaveLength(0);
    expect(activeRegistrationKinds()).toEqual([]);
  });

  it("does not leak registrations across independent activations", () => {
    const firstContext = createFakeExtensionContext();
    activate(firstContext as never);
    firstContext.dispose();

    const secondContext = createFakeExtensionContext();
    activate(secondContext as never);

    expect(activeFileDecorationProviders()).toHaveLength(1);
    expect(activeDocumentSymbolProviders()).toHaveLength(1);
    expect(secondContext.subscriptions).toHaveLength(2);
  });
});
