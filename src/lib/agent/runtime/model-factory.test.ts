import test from "node:test";
import assert from "node:assert/strict";
import {
  AgentModelConfigurationError,
  classifyAgentModelError,
  createAgentChatModel,
  getAgentModelDescriptor,
} from "./model-factory";

test("读取 OpenAI 模型配置", () => {
  const descriptor = getAgentModelDescriptor({
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: "test-key",
    OPENAI_AGENT_MODEL: "test-model",
  });
  assert.deepEqual(descriptor, { provider: "openai", model: "test-model", baseUrl: null });
});

test("DeepSeek 使用 OpenAI 兼容基础地址", () => {
  const env = {
    AI_PROVIDER: "deepseek",
    DEEPSEEK_API_KEY: "test-key",
    DEEPSEEK_MODEL: "deepseek-test",
    DEEPSEEK_BASE_URL: "https://example.invalid/v1",
  };
  assert.deepEqual(getAgentModelDescriptor(env), {
    provider: "deepseek",
    model: "deepseek-test",
    baseUrl: "https://example.invalid/v1",
  });
  assert.equal(createAgentChatModel(env).model, "deepseek-test");
});

test("缺少密钥时返回可分类配置错误", () => {
  assert.throws(
    () => getAgentModelDescriptor({ AI_PROVIDER: "openai" }),
    AgentModelConfigurationError,
  );
  assert.equal(classifyAgentModelError(new AgentModelConfigurationError("missing")), "MODEL_CONFIGURATION");
  assert.equal(classifyAgentModelError(new Error("request timed out")), "MODEL_TIMEOUT");
  assert.equal(classifyAgentModelError(new Error("429 rate limit")), "MODEL_RATE_LIMIT");
});

