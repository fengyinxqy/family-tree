import type { Metadata } from "next";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = {
  title: "注册 - 家谱",
  description: "创建家谱账户，记录家族根脉，传承世代记忆。",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
