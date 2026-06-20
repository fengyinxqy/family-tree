"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FamilyRole = "OWNER" | "ADMIN" | "EDITOR" | "REVIEWER" | "VIEWER";
type MemberStatus = "ACTIVE" | "SUSPENDED";

type MembershipOverview = {
  tree: { id: string; name: string };
  currentRole: FamilyRole;
  canManage: boolean;
  canTransferOwnership: boolean;
  members: Array<{
    id: string;
    userId: string;
    name: string;
    email: string;
    role: FamilyRole;
    status: MemberStatus;
    joinedAt: string;
  }>;
  invitations: Array<{
    id: string;
    email: string;
    role: FamilyRole;
    status: "PENDING";
    expiresAt: string;
    createdAt: string;
  }>;
};

const ASSIGNABLE_ROLES: Array<{ value: Exclude<FamilyRole, "OWNER">; label: string }> = [
  { value: "ADMIN", label: "管理员" },
  { value: "EDITOR", label: "编辑者" },
  { value: "REVIEWER", label: "审校者" },
  { value: "VIEWER", label: "只读成员" },
];

const ROLE_LABELS: Record<FamilyRole, string> = {
  OWNER: "所有者",
  ADMIN: "管理员",
  EDITOR: "编辑者",
  REVIEWER: "审校者",
  VIEWER: "只读成员",
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error ?? "请求失败");
  return body as T;
}

