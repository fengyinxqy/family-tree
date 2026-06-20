## 1. Implementation Preparation

- [x] 1.1 Read the relevant Next.js 16 guides in `node_modules/next/dist/docs/` for route handlers, server components, mutations, authentication boundaries, and cache invalidation, and record the applicable conventions for this change.
- [x] 1.2 Inventory every family-scoped read and mutation that still authorizes through `createdBy` or `FamilyTree.ownerId`, and map each entry point to a centralized family action.
- [x] 1.3 Define the OWNER, ADMIN, EDITOR, REVIEWER, and VIEWER action matrix as a shared typed contract with explicit owner-only recovery actions.

## 2. Membership Data Foundation

- [x] 2.1 Extend the Prisma schema with membership role/status enums, `FamilyMembership`, and `FamilyInvitation`, including uniqueness, expiry, lookup, and family-scope indexes.
- [x] 2.2 Create a migration that backfills exactly one active OWNER membership for every existing family and verifies it matches `FamilyTree.ownerId`.
- [x] 2.3 Add membership and invitation domain schemas that normalize email addresses, restrict assignable roles, and prevent persistence of plaintext invitation tokens.
- [x] 2.4 Add migration and domain tests for owner backfill, duplicate memberships, invalid owner demotion, invitation expiry, and token hashing.

## 3. Centralized Authorization

- [x] 3.1 Implement a server-only family authorization service that resolves active membership and checks typed actions without leaking cross-family record existence.
- [x] 3.2 Add unit tests covering every role/action combination, suspended and removed members, owner-only actions, and cross-family identifiers.
- [x] 3.3 Refactor family workspace and tree-space reads to authorize membership first and query active records by `treeId` instead of record creator.
- [x] 3.4 Refactor person, relationship, event, material, file, import/export, agent, audit, deletion, and snapshot server entry points to use the centralized authorization service.
- [x] 3.5 Add regression tests proving direct API calls cannot bypass hidden UI controls and stopped members lose access on their next request.

## 4. Invitations and Member Management

- [x] 4.1 Implement transactional invitation creation, listing, revocation, and acceptance services with hashed single-use tokens, email binding, expiry checks, and audit writes.
- [x] 4.2 Implement transactional member role change, suspension, reactivation, and removal services that protect the sole owner and ADMIN management boundaries.
- [x] 4.3 Implement atomic ownership transfer that updates `FamilyTree.ownerId`, swaps membership roles, and writes one immutable operation batch.
- [x] 4.4 Add authenticated route handlers or server actions for invitation and membership operations using the current Next.js 16 conventions.
- [x] 4.5 Build the family settings member interface with role descriptions, invitation status, permission-aware controls, and clear Chinese authorization errors.
- [ ] 4.6 Add service and route tests for invitation replay, wrong-email acceptance, ADMIN owner assignment, last-owner protection, and ownership transfer rollback.

## 5. Revision and Review Data Foundation

- [x] 5.1 Extend the Prisma schema with revision status/content-type enums, `ContentRevision`, and `ReviewDecision`, including immutable history, base-version, queue, target, and publication indexes.
- [x] 5.2 Create the revision migration without synthesizing review history for existing published business records.
- [x] 5.3 Define versioned Zod payload schemas for person, event, relationship, material metadata, media metadata, and material-link revisions.
- [x] 5.4 Implement revision payload parsing and family-scope reference validation with structured Chinese errors for unsupported schemas and out-of-scope identifiers.
- [x] 5.5 Add tests for every payload type, unknown schema versions, cross-family references, and malformed relationship payloads.

## 6. Draft and Review Workflow

- [x] 6.1 Implement draft creation/update and draft derivation services that preserve author, base family revision, target version, and immutable ancestor history.
- [x] 6.2 Implement the revision state machine and reject every transition outside the specified draft, review, changes-requested, approved, and published paths.
- [x] 6.3 Implement submission and review services with immutable submitted payloads, required change comments, self-review prevention, and audited OWNER/ADMIN override reasons.
- [x] 6.4 Implement permission-filtered draft views and a family review queue that never exposes revision payloads or comments to VIEWER members.
- [x] 6.5 Build draft status, submission, review queue, revision detail, review comment, approval, and changes-requested interfaces with Chinese state labels.
- [ ] 6.6 Add workflow tests for resubmission via derived drafts, in-place edit rejection, self-review, emergency override, and stopped reviewers.

## 7. Atomic Publishing

- [x] 7.1 Implement a publish coordinator that reauthorizes the actor, loads the approved immutable revision, validates its schema and scope, and dispatches by content type.
- [x] 7.2 Implement person and event publish adapters that create or update formal records and preserve existing data-safety transaction semantics.
- [x] 7.3 Implement relationship publish adapters that rerun current genealogy integrity validation inside the publish transaction.
- [x] 7.4 Implement material, media metadata, and material-link publish adapters that preserve file authorization, storage compensation, and recovery metadata rules.
- [x] 7.5 Atomically apply business writes, increment `dataRevision`, mark the revision PUBLISHED, and persist operation/audit records; roll back all state on any failure.
- [x] 7.6 Implement target/dependency conflict detection and structured stale-revision responses, while permitting unrelated family revision changes.
- [ ] 7.7 Add publish tests for each content type, integrity conflicts, stale targets, unrelated changes, audit failure rollback, and duplicate publish attempts.

## 8. Existing Write-Path Migration

- [x] 8.1 Route person and event create/edit UI and APIs through draft creation and submission instead of direct formal-table mutation.
- [ ] 8.2 Route relationship create/edit UI, agent relationship proposals, and intake apply operations through revision submission.
- [x] 8.3 Route material metadata and link changes through revisions while keeping private file-byte staging authorized and non-public.
- [ ] 8.4 Route import execution through a reviewable batch revision or equivalent immutable revision group before formal publication.
- [ ] 8.5 Verify ordinary tree, person, timeline, relationship inference, material, download, snapshot, and export reads exclude all unpublished revision data.
- [ ] 8.6 Add regression tests proving existing owners retain access and only successful publication changes formal reads or exports.

## 9. Audit and Publication Visibility

- [ ] 9.1 Extend operation action types and audit summaries for invitations, membership changes, ownership transfer, revision transitions, publishing, and withdrawal without recording secrets or unnecessary payloads.
- [ ] 9.2 Update operation history presentation to show collaboration actor, action, affected member or revision, result, and status to the OWNER.
- [ ] 9.3 Implement audited publication withdrawal or visibility control that preserves published revision history and member-visible formal data.
- [ ] 9.4 Add audit tests for append-only enforcement, secret redaction, transaction rollback, and complete actor attribution.

## 10. Validation and Release

- [ ] 10.1 Run targeted membership, authorization, revision, review, publish, integrity, audit, import/export, and recovery tests and resolve only regressions introduced by this change.
- [ ] 10.2 Run `npm run typecheck`, `npm run lint`, and the complete `npm test` suite.
- [ ] 10.3 Run `npm run build` and verify the changed routes and server components follow the inspected Next.js 16 guidance without cache-related visibility leaks.
- [ ] 10.4 Perform end-to-end role-matrix checks for invitation, editing, review, publication, suspension, cross-family access, ownership transfer, and owner-only recovery.
- [ ] 10.5 Document migration, rollback, role semantics, editorial workflow, and operational checks for administrators and future implementation agents.
