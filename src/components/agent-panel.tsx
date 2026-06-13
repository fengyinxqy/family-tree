"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Check,
  GitBranch,
  Loader2,
  MessageSquareText,
  Sparkles,
  TriangleAlert,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
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

function ThinkingCard({ label }: { label: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bot />
      </div>
      <Card className="w-full max-w-[88%] border border-border/80 bg-card/95 py-3 shadow-sm">
        <CardContent className="flex items-center gap-3 px-3">
          <div className="flex items-center gap-1.5">
            <span className="size-2 animate-[agent-dot_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
            <span className="size-2 animate-[agent-dot_1.2s_ease-in-out_0.2s_infinite] rounded-full bg-primary/80" />
            <span className="size-2 animate-[agent-dot_1.2s_ease-in-out_0.4s_infinite] rounded-full bg-primary/60" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">
              正在解析家谱信息并整理结构化结果
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
      {!isUser && (
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot />
        </div>
      )}
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-3 py-2 text-sm ring-1",
          isUser
            ? "bg-primary text-primary-foreground ring-primary/20"
            : "bg-card text-card-foreground ring-border",
        )}
      >
        <div className="mb-1 text-xs font-medium opacity-80">{message.title}</div>
        <p className="whitespace-pre-wrap leading-relaxed">{message.body}</p>
      </div>
      {isUser && (
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <User />
        </div>
      )}
    </div>
  );
}

function DraftSummary({
  draft,
  onApply,
  isApplying,
}: {
  draft: IntakeDraft;
  onApply: () => void;
  isApplying: boolean;
}) {
  return (
    <Card size="sm" className="border border-border/80 bg-background/80">
      <CardHeader>
        <CardTitle>录入草稿</CardTitle>
        <CardDescription>{draft.summary}</CardDescription>
        <CardAction>
          <Badge variant={draft.readyToApply ? "default" : "secondary"}>
            {draft.readyToApply ? "可应用" : "待确认"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles />
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
            <GitBranch />
            关系
          </div>
          <div className="flex flex-wrap gap-2">
            {draft.relationships.map((relationship) => (
              <Badge
                key={relationship.ref}
                variant={relationship.action === "create" ? "outline" : "secondary"}
              >
                {relationship.type === "spouse" ? "配偶" : "子女"} · {relationship.action === "create" ? "新增" : "跳过"}
              </Badge>
            ))}
          </div>
        </div>

        {draft.ambiguities.length > 0 && (
          <div className="flex flex-col gap-3">
            {draft.ambiguities.map((ambiguity, index) => (
              <Alert key={`${ambiguity.kind}-${index}`} variant="destructive">
                <TriangleAlert />
                <AlertTitle>需要人工确认</AlertTitle>
                <AlertDescription>
                  <p>{ambiguity.message}</p>
                  {ambiguity.options.length > 0 && (
                    <p>候选项：{ambiguity.options.join(" / ")}</p>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {draft.questions.length > 0 && (
          <Alert>
            <MessageSquareText />
            <AlertTitle>建议继续追问</AlertTitle>
            <AlertDescription>
              {draft.questions.map((question, index) => (
                <p key={`${question}-${index}`}>{question}</p>
              ))}
            </AlertDescription>
          </Alert>
        )}

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
        <AlertTitle>暂时没算出来</AlertTitle>
        <AlertDescription>{result.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card size="sm" className="border border-border/80 bg-background/80">
      <CardHeader>
        <CardTitle>关系结果</CardTitle>
        <CardDescription>
          {result.sourcePerson.name} 和 {result.targetPerson.name}
        </CardDescription>
        <CardAction>
          <Badge>{result.inference.relationship ?? "已识别"}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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
                {hop.kind === "spouse" ? "配偶" : hop.kind === "parent" ? "父母" : "子女"}
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
  const [relationshipResult, setRelationshipResult] = useState<RelationshipAgentResponse | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      title: "家谱助手",
      body: "我可以帮你把口述家谱整理成结构化草稿，也可以直接帮你计算两个人之间的亲属关系。",
    },
  ]);
  const [isSubmitting, startSubmitting] = useTransition();
  const [isApplying, startApplying] = useTransition();
  const intakeFieldId = useId();
  const relationshipFieldId = useId();

  function pushMessage(message: AgentMessage) {
    setMessages((current) => current.concat(message));
  }

  function summarizeDraft(nextDraft: IntakeDraft) {
    return `我识别出了 ${nextDraft.persons.length} 个人物、${nextDraft.relationships.length} 条关系。${nextDraft.readyToApply ? "当前草稿已经可以直接写入。" : "当前草稿还有待确认项。"}`
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
          throw new Error(json.error || "录入 Agent 请求失败");
        }

        const nextDraft = json as IntakeDraft;
        setDraft(nextDraft);
        setRelationshipResult(null);
        pushMessage({
          id: `assistant-intake-${Date.now()}`,
          role: "assistant",
          title: "录入结果",
          body: summarizeDraft(nextDraft),
        });
        toast.success("草稿已生成。");
      } catch (error) {
        const message = error instanceof Error ? error.message : "录入 Agent 请求失败";
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
          body: "草稿已经写入当前家谱，树图会自动刷新。",
        });
        setDraft(null);
        setIntakeText("");
        router.refresh();
        toast.success("家谱已更新。");
      } catch (error) {
        const message = error instanceof Error ? error.message : "草稿写入失败";
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
          throw new Error(json.error || "关系 Agent 请求失败");
        }

        const nextResult = json as RelationshipAgentResponse;
        setRelationshipResult(nextResult);
        setDraft(null);
        pushMessage({
          id: `assistant-relationship-${Date.now()}`,
          role: "assistant",
          title: "关系结果",
          body: nextResult.ok && nextResult.inference?.relationship
            ? `${nextResult.sourcePerson?.name} 和 ${nextResult.targetPerson?.name} 的关系是：${nextResult.inference.relationship}。`
            : nextResult.message,
        });
        toast.success("关系计算完成。");
      } catch (error) {
        const message = error instanceof Error ? error.message : "关系 Agent 请求失败";
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
    <Card className="flex h-full min-h-0 flex-col border-0 bg-background/75 shadow-none ring-0">
      <CardHeader className="border-b bg-background/80">
        <CardTitle className="flex items-center gap-2">
          <Bot />
          家谱 Agent
        </CardTitle>
        <CardDescription>
          先生成可确认草稿，再安全写入家谱；或者直接提问两个人的关系。
        </CardDescription>
        <CardAction>
          <Badge variant="secondary">MVP</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-4">
        <div className="max-h-[24rem] shrink-0 overflow-y-auto rounded-xl border bg-muted/20 p-3">
          <div className="flex flex-col gap-3">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isSubmitting && (
              <ThinkingCard
                label={currentTab === "intake" ? "正在生成录入草稿" : "正在推理亲属关系"}
              />
            )}
            {isApplying && <ThinkingCard label="正在写入家谱" />}
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
                    placeholder="例如：我叫王明，父亲王建国，母亲李秀兰，我有一个姐姐王丽。"
                    value={intakeText}
                    onChange={(event) => setIntakeText(event.target.value)}
                    className="min-h-28"
                  />
                  <FieldDescription>
                    Agent 会先抽取人物和关系，生成待确认草稿，不会直接写库。
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

            {draft && (
              <DraftSummary
                draft={draft}
                onApply={handleApplyDraft}
                isApplying={isApplying}
              />
            )}
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
                  />
                  <FieldDescription>
                    适合问两个人之间的直接或间接亲属关系。
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

            {relationshipResult && <RelationshipSummary result={relationshipResult} />}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
