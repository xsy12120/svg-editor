import assert from "node:assert/strict";

import * as vscode from "vscode";

const EXTENSION_NAME = "svg-editor-vscode";

export async function run(): Promise<void> {
  const extension = vscode.extensions.all.find(
    (candidate) => candidate.packageJSON.name === EXTENSION_NAME
  );
  assert.ok(extension, "SVG extension must be loaded in the host");
  await extension.activate();
  assert.equal(extension.isActive, true);

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(workspaceFolder, "integration fixture workspace must be open");

  const fileUri = vscode.Uri.joinPath(
    workspaceFolder.uri,
    `integration-outline-${process.pid}.svg`
  );
  const originalSource = [
    '<svg id="root">',
    '  <g id="layer">',
    '    <rect id="start"/>',
    "    <text>Label</text>",
    "  </g>",
    "</svg>",
    ""
  ].join("\n");
  const editedSource = originalSource.replace(
    "  </g>",
    '    <circle id="new-dot"/>\n  </g>'
  );

  let editor: vscode.TextEditor | undefined;
  const failures: string[] = [];

  try {
    await vscode.workspace.fs.writeFile(
      fileUri,
      Buffer.from(originalSource, "utf8")
    );
    const document = await vscode.workspace.openTextDocument(fileUri);
    editor = await vscode.window.showTextDocument(document);

    await test("registers a real DocumentSymbolProvider for SVG files", async () => {
      const symbols = await getDocumentSymbols(fileUri);
      assert.equal(symbols.length, 1);

      const root = symbols[0];
      assert.equal(root?.name, "svg#root");
      assert.equal(root?.children?.[0]?.name, "g#layer");
      assert.deepEqual(
        root?.children?.[0]?.children?.map((child) => child.name),
        ["rect#start", "text"]
      );
      assert.deepEqual(
        root?.children?.[0]?.children?.[0]?.selectionRange.start,
        new vscode.Position(2, 5)
      );
    }, failures);

    await test("refreshes symbols after an edit", async () => {
      const changed = await editor?.edit((editBuilder) => {
        const insertAt = document
          .getText()
          .lastIndexOf("</g>");
        editBuilder.insert(
          document.positionAt(insertAt),
          '    <circle id="new-dot"/>\n'
        );
      });
      assert.equal(changed, true);

      const symbols = await getDocumentSymbols(fileUri);
      assert.deepEqual(
        symbols[0]?.children?.[0]?.children?.map((child) => child.name),
        ["rect#start", "text", "circle#new-dot"]
      );
    }, failures);

    await test("returns an empty outline for incomplete XML", async () => {
      const closingStart = document.getText().lastIndexOf("</svg>");
      const changed = await editor?.edit((editBuilder) => {
        editBuilder.delete(
          new vscode.Range(
            document.positionAt(closingStart + 5),
            document.positionAt(closingStart + 6)
          )
        );
      });
      assert.equal(changed, true);

      const symbols = await getDocumentSymbols(fileUri);
      assert.equal(symbols.length, 0);
    }, failures);

    await test("restores symbols after the XML is repaired", async () => {
      const changed = await editor?.edit((editBuilder) => {
        editBuilder.replace(
          fullDocumentRange(document),
          editedSource
        );
      });
      assert.equal(changed, true);

      const symbols = await getDocumentSymbols(fileUri);
      assert.equal(symbols[0]?.name, "svg#root");
      assert.equal(
        symbols[0]?.children?.[0]?.children?.[2]?.name,
        "circle#new-dot"
      );
    }, failures);
  } finally {
    if (editor !== undefined) {
      const document = editor.document;
      if (document.getText() !== originalSource) {
        await editor.edit((editBuilder) => {
          editBuilder.replace(
            fullDocumentRange(document),
            originalSource
          );
        });
        await document.save();
      }
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    }
    await vscode.workspace.fs.delete(fileUri, { useTrash: false });
  }

  if (failures.length > 0) {
    throw new Error(`Extension Host tests failed:\n${failures.join("\n")}`);
  }
}

async function getDocumentSymbols(
  uri: vscode.Uri
): Promise<readonly vscode.DocumentSymbol[]> {
  const result = await vscode.commands.executeCommand<unknown>(
    "vscode.executeDocumentSymbolProvider",
    uri
  );
  if (result === undefined) {
    return [];
  }
  assert.ok(Array.isArray(result), "DocumentSymbolProvider must return an array");

  const symbols = result as unknown[];
  for (const symbol of symbols) {
    assert.ok(
      isDocumentSymbol(symbol),
      "expected nested DocumentSymbol results"
    );
  }
  return symbols as vscode.DocumentSymbol[];
}

function isDocumentSymbol(value: unknown): value is vscode.DocumentSymbol {
  return (
    typeof value === "object" &&
    value !== null &&
    "selectionRange" in value &&
    "children" in value
  );
}

function fullDocumentRange(
  document: vscode.TextDocument
): vscode.Range {
  return new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );
}

async function test(
  name: string,
  body: () => Promise<void>,
  failures: string[]
): Promise<void> {
  try {
    await body();
    console.log(`[PASS] ${name}`);
  } catch (error) {
    failures.push(
      `[FAIL] ${name}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
