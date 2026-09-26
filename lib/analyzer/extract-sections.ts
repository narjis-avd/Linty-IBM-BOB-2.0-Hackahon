import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { ImageRecord, ProductRecord, SectionRecord, SectionType, SourceElementInformation } from "./types";

export interface ExtractSectionsOptions {
  images?: Array<Pick<ImageRecord, "id" | "url" | "normalized_url" | "original_source_value">>;
  products?: Array<Pick<ProductRecord, "id" | "url">>;
}

export interface SectionExtractionResult {
  sections: SectionRecord[];
}

const MAX_SECTIONS = 100;

export function extractSections(html: string, options: ExtractSectionsOptions = {}): SectionExtractionResult {
  const $ = cheerio.load(html);
  const candidates = collectCandidates($);
  const sections: SectionRecord[] = [];
  const seen = new Set<string>();

  for (const element of candidates) {
    if (sections.length >= MAX_SECTIONS) break;
    const node = $(element);
    const text = meaningfulText(node);
    const heading = node.find("h1, h2, h3, h4, h5, h6").first().text().replace(/\s+/g, " ").trim() || null;
    const type = classifySection(node, element);
    if (!shouldKeep(node, text, heading, type)) continue;

    if (isHiddenOrClone(element)) continue;
    const key = sectionSignature(type, heading, text, node);
    if (seen.has(key)) continue;
    seen.add(key);

    const sourceElement = sourceInformation(element);
    const sectionId = stableSectionId(type, sections.length, sourceElement);
    const sectionImages = findImageIds(node, $, options.images ?? []);
    const productIds = type === "product_grid" ? findProductIds(node, $, options.products ?? []) : [];
    const sourceSelector = sourceElement.selector;

    sections.push({
      id: sectionId,
      section_id: sectionId,
      heading,
      text: text || null,
      order: sections.length,
      type,
      image_ids: sectionImages,
      source_element: sourceElement,
      source_selector: sourceSelector,
      content_item_ids: [],
      ...(productIds.length ? { product_ids: productIds } : {}),
    } as SectionRecord & { product_ids?: string[] });
  }

  return { sections };
}

function collectCandidates($: cheerio.CheerioAPI): Element[] {
  const seen = new Set<Element>();
  const candidates: Element[] = [];
  const add = (element: Element): void => {
    if (!seen.has(element)) {
      seen.add(element);
      candidates.push(element);
    }
  };

  $("header, nav, main > section, main > div, section, footer").each((_, element) => add(element as Element));
  $("[role='banner'], [role='navigation'], [role='contentinfo'], [class*='hero'], [class*='feature'], [class*='pricing'], [class*='testimonial'], [class*='cta'], [class*='product-grid'], [class*='category-grid'], [class*='blog']").each(
    (_, element) => add(element as Element),
  );

  const order = new Map<Element, number>();
  $.root().find("*").each((index, element) => {
    order.set(element as Element, index);
  });
  return candidates.sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
}

function classifySection(node: cheerio.Cheerio<Element>, element: Element): SectionType {
  const value = `${element.name} ${element.attribs.class ?? ""} ${element.attribs.id ?? ""} ${node.attr("aria-label") ?? ""}`.toLowerCase();
  if (element.name === "header" || /\b(site-header|header)\b/.test(value)) return "header";
  if (element.name === "nav" || /\b(navigation|navbar|menu)\b/.test(value)) return "navigation";
  if (element.name === "footer" || /\b(site-footer|footer)\b/.test(value)) return "footer";
  if (/\b(hero|masthead|jumbotron|banner)\b/.test(value)) return "hero";
  if (/\b(product[-_ ]?grid|products|shop|woocommerce)\b/.test(value)) return "product_grid";
  if (/\b(category[-_ ]?grid|categories|collections)\b/.test(value)) return "category_grid";
  if (/\b(testimonial|reviews?|customer[-_ ]?stories)\b/.test(value)) return "testimonial";
  if (/\b(pricing|plans?|price[-_ ]?table)\b/.test(value)) return "pricing";
  if (/\b(blog[-_ ]?grid|blog[-_ ]?section|article[-_ ]?list|news|journal)\b/.test(value)) return "blog_grid";
  if (/\b(service[-_ ]?grid|services)\b/.test(value)) return "service_grid";
  if (/\b(solution[-_ ]?grid|solutions)\b/.test(value)) return "solution_grid";
  if (/\b(feature|benefit|capabilit)\b/.test(value)) return "feature";
  if (/\b(cta|call[-_ ]?to[-_ ]?action|get[-_ ]?started|contact)\b/.test(value)) return "cta";
  return "content";
}

