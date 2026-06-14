import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import FamilyTree from "@/components/family-tree";
import { getFamilyWorkspaceData } from "@/services/family-workspace.service";

type SearchParams = Promise<{
  view?: string | string[];
  personId?: string | string[];
  generation?: string | string[];
  panel?: string | string[];
}>;

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function TreePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [{ persons, relationships }, query] = await Promise.all([
    getFamilyWorkspaceData(),
    searchParams,
  ]);

  const viewParam = readParam(query.view);
  const panelParam = readParam(query.panel);

  return (
    <FamilyTree
      key={`${viewParam ?? "tree"}:${readParam(query.personId) ?? "none"}:${readParam(query.generation) ?? "none"}:${panelParam ?? "assistant"}`}
      persons={persons}
      relationships={relationships}
      initialState={{
        view:
          viewParam === "table" || viewParam === "timeline" || viewParam === "branch"
            ? viewParam
            : "tree",
        personId: readParam(query.personId),
        generation: readParam(query.generation),
        panel: panelParam === "collapsed" ? "collapsed" : "assistant",
      }}
    />
  );
}