export function FamilyMembersPanel() {
  const [overview, setOverview] = useState<MembershipOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<FamilyRole, "OWNER">>("EDITOR");
  const [issuedToken, setIssuedToken] = useState("");
  const [acceptToken, setAcceptToken] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      setOverview(await requestJson<MembershipOverview>("/api/family/members"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "成员信息加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadOverview());
  }, [loadOverview]);

  async function createInvitation() {
    setBusyId("invite");
    try {
      const result = await requestJson<{ token: string }>("/api/family/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setIssuedToken(result.token);
      setInviteEmail("");
      toast.success("邀请已创建，请安全发送令牌");
      await loadOverview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建邀请失败");
    } finally {
      setBusyId(null);
    }
  }

  async function updateMember(id: string, body: Record<string, string>) {
    setBusyId(id);
    try {
      await requestJson(`/api/family/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      toast.success("成员权限已更新");
      await loadOverview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新成员失败");
    } finally {
      setBusyId(null);
    }
  }

  async function removeMember(id: string) {
    if (!window.confirm("确认移除这位家族成员？")) return;
    setBusyId(id);
    try {
      await requestJson(`/api/family/members/${id}`, { method: "DELETE" });
      toast.success("成员已移除");
      await loadOverview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "移除成员失败");
    } finally {
      setBusyId(null);
    }
  }

  async function revokeInvitation(id: string) {
    setBusyId(id);
    try {
      await requestJson(`/api/family/invitations/${id}`, { method: "DELETE" });
      toast.success("邀请已撤销");
      await loadOverview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "撤销邀请失败");
    } finally {
      setBusyId(null);
    }
  }

  async function transferOwnership(id: string) {
    if (!window.confirm("确认转移家族所有权？转移后你将成为管理员。")) return;
    setBusyId(id);
    try {
      await requestJson("/api/family/ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId: id }),
      });
      toast.success("所有权已转移");
      await loadOverview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "所有权转移失败");
    } finally {
      setBusyId(null);
    }
  }

  async function acceptInvitation() {
    setBusyId("accept");
    try {
      await requestJson("/api/family/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: acceptToken }),
      });
      toast.success("已加入家族，可在家族切换器中打开");
      setAcceptToken("");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "接受邀请失败");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>家族成员与权限</CardTitle>
        <CardDescription>
          {overview ? `${overview.tree.name} · 当前角色：${ROLE_LABELS[overview.currentRole]}` : "管理协作成员、角色和邀请。"}
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => void loadOverview()} disabled={loading}>
            <RefreshCw data-icon="inline-start" />
            刷新
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="accept-family-token">接受家族邀请</FieldLabel>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="accept-family-token" value={acceptToken} onChange={(event) => setAcceptToken(event.target.value)} placeholder="粘贴邀请令牌" />
              <Button onClick={() => void acceptInvitation()} disabled={!acceptToken.trim() || busyId === "accept"}>
                <ShieldCheck data-icon="inline-start" />
                加入家族
              </Button>
            </div>
            <FieldDescription>邀请与登录邮箱绑定，且只能使用一次。</FieldDescription>
          </Field>
        </FieldGroup>

        {overview?.canManage ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="invite-family-email">邀请新成员</FieldLabel>
              <div className="flex flex-col gap-2 lg:flex-row">
                <Input id="invite-family-email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="member@example.com" />
                <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as Exclude<FamilyRole, "OWNER">)}>
                  <SelectTrigger aria-label="邀请角色"><SelectValue>{ROLE_LABELS[inviteRole]}</SelectValue></SelectTrigger>
                  <SelectContent><SelectGroup>{ASSIGNABLE_ROLES.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
                <Button onClick={() => void createInvitation()} disabled={!inviteEmail.trim() || busyId === "invite"}>
                  <UserPlus data-icon="inline-start" />
                  创建邀请
                </Button>
              </div>
              <FieldDescription>邀请默认 72 小时有效；所有者角色只能通过所有权转移产生。</FieldDescription>
            </Field>
          </FieldGroup>
        ) : null}

        {issuedToken ? (
          <Alert>
            <AlertTitle>邀请令牌仅显示这一次</AlertTitle>
            <AlertDescription className="break-all">{issuedToken}</AlertDescription>
            <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(issuedToken).then(() => toast.success("已复制"))}>
              <Copy data-icon="inline-start" />
              复制
            </Button>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3">
          {(overview?.members ?? []).map((member) => (
            <Card key={member.id} size="sm">
              <CardHeader>
                <CardTitle>{member.name}</CardTitle>
                <CardDescription>{member.email}</CardDescription>
                <CardAction><Badge variant={member.status === "ACTIVE" ? "secondary" : "outline"}>{member.status === "ACTIVE" ? "有效" : "已停用"}</Badge></CardAction>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                {overview?.canManage && member.role !== "OWNER" ? (
                  <Select value={member.role} onValueChange={(value) => void updateMember(member.id, { role: value as FamilyRole })} disabled={busyId === member.id}>
                    <SelectTrigger size="sm" aria-label={`${member.name}的角色`}><SelectValue>{ROLE_LABELS[member.role]}</SelectValue></SelectTrigger>
                    <SelectContent><SelectGroup>{ASSIGNABLE_ROLES.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}</SelectGroup></SelectContent>
                  </Select>
                ) : <Badge>{ROLE_LABELS[member.role]}</Badge>}
                {overview?.canManage && member.role !== "OWNER" ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => void updateMember(member.id, { status: member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })} disabled={busyId === member.id}>
                      {member.status === "ACTIVE" ? "停用" : "恢复"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void removeMember(member.id)} disabled={busyId === member.id}>移除</Button>
                    {overview.canTransferOwnership && member.status === "ACTIVE" ? <Button variant="secondary" size="sm" onClick={() => void transferOwnership(member.id)} disabled={busyId === member.id}>转移所有权</Button> : null}
                  </>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>

        {overview?.canManage && overview.invitations.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h3 className="font-medium">待处理邀请</h3>
            {overview.invitations.map((invitation) => (
              <div key={invitation.id} className="flex flex-col justify-between gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
                <div><p className="font-medium">{invitation.email}</p><p className="text-sm text-muted-foreground">{ROLE_LABELS[invitation.role]} · {new Date(invitation.expiresAt).toLocaleString("zh-CN")} 失效</p></div>
                <Button variant="outline" size="sm" onClick={() => void revokeInvitation(invitation.id)} disabled={busyId === invitation.id}>撤销</Button>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
