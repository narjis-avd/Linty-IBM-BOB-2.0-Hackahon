import { readFileSync } from 'node:fs';
import path from 'node:path';

// The same prompt files drive the Bob IDE modes (.bob/custom_modes.yaml) and the live pipeline.
type PromptName = 'analyzer' | 'fixer' | 'tester' | 'reporter';

export function renderPrompt(name: PromptName, vars: Record<string, string>): string {
  const template = readFileSync(path.join(process.cwd(), 'prompts', `${name}.md`), 'utf8');
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}

export function numberLines(code: string): string {
  return code
    .split('\n')
    .map((line, i) => `${i + 1}| ${line}`)
    .join('\n');
}
