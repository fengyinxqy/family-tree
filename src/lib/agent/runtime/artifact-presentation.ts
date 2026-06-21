import type { IntakeDraft } from "@/lib/agent/types";

export interface PresentedAgentArtifact {
  text: string | null;
  draft: IntakeDraft | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIntakeDraft(value: unknown): value is IntakeDraft {
  return isRecord(value)
    && Array.isArray(value.persons)
    && Array.isArray(value.relationships)
    && typeof value.summary === "string";
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function presentAgentArtifact(artifact: unknown): PresentedAgentArtifact {
  if (!isRecord(artifact)) return { text: null, draft: null };

  if (isIntakeDraft(artifact)) return { text: artifact.summary, draft: artifact };
  if (artifact.kind === "draft" && isIntakeDraft(artifact.draft)) {
    return { text: artifact.draft.summary, draft: artifact.draft };
  }

  const directText = stringValue(artifact.content)
    ?? stringValue(artifact.message)
    ?? stringValue(artifact.summary);

  if (artifact.kind === "report") {
    const sections = directText ? [directText] : [];
    const findings = Array.isArray(artifact.findings) ? artifact.findings : [];
    const findingLines = findings.flatMap((finding) => {
      if (!isRecord(finding)) return [];
      const field = stringValue(finding.field) ?? "资料项";
      const summary = stringValue(finding.summary);
      return summary ? [`- **${field}**：${summary}`] : [];
    });
    if (findingLines.length) sections.push(`调查发现：\n${findingLines.join("\n")}`);

    const questions = Array.isArray(artifact.blockingQuestions)
      ? artifact.blockingQuestions.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      : [];
    if (questions.length) sections.push(`仍需确认：\n${questions.map((item) => `- ${item}`).join("\n")}`);
    return { text: sections.join("\n\n") || null, draft: null };
  }

  if (artifact.kind === "revision") {
    const id = stringValue(artifact.id);
    return {
      text: id ? `已创建待审修订：${id}` : "已创建待审修订。",
      draft: null,
    };
  }

  return { text: directText, draft: null };
}
