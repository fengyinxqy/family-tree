"use client";

import { useState } from "react";
import { Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RelationshipForm } from "@/components/relationship-form";
import { useRouter } from "next/navigation";

export function AddRelationButton({ personId }: { personId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button
        variant="outline"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
        添加关系
      </Button>
      <RelationshipForm
        open={open}
        onClose={() => {
          setOpen(false);
          router.refresh();
        }}
        currentPersonId={personId}
      />
    </>
  );
}
