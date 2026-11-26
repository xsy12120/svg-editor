import { Document } from "../domain/model/Document.js";
import {
  captureDocumentState,
  compareDocumentState,
  EMPTY_DOCUMENT_CHANGE_STATE,
  type DocumentChangeState,
  type DocumentStateSnapshot
} from "./context/DocumentChangeState.js";
import type { EditorCommandContext } from "./context/EditorCommandContext.js";

export class EditorSession implements EditorCommandContext {
  private activeDocument: Document | null = null;
  private activeDocumentPath: string | null = null;
  private savedDocumentState: DocumentStateSnapshot | null = null;

  get document(): Document | null {
    return this.activeDocument;
  }

  get documentPath(): string | null {
    return this.activeDocumentPath;
  }

  get changes(): DocumentChangeState {
    if (this.activeDocument === null || this.savedDocumentState === null) {
      return EMPTY_DOCUMENT_CHANGE_STATE;
    }
    return compareDocumentState(
      this.activeDocument,
      this.savedDocumentState
    );
  }

  initializeCanvas(width: number, height: number): Document {
    this.activeDocument = new Document(width, height);
    this.activeDocumentPath = null;
    this.savedDocumentState = captureDocumentState(this.activeDocument);
    return this.activeDocument;
  }

  replaceDocument(document: Document, path: string): void {
    this.activeDocument = document;
    this.activeDocumentPath = path;
    this.savedDocumentState = captureDocumentState(document);
  }

  setDocumentPath(path: string): void {
    this.activeDocumentPath = path;
  }

  markSaved(): void {
    if (this.activeDocument !== null) {
      this.savedDocumentState = captureDocumentState(this.activeDocument);
    }
  }
}
