"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Check,
  GitBranch,
  Loader2,
  ScrollText,
  Sparkles,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  buildSuggestionChips,
  buildSuggestionHints,
} from "@/lib/family-graph";
import { presentAgentArtifact } from "@/lib/agent/runtime/artifact-presentation";
import type { IntakeDraft } from "@/lib/agent/types";
import type { RelationshipData, WorkspacePersonData } from "@/types";

interface RelationshipAgentResponse {
  ok: boolean;
  reason: string | null;
  message: string;
  inference?: {
    found: boolean;
    relationship: string | null;
    inverseRelationship: string | null;
    explanation: string;
    path: Array<{
      fromPersonId: string;
      toPersonId: string;
      kind: "spouse" | "parent" | "child";
    }>;
  };
  sourcePerson?: {
    id: string;
    name: string;
  };
  targetPerson?: {
    id: string;
    name: string;
  };
}

interface AgentMessage {
  id: string;
  role: "assistant" | "user";
  title: string;
  body: string;
}

type AgentStreamEvent =
  | { type: "delta"; content: string }
  | {
      type: "metadata";
      draft?: IntakeDraft;
      relationshipResult?: RelationshipAgentResponse;
    }
  | { type: "done" }
  | { type: "error"; error?: string; message?: string }
  | { type: "text_delta"; runId: string; content: string }
  | { type: "step"; runId: string; node: string; status: string }
  | { type: "tool"; runId: string; tool: string; status: string }
  | { type: "artifact"; runId: string; artifact: unknown }
  | { type: "interruption"; runId: string; interruption: RuntimeInterruption }
  | { type: "done"; runId: string; reason: string };

interface RuntimeInterruption {
  kind: "CLARIFICATION" | "CONFIRMATION";
  reason: string;
  question: string;
  options: Array<{ value: string; label: string }>;
  pendingTool?: { name: string; argumentsHash: string; summary: string };
  expiresAt: string;
}

const runtimeEnabled = process.env.NEXT_PUBLIC_AGENT_RUNTIME_ENABLED === "true";

