## Why

As family trees grow, the tree view becomes much harder to navigate and users can no longer reliably find a person by scanning nodes manually. V1.1 already calls out search-and-focus as the first high-priority usability gap, so this change should tighten the core browse loop before more editing features are added.

## What Changes

- Add a more dependable member search experience in the family tree workspace, including predictable match results, clear empty states, and keyboard-friendly interaction.
- Strengthen tree focus behavior so selecting a result reliably centers and highlights the target node without leaving the tree in a confusing transient state.
- Add reset behavior that lets users clear the current search context and return to normal tree browsing.
- Cover the search-and-focus flow with targeted tests so the interaction remains stable as the tree workspace evolves.

## Capabilities

### New Capabilities
- `member-search-tree-focus`: Search for family members from the tree workspace and focus the tree viewport on the selected result.

### Modified Capabilities
- None.

## Impact

- Affected code: `src/components/member-search.tsx`, `src/components/family-tree.tsx`, and related tree UI logic.
- Likely adds or updates UI interaction tests around search results, highlighting, keyboard navigation, and reset behavior.
- No new backend API is expected; the change is primarily client-side behavior on top of existing tree data.
