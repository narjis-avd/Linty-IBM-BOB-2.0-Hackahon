import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { normalizeUrl } from "./normalize-url";
import type { LinkRecord, Navigation, NavigationNode, SourceArea } from "./types";

export interface NavigationExtractionResult {
  navigation: Navigation;
}

export function extractNavigation(html: string, pageUrl: string): NavigationExtractionResult {
  const $ = cheerio.load(html);
  const trees: NavigationNode[] = [];
  const links: LinkRecord[] = [];
  const seenTrees = new Set<Element>();
  const seenLinks = new Set<string>();

  const addRegion = (root: Element, sourceArea: SourceArea): void => {
    if (seenTrees.has(root)) return;
    seenTrees.add(root);
    const rootQuery = $(root);
    const nodes = buildNodes(rootQuery, $, pageUrl, sourceArea, seenLinks, links);
    trees.push(...nodes);
  };

  $("nav").each((_, element) => {
    const typed = element as Element;
    const area = sourceAreaFor(typed);
    if (area === "breadcrumb") addRegion(typed, "breadcrumb");
    else if (area === "main") addRegion(typed, "main");
    else if (area === "footer") addRegion(typed, "footer");
    else addRegion(typed, "header");
  });
  $('[role="navigation"], .menu, .navbar, .navigation, .main-menu, .primary-menu, .site-menu').each((_, element) =>
    addRegion(element as Element, "header"),
  );
  $("main .menu, main .navigation").each((_, element) => addRegion(element as Element, "main"));
  $("footer .menu, footer .navigation").each((_, element) => addRegion(element as Element, "footer"));
  $(".breadcrumb, .breadcrumbs, [itemtype*='BreadcrumbList']").each((_, element) =>
    addRegion(element as Element, "breadcrumb"),
  );
  $("nav").each((_, element) => {
    const label = $(element).attr("aria-label")?.toLowerCase() ?? "";
    if (label.includes("breadcrumb")) addRegion(element as Element, "breadcrumb");
  });

  $(
    'header a[href], footer a[href], [data-nav-href]',
  ).each((_, element) => {
    const typed = element as Element;
    const sourceArea = sourceAreaFor(typed);
    const record = toLinkRecord($(typed), $, pageUrl, sourceArea);
    if (record) addLink(record, seenLinks, links);
  });

  const primary_links = links.filter((link) => link.source_area === "header" && !isSocialLink(link.url, link.rel));
  const footer_links = links.filter((link) => link.source_area === "footer");
  const breadcrumb_links = links.filter((link) => link.source_area === "breadcrumb");
  const social_links = links.filter((link) => isSocialLink(link.url, link.rel));
  const product_links = links.filter((link) => isProductLink(link.url, link.source_area));
  const content_links = links.filter((link) => link.source_area === "main" && !isProductLink(link.url, link.source_area));
  const external_links = links.filter((link) => link.is_external);
  for (const link of links) {
    link.category = primary_links.includes(link) ? "primary_navigation" : footer_links.includes(link) ? "footer" : breadcrumb_links.includes(link) ? "breadcrumb" : social_links.includes(link) ? "social" : product_links.includes(link) ? "product" : content_links.includes(link) ? "content" : "navigation";
  }
  return { navigation: { trees, links, primary_links, footer_links, breadcrumb_links, social_links, product_links, content_links, external_links } };
}

function buildNodes(
  root: cheerio.Cheerio<Element>,
  $: cheerio.CheerioAPI,
  pageUrl: string,
  sourceArea: SourceArea,
  seenLinks: Set<string>,
  links: LinkRecord[],
): NavigationNode[] {
  const listItems = root.children("ul, ol").children("li");
  if (listItems.length === 0) {
    return root.find("a[href], [data-nav-href], [role='link']").toArray().flatMap((element) => {
      const record = toLinkRecord($(element), $, pageUrl, sourceArea);
      if (!record) return [];
      addLink(record, seenLinks, links);
      return [{ label: record.text ?? record.url, href: record.url, children: [] }];
    });
  }

  return listItems.toArray().flatMap((element) => {
    const item = $(element);
    const linkElement = item.children("a[href], [data-nav-href], [role='link']").first();
    const record = toLinkRecord(linkElement, $, pageUrl, sourceArea);
    const nestedRoot = item.children("ul, ol").first();
    const children = nestedRoot.length ? buildNodes(nestedRoot, $, pageUrl, sourceArea, seenLinks, links) : [];
    if (!record && children.length === 0) return [];
    if (record) addLink(record, seenLinks, links);
    return [{
      label: record?.text ?? item.clone().children("ul, ol").remove().end().text().trim() ?? "Untitled",
      href: record?.url ?? null,
      children,
    }];
  });
}

function toLinkRecord(
  element: cheerio.Cheerio<Element>,
  $: cheerio.CheerioAPI,
  pageUrl: string,
  sourceArea: SourceArea,
): LinkRecord | null {
  if (!element.length) return null;
  const rawUrl = element.attr("href") ?? element.attr("data-nav-href");
  if (!rawUrl || rawUrl.startsWith("#")) return null;
  const normalized = normalizeUrl(rawUrl, pageUrl);
  if (!normalized.accepted || !normalized.value) return null;
  const text = (element.text().replace(/\s+/g, " ").trim() || element.attr("aria-label") || element.attr("title") || "").trim();
  const rel = (element.attr("rel") ?? "").split(/\s+/).filter(Boolean);
  return {
    url: normalized.value,
    text: text || null,
    rel,
    type: element.attr("type") ?? null,
    source_area: sourceArea,
    category: "navigation",
    parent_selector: parentSelector(element),
    depth: element.parents("ul, ol").length,
    is_external: isExternal(normalized.value, pageUrl),
  };
}

function parentSelector(element: cheerio.Cheerio<Element>): string | null {
  const parent = element.parents("nav, header, footer, .menu, .navigation").first();
  if (!parent.length) return null;
  return parent.attr("id") ? `#${parent.attr("id")}` : parent[0]?.name ?? null;
}

function isExternal(value: string, pageUrl: string): boolean {
  try { return new URL(value).hostname !== new URL(pageUrl).hostname; } catch { return false; }
}

function isSocialLink(value: string, rel: string[]): boolean {
  return rel.includes("me") || /(?:facebook|instagram|linkedin|twitter|x\.com|youtube|github|tiktok)\./i.test(value);
}

function isProductLink(value: string, sourceArea: SourceArea): boolean {
  return sourceArea === "main" && /(?:product|shop|store|cart|sku|item)/i.test(value);
}

function addLink(record: LinkRecord, seenLinks: Set<string>, links: LinkRecord[]): void {
  const key = `${record.source_area}:${record.url}`;
  if (seenLinks.has(key)) return;
  seenLinks.add(key);
  links.push(record);
}

function sourceAreaFor(element: Element): SourceArea {
  let current: Element | null = element;
  while (current) {
    const attributes = current.attribs ?? {};
    const classes = attributes.class?.split(/\s+/) ?? [];
    if (attributes["aria-label"]?.toLowerCase().includes("breadcrumb") || classes.includes("breadcrumb") || classes.includes("breadcrumbs")) return "breadcrumb";
    if (current.name === "header") return "header";
    if (current.name === "main") return "main";
    if (current.name === "footer") return "footer";
    current = current.parent && "name" in current.parent ? current.parent : null;
  }
  return "unknown";
}
