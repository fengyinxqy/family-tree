"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppPage, AppPanel } from "@/components/app-surface";
import {
  PersonFormFields,
  savePerson,
  usePersonForm,
  type PersonFormValues,
} from "@/components/person-form";
import { Button } from "@/components/ui/button";

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

    toast.success("人物草稿已创建");
    router.push("/tree");
  }

  return (
    <AppPage>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/tree">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              返回家族树
            </Button>
          </Link>
        </div>

        <AppPanel className="bg-card/80 p-1.5">
          <div className="rounded-[1.45rem] border border-border/60 bg-background/78 p-5 lg:p-7">
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <UserRound className="size-7" strokeWidth={1.8} />
              </div>
              <div>
                <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
                  添加新成员
                </h1>
              </div>
            </div>
          </div>
        </AppPanel>

        <AppPanel className="bg-card/84 p-1.5">
          <div className="rounded-[1.45rem] border border-border/60 bg-background/82 p-5 lg:p-7">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <PersonFormFields
                form={form}
                serverError={serverError}
              />

              <div className="flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row">
                <Link href="/tree" className="sm:flex-1">
                  <Button type="button" variant="outline" className="w-full" disabled={isSubmitting}>
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    取消并返回
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting} className="sm:flex-1">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    "保存并加入家族树"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </AppPanel>
      </div>
    </AppPage>
  );
}
