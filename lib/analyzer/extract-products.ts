import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { extractImages } from "./extract-images";
import { normalizeUrl } from "./normalize-url";
import type { ContentItemRecord, ImageRecord, ProductAction, ProductRecord, ProductType, ContentItemType } from "./types";

export interface ProductExtractionResult {
  products: ProductRecord[];
  content_items: ContentItemRecord[];
  images: ImageRecord[];
  counters: {
    raw_product_candidates: number;
    unique_ecommerce_products: number;
    raw_content_candidates: number;
    unique_content_items: number;
    duplicate_entities_removed: number;
    carousel_clones_removed: number;
    hidden_duplicates_removed: number;
  };
}

export interface ExtractProductsOptions {
  include_detail_page_fallback?: boolean;
}

const PRODUCT_SELECTORS = [
  ".product",
  "li.product",
  ".product-card",
  ".product-item",
  "[data-product-id]",
  '[itemtype*="Product"]',
  ".woocommerce-loop-product__link",
  ".woocommerce-LoopProduct-link",
  "[data-content-card]",
  "[data-card]",
  ".service-card",
  ".saas-card",
  ".solution-card",
  ".feature-card",
  ".pricing-card",
  ".resource-card",
  ".content-card",
  "div.group",
  "article",
];

export function extractProducts(
  html: string,
  pageUrl: string,
  _options: ExtractProductsOptions = {},
): ProductExtractionResult {
  void _options;
  const $ = cheerio.load(html);
  const candidates = collectCandidates($);
  const products: ProductRecord[] = [];
  const content_items: ContentItemRecord[] = [];
  const images: ImageRecord[] = [];
  const productKeys = new Set<string>();
  const imagesByUrl = new Map<string, ImageRecord>();
  const entities = new Map<string, ProductRecord | ContentItemRecord>();
  const counters = {
    raw_product_candidates: candidates.length,
    unique_ecommerce_products: 0,
    raw_content_candidates: 0,
    unique_content_items: 0,
    duplicate_entities_removed: 0,
    carousel_clones_removed: 0,
    hidden_duplicates_removed: 0,
  };

  for (const element of candidates) {
    const card = $(element);
    if (!isProductCandidate(card, pageUrl)) continue;
    if (isHiddenDuplicate(card)) {
      counters.hidden_duplicates_removed += 1;
      continue;
    }
    if (isCarouselClone(card)) {
      counters.carousel_clones_removed += 1;
      continue;
    }

    const url = findProductUrl(card, pageUrl);
    const title = findTitle(card);
    const id = findProductId(card, url, title);
    const classification = classifyCandidate(card, url, $);
    const entityId = stableEntityId(card, id, url, title, classification.type);
    const existingKey = [...entities.entries()].find(([, entity]) => {
      if (url && entity.original_urls.includes(url)) return true;
      return entity.id === id || entity.entity_id === entityId;
    })?.[0];
    const key = existingKey ?? entityId;
    counters.raw_content_candidates += classification.type === "ecommerce_product" ? 0 : 1;
    if (productKeys.has(key)) {
      counters.duplicate_entities_removed += 1;
      const existing = entities.get(key);
      if (existing) mergeOccurrence(existing, element, card, url);
      continue;
    }
    productKeys.add(key);

    const cardHtml = $.html(element);
    const extracted = extractImages(cardHtml, pageUrl);
    const productImages: ImageRecord[] = [];
    for (const image of extracted.images) {
      const imageKey = image.identity ?? image.normalized_url ?? image.url;
      const existingImage = imagesByUrl.get(imageKey);
      if (existingImage) {
        if (classification.type === "ecommerce_product") {
          if (!existingImage.associated_product_ids.includes(id)) existingImage.associated_product_ids.push(id);
          existingImage.product_id = existingImage.product_id ?? id;
        }
        productImages.push(existingImage);
        continue;
      }
      // Each card extraction starts its own local image counter. Re-key when
      // adding to the page-wide collection so recursive WooCommerce cards
      // never share image IDs.
      const productImage = {
        ...image,
        id: `image-${images.length + 1}`,
        product_id: classification.type === "ecommerce_product" ? id : null,
        associated_product_ids: classification.type === "ecommerce_product" ? [id] : [],
      };
      imagesByUrl.set(imageKey, productImage);
      images.push(productImage);
      productImages.push(productImage);
    }

    const pricing = parsePricing(card);
    const product: ProductRecord = {
      id,
      entity_id: key,
      title: title ?? "",
      url,
      price: pricing.price,
      old_price: pricing.old_price,
      currency: pricing.currency,
      is_on_sale: pricing.old_price !== null || pricing.is_on_sale,
      product_type: detectProductType(card),
      description: findDescription(card),
      image_ids: productImages.map((image) => image.id),
      source_selector: selectorFor(element),
      source_url: pageUrl,
      action_buttons: findActions(card, $, pageUrl),
      classification_reason: classification.reason,
      evidence: classification.evidence,
      occurrence_count: 1,
      source_selectors: [selectorFor(element)],
      source_section_ids: sourceSectionIds(element),
      original_urls: url ? [url] : [],
    };
    if (classification.type === "ecommerce_product") {
      products.push(product);
      entities.set(key, product);
      counters.unique_ecommerce_products += 1;
    } else {
      const contentItem: ContentItemRecord = {
      id,
      entity_id: key,
      title: title ?? "",
      url,
      description: findDescription(card),
      image_ids: productImages.map((image) => image.id),
      source_selector: selectorFor(element),
      source_url: pageUrl,
        item_type: classification.type,
        evidence: classification.evidence,
        classification_reason: classification.reason,
        occurrence_count: 1,
        source_selectors: [selectorFor(element)],
        source_section_ids: sourceSectionIds(element),
        original_urls: url ? [url] : [],
      };
      content_items.push(contentItem);
      entities.set(key, contentItem);
      counters.unique_content_items += 1;
    }
  }

  return {
    products,
    content_items,
    images,
    counters,
  };
}

