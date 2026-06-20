## 1. Implementation preparation

- [x] 1.1 Read the relevant Next.js 16 guides in `node_modules/next/dist/docs/` for Server Actions, Route Handlers, caching/revalidation, and the current proxy convention; record any constraints that affect touched files.
- [x] 1.2 Read the installed Prisma 7 documentation or generated guidance for PostgreSQL migrations, JSON fields, transactions, isolation, and row locking; choose and document the transaction strategy used for revision-guarded writes.

## 2. Persistence model and migration

- [x] 2.1 Extend the Prisma schema with `FamilyTree.dataRevision` and nullable soft-delete metadata on `Person` and `Relationship`, including indexes required by active-record and deletion-batch queries.
- [x] 2.2 Add Prisma models and relations for operation batches, append-only audit entries, short-lived operation confirmations, and versioned family snapshots, scoped by family tree and actor.
- [x] 2.3 Generate and inspect the PostgreSQL migration so existing records remain active, existing trees start at revision `0`, foreign keys preserve recovery data, and destructive cascades cannot erase audit history unexpectedly.
- [x] 2.4 Regenerate Prisma Client and add a migration-focused test or verification script proving existing family data remains readable after the schema change.

## 3. Shared active-data and mutation infrastructure

- [x] 3.1 Add reusable active-person and active-relationship query constraints and tests that distinguish normal reads from explicit recovery reads.
- [x] 3.2 Implement transaction helpers that increment a tree revision and append an operation/audit record atomically with a business mutation.
- [x] 3.3 Implement creation, hashing, expiration, scope validation, revision validation, and single-use consumption for destructive-operation confirmations, with tests for expired, stale, reused, cross-user, cross-tree, and input-mismatch cases.
- [x] 3.4 Add paginated owner-scoped operation-history reads and tests proving normal product services cannot update or delete audit entries.

## 4. Genealogy integrity domain rules

- [x] 4.1 Implement a pure typed integrity result model with stable error codes, relevant in-scope entity IDs, and user-readable Chinese messages.
- [x] 4.2 Implement and unit-test endpoint, self-reference, directed parent-child duplicate, and order-independent spouse duplicate validation.
- [x] 4.3 Implement and unit-test direct and multi-generation ancestry-cycle detection, including a returned conflict path.
- [x] 4.4 Implement and unit-test generation-constraint validation for spouse and parent-child edges, including incomplete disconnected graphs and contradictory existing paths.
- [x] 4.5 Add batch validation for imported or AI-proposed graphs so conflicts are deterministic and no candidate is validated against records outside the target tree.

## 5. Migrate relationship and AI write paths

- [x] 5.1 Refactor manual relationship creation to load only active in-tree endpoints, run the shared validator inside the write transaction, increment revision, and write audit data.
- [x] 5.2 Replace physical relationship deletion with a revision-bound impact preview and confirmed atomic soft deletion recorded under one operation batch.
- [x] 5.3 Integrate the shared validator, revision increment, and audit transaction into AI intake draft application, returning structured per-candidate conflicts without partially writing invalid relationships.
- [x] 5.4 Add service tests proving manual and AI entry points return the same integrity codes and roll back business, revision, and audit state together on failure.

## 6. Person deletion and recovery

- [x] 6.1 Implement an owner-scoped person deletion preview that reports the person, active adjacent relationships, attached events, and other affected records without mutation.
- [x] 6.2 Replace physical person deletion with confirmed atomic soft deletion of the person and active adjacent relationships while preserving events and original IDs under one deletion batch.
- [x] 6.3 Implement deletion-batch listing and atomic person/relationship restoration with current-tree ownership checks and final integrity validation.
- [x] 6.4 Add recovery service tests for successful restoration, preserved events, unrelated prior-deleted relationships, integrity conflicts, stale confirmation, cross-tree access, and full transaction rollback.

## 7. Migrate all normal read paths

- [x] 7.1 Update family workspace, person detail, events, ancestors, member search, tree layout, and relationship summary reads to exclude soft-deleted people and relationships.
- [x] 7.2 Update relationship inference, derived sibling calculation, generation synchronization, and all AI context/tool reads to exclude soft-deleted records.
- [x] 7.3 Update JSON export and any remaining API/service queries to exclude soft-deleted business records and internal audit, confirmation, and snapshot data.
- [x] 7.4 Search the repository for direct `person` and `relationship` reads, classify every recovery exception explicitly, and add regression tests for tree, search, AI context, inference, timeline, and export invisibility.

## 8. Snapshots and safe import

- [x] 8.1 Implement versioned server-side snapshot creation from active business records, including manual, pre-import, and pre-restore reasons plus creator and source revision metadata.
- [x] 8.2 Extend import core with a read-only preview that validates document shape, references, genealogy integrity, replacement impact, warnings, and conflicts before issuing a confirmation.
- [x] 8.3 Refactor import execution to require the matching current confirmation, repeat safety-critical validation in the transaction, create a pre-import snapshot, replace active data atomically, increment revision, audit the operation, and consume the confirmation.
- [x] 8.4 Implement snapshot-restore preview and confirmed execution by reusing the safe import pipeline and creating a pre-restore snapshot.
- [x] 8.5 Add tests for valid previews, invalid graphs, changed documents, stale revisions, confirmation reuse, snapshot creation, snapshot-restore chaining, and rollback of data, snapshot, revision, audit, and confirmation state.

## 9. Product interfaces

- [x] 9.1 Replace the person delete interaction with an impact-preview dialog that displays affected counts, handles stale previews, and confirms the server-issued token.
- [x] 9.2 Replace the relationship delete interaction with the same preview/confirmation contract and display structured integrity or concurrency errors.
- [x] 9.3 Add a settings recovery area that lists deletion batches and paginated operation history, restores eligible batches, and explains conflicts without exposing another tree's data.
- [x] 9.4 Add snapshot controls in settings for manual creation, snapshot listing, restore preview, confirmation, progress, and completion feedback.
- [x] 9.5 Update the JSON import interface to show preview counts, warnings, blocking conflicts, stale-preview recovery, and explicit confirmation before execution.

## 10. Verification and handoff

- [x] 10.1 Add or update automated tests so each scenario in `data-recovery-audit`, `genealogy-integrity`, and the modified `import-export` spec has direct unit, service, or interaction coverage.
- [x] 10.2 Run the database migration against a copy of representative MVP data and manually verify active reads, delete/restore, import preview, snapshot restore, revision invalidation, and cross-tree isolation.
- [x] 10.3 Run `npm test`, `npm run lint`, and `npm run build`; resolve all failures and record final verification results in the implementation handoff.
