"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Check,
  Clock,
  GitBranch,
  Loader2,
  MessageSquareText,
  ScrollText,
  Sparkles,
  TriangleAlert,
  User,
} from "lucide-react";
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { IntakeDraft } from "@/lib/agent/types";

type AgentTab = "intake" | "relationship";

interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  title: string;
  body: string;
}

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

interface ClarificationEntry {
  /** 轮次序号 (1-based) */
  round: number;
  /** 用户补充文本 */
  userText: string;
  /** 提交时间戳 */
  timestamp: number;
}

function ThinkingCard({ label }: { label: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bot />
      </div>
      <Card className="w-full border border-border/70 bg-card/88 py-3 shadow-none">
        <CardContent className="flex items-center gap-3 px-3">
          <div className="flex items-center gap-1.5">
            <span className="size-2 animate-[agent-dot_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
            <span className="size-2 animate-[agent-dot_1.2s_ease-in-out_0.2s_infinite] rounded-full bg-primary/80" />
            <span className="size-2 animate-[agent-dot_1.2s_ease-in-out_0.4s_infinite] rounded-full bg-primary/60" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">
              正在整理人物、关系与待确认项。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser ? (
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot />
        </div>
      ) : null}

      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-3 py-2 text-sm ring-1",
          isUser
            ? "bg-primary text-primary-foreground ring-primary/20"
            : "bg-card text-card-foreground ring-border/80",
        )}
      >
        <div className="mb-1 text-xs font-medium opacity-80">{message.title}</div>
        <p className="whitespace-pre-wrap leading-relaxed">{message.body}</p>
      </div>

      {isUser ? (
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <User />
        </div>
      ) : null}
    </div>
  );
}

