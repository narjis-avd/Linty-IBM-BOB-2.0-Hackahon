import { WatsonXClient, WatsonXResponse } from '../utils/watsonx-client';
import { AgentResponse, AgentResponseSchema } from '../utils/schemas';
import { z } from 'zod';

export abstract class BaseAgent {
  protected client: WatsonXClient;
  protected name: string;

  constructor(client: WatsonXClient, name: string) {
    this.client = client;
    this.name = name;
  }

  abstract execute(input: any): Promise<AgentResponse>;

  protected async generateResponse(
    prompt: string,
    schema: z.ZodType,
    jsonMode: boolean = true
  ): Promise<any> {
    try {
      const response: WatsonXResponse = await this.client.generateText(prompt, jsonMode);
      const result = schema.parse(JSON.parse(response.output));

      return {
        agent: this.name,
        status: 'success',
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`${this.name} failed:`, error);
      return {
        agent: this.name,
        status: 'failed',
        data: null,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  protected async generateWithFallback(
    prompt: string,
    primarySchema: z.ZodType,
    fallbackSchema: z.ZodType,
    jsonMode: boolean = true
  ): Promise<any> {
    try {
      const response: WatsonXResponse = await this.client.generateText(prompt, jsonMode);
      return primarySchema.parse(JSON.parse(response.output));
    } catch (primaryError) {
      console.log(`${this.name} primary schema failed, trying fallback:`, primaryError);

      try {
        const fallbackResponse: WatsonXResponse = await this.client.generateText(prompt, jsonMode);
        return fallbackSchema.parse(JSON.parse(fallbackResponse.output));
      } catch (fallbackError) {
        console.error(`${this.name} fallback schema failed:`, fallbackError);
        return {
          agent: this.name,
          status: 'partial',
          data: { issues: [{ type: 'schema_error', message: 'Failed to parse AI response with available schemas' }] },
          timestamp: new Date().toISOString(),
        };
      }
    }
  }
}
