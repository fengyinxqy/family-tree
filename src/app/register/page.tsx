import type { Metadata } from "next";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = {
  title: "注册 - 家谱",
  description: "创建家谱账户，记录家族根脉，传承世代记忆。",
};

export default function RegisterPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-amber-50/40 via-background to-background dark:from-amber-950/20 dark:via-background dark:to-background">
      <RegisterForm />
    </div>
  );
}
