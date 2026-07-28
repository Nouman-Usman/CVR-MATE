/**
 * remark plugin: auto-link bare 8-digit CVR/VAT numbers in agent replies to
 * `/company/{VAT}`. The system prompt already instructs the model to link
 * companies; this is the safety net so a plain VAT is still clickable. Operates
 * on the parsed mdast (not the raw string) so it never corrupts existing links,
 * and it refuses to descend into link/code nodes so numbers there are untouched.
 */

interface MdNode {
  type: string;
  value?: string;
  url?: string;
  title?: string | null;
  children?: MdNode[];
}

// Contiguous 8 digits, on word boundaries. Spaced Danish phone numbers
// ("12 34 56 78") therefore don't match — only solid CVR numbers do.
const HAS_VAT = /\b\d{8}\b/;
const VAT_RE = /\b\d{8}\b/g;

function splitVat(value: string): MdNode[] {
  const out: MdNode[] = [];
  let last = 0;
  VAT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = VAT_RE.exec(value)) !== null) {
    const vat = m[0];
    if (m.index > last) out.push({ type: "text", value: value.slice(last, m.index) });
    out.push({ type: "link", url: `/company/${vat}`, title: null, children: [{ type: "text", value: vat }] });
    last = m.index + vat.length;
  }
  if (last < value.length) out.push({ type: "text", value: value.slice(last) });
  return out.length ? out : [{ type: "text", value }];
}

function transform(node: MdNode): void {
  if (!node.children || node.children.length === 0) return;
  // Never rewrite inside an existing link or code — avoids double-linking.
  if (node.type === "link" || node.type === "inlineCode" || node.type === "code") return;

  const next: MdNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && typeof child.value === "string" && HAS_VAT.test(child.value)) {
      next.push(...splitVat(child.value));
    } else {
      transform(child);
      next.push(child);
    }
  }
  node.children = next;
}

export function remarkLinkVat() {
  return (tree: unknown) => {
    transform(tree as MdNode);
  };
}
