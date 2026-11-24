export interface SvgSourceRange {
  readonly start: number;
  readonly end: number;
}

export interface SvgOutlineNode {
  readonly tagName: string;
  readonly id?: string;
  readonly range: SvgSourceRange;
  readonly selectionRange: SvgSourceRange;
  readonly children: readonly SvgOutlineNode[];
}

interface WorkingNode {
  readonly tagName: string;
  readonly id?: string;
  readonly startOffset: number;
  readonly nameStartOffset: number;
  readonly nameEndOffset: number;
  endOffset: number | undefined;
  readonly children: WorkingNode[];
}

export function parseSvgOutline(source: string): SvgOutlineNode | null {
  const stack: WorkingNode[] = [];
  let root: WorkingNode | undefined;
  let offset = 0;

  while (offset < source.length) {
    const tagStart = source.indexOf("<", offset);
    if (tagStart < 0) {
      break;
    }

    if (source.startsWith("<!--", tagStart)) {
      const commentEnd = source.indexOf("-->", tagStart + 4);
      if (commentEnd < 0) {
        return null;
      }
      offset = commentEnd + 3;
      continue;
    }

    if (source.startsWith("<![CDATA[", tagStart)) {
      const cdataEnd = source.indexOf("]]>", tagStart + 9);
      if (cdataEnd < 0) {
        return null;
      }
      offset = cdataEnd + 3;
      continue;
    }

    if (source.startsWith("<?", tagStart)) {
      const declarationEnd = source.indexOf("?>", tagStart + 2);
      if (declarationEnd < 0) {
        return null;
      }
      offset = declarationEnd + 2;
      continue;
    }

    if (source.startsWith("</", tagStart)) {
      const closing = readClosingTag(source, tagStart);
      if (closing === null) {
        return null;
      }

      const open = stack.pop();
      if (open === undefined || open.tagName !== closing.tagName) {
        return null;
      }
      open.endOffset = closing.endOffset;
      offset = closing.endOffset;
      continue;
    }

    if (source.startsWith("<!", tagStart)) {
      const declarationEnd = source.indexOf(">", tagStart + 2);
      if (declarationEnd < 0) {
        return null;
      }
      offset = declarationEnd + 1;
      continue;
    }

    const start = readStartTag(source, tagStart);
    if (start === null) {
      return null;
    }

    const node: WorkingNode = {
      tagName: start.tagName,
      startOffset: tagStart,
      nameStartOffset: start.nameStartOffset,
      nameEndOffset: start.nameEndOffset,
      endOffset: start.selfClosing ? start.endOffset : undefined,
      children: []
    };
    const selected = start.id === undefined ? node : withId(node, start.id);

    const parent = stack.at(-1);
    if (parent !== undefined) {
      parent.children.push(selected);
    } else if (root === undefined) {
      root = selected;
    } else {
      return null;
    }

    if (!start.selfClosing) {
      stack.push(selected);
    }
    offset = start.endOffset;
  }

  if (root === undefined || stack.length > 0) {
    return null;
  }
  return toOutlineNode(root);
}

interface ClosingTag {
  readonly tagName: string;
  readonly endOffset: number;
}

interface StartTag {
  readonly tagName: string;
  readonly nameStartOffset: number;
  readonly nameEndOffset: number;
  readonly endOffset: number;
  readonly selfClosing: boolean;
  readonly id?: string;
}

function readClosingTag(
  source: string,
  tagStart: number
): ClosingTag | null {
  let cursor = skipWhitespace(source, tagStart + 2);
  const nameStart = cursor;
  while (cursor < source.length && !isTagNameTerminator(source[cursor])) {
    cursor += 1;
  }
  if (cursor === nameStart) {
    return null;
  }

  const tagEnd = findTagEnd(source, cursor);
  if (tagEnd < 0) {
    return null;
  }

  return {
    tagName: source.slice(nameStart, cursor),
    endOffset: tagEnd + 1
  };
}

