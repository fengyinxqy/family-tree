import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "登录 - 家谱",
  description: "登录您的家谱账户，继续探索家族记忆。",
};

export default function LoginPage() {
  return <LoginForm />;
}