function stableEntityId(
  card: cheerio.Cheerio<Element>,
  explicitId: string,
  url: string | null,
  title: string | null,
  type: ContentItemType,
): string {
  const dataId = (type === "ecommerce_product" ? card.attr("data-product-id") : null)
    ?? card.attr("data-content-id")
    ?? card.attr("data-card-id")
    ?? card.attr("data-id");
  const strongest = dataId || url;
  if (strongest) return `${type}:${normalizeIdentityValue(strongest)}`;
  const normalizedTitle = normalizeIdentityValue(title ?? "");
  const signature = card.text();
  return `${type}:${normalizeIdentityValue(explicitId || normalizedTitle || signature)}`;
}

function normalizeIdentityValue(value: string): string {
  return value.toLowerCase().trim().replace(/\/+$/, "").replace(/\s+/g, " ").replace(/[^a-z0-9:/?&=._ -]/g, "");
}

function sourceSectionIds(element: Element): string[] {
  const ids: string[] = [];
  let current: Element | null = element.parent && "name" in element.parent ? element.parent : null;
  while (current) {
    const id = current.attribs?.id;
    const className = current.attribs?.class?.split(/\s+/).find((value) => /section|grid|carousel|products|content/i.test(value));
    if (id) ids.push(id);
    else if (className) ids.push(className);
    current = current.parent && "name" in current.parent ? current.parent : null;
  }
  return [...new Set(ids)];
}

function mergeOccurrence(
  entity: ProductRecord | ContentItemRecord,
  element: Element,
  card: cheerio.Cheerio<Element>,
  url: string | null,
): void {
  entity.occurrence_count += 1;
  entity.source_selectors = [...new Set([...entity.source_selectors, selectorFor(element)])];
  entity.source_section_ids = [...new Set([...entity.source_section_ids, ...sourceSectionIds(element)])];
  if (url) entity.original_urls = [...new Set([...entity.original_urls, url])];
  if (!entity.description) entity.description = findDescription(card);
}

function isHiddenDuplicate(card: cheerio.Cheerio<Element>): boolean {
  const style = card.attr("style")?.replace(/\s/g, "").toLowerCase() ?? "";
  return card.attr("aria-hidden") === "true" || card.attr("hidden") !== undefined || /display:none|visibility:hidden/.test(style);
}

function isCarouselClone(card: cheerio.Cheerio<Element>): boolean {
  const value = `${card.attr("class") ?? ""} ${card.attr("data-clone") ?? ""}`.toLowerCase();
  return /swiper-slide-duplicate|carousel-clone|slick-cloned|clone|duplicate/.test(value);
}

function collectCandidates($: cheerio.CheerioAPI): Element[] {
  const seen = new Set<Element>();
  const candidates: Element[] = [];
  for (const selector of PRODUCT_SELECTORS) {
    $(selector).each((_, element) => {
      const typed = element as Element;
      if (!seen.has(typed)) {
        seen.add(typed);
        candidates.push(typed);
      }
    });
  }
  return candidates;
}

function isProductCandidate(card: cheerio.Cheerio<Element>, pageUrl: string): boolean {
  if (card.is(".product, li.product, .product-card, .product-item, [data-product-id], [itemtype*='Product'], [data-content-card], [data-card], .service-card, .saas-card, .solution-card, .feature-card, .pricing-card, .resource-card, .content-card")) return true;
  if (card.is("div.group") && card.find("img, picture").length > 0 && findTitle(card)) return true;
  if (card.is("article") && (findTitle(card) || findDescription(card)) && (findProductUrl(card, pageUrl) || card.find("img, picture").length > 0)) return true;
  return Boolean(findProductUrl(card, pageUrl) && parsePricing(card).price !== null);
}