function meaningfulText(node: cheerio.Cheerio<Element>): string {
  const clone = node.clone();
  clone.find("script, style, noscript, svg, img, picture, video, audio").remove();
  return clone.text().replace(/\s+/g, " ").trim().slice(0, 1200);
}

function shouldKeep(
  node: cheerio.Cheerio<Element>,
  text: string,
  heading: string | null,
  type: SectionType,
): boolean {
  if (type === "header" || type === "navigation" || type === "footer" || type === "hero" || type === "cta") return true;
  if (node.find("h1, h2, h3, h4, h5, h6").length > 0) return true;
  if (text.length >= 40) return true;
  return Boolean(heading);
}

function sourceInformation(element: Element): SourceElementInformation {
  return {
    tag_name: element.name || null,
    element_id: element.attribs.id ?? null,
    class_name: element.attribs.class ?? null,
    selector: element.attribs.id ? `#${element.attribs.id}` : element.name || null,
    attributes: { ...element.attribs },
  };
}

function stableSectionId(type: SectionType, index: number, source: SourceElementInformation): string {
  const base = source.element_id || `${type}-${index + 1}`;
  return base.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

function sectionSignature(type: SectionType, heading: string | null, text: string, node: cheerio.Cheerio<Element>): string {
  const explicit = node.attr("id") || node.attr("data-section-id");
  if (explicit) return `${type}:id:${explicit.toLowerCase()}`;
  return `${type}:${(heading ?? "").toLowerCase().replace(/\s+/g, " ").trim()}:${text.slice(0, 240).toLowerCase()}`;
}

function isHiddenOrClone(element: Element): boolean {
  const attributes = element.attribs ?? {};
  const className = attributes.class ?? "";
  const style = attributes.style ?? "";
  return attributes.hidden !== undefined
    || attributes["aria-hidden"] === "true"
    || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)
    || /(?:clone|duplicate|swiper-slide-duplicate|slick-cloned|mobile-only|desktop-only)/i.test(className);
}

function findImageIds(node: cheerio.Cheerio<Element>, $: cheerio.CheerioAPI, images: NonNullable<ExtractSectionsOptions["images"]>): string[] {
  const values = new Set<string>();
  node.find("img, source").each((_, element) => {
    const source = $(element).attr("src") ?? $(element).attr("srcset")?.split(",")[0]?.trim().split(/\s+/)[0];
    if (!source) return;
    const match = images.find((image) => image.url === source || image.original_source_value === source);
    if (match) values.add(match.id);
  });
  return [...values];
}

function findProductIds(node: cheerio.Cheerio<Element>, $: cheerio.CheerioAPI, products: NonNullable<ExtractSectionsOptions["products"]>): string[] {
  const values = new Set<string>();
  node.find("[data-product-id], [data-product], .product, .product-card, li.product, article").each((_, element) => {
    const key = $(element).attr("data-product-id") ?? $(element).attr("data-product");
    const href = $(element).find("a[href]").first().attr("href");
    const match = products.find((product) => product.id === key || (href && product.url?.endsWith(href)));
    if (match) values.add(match.id);
  });
  return [...values];
}
