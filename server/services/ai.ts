import { getAIConfig } from "../db.ts";

export interface AIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface AIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: AIToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface AIToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AICompletionResult {
  content: string;
  toolCalls: AIToolCall[];
  model: string;
  usage: unknown;
  finishReason: string | null;
}

export class AIError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "AIError";
    this.status = status;
  }
}

export function isAIConfigured(): boolean {
  return getAIConfig().apiKey.trim().length > 0;
}

export function aiEndpoint(baseUrl: string): string {
  const clean = baseUrl.replace(/\/+$/, "");
  if (clean.endsWith("/chat/completions")) return clean;
  return `${clean}/chat/completions`;
}

export async function chatCompletion(options: {
  messages: AIMessage[];
  tools?: AIToolDefinition[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
}): Promise<AICompletionResult> {
  const config = getAIConfig();
  if (!config.apiKey) {
    throw new AIError(
      "No AI API key is configured. Add a DeepSeek API key in Settings or set DEEPSEEK_API_KEY.",
      503,
    );
  }
  const model = options.model ?? config.model;
  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.4,
    max_tokens: options.maxTokens ?? 4096,
  };
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = "auto";
  }
  if (options.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  let response: Response;
  try {
    response = await fetch(aiEndpoint(config.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? 180_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AIError(`Could not reach the AI provider at ${config.baseUrl}: ${message}`, 502);
  }

  const raw = await response.text();
  if (!response.ok) {
    let detail = raw;
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      detail = parsed.error?.message ?? raw;
    } catch {
      // keep raw
    }
    throw new AIError(`AI provider returned HTTP ${response.status}: ${detail.slice(0, 800)}`, 502);
  }

  let data: {
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: AIToolCall[];
      };
      finish_reason?: string;
    }[];
    model?: string;
    usage?: unknown;
    error?: { message?: string };
  };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    throw new AIError("AI provider returned invalid JSON.", 502);
  }
  if (data.error) throw new AIError(data.error.message ?? "Unknown AI provider error.", 502);
  const choice = data.choices?.[0];
  if (!choice?.message) throw new AIError("AI provider returned no choices.", 502);
  return {
    content: choice.message.content ?? "",
    toolCalls: choice.message.tool_calls ?? [],
    model: data.model ?? model,
    usage: data.usage,
    finishReason: choice.finish_reason ?? null,
  };
}

export async function testAIConnection(): Promise<{ ok: boolean; message: string; model?: string }> {
  try {
    const result = await chatCompletion({
      messages: [
        { role: "system", content: "You are a connection test. Reply with exactly: OK" },
        { role: "user", content: "Reply with exactly: OK" },
      ],
      temperature: 0,
      maxTokens: 10,
      timeoutMs: 30_000,
    });
    return { ok: true, message: `Connected. Model responded: ${result.content.trim().slice(0, 80) || "(empty)"}`, model: result.model };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export function parseJsonResponse<T>(content: string): T {
  const trimmed = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as T;
    }
    throw new AIError("The AI response was not valid JSON. Try again or use a stronger model.", 502);
  }
}
