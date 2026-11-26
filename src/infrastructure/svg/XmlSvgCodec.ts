import type {
  ParsedSvgDocument,
  SvgCodec
} from "../../application/ports/SvgCodec.js";
import type { SvgShapeReader } from "../../application/ports/SvgShapeReader.js";
import type { Document } from "../../domain/model/Document.js";
import { SvgDocumentParser } from "./SvgDocumentParser.js";
import { SvgDocumentSerializer } from "./SvgDocumentSerializer.js";

export class XmlSvgCodec implements SvgCodec {
  private readonly parser: SvgDocumentParser;
  private readonly serializer: SvgDocumentSerializer;

  constructor(shapes: SvgShapeReader) {
    this.parser = new SvgDocumentParser(shapes);
    this.serializer = new SvgDocumentSerializer();
  }

  decode(content: string): ParsedSvgDocument {
    return this.parser.parse(content);
  }

  encode(document: Document): string {
    return this.serializer.serialize(document);
  }
}
