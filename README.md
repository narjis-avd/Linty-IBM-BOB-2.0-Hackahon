This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Local analysis history

Completed analyses are saved through the replaceable `AnalysisStore` interface in `lib/store/analysis-store.ts`. By default, the server uses an in-memory store, so history is cleared whenever the server restarts or the deployment instance is replaced. This is intentional and is not durable production persistence.

To use local filesystem persistence on a Node deployment, set `REPLICAFORGE_ANALYSIS_STORE` to a writable JSON file path. The store writes atomically and can later be replaced with a database-backed implementation without changing the API route or dashboard.

## Optional live analyzer tests

Ordinary tests use local fixtures and mocks. The ACN integration test is opt-in and analyzes `https://acn.com.pk/` with the real analyzer. It accepts a completed result or a controlled analyzer failure, prints stable summary counters, and does not assert website-specific counts.

On PowerShell:

```powershell
$env:RUN_LIVE_TESTS = "true"
npm run test -- tests/integration.acn-live.test.ts
```

The test is skipped when `RUN_LIVE_TESTS` is not exactly `true`. A temporary network, DNS, or browser failure is reported as a controlled analyzer failure rather than making the test fail. The test fails only for malformed analyzer output, crashes, or valid HTTP/HTTPS source URLs being classified as `unsupported_protocol`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
