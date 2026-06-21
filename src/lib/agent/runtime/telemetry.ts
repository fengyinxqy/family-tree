const SENSITIVE_KEY = /(?:api.?key|token|password|credential|secret|storage.?key|file|payload|content)/i;

export function sanitizeAgentTelemetry(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[depth-limited]";
  if (typeof value === "string") return value.length > 300 ? `${value.slice(0, 300)}…` : value;
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitizeAgentTelemetry(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[redacted]" : sanitizeAgentTelemetry(item, depth + 1),
    ]));
  }
  return String(value);
}

export function logAgentRuntimeEvent(event: string, metadata: Record<string, unknown>) {
  console.info(JSON.stringify({
    scope: "agent-runtime",
    event,
    timestamp: new Date().toISOString(),
    ...sanitizeAgentTelemetry(metadata) as Record<string, unknown>,
  }));
}

