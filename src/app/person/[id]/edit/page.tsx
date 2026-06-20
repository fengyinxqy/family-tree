"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppPage, AppPanel } from "@/components/app-surface";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  EventsEditor,
  PersonFormFields,
  savePerson,
  usePersonForm,
  type PersonFormValues,
} from "@/components/person-form";
import type { PersonData, PersonEventData } from "@/types";

interface PersonDetailData extends PersonData {
  events?: PersonEventData[];
}

export default function EditPersonPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [person, setPerson] = useState<PersonDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/persons/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("load_failed");
        return res.json();
      })
      .then((data) => {
        setPerson(data);
        setLoading(false);
      })
      .catch(() => {
        setServerError("人物不存在或无权访问");
        setLoading(false);
      });
  }, [id]);

  const form = usePersonForm(person ?? undefined);
  const isSubmitting = form.formState.isSubmitting;

  useEffect(() => {
    if (!person) return;

    form.reset({
      name: person.name ?? "",
      gender: (person.gender as "male" | "female") ?? "male",
      birthDate: person.birthDate ?? null,
      deathDate: person.deathDate ?? null,
      bio: person.bio ?? null,
      aliases: person.aliases ?? [],
      generationLabel: person.generationLabel ?? null,
      nativePlace: person.nativePlace ?? null,
      notes: person.notes ?? null,
      events: (person.events?.filter((event) => event.type !== "death") ?? []) as PersonFormValues["events"],
    });
  }, [form, person]);

  async function onSubmit(values: PersonFormValues) {
    setServerError(null);
    if (!person) return;

    const result = await savePerson(values, person);

    if (!result.success) {
      setServerError(result.error || "保存失败");
      return;
    }

    toast.success("人物修改草稿已创建");
    router.push(`/person/${id}`);
    router.refresh();
  }

  if (loading) {
    return (
      <AppPage centered>
        <div className="flex h-full items-center justify-center">
          <div className="inline-flex items-center gap-3 rounded-full border border-border/70 bg-card/80 px-5 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            正在加载人物信息...
          </div>
        </div>
      </AppPage>
    );
  }

  if (serverError && !person) {
    return (
      <AppPage centered>
        <AppPanel className="mx-auto max-w-lg bg-card/84 p-1.5">
          <div className="rounded-[1.45rem] border border-border/60 bg-background/82 px-6 py-8 text-center">
            <p className="text-base font-medium text-foreground">{serverError}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              你可以先回到家族树，重新选择成员后再继续编辑。
            </p>
            <div className="mt-5">
              <Link href="/tree">
                <Button variant="outline" className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" />
                  返回家族树
                </Button>
              </Link>
            </div>
          </div>
        </AppPanel>
      </AppPage>
    );
  }

  return (
    <AppPage>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/person/${id}`}>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              返回人物详情
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
                  {person?.name ? `编辑 ${person.name}` : "编辑成员信息"}
                </h1>
              </div>
            </div>
          </div>
        </AppPanel>

        <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <AppPanel className="min-h-0 bg-card/84 p-1.5">
            <div className="h-full rounded-[1.45rem] border border-border/60 bg-background/82 p-5 lg:p-7">
              <form
                id="edit-person-form"
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <PersonFormFields
                  form={form}
                  serverError={serverError}
                  showEvents={false}
                />
              </form>
            </div>
          </AppPanel>

          <Form {...form}>
            <AppPanel className="min-h-0 bg-card/84 p-1.5">
              <div className="flex h-full flex-col rounded-[1.45rem] border border-border/60 bg-background/82 p-5 lg:p-6">
                <div className="mb-4">
                  <h2 className="font-heading text-xl font-semibold text-foreground">人生事件</h2>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <EventsEditor form={form} />
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-border/60 pt-5">
                  <Link href={`/person/${id}`}>
                    <Button type="button" variant="outline" className="w-full" disabled={isSubmitting}>
                      取消修改
                    </Button>
                  </Link>
                  <Button type="submit" form="edit-person-form" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      "保存人物档案"
                    )}
                  </Button>
                </div>
              </div>
            </AppPanel>
          </Form>
        </div>
      </div>
    </AppPage>
  );
}
