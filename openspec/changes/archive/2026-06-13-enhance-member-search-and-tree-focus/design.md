## Context

The tree workspace already contains an initial `MemberSearch` component and a `highlightedNodeId` state in `FamilyTree`, but the behavior is still fragile: search text, dropdown visibility, active result state, and tree focus behavior are only loosely coordinated. As the family tree grows, search is no longer a nice-to-have UI flourish; it becomes the main navigation tool for locating a person in a dense graph.

This change stays repo-local and primarily affects client-side interaction in the tree workspace. No new server endpoint is required because the search source is the tree data already loaded into the page. The main constraint is that search must remain predictable while React Flow layout and node state are being regenerated.

## Goals / Non-Goals

**Goals:**
- Make tree search reliably usable as the primary way to locate a member in a larger family graph.
- Keep result selection, node highlighting, and viewport centering synchronized even when the tree re-layouts.
- Preserve keyboard-friendly search interactions and a clear reset path back to normal browsing.
- Add targeted tests for the search-and-focus interaction so regressions are caught quickly.

**Non-Goals:**
- Introducing server-side search, fuzzy ranking services, or pagination.
- Redesigning the full tree workspace layout beyond the search-and-focus flow.
- Changing relationship data, node rendering strategy, or graph layout algorithms outside what is needed for focus behavior.

## Decisions

### 1. Keep search entirely client-side over the current tree dataset
The current tree page already has the full `persons` list in memory, so a local search keeps latency near-zero and avoids creating an API dependency for a tree-local interaction.

Alternative considered:
- Add a backend search endpoint. Rejected because it adds complexity without solving the current navigation problem better than local filtering.

### 2. Treat "query text" and "focused/highlighted member" as separate states
The input value should describe what the user is typing, while the highlighted node should describe what the tree is focused on. Separating those states avoids confusing cases where a previous selection remains highlighted even though the user is typing a new query.

Alternative considered:
- Use the input text itself as the source of truth for the highlighted node. Rejected because partial or ambiguous queries do not map cleanly to a single tree target.

### 3. Resolve viewport centering from the rendered node collection, not from raw person data
Selection should locate the actual rendered React Flow node and center on its current position. This keeps focus behavior aligned with drag-adjusted or re-laid-out nodes.

Alternative considered:
- Center using raw persisted coordinates from `persons`. Rejected because the rendered graph may differ from those values after layout or drag operations.

### 4. Define explicit reset behavior for search
Clearing the search should close the dropdown, clear the active result index, remove current highlighting, and return the widget to a neutral browse state. This makes the search interaction reversible and easier to understand.

Alternative considered:
- Leave the selected node highlighted after clear. Rejected because it blurs the difference between "currently searching" and "normal browsing."

### 5. Add targeted UI tests around search filtering and focus coordination
The logic is spread across `MemberSearch` and `FamilyTree`, so the safest verification layer is interaction-focused tests that cover filtering, keyboard selection, highlighting, and reset behavior.

Alternative considered:
- Rely on manual verification only. Rejected because the interaction can regress silently during future tree UI changes.

## Risks / Trade-offs

- [Search state becomes over-coupled to tree render timing] → Keep focus state minimal and derive viewport movement only after rendered nodes are available.
- [Client-side filtering becomes noisy for large trees] → Keep result limits and ranking straightforward for now, and leave fuzzy search out of scope.
- [Reset behavior feels too aggressive for some users] → Keep the behavior explicit and consistent; if needed, persistent focus can be revisited in a later UX pass.
- [Interaction tests are brittle with React Flow] → Prefer testing local coordination logic and DOM-level outcomes rather than deep graph implementation details.

## Migration Plan

1. Refine the `MemberSearch` interaction model and result rendering.
2. Tighten `FamilyTree` focus/highlight coordination so selection and clear behavior stay stable across layout updates.
3. Add or update tests for search filtering, selection, focus, and reset flows.
4. Run existing tests and lint to confirm the tree workspace remains stable.

Rollback is low risk because the change is client-side only. If needed, the workspace can fall back to the current search behavior by reverting the tree UI files and tests together.

## Open Questions

- Whether name-only matching is sufficient for the first pass, or whether aliases and generation labels should be included in search matching immediately.
- Whether the selected result should remain visible as a badge or helper hint after the dropdown closes.
