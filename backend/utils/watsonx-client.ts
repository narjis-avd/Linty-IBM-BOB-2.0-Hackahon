import axios from 'axios';

export interface WatsonXConfig {
  apiKey: string;
  url: string;
  projectId: string;
  modelId: string;
}

export interface WatsonXResponse {
  output: string;
  generatedToken?: string;
}

export class WatsonXClient {
  private config: WatsonXConfig;
  private token?: string;

  constructor(config: WatsonXConfig) {
    this.config = config;
  }

  async authenticate(): Promise<void> {
    try {
      const response = await axios.post(
        `${this.config.url}/v1/ai/models`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      this.token = response.data.tokens?.[0]?.value || this.config.apiKey;
    } catch (error) {
      console.error('WatsonX authentication failed:', error);
      throw new Error('Failed to authenticate with IBM watsonx');
    }
  }

  async generateText(prompt: string, jsonMode: boolean = true): Promise<WatsonXResponse> {
    if (!this.token) {
      await this.authenticate();
    }

    const systemPrompt = jsonMode
      ? `You are a specialized AI code analysis assistant. You MUST respond ONLY with valid JSON matching the specified schema. No additional text, explanations, or markdown formatting.`
      : 'You are a specialized AI code analysis assistant.';

    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    try {
      const response = await axios.post(
        `${this.config.url}/v1/inference/${this.config.modelId}`,
        {
          messages,
          parameters: {
            temperature: 0.2,
            max_tokens: 2000,
            top_p: 1,
            top_k: 50,
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        output: response.data.generation.output,
      };
    } catch (error) {
      console.error('WatsonX generation failed:', error);
      throw new Error('Failed to generate response from AI model');
    }
  }
}
