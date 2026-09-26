import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { inspectPublicUrlWithDns, type UrlRejectionReason } from "./security";

export const DEFAULT_RENDER_TIMEOUT_MS = 20_000;

export type PageRenderFailureCode =
  | "invalid_url"
  | "ssrf_rejected"
  | "browser_launch_failed"
  | "navigation_timeout"
  | "navigation_failed"
  | "render_failed";

export interface RenderPageOptions {
  timeout_ms?: number;
  block_resources?: boolean;
  launch_browser?: typeof chromium.launch;
}

export interface RenderPageSuccess {
  ok: true;
  requested_url: string;
  final_url: string;
  html: string;
  title: string;
  response_status: number | null;
}

export interface RenderPageFailure {
  ok: false;
  requested_url: string;
  final_url: string | null;
  html: null;
  title: null;
  response_status: number | null;
  code: PageRenderFailureCode;
  message: string;
  rejection_reason?: UrlRejectionReason;
}

export type RenderPageResult = RenderPageSuccess | RenderPageFailure;

function failure(
  requested_url: string,
  code: PageRenderFailureCode,
  message: string,
  final_url: string | null = null,
  response_status: number | null = null,
  rejection_reason?: UrlRejectionReason,
): RenderPageFailure {
  return {
    ok: false,
    requested_url,
    final_url,
    html: null,
    title: null,
    response_status,
    code,
    message,
    ...(rejection_reason ? { rejection_reason } : {}),
  };
}

function shouldBlockResource(resourceType: string): boolean {
  return resourceType === "image" || resourceType === "media" || resourceType === "font";
}

async function closeQuietly(resource: Browser | BrowserContext | Page): Promise<void> {
  try {
    await resource.close();
  } catch {
    // Cleanup must not replace the original render result.
  }
}

export async function renderPage(url: string, options: RenderPageOptions = {}): Promise<RenderPageResult> {
  const timeoutMs = options.timeout_ms ?? DEFAULT_RENDER_TIMEOUT_MS;
  const blockResources = options.block_resources ?? true;
  const launchBrowser = options.launch_browser ?? chromium.launch;
  const requested = await inspectPublicUrlWithDns(url);

  if (!requested.accepted || !requested.url) {
    return failure(
      url,
      requested.reason === "invalid_url" ? "invalid_url" : "ssrf_rejected",
      requested.message ?? "The requested URL is not allowed.",
      null,
      null,
      requested.reason ?? undefined,
    );
  }

  let browser: Browser;
  try {
    browser = await launchBrowser({ headless: true });
  } catch {
    return failure(url, "browser_launch_failed", "Chromium could not be launched.");
  }

  let page: Page | null = null;
  try {
    const context = await browser.newContext();
    page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);

    await page.route("**/*", async (route) => {
      const requestUrl = route.request().url();
      const inspected = await inspectPublicUrlWithDns(requestUrl);
      if (!inspected.accepted) {
        await route.abort("blockedbyclient");
        return;
      }

      if (blockResources && shouldBlockResource(route.request().resourceType())) {
        await route.abort("blockedbyclient");
        return;
      }

      await route.continue();
    });

    const response = await page.goto(requested.url.href, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    const finalUrl = page.url();
    const finalTarget = await inspectPublicUrlWithDns(finalUrl);
    if (!finalTarget.accepted) {
      return failure(
        url,
        "ssrf_rejected",
        finalTarget.message ?? "The final navigation target is not allowed.",
        finalUrl,
        response?.status() ?? null,
        finalTarget.reason ?? undefined,
      );
    }

    return {
      ok: true,
      requested_url: url,
      final_url: finalUrl,
      html: await page.content(),
      title: await page.title(),
      response_status: response?.status() ?? null,
    };
  } catch (error) {
    const isTimeout = error instanceof Error && /timeout/i.test(error.name + error.message);
    return failure(
      url,
      isTimeout ? "navigation_timeout" : "navigation_failed",
      isTimeout ? "The page render timed out." : "The page could not be rendered.",
      page?.url() || null,
    );
  } finally {
    if (page) {
      await closeQuietly(page.context());
    }
    await closeQuietly(browser);
  }
}
