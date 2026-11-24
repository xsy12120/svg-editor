import { describe, expect, it, vi } from "vitest";
import type { Uri } from "vscode";

import {
  classifySvgFile,
  SvgFileDecorationProvider,
  type SvgEntryKind
} from "../src/svgFileDecoration.js";

interface TestUri {
  readonly scheme: string;
  readonly path: string;
}

function fileUri(path: string): Uri {
  return { scheme: "file", path } as Uri;
}

describe("classifySvgFile", () => {
  it.each([
    {
      description: "a regular lowercase SVG file",
      uri: fileUri("/workspace/example.svg"),
      kind: "file" as const,
      expected: true
    },
    {
      description: "a regular uppercase SVG file",
      uri: fileUri("/workspace/example.SVG"),
      kind: "file" as const,
      expected: true
    },
    {
      description: "a non-SVG text file",
      uri: fileUri("/workspace/example.txt"),
      kind: "file" as const,
      expected: false
    },
    {
      description: "a file whose extension merely contains svg",
      uri: fileUri("/workspace/example.svg.txt"),
      kind: "file" as const,
      expected: false
    },
    {
      description: "a directory named like an SVG file",
      uri: fileUri("/workspace/folder.svg"),
      kind: "directory" as const,
      expected: false
    },
    {
      description: "a special filesystem entry named like an SVG file",
      uri: fileUri("/workspace/link.svg"),
      kind: "other" as const,
      expected: false
    },
    {
      description: "an SVG outside the file scheme",
      uri: { scheme: "untitled", path: "/Untitled-1.svg" },
      kind: "file" as const,
      expected: false
    }
  ])(
    "classifies $description as expected",
    ({ uri, kind, expected }: {
      readonly uri: TestUri;
      readonly kind: SvgEntryKind;
      readonly expected: boolean;
    }) => {
      expect(classifySvgFile(uri, kind)).toBe(expected);
    }
  );
});

describe("SvgFileDecorationProvider", () => {
  it("returns the [] badge for an eligible SVG file", async () => {
    const inspectEntry = vi.fn(async () => "file" as const);
    const provider = new SvgFileDecorationProvider(inspectEntry);

    const decoration = await provider.provideFileDecoration(
      fileUri("/workspace/example.svg")
    );

    expect(decoration).toEqual({ badge: "[]" });
    expect(inspectEntry).toHaveBeenCalledOnce();
  });

  it("does not decorate a directory even when its name ends in .svg", async () => {
    const inspectEntry = vi.fn(async () => "directory" as const);
    const provider = new SvgFileDecorationProvider(inspectEntry);

    const decoration = await provider.provideFileDecoration(
      fileUri("/workspace/folder.svg")
    );

    expect(decoration).toBeUndefined();
    expect(inspectEntry).toHaveBeenCalledOnce();
  });

  it("does not inspect or decorate a non-SVG file", async () => {
    const inspectEntry = vi.fn(async () => "file" as const);
    const provider = new SvgFileDecorationProvider(inspectEntry);

    const decoration = await provider.provideFileDecoration(
      fileUri("/workspace/example.txt")
    );

    expect(decoration).toBeUndefined();
    expect(inspectEntry).not.toHaveBeenCalled();
  });

  it("evaluates the SVG path rule only once", async () => {
    let pathReads = 0;
    const target = {
      scheme: "file",
      get path(): string {
        pathReads += 1;
        return "/workspace/example.svg";
      }
    } as Uri;
    const provider = new SvgFileDecorationProvider(
      vi.fn(async () => "file" as const)
    );

    await provider.provideFileDecoration(target);

    expect(pathReads).toBe(1);
  });

  it("does not modify the URI it receives", async () => {
    const uri = fileUri("/workspace/example.svg");
    const originalUri = { ...uri };
    const provider = new SvgFileDecorationProvider(
      vi.fn(async () => "file" as const)
    );

    await provider.provideFileDecoration(uri);

    expect(uri).toEqual(originalUri);
  });
});
