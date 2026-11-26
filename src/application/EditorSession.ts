import { Document } from "../domain/model/Document.js";
import type { EditorCommandContext } from "./context/EditorCommandContext.js";

export class EditorSession implements EditorCommandContext {
  private activeDocument: Document | null = null;
  private activeDocumentPath: string | null = null;

  get document(): Document | null {
    return this.activeDocument;
  }

  get documentPath(): string | null {
    return this.activeDocumentPath;
  }

  initializeCanvas(width: number, height: number): Document {
    this.activeDocument = new Document(width, height);
    this.activeDocumentPath = null;
    return this.activeDocument;
  }

  replaceDocument(document: Document, path: string): void {
    this.activeDocument = document;
    this.activeDocumentPath = path;
  }

  setDocumentPath(path: string): void {
    this.activeDocumentPath = path;
  }
}
