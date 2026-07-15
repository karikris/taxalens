import OpenAI from 'openai'

import type { ResearchAnalystResponsesTransport } from './researchAnalyst'

export interface ServerOpenAITransportOptions {
  readonly apiKey: string
}

export function createServerOpenAITransport(
  options: ServerOpenAITransportOptions,
): ResearchAnalystResponsesTransport {
  if (typeof globalThis.window !== 'undefined') {
    throw new Error('OpenAI transport is server-only; browser API keys are forbidden')
  }
  const apiKey = options.apiKey.trim()
  if (apiKey.length === 0) {
    throw new Error('A server-owned OpenAI API key is required for live analyst calls')
  }
  const client = new OpenAI({ apiKey })
  return {
    async create(request) {
      const response = await client.responses.create(request)
      return {
        id: response.id,
        model: response.model,
        status: response.status ?? 'failed',
        output: response.output,
        output_text: response.output_text,
        usage: response.usage ?? null,
      }
    },
  }
}