function classifyCandidate(card: cheerio.Cheerio<Element>, url: string | null, $: cheerio.CheerioAPI): {
  type: ContentItemType;
  evidence: string[];
  reason: string;
} {
  const evidence: string[] = [];
  const value = `${card.attr("class") ?? ""} ${card.attr("data-content-type") ?? ""} ${card.attr("data-product-type") ?? ""} ${card.attr("itemtype") ?? ""} ${card.text()}`.toLowerCase();
  const classes = card.attr("class") ?? "";
  const pricing = parsePricing(card);
  const hasPurchaseAction = /add-to-cart|add_to_cart|buy-now|buy_now|purchase|checkout/i.test(classes)
    || card.find("a, button").toArray().some((element) => /add\s+to\s+cart|buy\s+now|purchase|checkout/i.test($(element).text()));
  const hasProductSchema = /product/i.test(card.attr("itemtype") ?? "") || card.find('[itemtype*="Product"], [itemprop="price"], [itemprop="sku"], [itemprop="availability"]').length > 0;
  const hasProductSelector = card.is(".product, li.product, .product-card, .product-item, [data-product-id], .woocommerce-loop-product__link, .woocommerce-LoopProduct-link");
  const hasProductUrl = Boolean(url && /product|shop|item|sku/i.test(url));
  if (url) evidence.push("link_context");
  if (card.find("img, picture").length) evidence.push("image");
  if (card.find("h1, h2, h3, h4, h5, h6, [itemprop='name']").length) evidence.push("heading");
  if (hasProductSelector) evidence.push("matched-product-selector");
  if (hasProductSchema) evidence.push("product-schema");
  if (pricing.price !== null) evidence.push(`detected-price:${pricing.currency ?? "unknown"}:${pricing.price}`);
  if (hasPurchaseAction) evidence.push("purchase-action");
  if (hasProductUrl) evidence.push("product-detail-url");

  const ecommerceStrong = hasProductSchema || hasPurchaseAction || Boolean(card.attr("data-product-id")) || (hasProductSelector && (pricing.price !== null || Boolean(url))) || (hasProductUrl && pricing.price !== null);
  if (ecommerceStrong) return { type: "ecommerce_product", evidence, reason: "Classified as ecommerce_product from product structure and purchase or price evidence." };
  if (/solution|solutions/.test(value)) return { type: "solution", evidence: [...evidence, "solution-signal"], reason: "Classified as solution from card class or content language." };
  if (/service|consulting|booking|agency/.test(value)) return { type: "service", evidence: [...evidence, "service-signal"], reason: "Classified as service from card class or service language." };
  if (/feature|benefit|capability/.test(value)) return { type: "feature", evidence: [...evidence, "feature-signal"], reason: "Classified as feature from card class or feature language." };
  if (/portfolio|project|case-study|case study/.test(value)) return { type: "portfolio_item", evidence: [...evidence, "portfolio-signal"], reason: "Classified as portfolio_item from card structure or content language." };
  if (/blog|article|post|news/.test(value)) return { type: "blog_post", evidence: [...evidence, "article-signal"], reason: "Classified as blog_post from card structure or content language." };
  if (/course|lesson|training|academy/.test(value)) return { type: "course", evidence: [...evidence, "course-signal"], reason: "Classified as course from card structure or content language." };
  if (/property|real estate|listing/.test(value)) return { type: "property", evidence: [...evidence, "property-signal"], reason: "Classified as property from card structure or content language." };
  if (/category|collection/.test(value)) return { type: "category", evidence: [...evidence, "category-signal"], reason: "Classified as category from card structure or content language." };
  if (/event|webinar|conference/.test(value)) return { type: "event", evidence: [...evidence, "event-signal"], reason: "Classified as event from card structure or content language." };
  if (/encyclopedia|wiki|article/.test(value)) return { type: "encyclopedia_article", evidence: [...evidence, "encyclopedia-signal"], reason: "Classified as encyclopedia_article from card structure or content language." };
  if (url || evidence.includes("heading") || evidence.includes("image")) return { type: "generic_content_card", evidence, reason: "Classified as generic_content_card because a repeated card structure was detected without stronger type evidence." };
  return { type: "unknown", evidence, reason: "No reliable classification evidence was found." };
}

function findProductId(card: cheerio.Cheerio<Element>, url: string | null, title: string | null): string {
  const value =
    card.attr("data-product-id") ??
    card.attr("data-product") ??
    card.find('[itemprop="sku"], [itemprop="productID"], .sku').first().text().trim() ??
    "";
  return value || slug(`${url ?? ""}-${title ?? ""}`) || "product-unknown";
}