function MessageLog({ messages, busyLabel }: { messages: AgentMessage[]; busyLabel: string | null }) {
  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-3">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
        <ScrollText className="size-4" />
        最近对话
      </div>
      <div className="app-scrollbar flex max-h-72 flex-col gap-3 overflow-y-auto pr-1">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.role === "assistant" ? (
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="size-4" />
              </div>
            ) : null}
            <div
              className={
                message.role === "user"
                  ? "max-w-[86%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "max-w-[86%] rounded-2xl border border-border/70 bg-card px-3 py-2 text-sm text-card-foreground"
              }
            >
              <div className="mb-1 text-xs font-medium opacity-75">{message.title}</div>
              <div className="max-w-none text-sm [&_p]:leading-relaxed [&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5 [&_strong]:font-semibold [&_hr]:my-2 [&_hr]:border-border/40 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold"><ReactMarkdown>{message.body}</ReactMarkdown></div>
            </div>
            {message.role === "user" ? (
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <UserRound className="size-4" />
              </div>
            ) : null}
          </div>
        ))}
        {busyLabel ? (
          <div className="flex gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="size-4" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {busyLabel}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DraftCard({
  draft,
  onApply,
  isApplying,
}: {
  draft: IntakeDraft;
  onApply: () => void;
  isApplying: boolean;
}) {
  return (
    <Card size="sm" className="border border-border/70 bg-background/75">
      <CardHeader>
        <CardTitle>待确认草稿</CardTitle>
        <CardDescription>{draft.summary}</CardDescription>
        <CardAction>
          <Badge variant={draft.readyToApply ? "default" : "secondary"}>
            {draft.readyToApply ? "可创建修订" : "待确认"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <Sparkles className="size-4 text-primary" />
            人物
          </div>
          <div className="flex flex-wrap gap-2">
            {draft.persons.map((person) => (
              <Badge key={person.ref} variant={person.action === "reuse" ? "secondary" : "outline"}>
                {person.name} · {person.action === "reuse" ? "复用" : "新增"}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <GitBranch className="size-4 text-primary" />
            关系
          </div>
          <div className="flex flex-wrap gap-2">
            {draft.relationships.map((relationship) => (
              <Badge key={relationship.ref} variant={relationship.action === "create" ? "outline" : "secondary"}>
                {relationship.type === "spouse" ? "配偶" : "子女"} ·{" "}
                {relationship.action === "create" ? "新增" : "跳过"}
              </Badge>
            ))}
          </div>
        </div>

        {draft.ambiguities.length > 0 ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>仍有待确认项</AlertTitle>
            <AlertDescription className="space-y-1">
              {draft.ambiguities.map((ambiguity, index) => (
                <p key={`${ambiguity.kind}-${index}`}>
                  {ambiguity.message}
                  {ambiguity.question ? ` ${ambiguity.question}` : ""}
                </p>
              ))}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex justify-end">
          <Button onClick={onApply} disabled={!draft.readyToApply || isApplying}>
            {isApplying ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Check data-icon="inline-start" />
            )}
            创建待审修订
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RelationshipCard({ result }: { result: RelationshipAgentResponse }) {
  if (!result.ok || !result.inference || !result.sourcePerson || !result.targetPerson) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>关系建议暂时不可用</AlertTitle>
        <AlertDescription>{result.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card size="sm" className="border border-border/70 bg-background/75">
      <CardHeader>
        <CardTitle>关系结果</CardTitle>
        <CardDescription>
          {result.sourcePerson.name} 与 {result.targetPerson.name}
        </CardDescription>
        <CardAction>
          <Badge>{result.inference.relationship ?? "已识别"}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
          <p className="text-sm text-muted-foreground">
            {result.targetPerson.name} 是 {result.sourcePerson.name} 的
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {result.inference.relationship ?? "未命名关系"}
          </p>
        </div>

        <Alert>
          <Bot />
          <AlertTitle>关系说明</AlertTitle>
          <AlertDescription>{result.inference.explanation}</AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-2">
          {result.inference.path.map((hop, index) => (
            <Badge key={`${hop.fromPersonId}-${hop.toPersonId}-${index}`} variant="outline">
              {hop.kind === "spouse" ? "配偶" : hop.kind === "parent" ? "父母" : "子女"}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentPanel({
  selectedPerson,
  persons,
  relationships,
  onDraftApplied,
}: {
  selectedPerson: WorkspacePersonData | null;
  persons: WorkspacePersonData[];
  relationships: RelationshipData[];
  onDraftApplied?: () => void;
}) {
  const router = useRouter();
  const [chatInput, setChatInput] = useState("");
  const [draft, setDraft] = useState<IntakeDraft | null>(null);
  const [draftSourceText, setDraftSourceText] = useState("");
  const [relationshipResult, setRelationshipResult] = useState<RelationshipAgentResponse | null>(null);
  const [runtimeSessionId, setRuntimeSessionId] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [interruption, setInterruption] = useState<RuntimeInterruption | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      title: "谱小助",
      body: "我是谱小助，可以帮你录入家谱、查询关系、分析资料缺口。直接告诉我你想做什么就好。",
    },
  ]);
  const [isSubmitting, startSubmitting] = useTransition();
  const [isApplying, startApplying] = useTransition();
  const messageIdCounter = useRef(0);

  useEffect(() => {
    if (!runtimeEnabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/agent/sessions");
        if (!response.ok) return;
        const data = await response.json() as { sessions?: Array<{ id: string }> };
        const latest = data.sessions?.[0];
        if (!latest || cancelled) return;
        setRuntimeSessionId(latest.id);
        const detailResponse = await fetch(`/api/agent/sessions/${latest.id}`);
        if (!detailResponse.ok || cancelled) return;
        const detail = await detailResponse.json() as {
          session?: {
            messages?: Array<{ id: string; role: string; content: string }>;
            currentRun?: { id: string; status: string; interruption?: RuntimeInterruption | null } | null;
          };
        };
        const persisted = detail.session?.messages ?? [];
        if (persisted.length > 0) {
          setMessages(persisted.filter((item) => item.role === "USER" || item.role === "ASSISTANT").map((item) => ({
            id: item.id,
            role: item.role === "USER" ? "user" : "assistant",
            title: item.role === "USER" ? "你" : "谱小助",
            body: item.content,
          })));
        }
        const currentRun = detail.session?.currentRun;
        if (currentRun) {
          setActiveRunId(currentRun.id);
          setRunStatus(currentRun.status);
          setInterruption(currentRun.interruption ?? null);
        }
      } catch {
        // 会话恢复失败不阻止用户开始新会话。
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const suggestionChips = useMemo(() => buildSuggestionChips(selectedPerson), [selectedPerson]);
  const suggestionHints = useMemo(
    () => buildSuggestionHints(selectedPerson, relationships),
    [selectedPerson, relationships],
  );

  function pushMessage(message: AgentMessage) {
    setMessages((current) => current.concat(message));
  }

  function nextMessageId(prefix: string) {
    messageIdCounter.current += 1;
    return `${prefix}-${messageIdCounter.current}`;
  }

  function updateMessageBody(id: string, updater: (body: string) => string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === id
          ? { ...message, body: updater(message.body) }
          : message,
      ),
    );
  }

  async function readAgentStream(response: Response, assistantMessageId: string) {
    if (!response.body) {
      throw new Error("AI 助手没有返回可读取的流。");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const handleLine = (line: string) => {
      const event = JSON.parse(line) as AgentStreamEvent;

      if (event.type === "delta" || event.type === "text_delta") {
        updateMessageBody(assistantMessageId, (body) => body + event.content);
        return;
      }

      if (event.type === "metadata") {
        if (event.draft) {
          setDraft(event.draft);
        }
        if (event.relationshipResult) {
          setRelationshipResult(event.relationshipResult);
        }
        return;
      }

      if (event.type === "artifact") {
        const presented = presentAgentArtifact(event.artifact);
        if (presented.draft) setDraft(presented.draft);
        if (presented.text) updateMessageBody(assistantMessageId, (body) => body || presented.text || "");
        return;
      }

      if (event.type === "interruption") {
        setActiveRunId(event.runId);
        setInterruption(event.interruption);
        setRunStatus(event.interruption.kind === "CONFIRMATION" ? "WAITING_FOR_CONFIRMATION" : "WAITING_FOR_USER");
        updateMessageBody(assistantMessageId, (body) => body || event.interruption.question);
        return;
      }

      if (event.type === "step") {
        setRunStatus(`${event.node} · ${event.status}`);
        return;
      }

      if (event.type === "done" && "reason" in event) {
        setRunStatus(event.reason);
        if (!["WAITING_FOR_USER", "WAITING_FOR_CONFIRMATION"].includes(event.reason)) {
          setActiveRunId(null);
          setInterruption(null);
        }
        return;
      }

      if (event.type === "error") {
        throw new Error(event.error || event.message || "AI 助手请求失败");
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          handleLine(trimmed);
        }
      }
    }

    const remaining = buffer.trim();
    if (remaining) {
      handleLine(remaining);
    }
  }

  async function ensureRuntimeSession() {
    if (runtimeSessionId) return runtimeSessionId;
    const response = await fetch("/api/agent/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: selectedPerson ? `${selectedPerson.name} 资料补全` : "家谱资料补全" }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "创建 Agent 会话失败");
    const id = json.session.id as string;
    setRuntimeSessionId(id);
    return id;
  }

  function handleSendMessage(input?: string) {
    const text = (input ?? chatInput).trim();
    if (!text) {
      toast.error("请先输入内容。");
      return;
    }

    setChatInput("");
    setDraft(null);
    setDraftSourceText(text);
    setRelationshipResult(null);
    const assistantMessageId = nextMessageId("assistant");

    pushMessage({
      id: nextMessageId("user"),
      role: "user",
      title: selectedPerson ? `关于 ${selectedPerson.name}` : "家谱助手",
      body: text,
    });
    pushMessage({
      id: assistantMessageId,
      role: "assistant",
      title: "谱小助",
      body: "",
    });

    startSubmitting(async () => {
      try {
        const sessionId = runtimeEnabled ? await ensureRuntimeSession() : null;
        const response = await fetch(runtimeEnabled ? "/api/agent/runs" : "/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(runtimeEnabled ? { sessionId, goal: text } : { message: text }),
        });

        if (!response.ok) {
          const json = await response.json();
          throw new Error(json.error || "AI 助手请求失败");
        }

        await readAgentStream(response, assistantMessageId);
        updateMessageBody(assistantMessageId, (body) => body || "已处理完成。");
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI 助手请求失败";
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageId
              ? { ...item, title: "出错了", body: message }
              : item,
          ),
        );
        toast.error(message);
      }
    });
  }

  function handleResumeRuntime(input: { answer?: string; confirmation?: boolean }) {
    if (!activeRunId || !interruption) return;
    const assistantMessageId = nextMessageId("assistant-resume");
    pushMessage({ id: assistantMessageId, role: "assistant", title: "谱小助", body: "" });
    startSubmitting(async () => {
      try {
        const response = await fetch(`/api/agent/runs/${activeRunId}/resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...input,
            argumentsHash: interruption.pendingTool?.argumentsHash,
          }),
        });
        if (!response.ok) {
          const json = await response.json();
          throw new Error(json.error || "恢复 Agent 运行失败");
        }
        setInterruption(null);
        await readAgentStream(response, assistantMessageId);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "恢复 Agent 运行失败");
      }
    });
  }

  async function handleCancelRuntime() {
    if (!activeRunId) return;
    const response = await fetch(`/api/agent/runs/${activeRunId}/cancel`, { method: "POST" });
    if (response.ok) {
      setActiveRunId(null);
      setInterruption(null);
      setRunStatus("CANCELLED");
      toast.success("已取消 Agent 运行");
    } else {
      const json = await response.json();
      toast.error(json.error || "取消失败");
    }
  }

  function handleApplyDraft() {
    if (!draft) {
      return;
    }

    startApplying(async () => {
      try {
        const response = await fetch("/api/agent/intake/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft, sourceText: draftSourceText, conversationRounds: 1 }),
        });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || "待审修订创建失败");
        }

        pushMessage({
          id: `assistant-apply-${Date.now()}`,
          role: "assistant",
          title: "待审修订已创建",
          body: "AI 建议已保存为待审修订，正式家谱不会在审校发布前发生变化。",
        });
        setDraft(null);
        router.push(json.kind === "revision" ? `/reviews?revision=${json.revisionId}` : `/reviews?group=${json.groupId}`);
        onDraftApplied?.();
        toast.success("待审修订已创建。");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "待审修订创建失败");
      }
    });
  }

  return (
    <Card className="relative flex h-full flex-col rounded-[1.4rem] border-border/70 bg-transparent bg-card/86 shadow-none">
      <CardHeader className="border-b border-border/70">
        <CardTitle className="flex items-center gap-2 text-[1.1rem]">
          <Bot className="text-primary" />
          AI 修谱助手
        </CardTitle>
        <CardDescription>
          {runtimeEnabled ? "受约束 Agent：多步调查、人工确认、可恢复运行。" : "直接对话：录入家谱、查询关系、分析资料缺口。"}
        </CardDescription>
      </CardHeader>

      <CardContent className="app-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-4">
        <div className="rounded-[1.4rem] border border-border/70 bg-background/68 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                当前上下文
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {selectedPerson ? selectedPerson.name : "未选中成员"}
              </p>
            </div>
            <Badge variant="secondary">{persons.length} 位成员</Badge>
          </div>
          <div className="mt-3 space-y-2">
            {suggestionHints.map((hint) => (
              <div key={hint.id} className="rounded-2xl border border-border/60 bg-card/75 px-3 py-2">
                <p className="text-sm font-medium text-foreground">{hint.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint.description}</p>
              </div>
            ))}
          </div>
        </div>

        <MessageLog
          messages={messages}
          busyLabel={isSubmitting ? "正在思考…" : isApplying ? "正在创建待审修订…" : null}
        />

        <Separator />

        {runtimeEnabled && runStatus ? (
          <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/72 px-3 py-2 text-xs">
            <span className="text-muted-foreground">运行状态：{runStatus}</span>
            {activeRunId ? <Button size="sm" variant="ghost" onClick={handleCancelRuntime}>取消运行</Button> : null}
          </div>
        ) : null}

        {runtimeEnabled && interruption ? (
          <Alert>
            <TriangleAlert />
            <AlertTitle>{interruption.reason}</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{interruption.question}</p>
              {interruption.kind === "CONFIRMATION" ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleResumeRuntime({ confirmation: true })}>确认创建待审修订</Button>
                  <Button size="sm" variant="outline" onClick={() => handleResumeRuntime({ confirmation: false })}>取消</Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {interruption.options.map((option) => (
                    <Button key={option.value} size="sm" variant="outline" onClick={() => handleResumeRuntime({ answer: option.value })}>
                      {option.label}
                    </Button>
                  ))}
                </div>
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        {/* 快捷建议 */}
        {suggestionChips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestionChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleSendMessage(chip.question)}
                disabled={isSubmitting}
                className="rounded-full border border-border/70 bg-card/72 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground disabled:opacity-50"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* 统一聊天输入 */}
        <div className="space-y-3">
          <Textarea
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={
              selectedPerson
                ? `试试：补充 ${selectedPerson.name} 的生平信息 · ${selectedPerson.name} 和XX是什么关系 · ${selectedPerson.name} 还缺什么信息`
                : "直接告诉我：录入家谱信息、查询人物关系、分析资料缺口……"
            }
            disabled={isSubmitting}
            className="min-h-24 bg-background/72"
          />
          <div className="flex justify-end">
            <Button onClick={() => handleSendMessage()} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Sparkles data-icon="inline-start" />
              )}
              发送
            </Button>
          </div>
        </div>

      </CardContent>

      {(draft || relationshipResult) ? (
        <div className="border-t border-border/60 px-(--card-spacing) py-4">
          {draft ? <DraftCard draft={draft} onApply={handleApplyDraft} isApplying={isApplying} /> : null}
          {relationshipResult ? <RelationshipCard result={relationshipResult} /> : null}
        </div>
      ) : null}
    </Card>
  );
}
