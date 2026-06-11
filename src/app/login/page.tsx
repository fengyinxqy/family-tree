import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "登录 - 家谱",
  description: "登录您的家谱账户，继续探索家族记忆。",
};

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-amber-50/40 via-background to-background dark:from-amber-950/20 dark:via-background dark:to-background">
      <LoginForm />
    </div>
  );
}