function findTitle(card: cheerio.Cheerio<Element>): string | null {
  const value = card.find('[itemprop="name"], .product-title, .product-name, .woocommerce-loop-product__title, h2, h3, h4, a[rel="bookmark"]').first().text().trim();
  return value || null;
}

function findProductUrl(card: cheerio.Cheerio<Element>, pageUrl: string): string | null {
  const href = card.find('[itemprop="url"], a.woocommerce-LoopProduct-link, a.woocommerce-loop-product__link, a[href]').first().attr("href");
  if (!href) return null;
  const normalized = normalizeUrl(href, pageUrl);
  return normalized.accepted ? normalized.value : null;
}

function findDescription(card: cheerio.Cheerio<Element>): string | null {
  const value = card.find('[itemprop="description"], .description, .product-description, .short-description, .woocommerce-product-details__short-description, p').first().text().trim();
  return value || null;
}

function parsePricing(card: cheerio.Cheerio<Element>): {
  price: number | null;
  old_price: number | null;
  currency: string | null;
  is_on_sale: boolean;
} {
  const sale = card.find(".sale-price, .price ins, [itemprop='price']").first().text().trim();
  const old = card.find(".old-price, del, .price del, .regular-price, [data-regular-price]").first().text().trim();
  const combined = sale || card.find(".price, .woocommerce-Price-amount, [itemprop='price']").first().text().trim() || card.text().match(/(?:rs\.?|usd|eur|gbp|inr|\$|€|£|₹)\s*[\d,]+(?:\.\d{1,2})?/i)?.[0] || "";
  const current = parseMoney(combined);
  const previous = parseMoney(old);
  return {
    price: current.value,
    old_price: previous.value,
    currency: current.currency ?? previous.currency,
    is_on_sale: card.is(".sale, .on-sale") || card.find(".onsale, .sale-badge").length > 0,
  };
}

function parseMoney(value: string): { value: number | null; currency: string | null } {
  if (!value) return { value: null, currency: null };
  const currencySymbol = value.match(/[€£$¥₹]/)?.[0] ?? null;
  const numericValue = value.replace(/[^\d,.-]/g, "");
  const normalizedValue = numericValue.includes(",") && !numericValue.includes(".") && /,\d{1,2}$/.test(numericValue)
    ? numericValue.replace(",", ".")
    : numericValue.replace(/,/g, "");
  const numberMatch = normalizedValue.match(/-?\d+(?:\.\d{1,2})?/);
  return { value: numberMatch ? Number(numberMatch[0]) : null, currency: currencySymbol ? symbolToCurrency(currencySymbol) : null };
}

function symbolToCurrency(symbol: string): string {
  return { $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₹": "INR" }[symbol] ?? symbol;
}

function detectProductType(card: cheerio.Cheerio<Element>): ProductType {
  const value = `${card.attr("data-product-type") ?? ""} ${card.attr("itemtype") ?? ""} ${card.text()}`.toLowerCase();
  if (/subscription|membership/.test(value)) return "subscription";
  if (/digital|download/.test(value)) return "digital";
  if (/service|consulting|booking/.test(value)) return "service";
  if (card.find('[itemtype*="Product"]').length || /physical/.test(value)) return "physical";
  return "unknown";
}

function findActions(card: cheerio.Cheerio<Element>, $: cheerio.CheerioAPI, pageUrl: string): ProductAction[] {
  const actions: ProductAction[] = [];
  card.find("a, button").each((_, element) => {
    const item = $(element);
    const label = item.text().replace(/\s+/g, " ").trim() || item.attr("aria-label") || item.attr("title") || "";
    if (!label) return;
    const lower = label.toLowerCase();
    const href = item.attr("href");
    const normalized = href ? normalizeUrl(href, pageUrl) : null;
    const isWhatsApp = lower.includes("whatsapp") || Boolean(href && /wa\.me|api\.whatsapp\.com/i.test(href));
    const type = isWhatsApp ? "buy_via_whatsapp" : /add to cart/.test(lower) ? "add_to_cart" : /buy now/.test(lower) ? "buy_now" : /view product|view details|details/.test(lower) ? "view_product" : null;
    if (type) actions.push({ label, href: normalized?.accepted ? normalized.value : href ?? null, type });
  });
  return dedupeActions(actions);
}

function dedupeActions(actions: ProductAction[]): ProductAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.type}:${action.href ?? action.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function selectorFor(element: Element): string {
  return element.name + (element.attribs.class ? `.${element.attribs.class.trim().split(/\s+/).join(".")}` : "");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/https?:\/\//, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