function readStartTag(
  source: string,
  tagStart: number
): StartTag | null {
  const nameStart = tagStart + 1;
  let cursor = nameStart;
  while (cursor < source.length && !isTagNameTerminator(source[cursor])) {
    cursor += 1;
  }
  if (cursor === nameStart) {
    return null;
  }

  const tagEnd = findTagEnd(source, cursor);
  if (tagEnd < 0) {
    return null;
  }

  const tagName = source.slice(nameStart, cursor);
  const attributesEnd = isSelfClosingTag(source, tagEnd)
    ? previousNonWhitespace(source, tagEnd - 1) - 1
    : tagEnd;
  const id = readIdAttribute(source, cursor, attributesEnd);
  const start: StartTag = {
    tagName,
    nameStartOffset: nameStart,
    nameEndOffset: cursor,
    endOffset: tagEnd + 1,
    selfClosing: isSelfClosingTag(source, tagEnd)
  };
  return id === undefined ? start : { ...start, id };
}

function readIdAttribute(
  source: string,
  start: number,
  end: number
): string | undefined {
  let cursor = start;
  while (cursor < end) {
    cursor = skipAttributeWhitespace(source, cursor, end);
    if (cursor >= end) {
      break;
    }

    const nameStart = cursor;
    while (
      cursor < end &&
      !isAttributeNameTerminator(source[cursor])
    ) {
      cursor += 1;
    }
    if (cursor === nameStart) {
      cursor += 1;
      continue;
    }

    const name = source.slice(nameStart, cursor);
    cursor = skipAttributeWhitespace(source, cursor, end);
    if (source[cursor] !== "=") {
      continue;
    }

    cursor = skipAttributeWhitespace(source, cursor + 1, end);
    const value = readAttributeValue(source, cursor, end);
    if (value === null) {
      return undefined;
    }
    if (name === "id" && value.value.length > 0) {
      return value.value;
    }
    cursor = value.end;
  }
  return undefined;
}

function readAttributeValue(
  source: string,
  start: number,
  end: number
): { readonly value: string; readonly end: number } | null {
  const quote = source[start];
  if (quote === '"' || quote === "'") {
    const valueEnd = source.indexOf(quote, start + 1);
    if (valueEnd < 0 || valueEnd > end) {
      return null;
    }
    return {
      value: source.slice(start + 1, valueEnd),
      end: valueEnd + 1
    };
  }

  let cursor = start;
  while (
    cursor < end &&
    source[cursor] !== ">" &&
    !isWhitespace(source[cursor])
  ) {
    cursor += 1;
  }
  return {
    value: source.slice(start, cursor),
    end: cursor
  };
}

function findTagEnd(source: string, start: number): number {
  let quote: string | undefined;
  for (let cursor = start; cursor < source.length; cursor += 1) {
    const character = source[cursor];
    if (quote !== undefined) {
      if (character === quote) {
        quote = undefined;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === ">") {
      return cursor;
    }
  }
  return -1;
}

function isSelfClosingTag(source: string, tagEnd: number): boolean {
  return source[previousNonWhitespace(source, tagEnd - 1)] === "/";
}

function previousNonWhitespace(source: string, from: number): number {
  let cursor = from;
  while (cursor >= 0 && isWhitespace(source[cursor])) {
    cursor -= 1;
  }
  return cursor;
}

function skipWhitespace(source: string, start: number): number {
  let cursor = start;
  while (cursor < source.length && isWhitespace(source[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function skipAttributeWhitespace(
  source: string,
  start: number,
  end: number
): number {
  let cursor = start;
  while (
    cursor < end &&
    (isWhitespace(source[cursor]) || source[cursor] === "/")
  ) {
    cursor += 1;
  }
  return cursor;
}

function isWhitespace(character: string | undefined): boolean {
  return character !== undefined && /\s/.test(character);
}

function isTagNameTerminator(character: string | undefined): boolean {
  return (
    character === undefined ||
    isWhitespace(character) ||
    character === "/" ||
    character === ">"
  );
}

function isAttributeNameTerminator(
  character: string | undefined
): boolean {
  return (
    character === undefined ||
    isWhitespace(character) ||
    character === "=" ||
    character === "/" ||
    character === ">"
  );
}

function withId(node: WorkingNode, id: string): WorkingNode {
  return {
    ...node,
    id
  };
}

function toOutlineNode(node: WorkingNode): SvgOutlineNode {
  if (node.endOffset === undefined) {
    throw new Error(`unclosed SVG element: ${node.tagName}`);
  }

  const base = {
    tagName: node.tagName,
    range: {
      start: node.startOffset,
      end: node.endOffset
    },
    selectionRange: {
      start: node.nameStartOffset,
      end: node.nameEndOffset
    },
    children: node.children.map((child) => toOutlineNode(child))
  };
  return node.id === undefined ? base : { ...base, id: node.id };
}
