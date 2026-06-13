"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const registerSchema = z
  .object({
    name: z.string().min(1, "请输入姓名"),
    email: z.string().min(1, "请输入邮箱").email("请输入有效的邮箱地址"),
    password: z.string().min(6, "密码至少需要 6 位"),
    confirmPassword: z.string().min(1, "请确认密码"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.fieldErrors) {
          const messages = Object.values(data.fieldErrors).flat() as string[];
          setServerError(messages.join("；"));
        } else {
          setServerError(data.error || "注册失败");
        }
        return;
      }

      toast.success("注册成功，欢迎加入");
      router.push("/login");
    } catch {
      setServerError("网络错误，请稍后重试");
    }
  }

  return (
    <AuthShell
      title="创建你的家谱工作台"
      description="用统一的表单与页面结构开始记录家族脉络，从第一位成员到完整家族树都在同一套体验里完成。"
      eyebrow="注册并开始整理家族成员"
      footer={
        <>
          已有账号？{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
          >
            去登录
          </Link>
        </>
      }
    >
      <div className="mb-6 space-y-2">
        <div className="inline-flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <UserPlus className="size-5" strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            注册账号
          </h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            创建账户后即可进入家族树，开始录入成员与关系。
          </p>
        </div>
      </div>

      {serverError ? (
        <div className="mb-5 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      ) : null}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>姓名</FormLabel>
                <FormControl>
                  <Input
                    placeholder="请输入你的姓名"
                    autoComplete="name"
                    className="h-11 bg-background/80"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>邮箱</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="email"
                    className="h-11 bg-background/80"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>密码</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="至少 6 位"
                      autoComplete="new-password"
                      className="h-11 bg-background/80"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>确认密码</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="再次输入密码"
                      autoComplete="new-password"
                      className="h-11 bg-background/80"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" disabled={isSubmitting} className="h-11 w-full" size="lg">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                注册中...
              </>
            ) : (
              "创建账号并开始录入"
            )}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}
