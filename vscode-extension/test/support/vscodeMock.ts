interface MockDisposable {
  readonly kind: string;
  readonly dispose: () => void;
}

interface ProviderRegistration {
  readonly kind: string;
  active: boolean;
  readonly provider: unknown;
}

const fileDecorationRegistrations: ProviderRegistration[] = [];
const documentSymbolRegistrations: ProviderRegistration[] = [];

export interface FakeExtensionContext {
  readonly subscriptions: MockDisposable[];
  dispose(): void;
}

export const window = {
  registerFileDecorationProvider(provider: unknown): MockDisposable {
    return registerProvider(
      provider,
      "file-decoration",
      fileDecorationRegistrations
    );
  }
};

export const languages = {
  registerDocumentSymbolProvider(
    selector: unknown,
    provider: unknown
  ): MockDisposable {
    void selector;
    return registerProvider(
      provider,
      "document-symbol",
      documentSymbolRegistrations
    );
  }
};

export function createFakeExtensionContext(): FakeExtensionContext {
  const subscriptions: MockDisposable[] = [];

  return {
    subscriptions,
    dispose(): void {
      for (const disposable of subscriptions.splice(0).reverse()) {
        disposable.dispose();
      }
    }
  };
}

export function activeFileDecorationProviders(): readonly unknown[] {
  return activeProviders(fileDecorationRegistrations);
}

export function activeDocumentSymbolProviders(): readonly unknown[] {
  return activeProviders(documentSymbolRegistrations);
}

export function activeRegistrationKinds(): readonly string[] {
  return [
    ...fileDecorationRegistrations,
    ...documentSymbolRegistrations
  ]
    .filter((registration) => registration.active)
    .map((registration) => registration.kind);
}

export function resetVscodeMock(): void {
  fileDecorationRegistrations.length = 0;
  documentSymbolRegistrations.length = 0;
}

function registerProvider(
  provider: unknown,
  kind: string,
  registrations: ProviderRegistration[]
): MockDisposable {
  const registration: ProviderRegistration = {
    kind,
    active: true,
    provider
  };
  registrations.push(registration);

  return {
    kind,
    dispose(): void {
      registration.active = false;
    }
  };
}

function activeProviders(
  registrations: readonly ProviderRegistration[]
): readonly unknown[] {
  return registrations
    .filter((registration) => registration.active)
    .map((registration) => registration.provider);
}
