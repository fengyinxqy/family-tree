"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LogIn } from "lucide-react";
import { useForm } from "react-hook-form";
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

const loginSchema = z.object({
  email: z.string().min(1, "请输入邮箱").email("请输入有效的邮箱地址"),
  password: z.string().min(1, "请输入密码"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);

    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (result?.error) {
        setServerError("邮箱或密码错误");
        return;
      }

      router.refresh();
      router.push("/tree");
    } catch {
      setServerError("网络错误，请稍后重试");
    }
  }

  return (
    <AuthShell
      title="欢迎回到家谱档案"
      description="继续整理家族关系、补充成员资料，并从统一的工作台视觉进入家族树。"
      eyebrow="登录后继续编辑家族树"
      footer={
        <>
          还没有账号？{" "}
          <Link
            href="/register"
            className="font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
          >
            去注册
          </Link>
        </>
      }
    >
      <div className="mb-6 space-y-2">
        <div className="inline-flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <LogIn className="size-5" strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            登录
          </h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            输入账户信息，回到你的家族树工作区。
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

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>密码</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="请输入密码"
                    autoComplete="current-password"
                    className="h-11 bg-background/80"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isSubmitting} className="h-11 w-full" size="lg">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                登录中...
              </>
            ) : (
              "登录并进入家族树"
            )}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}
