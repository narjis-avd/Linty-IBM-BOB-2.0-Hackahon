"use client";

import { FormEvent, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { websiteUrlSchema } from "@/lib/validation";

export function AnalyzerForm() {
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = websiteUrlSchema.safeParse(url);

    if (!result.success) {
      setNotice("Enter a valid public URL to continue.");
      return;
    }

    setNotice("Analysis is not connected yet. Your URL is ready for the analyzer layer.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label htmlFor="website-url" className="sr-only">
        Website URL
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id="website-url"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="acn.com.pk or https://example.com"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setNotice("");
          }}
          aria-describedby="form-status"
        />
        <Button type="submit">
          Analyze Website
          <ArrowRight size={16} strokeWidth={2} />
        </Button>
      </div>
      <p id="form-status" className="min-h-5 font-mono text-xs text-zinc-500" aria-live="polite">
        {notice || "Only public frontend metadata will be considered."}
      </p>
    </form>
  );
}
