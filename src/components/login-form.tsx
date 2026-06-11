"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { Loader2, Leaf } from "lucide-react";
import Link from "next/link";
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
    <div className="flex w-full flex-col items-center justify-center px-4 py-12">
      {/* Background decorative elements */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-amber-200/20 blur-3xl dark:bg-amber-800/10" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-emerald-200/15 blur-3xl dark:bg-emerald-800/8" />
        <div className="absolute left-1/3 top-1/4 h-[300px] w-[300px] rounded-full bg-amber-100/30 blur-2xl dark:bg-amber-700/5" />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* Brand / Logo area */}
      <div className="relative z-10 mb-8 flex flex-col items-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 shadow-lg shadow-amber-900/20 ring-1 ring-amber-700/20 dark:from-amber-500 dark:to-amber-700 dark:ring-amber-400/10">
          <Leaf className="h-7 w-7 text-amber-50" strokeWidth={1.8} />
        </div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          欢迎回来
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          登录您的家谱账户，继续探索家族记忆
        </p>
      </div>

      {/* Auth card */}
      <div className="relative z-10 w-full max-w-[420px]">
        <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-xl shadow-zinc-200/50 backdrop-blur dark:shadow-zinc-900/60 dark:bg-card/60">
          {/* Server error banner */}
          {serverError && (
            <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive dark:border-destructive/20 dark:bg-destructive/10">
              <p>{serverError}</p>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Email field */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">邮箱</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        autoComplete="email"
                        className="h-10"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Password field */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">密码</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="请输入您的密码"
                        autoComplete="current-password"
                        className="h-10"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 w-full bg-gradient-to-r from-amber-600 to-amber-700 font-medium shadow-md shadow-amber-900/15 transition-all hover:from-amber-700 hover:to-amber-800 dark:from-amber-600 dark:to-amber-700 dark:hover:from-amber-500 dark:hover:to-amber-600"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登录中...
                  </>
                ) : (
                  "登录"
                )}
              </Button>
            </form>
          </Form>
        </div>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          没有账号？{" "}
          <Link
            href="/register"
            className="font-medium text-amber-700 underline-offset-4 transition-colors hover:text-amber-600 hover:underline dark:text-amber-400 dark:hover:text-amber-300"
          >
            去注册
          </Link>
        </p>
      </div>
    </div>
  );
}
