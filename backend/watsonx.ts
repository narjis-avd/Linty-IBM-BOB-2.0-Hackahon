// Minimal IBM watsonx.ai chat client: IAM API-key exchange + /ml/v1/text/chat.

const IAM_URL = 'https://iam.cloud.ibm.com/identity/token';
const API_VERSION = '2024-10-08';

export interface WatsonxConfig {
  apiKey: string;
  projectId: string;
  url: string;
  modelId: string;
}

export function watsonxConfigFromEnv(): WatsonxConfig | null {
  const apiKey = process.env.WATSONX_API_KEY;
  const projectId = process.env.WATSONX_PROJECT_ID;
  if (!apiKey || !projectId) return null;
  return {
    apiKey,
    projectId,
    url: (process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com').replace(/\/$/, ''),
    // Granite only: the hackathon guide penalises some non-IBM watsonx models.
    modelId: process.env.WATSONX_MODEL_ID || 'ibm/granite-3-3-8b-instruct',
  };
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(apiKey: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const res = await fetch(IAM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'urn:ibm:params:oauth:grant-type:apikey', apikey: apiKey }),
  });
  if (!res.ok) throw new Error(`IBM Cloud IAM token request failed (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export async function chat(config: WatsonxConfig, prompt: string, maxTokens = 4000): Promise<string> {
  const token = await getToken(config.apiKey);
  const res = await fetch(`${config.url}/ml/v1/text/chat?version=${API_VERSION}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      model_id: config.modelId,
      project_id: config.projectId,
      messages: [
        { role: 'system', content: 'You are part of Linty, an automated code review pipeline. You reply with a single JSON object and nothing else.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`watsonx chat request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('watsonx returned an empty response');
  return content;
}

// Models sometimes wrap JSON in fences or add a sentence; take the outermost object.
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('Model response contained no JSON object');
  return JSON.parse(text.slice(start, end + 1));
}
