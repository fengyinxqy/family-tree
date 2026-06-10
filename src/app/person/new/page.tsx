"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserRound, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  PersonFormFields,
  usePersonForm,
  savePerson,
  type PersonFormValues,
} from "@/components/person-form";
import Link from "next/link";

export default function NewPersonPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = usePersonForm();
  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: PersonFormValues) {
    setServerError(null);

    const result = await savePerson(values);

    if (!result.success) {
      setServerError(result.error || "保存失败");
      return;
    }

    toast.success("人物已添加");
    router.push("/tree");
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
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

      {/* Page card */}
      <div className="relative z-10 w-full max-w-[480px]">
        <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-xl shadow-zinc-200/50 backdrop-blur dark:shadow-zinc-900/60 dark:bg-card/60">
          {/* Header */}
          <div className="mb-6 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 shadow-sm shadow-amber-900/15 ring-1 ring-amber-700/20 dark:from-amber-500 dark:to-amber-700 dark:ring-amber-400/10">
              <UserRound className="h-4.5 w-4.5 text-amber-50" strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="font-heading text-lg leading-none font-medium">
                添加人物
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                将新成员加入家族树
              </p>
            </div>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)}>
            <PersonFormFields
              form={form}
              isSubmitting={isSubmitting}
              serverError={serverError}
            />

            {/* Action buttons */}
            <div className="flex gap-3 pt-4">
              <Link href="/tree" className="flex-1">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  返回
                </Button>
              </Link>
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
                ) : (
                  "添加人物"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
