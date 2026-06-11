"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { PersonData } from "@/types";

const personSchema = z.object({
  name: z.string().min(1, "请输入姓名"),
  gender: z.enum(["male", "female"]),
  birthDate: z.string().optional().nullable(),
  deathDate: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
});

export type PersonFormValues = z.infer<typeof personSchema>;

export function usePersonForm(person?: PersonData) {
  return useForm<PersonFormValues>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      name: person?.name ?? "",
      gender: (person?.gender as "male" | "female") ?? "male",
      birthDate: person?.birthDate ?? null,
      deathDate: person?.deathDate ?? null,
      bio: person?.bio ?? null,
    },
  });
}

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

interface PersonFormFieldsProps {
  form: UseFormReturn<PersonFormValues>;
  isSubmitting: boolean;
  serverError: string | null;
}

export function PersonFormFields({
  form,
  isSubmitting,
  serverError,
}: PersonFormFieldsProps) {
  return (
    <>
      {/* Server error banner */}
      {serverError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive dark:border-destructive/20 dark:bg-destructive/10">
          <p>{serverError}</p>
        </div>
      )}

      <Form {...form}>
        <div className="space-y-4">
          {/* Name field */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">姓名</FormLabel>
                <FormControl>
                  <Input
                    placeholder="请输入姓名"
                    className="h-10"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Gender field */}
          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">性别</FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value)}
                  >
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

          {/* Date fields row */}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="birthDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">出生日期</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      className="h-10"
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
              name="deathDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">逝世日期</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      className="h-10"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Bio field */}
          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">简介</FormLabel>
                <FormControl>
                  <textarea
                    placeholder="请输入人物简介..."
                    className="h-24 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Form>
    </>
  );
}

interface PersonFormProps {
  open: boolean;
  onClose: () => void;
  person?: PersonData;
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
      <DialogContent className="sm:max-w-[480px]">
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
            isSubmitting={isSubmitting}
            serverError={serverError}
          />

          {/* Action buttons */}
          <div className="flex gap-3 pt-4">
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
