import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { normalizeUrl } from "./normalize-url";
import type { LinkRecord, SourceArea } from "./types";

export function extractAllLinks(html: string, pageUrl: string): LinkRecord[] {
  const $ = cheerio.load(html);
  const links: LinkRecord[] = [];
  const seen = new Set<string>();

  $("a[href], [data-nav-href]").each((_, element) => {
    const node = $(element);
    const raw = node.attr("href") ?? node.attr("data-nav-href");
    if (!raw || raw.startsWith("#")) return;
    const normalized = normalizeUrl(raw, pageUrl);
    if (!normalized.accepted || !normalized.value) return;
    const sourceArea = sourceAreaFor(element as Element);
    const key = `${sourceArea}:${normalized.value}`;
    if (seen.has(key)) return;
    seen.add(key);
    const text = (node.text().replace(/\s+/g, " ").trim() || node.attr("aria-label") || node.attr("title") || "").trim();
    const parent = nearestContext(element as Element);
    links.push({
      url: normalized.value,
      text: text || null,
      rel: (node.attr("rel") ?? "").split(/\s+/).filter(Boolean),
      type: node.attr("type") ?? null,
      source_area: sourceArea,
      category: "all",
      parent_selector: parent.selector,
      depth: linkDepth(element as Element),
      is_external: isExternal(normalized.value, pageUrl),
    });
  });

  return links;
}

function nearestContext(element: Element): { selector: string | null } {
  let current: Element | null = element.parent && "name" in element.parent ? element.parent : null;
  while (current) {
    if (current.name === "header" || current.name === "nav" || current.name === "footer" || current.attribs?.id || current.attribs?.class) {
      return { selector: current.attribs?.id ? `#${current.attribs.id}` : current.name };
    }
    current = current.parent && "name" in current.parent ? current.parent : null;
  }
  return { selector: null };
}

function linkDepth(element: Element): number {
  let depth = 0;
  let current: Element | null = element.parent && "name" in element.parent ? element.parent : null;
  while (current) {
    if (current.name === "ul" || current.name === "ol") depth += 1;
    current = current.parent && "name" in current.parent ? current.parent : null;
  }
  return depth;
}

function isExternal(value: string, pageUrl: string): boolean {
  try {
    return new URL(value).hostname !== new URL(pageUrl).hostname;
  } catch {
    return false;
  }
}

function sourceAreaFor(element: Element): SourceArea {
  let current: Element | null = element;
  while (current) {
    const classes = current.attribs?.class?.split(/\s+/) ?? [];
    if (classes.includes("breadcrumb") || classes.includes("breadcrumbs")) return "breadcrumb";
    if (current.name === "header") return "header";
    if (current.name === "main") return "main";
    if (current.name === "footer") return "footer";
    current = current.parent && "name" in current.parent ? current.parent : null;
  }
  return "unknown";
}
