import { ChatOpenAI } from "@langchain/openai";

const DEFAULT_OPENAI_MODEL = "gpt-5.5";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";

export type AgentProvider = "openai" | "deepseek";

export class AgentModelConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentModelConfigurationError";
  }
}

export interface AgentModelDescriptor {
  provider: AgentProvider;
  model: string;
  baseUrl: string | null;
}

type AgentEnvironment = Record<string, string | undefined>;

export function getAgentModelDescriptor(env: AgentEnvironment = process.env): AgentModelDescriptor {
  const provider = (env.AI_PROVIDER || "openai").toLowerCase();
  if (provider === "deepseek") {
    if (!env.DEEPSEEK_API_KEY) {
      throw new AgentModelConfigurationError("缺少 DEEPSEEK_API_KEY 环境变量");
    }
    return {
      provider,
      model: env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
      baseUrl: env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL,
    };
  }
  if (provider !== "openai") {
    throw new AgentModelConfigurationError(`不支持的 AI_PROVIDER：${provider}`);
  }
  if (!env.OPENAI_API_KEY) {
    throw new AgentModelConfigurationError("缺少 OPENAI_API_KEY 环境变量");
  }
  return {
    provider,
    model: env.OPENAI_AGENT_MODEL || DEFAULT_OPENAI_MODEL,
    baseUrl: null,
  };
}

export function createAgentChatModel(env: AgentEnvironment = process.env) {
  const descriptor = getAgentModelDescriptor(env);
  const apiKey = descriptor.provider === "deepseek" ? env.DEEPSEEK_API_KEY : env.OPENAI_API_KEY;
  return new ChatOpenAI({
    apiKey,
    model: descriptor.model,
    temperature: 0.2,
    timeout: 30_000,
    maxRetries: 2,
    useResponsesApi: false,
    configuration: descriptor.baseUrl ? { baseURL: descriptor.baseUrl } : undefined,
  });
}

export function classifyAgentModelError(error: unknown) {
  if (error instanceof AgentModelConfigurationError) return "MODEL_CONFIGURATION";
  if (error instanceof Error && /timeout|timed out|abort/i.test(error.message)) return "MODEL_TIMEOUT";
  if (error instanceof Error && /rate|429/i.test(error.message)) return "MODEL_RATE_LIMIT";
  return "MODEL_FAILURE";
}