function DraftSummary({
  draft,
  onApply,
  isApplying,
  onClarify,
  isClarifying,
  clarifyCount,
  maxClarifyRounds,
  clarificationHistory,
}: {
  draft: IntakeDraft;
  onApply: () => void;
  isApplying: boolean;
  onClarify?: (text: string) => void;
  isClarifying?: boolean;
  clarifyCount?: number;
  maxClarifyRounds?: number;
  clarificationHistory?: ClarificationEntry[];
}) {
  const [clarifyText, setClarifyText] = useState("");
  const atMaxRounds =
    clarifyCount !== undefined &&
    maxClarifyRounds !== undefined &&
    clarifyCount >= maxClarifyRounds;

  function handleClarifySubmit() {
    const text = clarifyText.trim();
    if (!text || !onClarify) {
      return;
    }
    onClarify(text);
    setClarifyText("");
  }

  return (
    <Card size="sm" className="border border-border/70 bg-background/78">
      <CardHeader>
        <CardTitle>录入草稿</CardTitle>
        <CardDescription>{draft.summary}</CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            {clarifyCount !== undefined && clarifyCount > 0 ? (
              <Badge variant="secondary">
                第 {clarifyCount}/{maxClarifyRounds} 轮澄清
              </Badge>
            ) : null}
            <Badge variant={draft.readyToApply ? "default" : "secondary"}>
              {draft.readyToApply ? "可写入" : "待确认"}
            </Badge>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-primary" />
            人物
          </div>
          <div className="flex flex-wrap gap-2">
            {draft.persons.map((person) => (
              <Badge
                key={person.ref}
                variant={person.action === "reuse" ? "secondary" : "outline"}
              >
                {person.name} · {person.action === "reuse" ? "复用" : "新增"}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <GitBranch className="size-4 text-primary" />
            关系
          </div>
          <div className="flex flex-wrap gap-2">
            {draft.relationships.map((relationship) => (
              <Badge
                key={relationship.ref}
                variant={relationship.action === "create" ? "outline" : "secondary"}
              >
                {relationship.type === "spouse" ? "配偶" : "子女"} ·{" "}
                {relationship.action === "create" ? "新增" : "跳过"}
              </Badge>
            ))}
          </div>
        </div>

        {draft.ambiguities.length > 0 ? (
          <div className="flex flex-col gap-3">
            {draft.ambiguities.map((ambiguity, index) => (
              <Alert key={`${ambiguity.kind}-${index}`} variant="destructive">
                <TriangleAlert />
                <AlertTitle>需要人工确认</AlertTitle>
                <AlertDescription>
                  <p>{ambiguity.message}</p>
                  {ambiguity.question ? (
                    <p className="mt-1 text-sm font-medium text-foreground/80">
                      💬 {ambiguity.question}
                    </p>
                  ) : null}
                  {ambiguity.options.length > 0 ? (
                    <p className="mt-1">候选项：{ambiguity.options.join(" / ")}</p>
                  ) : null}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        ) : null}

        {draft.questions.length > 0 ? (
          <Alert>
            <MessageSquareText />
            <AlertTitle>建议继续追问</AlertTitle>
            <AlertDescription className="flex flex-col gap-1">
              {draft.questions.map((question, index) => (
                <p key={`${question}-${index}`}>{question}</p>
              ))}
            </AlertDescription>
          </Alert>
        ) : null}

        {/* 澄清历史时间线 */}
        {clarificationHistory && clarificationHistory.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Clock className="size-3.5" />
              澄清历史
            </div>
            <div className="flex flex-col gap-2">
              {clarificationHistory.map((entry) => (
                <div
                  key={entry.timestamp}
                  className="flex items-start gap-2 text-xs"
                >
                  <span className="mt-0.5 shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                    R{entry.round}
                  </span>
                  <span className="text-muted-foreground">{entry.userText}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* 达到澄清上限提示 */}
        {atMaxRounds && !draft.readyToApply ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>已达澄清上限</AlertTitle>
            <AlertDescription>
              已完成 {maxClarifyRounds} 轮澄清，草稿仍无法自动解决所有歧义。
              建议重新录入或切换到手动添加人物。
            </AlertDescription>
          </Alert>
        ) : null}

        {/* 澄清补充输入区 */}
        {!draft.readyToApply && onClarify ? (
          <div className="flex flex-col gap-2">
            {atMaxRounds ? null : (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="补充一句话来澄清..."
                    value={clarifyText}
                    onChange={(e) => setClarifyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleClarifySubmit();
                      }
                    }}
                    disabled={isClarifying}
                    className="flex-1 bg-background/72 text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={handleClarifySubmit}
                    disabled={!clarifyText.trim() || isClarifying}
                  >
                    {isClarifying ? (
                      <Loader2 data-icon="inline-start" className="animate-spin" />
                    ) : (
                      <MessageSquareText data-icon="inline-start" />
                    )}
                    补充澄清
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  输入一句补充信息（如：他的父亲叫王建国、他的性别是男），
                  按 Enter 提交
                </p>
              </>
            )}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button onClick={onApply} disabled={!draft.readyToApply || isApplying}>
            {isApplying ? (
              <>
                <Loader2 data-icon="inline-start" className="animate-spin" />
                正在写入
              </>
            ) : (
              <>
                <Check data-icon="inline-start" />
                确认写入家谱
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RelationshipSummary({ result }: { result: RelationshipAgentResponse }) {
  if (!result.ok || !result.inference || !result.sourcePerson || !result.targetPerson) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>暂时还没推理出来</AlertTitle>
        <AlertDescription>{result.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card size="sm" className="border border-border/70 bg-background/78">
      <CardHeader>
        <CardTitle>关系结果</CardTitle>
        <CardDescription>
          {result.sourcePerson.name} 与 {result.targetPerson.name}
        </CardDescription>
        <CardAction>
          <Badge>{result.inference.relationship ?? "已识别"}</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div className="rounded-md border border-border/60 bg-muted/40 p-3">
            <div className="text-sm">
              <span className="font-semibold">{result.targetPerson.name}</span>
              <span className="text-muted-foreground"> 是 </span>
              <span className="font-semibold">{result.sourcePerson.name}</span>
              <span className="text-muted-foreground"> 的</span>
            </div>
            <div className="text-base font-bold mt-1">
              {result.inference.relationship ?? "已识别"}
            </div>
          </div>
          {result.inference.inverseRelationship &&
            result.inference.inverseRelationship !== result.inference.relationship && (
              <div className="rounded-md border border-border/60 bg-muted/40 p-3">
                <div className="text-sm">
                  <span className="font-semibold">{result.sourcePerson.name}</span>
                  <span className="text-muted-foreground"> 是 </span>
                  <span className="font-semibold">{result.targetPerson.name}</span>
                  <span className="text-muted-foreground"> 的</span>
                </div>
                <div className="text-base font-bold mt-1">
                  {result.inference.inverseRelationship}
                </div>
              </div>
            )}
        </div>

        <Alert>
          <Bot />
          <AlertTitle>推理说明</AlertTitle>
          <AlertDescription>{result.inference.explanation}</AlertDescription>
        </Alert>

        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium">关系路径</div>
          <div className="flex flex-wrap gap-2">
            {result.inference.path.map((hop, index) => (
              <Badge key={`${hop.fromPersonId}-${hop.toPersonId}-${index}`} variant="outline">
                {hop.kind === "spouse"
                  ? "配偶"
                  : hop.kind === "parent"
                    ? "父母"
                    : "子女"}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentPanel() {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState<AgentTab>("intake");
  const [intakeText, setIntakeText] = useState("");
  const [relationshipQuestion, setRelationshipQuestion] = useState("");
  const [draft, setDraft] = useState<IntakeDraft | null>(null);
  const [relationshipResult, setRelationshipResult] =
    useState<RelationshipAgentResponse | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      title: "家谱助手",
      body: "先生成可确认的录入草稿，再安全写入家谱；也可以直接提问两个人之间的关系。",
    },
  ]);
  const [isSubmitting, startSubmitting] = useTransition();
  const [isApplying, startApplying] = useTransition();
  const [isClarifying, startClarifying] = useTransition();
  const [clarifyCount, setClarifyCount] = useState(0);
  const [clarificationHistory, setClarificationHistory] = useState<ClarificationEntry[]>([]);
  const maxClarifyRounds = 5;
  const intakeFieldId = useId();
  const relationshipFieldId = useId();

  function pushMessage(message: AgentMessage) {
    setMessages((current) => current.concat(message));
  }

  function summarizeDraft(nextDraft: IntakeDraft) {
    if (nextDraft.persons.length === 0 && nextDraft.relationships.length === 0) {
      return "未能从输入中识别出人物或关系，请尝试用更具体的方式描述。";
    }
    return `识别到 ${nextDraft.persons.length} 位人物、${nextDraft.relationships.length} 条关系。${
      nextDraft.readyToApply ? "当前草稿可以直接写入。" : "当前草稿仍有待确认项。"
    }`;
  }

  function handleIntakeSubmit() {
    const text = intakeText.trim();
    if (!text) {
      toast.error("请先输入家谱描述。");
      return;
    }

    pushMessage({
      id: `user-intake-${Date.now()}`,
      role: "user",
      title: "家谱录入",
      body: text,
    });

    startSubmitting(async () => {
      try {
        const response = await fetch("/api/agent/intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || "录入请求失败");
        }

        const nextDraft = json as IntakeDraft;
        setDraft(nextDraft);
        setClarifyCount(0);
        setClarificationHistory([]);
        setRelationshipResult(null);

        const isEmpty = nextDraft.persons.length === 0 && nextDraft.relationships.length === 0;
        pushMessage({
          id: `assistant-intake-${Date.now()}`,
          role: "assistant",
          title: isEmpty ? "未能识别" : "草稿已生成",
          body: summarizeDraft(nextDraft),
        });
        toast.success(isEmpty ? "未能从输入中识别出人物或关系，请换一种方式描述。" : "录入草稿已生成。");
      } catch (error) {
        const message = error instanceof Error ? error.message : "录入请求失败";
        pushMessage({
          id: `assistant-intake-error-${Date.now()}`,
          role: "assistant",
          title: "录入失败",
          body: message,
        });
        toast.error(message);
      }
    });
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
          body: JSON.stringify({ draft }),
        });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || "草稿写入失败");
        }

        pushMessage({
          id: `assistant-apply-${Date.now()}`,
          role: "assistant",
          title: "写入成功",
          body: "草稿已写入当前家谱，树图会自动刷新。",
        });
        setDraft(null);
        setIntakeText("");
        setClarifyCount(0);
        setClarificationHistory([]);
        router.refresh();
        toast.success("家谱已更新。");
      } catch (error) {
        const message = error instanceof Error ? error.message : "草稿写入失败";
        toast.error(message);
      }
    });
  }

  function handleClarify(clarificationText: string) {
    if (!draft || !intakeText) {
      return;
    }

    if (clarifyCount >= maxClarifyRounds) {
      toast.error("已达到最大澄清轮次，请重新开始或手动录入。");
      return;
    }

    const nextRound = clarifyCount + 1;
    const entry: ClarificationEntry = {
      round: nextRound,
      userText: clarificationText,
      timestamp: Date.now(),
    };

    pushMessage({
      id: `user-clarify-${Date.now()}`,
      role: "user",
      title: `补充澄清 (第 ${nextRound} 轮)`,
      body: clarificationText,
    });

    startClarifying(async () => {
      try {
        const response = await fetch("/api/agent/intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: intakeText,
            previousDraft: draft,
            clarificationText,
          }),
        });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || "澄清请求失败");
        }

        const nextDraft = json as IntakeDraft;
        setDraft(nextDraft);
        setClarifyCount(nextRound);
        setClarificationHistory((prev) => [...prev, entry]);

        const isEmpty = nextDraft.persons.length === 0 && nextDraft.relationships.length === 0;
        pushMessage({
          id: `assistant-clarify-${Date.now()}`,
          role: "assistant",
          title: isEmpty ? "未能识别" : `草稿已更新 (第 ${nextRound} 轮澄清)`,
          body: summarizeDraft(nextDraft),
        });
        toast.success(
          isEmpty
            ? "未能从输入中识别出人物或关系，请换一种方式描述。"
            : nextDraft.readyToApply
              ? "歧义已全部解决，可以写入家谱。"
              : "草稿已更新，仍有待确认项。",
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "澄清请求失败";
        pushMessage({
          id: `assistant-clarify-error-${Date.now()}`,
          role: "assistant",
          title: "澄清失败",
          body: message,
        });
        toast.error(message);
      }
    });
  }

  function handleRelationshipSubmit() {
    const question = relationshipQuestion.trim();
    if (!question) {
      toast.error("请先输入关系问题。");
      return;
    }

    pushMessage({
      id: `user-relationship-${Date.now()}`,
      role: "user",
      title: "关系提问",
      body: question,
    });

    startSubmitting(async () => {
      try {
        const response = await fetch("/api/agent/relationship", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || "关系推理失败");
        }

        const nextResult = json as RelationshipAgentResponse;
        setRelationshipResult(nextResult);
        setDraft(null);
        pushMessage({
          id: `assistant-relationship-${Date.now()}`,
          role: "assistant",
          title: "关系结果",
          body:
            nextResult.ok && nextResult.inference?.relationship
              ? [
                  `${nextResult.targetPerson?.name} 是 ${nextResult.sourcePerson?.name} 的${nextResult.inference.relationship}`,
                  nextResult.inference.inverseRelationship &&
                  nextResult.inference.inverseRelationship !== nextResult.inference.relationship
                    ? `${nextResult.sourcePerson?.name} 是 ${nextResult.targetPerson?.name} 的${nextResult.inference.inverseRelationship}`
                    : null,
                ]
                  .filter(Boolean)
                  .join("\n")
              : nextResult.message,
        });
        toast.success("关系推理完成。");
      } catch (error) {
        const message = error instanceof Error ? error.message : "关系推理失败";
        pushMessage({
          id: `assistant-relationship-error-${Date.now()}`,
          role: "assistant",
          title: "提问失败",
          body: message,
        });
        toast.error(message);
      }
    });
  }

  return (
    <Card className="flex h-full min-h-0 flex-col rounded-none border-0 bg-transparent shadow-none ring-0">
      <CardHeader className="border-b border-border/70 bg-card/56 backdrop-blur">
        <CardTitle className="flex items-center gap-2 text-[1.05rem]">
          <Bot className="text-primary" />
          家谱助手
        </CardTitle>
        <CardDescription className="text-balance">
          支持录入草稿生成与人物关系问答。
        </CardDescription>
        <CardAction>
          <Badge variant="secondary">AI workflow</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="app-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-4">
        <div className="rounded-[1.4rem] border border-border/70 bg-background/55 p-3">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            <ScrollText className="size-4" />
            conversation log
          </div>
          <div className="app-scrollbar flex min-h-[22rem] max-h-[32rem] flex-col gap-3 overflow-y-auto pr-1 pt-1">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isSubmitting ? (
              <ThinkingCard
                label={
                  currentTab === "intake" ? "正在生成录入草稿" : "正在推理人物关系"
                }
              />
            ) : null}
            {isApplying ? <ThinkingCard label="正在写入家谱" /> : null}
          </div>
        </div>

        <Separator />

        <Tabs
          value={currentTab}
          onValueChange={(value) => setCurrentTab(value as AgentTab)}
          className="flex flex-col gap-0"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="intake">家谱录入</TabsTrigger>
            <TabsTrigger value="relationship">关系问答</TabsTrigger>
          </TabsList>

          <TabsContent value="intake" className="mt-4 flex flex-col gap-4 pr-1">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={intakeFieldId}>口述家谱</FieldLabel>
                <FieldContent>
                  <Textarea
                    id={intakeFieldId}
                    placeholder="例如：我叫王明，父亲王建国，母亲李秀英，我有一个姐姐王丽。"
                    value={intakeText}
                    onChange={(event) => setIntakeText(event.target.value)}
                    className="min-h-32 bg-background/72"
                  />
                  <FieldDescription>
                    助手会先抽取人物与关系，生成待确认草稿，不会直接写库。
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>

            <div className="flex justify-end">
              <Button onClick={handleIntakeSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 data-icon="inline-start" className="animate-spin" />
                    正在解析
                  </>
                ) : (
                  <>
                    <Sparkles data-icon="inline-start" />
                    生成草稿
                  </>
                )}
              </Button>
            </div>

            {draft && (draft.persons.length > 0 || draft.relationships.length > 0) ? (
              <DraftSummary
                draft={draft}
                onApply={handleApplyDraft}
                isApplying={isApplying}
                onClarify={handleClarify}
                isClarifying={isClarifying}
                clarifyCount={clarifyCount}
                maxClarifyRounds={maxClarifyRounds}
                clarificationHistory={clarificationHistory}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="relationship" className="mt-4 flex flex-col gap-4 pr-1">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={relationshipFieldId}>关系问题</FieldLabel>
                <FieldContent>
                  <Input
                    id={relationshipFieldId}
                    placeholder="例如：王丽和王建国是什么关系？"
                    value={relationshipQuestion}
                    onChange={(event) => setRelationshipQuestion(event.target.value)}
                    className="bg-background/72"
                  />
                  <FieldDescription>
                    适合询问两个人之间的直接或间接亲属关系。
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>

            <div className="flex justify-end">
              <Button onClick={handleRelationshipSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 data-icon="inline-start" className="animate-spin" />
                    正在推理
                  </>
                ) : (
                  <>
                    <MessageSquareText data-icon="inline-start" />
                    计算关系
                  </>
                )}
              </Button>
            </div>

            {relationshipResult ? (
              <RelationshipSummary result={relationshipResult} />
            ) : null}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
