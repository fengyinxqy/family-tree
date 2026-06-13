"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, useFieldArray, type UseFormReturn, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, UserRound, Plus, X, GripVertical, MapPin, BookOpen, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/date-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PersonData, PersonEventData } from "@/types";

// ── 事件类型标签映射 ──────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  birth: "出生",
  marriage: "婚姻",
  migration: "迁徙",
  other: "其他",
};

// ── Zod Schema ────────────────────────────────────────────

const eventSchema = z.object({
  type: z.enum(["birth", "marriage", "migration", "other"]),
  title: z.string().optional().nullable(),
  dateLabel: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

const personSchema = z.object({
  name: z.string().min(1, "请输入姓名"),
  gender: z.enum(["male", "female"]),
  birthDate: z.string().optional().nullable(),
  deathDate: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  aliases: z.array(z.string()).default([]),
  generationLabel: z.string().optional().nullable(),
  nativePlace: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  events: z.array(eventSchema).default([]),
});

export type PersonFormValues = z.infer<typeof personSchema>;

// ── usePersonForm ──────────────────────────────────────────

export function usePersonForm(person?: PersonData & { events?: PersonEventData[] }) {
  return useForm<PersonFormValues>({
    resolver: zodResolver(personSchema) as Resolver<PersonFormValues>,
    defaultValues: {
      name: person?.name ?? "",
      gender: (person?.gender as "male" | "female") ?? "male",
      birthDate: person?.birthDate ?? null,
      deathDate: person?.deathDate ?? null,
      bio: person?.bio ?? null,
      aliases: person?.aliases ?? [],
      generationLabel: person?.generationLabel ?? null,
      nativePlace: person?.nativePlace ?? null,
      notes: person?.notes ?? null,
      events: (person?.events?.filter((e) => e.type !== "death") ?? []) as PersonFormValues["events"],
    },
  });
}

// ── savePerson ─────────────────────────────────────────────

export async function savePerson(
  values: PersonFormValues,
  person?: PersonData,
): Promise<{ success: boolean; error?: string }> {
  const isEdit = !!person;
  const url = isEdit ? `/api/persons/${person!.id}` : "/api/persons";
  const method = isEdit ? "PUT" : "POST";

  const body: Record<string, unknown> = {
    name: values.name,
    gender: values.gender,
  };
  if (values.birthDate) body.birthDate = values.birthDate;
  if (values.deathDate) body.deathDate = values.deathDate;
  if (values.bio) body.bio = values.bio;
  if (values.aliases && values.aliases.length > 0) body.aliases = values.aliases;
  if (values.generationLabel) body.generationLabel = values.generationLabel;
  if (values.nativePlace) body.nativePlace = values.nativePlace;
  if (values.notes) body.notes = values.notes;
  if (values.events && values.events.length > 0) body.events = values.events;

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    return { success: false, error: data.error || "保存失败" };
  }

  return { success: true };
}

// ── 子组件 ──────────────────────────────────────────────────

function SectionLabel({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 border-b border-border/60 pb-3">
      <div className="flex size-8 items-center justify-center rounded-2xl border border-primary/15 bg-primary/8 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm font-semibold text-foreground">{text}</span>
    </div>
  );
}

/** 已故复选框 + 逝世日期 */
function DeceasedFields({ form }: { form: UseFormReturn<PersonFormValues> }) {
  const deathDate = useWatch({ control: form.control, name: "deathDate" });
  const deceased = deathDate !== null && deathDate !== undefined;

  return (
    <>
      <div className="flex items-center gap-2">
        <Checkbox
          id="deceased"
          checked={deceased}
          onCheckedChange={(checked) => {
            if (checked) {
              form.setValue("deathDate", "");
            } else {
              form.setValue("deathDate", null);
            }
          }}
        />
        <label
          htmlFor="deceased"
          className="text-sm font-medium leading-none cursor-pointer select-none"
        >
          是否已故
        </label>
      </div>
      {deceased && (
        <FormField
          control={form.control}
          name="deathDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">逝世日期</FormLabel>
              <FormControl>
                <DatePicker
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v)}
                  placeholder="选择或输入日期"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
}

/** 别名 tag 输入 */
function AliasesInput({ form }: { form: UseFormReturn<PersonFormValues> }) {
  const [inputValue, setInputValue] = useState("");
  const aliases = useWatch({ control: form.control, name: "aliases" }) ?? [];

  function addAlias() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (aliases.includes(trimmed)) {
      setInputValue("");
      return;
    }
    form.setValue("aliases", [...aliases, trimmed]);
    setInputValue("");
  }

  function removeAlias(index: number) {
    const next = [...aliases];
    next.splice(index, 1);
    form.setValue("aliases", next);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addAlias();
    }
    if (e.key === "Backspace" && !inputValue && aliases.length > 0) {
      removeAlias(aliases.length - 1);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {aliases.map((alias, i) => (
          <span
            key={`${alias}-${i}`}
            className="inline-flex items-center gap-1 rounded-md bg-amber-100/60 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
          >
            {alias}
            <button
              type="button"
              onClick={() => removeAlias(i)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-amber-200/60 dark:hover:bg-amber-800/40"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <Input
        placeholder="输入别名后按回车添加"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (inputValue.trim()) addAlias();
        }}
        className="h-9 text-sm"
      />
    </div>
  );
}

/** 事件编辑器 */
export function EventsEditor({ form }: { form: UseFormReturn<PersonFormValues> }) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "events",
  });

  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2.5"
        >
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
            {/* 事件类型 — 中文显示 */}
            <FormField
              control={form.control}
              name={`events.${index}.type`}
              render={({ field: f }) => (
                <Select value={f.value} onValueChange={f.onChange}>
                  <SelectTrigger className="h-8 flex-1 text-xs">
                    <SelectValue>
                      {f.value ? EVENT_TYPE_LABELS[f.value] ?? f.value : "选择类型"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(index)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {/* 日期 + 地点 */}
          <div className="grid grid-cols-2 gap-2">
            <FormField
              control={form.control}
              name={`events.${index}.dateLabel`}
              render={({ field: f }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs">日期</FormLabel>
                  <FormControl>
                    <DatePicker
                      value={f.value ?? null}
                      onChange={(v) => f.onChange(v)}
                      placeholder="选择日期"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`events.${index}.location`}
              render={({ field: f }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs">地点</FormLabel>
                  <FormControl>
                    <Input placeholder="事件地点" className="h-8 text-xs" {...f} value={f.value ?? ""} onChange={(e) => f.onChange(e.target.value || null)} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          {/* 标题（仅 other 类型显示） */}
          {form.watch(`events.${index}.type`) === "other" && (
            <FormField
              control={form.control}
              name={`events.${index}.title`}
              render={({ field: f }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs">标题</FormLabel>
                  <FormControl>
                    <Input placeholder="事件标题" className="h-8 text-xs" {...f} value={f.value ?? ""} onChange={(e) => f.onChange(e.target.value || null)} />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
          {/* 描述 */}
          <FormField
            control={form.control}
            name={`events.${index}.description`}
            render={({ field: f }) => (
              <FormItem className="space-y-1">
                <FormLabel className="text-xs">描述</FormLabel>
                <FormControl>
                  <Input placeholder="事件描述（可选）" className="h-8 text-xs" {...f} value={f.value ?? ""} onChange={(e) => f.onChange(e.target.value || null)} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          append({ type: "marriage" as const, title: null, dateLabel: null, location: null, description: null })
        }
        className="w-full gap-1.5 h-9"
      >
        <Plus className="h-4 w-4" />
        添加事件
      </Button>
    </div>
  );
}

// ── PersonFormFields ───────────────────────────────────────

interface PersonFormFieldsProps {
  form: UseFormReturn<PersonFormValues>;
  serverError: string | null;
  showEvents?: boolean;
}

export function PersonFormFields({
  form,
  serverError,
  showEvents = true,
}: PersonFormFieldsProps) {
  return (
    <>
      {serverError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive dark:border-destructive/20 dark:bg-destructive/10">
          <p>{serverError}</p>
        </div>
      )}

      <Form {...form}>
        <div className="space-y-6">
          {/* ── 第一部分：基础信息 ─────────────────────── */}
          <section>
            <SectionLabel icon={UserRound} text="基础信息" />

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">姓名</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入姓名" className="h-10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">性别</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue>
                            {field.value === "male" ? "男" : field.value === "female" ? "女" : "请选择性别"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">男</SelectItem>
                          <SelectItem value="female">女</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">出生日期</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value ?? null}
                          onChange={(v) => field.onChange(v)}
                          placeholder="选择或输入日期"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DeceasedFields form={form} />
              </div>

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">人物简介</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="请输入人物简介..."
                        className="min-h-28 resize-y bg-background/70"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* ── 第二部分：扩展档案 ─────────────────────── */}
          <section>
            <SectionLabel icon={Tag} text="扩展档案" />

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">别名</label>
                <AliasesInput form={form} />
              </div>

              <FormField
                control={form.control}
                name="generationLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">排行/代际标签</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例如：长子、次女、第七世"
                        className="h-10"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nativePlace"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        籍贯
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例如：广东梅州"
                        className="h-10"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* ── 第三部分：备注 ─────────────────────────── */}
          <section>
            <SectionLabel icon={BookOpen} text="维护备注" />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">维护备注</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="例如：出生日期待核实、别名来源为口述..."
                      className="min-h-24 resize-y bg-background/70"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          {/* ── 第四部分：人生事件 ─────────────────────── */}
          {showEvents && (
            <section>
              <SectionLabel icon={BookOpen} text="人生事件" />
              <EventsEditor form={form} />
            </section>
          )}
        </div>
      </Form>
    </>
  );
}

// ── PersonForm (Dialog 包装) ───────────────────────────────

interface PersonFormProps {
  open: boolean;
  onClose: () => void;
  person?: PersonData & { events?: PersonEventData[] };
}

export function PersonForm({ open, onClose, person }: PersonFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const isEdit = !!person;
  const form = usePersonForm(person);
  const isSubmitting = form.formState.isSubmitting;

  function handleOpenChange(open: boolean) {
    if (!open) {
      onClose();
    }
  }

  async function onSubmit(values: PersonFormValues) {
    setServerError(null);

    const result = await savePerson(values, person);

    if (!result.success) {
      setServerError(result.error || "保存失败");
      return;
    }

    toast.success(isEdit ? "人物信息已更新" : "人物已添加");
    router.refresh();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 shadow-sm shadow-amber-900/15 ring-1 ring-amber-700/20 dark:from-amber-500 dark:to-amber-700 dark:ring-amber-400/10">
              <UserRound className="h-4.5 w-4.5 text-amber-50" strokeWidth={1.8} />
            </div>
            <div>
              <DialogTitle className="text-lg">
                {isEdit ? "编辑人物" : "添加人物"}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {isEdit ? "修改家庭成员信息" : "将新成员加入家族树"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <PersonFormFields
            form={form}
            serverError={serverError}
          />

          <div className="flex gap-3 pt-5">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-gradient-to-r from-amber-600 to-amber-700 font-medium shadow-md shadow-amber-900/15 transition-all hover:from-amber-700 hover:to-amber-800 dark:from-amber-600 dark:to-amber-700 dark:hover:from-amber-500 dark:hover:to-amber-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : isEdit ? (
                "保存修改"
              ) : (
                "添加人物"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
