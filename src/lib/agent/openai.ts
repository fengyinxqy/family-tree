import { ZodType } from "zod";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-5.5";
const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";

type AgentProvider = "openai" | "deepseek";

interface StructuredCompletionParams<T> {
  schemaName: string;
  schema: Record<string, unknown>;
  validator: ZodType<T>;
  systemPrompt: string;
  userPrompt: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      refusal?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
}

function getAgentProvider(): AgentProvider {
  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();

  if (provider === "openai" || provider === "deepseek") {
    return provider;
  }

  throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
}

export function getAgentModel() {
  const provider = getAgentProvider();
  if (provider === "deepseek") {
    return process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;
  }
  return process.env.OPENAI_AGENT_MODEL || DEFAULT_OPENAI_MODEL;
}

function getProviderConfig() {
  const provider = getAgentProvider();

  if (provider === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error("Missing DEEPSEEK_API_KEY environment variable.");
    }

    return {
      provider,
      apiKey,
      apiUrl: `${process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL}/chat/completions`,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }

  return {
    provider,
    apiKey,
    apiUrl: OPENAI_API_URL,
  };
}

export async function createStructuredCompletion<T>({
  schemaName,
  schema,
  validator,
  systemPrompt,
  userPrompt,
}: StructuredCompletionParams<T>): Promise<T> {
  const { provider, apiKey, apiUrl } = getProviderConfig();

  const messages = provider === "deepseek"
    ? [
        {
          role: "system",
          content: [
            systemPrompt,
            "",
            "You must return exactly one JSON object.",
            "Do not wrap it in markdown and do not add any extra explanation.",
            `Schema name: ${schemaName}`,
            `JSON Schema: ${JSON.stringify(schema)}`,
          ].join("\n"),
        },
        { role: "user", content: userPrompt },
      ]
    : [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

  const requestBody = provider === "deepseek"
    ? {
        model: getAgentModel(),
        temperature: 0.1,
        messages,
        response_format: {
          type: "json_object",
        },
      }
    : {
        model: getAgentModel(),
        temperature: 0.1,
        messages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            strict: true,
            schema,
          },
        },
      };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const json = (await response.json()) as ChatCompletionResponse;

  if (!response.ok) {
    throw new Error(json.error?.message || "AI provider request failed.");
  }

  const message = json.choices?.[0]?.message;
  if (!message) {
    throw new Error("AI provider response did not include a message.");
  }

  if (message.refusal) {
    throw new Error(`AI provider refused the request: ${message.refusal}`);
  }

  if (!message.content) {
    throw new Error("AI provider response did not include structured content.");
  }

  const parsed = JSON.parse(message.content) as unknown;
  return validator.parse(parsed);
}
