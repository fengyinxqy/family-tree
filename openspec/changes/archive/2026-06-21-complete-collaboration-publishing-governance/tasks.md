## 1. Implementation Preparation

- [x] 1.1 Read the relevant Next.js 16 route-handler, server-component, mutation, authentication, and cache-invalidation guides in `node_modules/next/dist/docs/` and record constraints that apply to this change.
- [x] 1.2 Reconcile this change with pending tasks 8.2, 9.1, 9.2, 9.3, and 9.4 in `family-collaboration-review-publishing-permissions`, documenting which change owns each implementation and preventing duplicate task completion.
- [x] 1.3 Inventory every AI intake, AI relationship, publication-read, export, snapshot, audit-history, and withdrawal-related server entry point and map it to a typed family action.

## 2. Revision Group and Provenance Data Model

- [x] 2.1 Define versioned Zod schemas for AI revision-group source snapshots, temporary entity references, ordered member revisions, and group status transitions.
- [x] 2.2 Extend the Prisma schema with revision groups and membership/order metadata that preserve immutable AI contribution boundaries and efficient family/status lookup.
- [x] 2.3 Extend the Prisma schema with structured provenance records supporting material, media, intake snapshot, and manual-knowledge kinds without storing secrets in audit summaries.
- [x] 2.4 Extend formal publication metadata with active/withdrawn visibility state, withdrawal actor, reason, time, and operation linkage while preserving existing published revision history.
- [x] 2.5 Create a baseline-safe migration that leaves existing published records visible, does not fabricate provenance, and adds required indexes and constraints.
- [x] 2.6 Add schema and migration tests for closed temporary-reference graphs, cross-family provenance, duplicate provenance, baseline visibility, and immutable group membership.

## 3. AI Contribution Revision Creation

- [x] 3.1 Refactor AI intake apply logic into a pure builder that converts a validated `IntakeDraft` into typed revision-group members without writing formal tables.
- [x] 3.2 Implement transactional AI revision-group creation with actor attribution, immutable source snapshot metadata, payload limits, ordered member persistence, and non-secret audit summary.
- [x] 3.3 Refactor AI relationship proposal acceptance to create a single relationship revision when all endpoints already exist and a revision group when new entities are required.
- [x] 3.4 Update AI apply route handlers to authorize revision creation, return revision or group identifiers, and remove every direct formal person, event, and relationship mutation.
- [x] 3.5 Update AI intake and relationship interfaces to say “创建待审修订”, navigate to the created revision/group, and never claim formal data was written before publication.
- [x] 3.6 Add tests proving VIEWER and REVIEWER roles cannot create AI revisions, stopped members lose access immediately, malformed temporary references are rejected, and formal reads remain unchanged after group creation.

## 4. Group Review and Atomic Publishing

- [x] 4.1 Implement revision-group submission that validates every member payload and dependency, freezes the group snapshot, and enters review as one unit.
- [x] 4.2 Extend review queue and detail services to expose group summaries and member diffs only to authorized collaborators without adding threaded comments.
- [x] 4.3 Implement group approval and changes-requested decisions using the existing immutable single-comment `ReviewDecision` model and self-review rules.
- [x] 4.4 Implement deterministic temporary-reference resolution for new people, events, and relationships inside a serializable publish transaction.
- [x] 4.5 Implement atomic group publishing that reauthorizes the publisher, reruns genealogy integrity validation, applies all members, increments `dataRevision`, and writes one operation batch.
- [x] 4.6 Add compensation and rollback behavior for any staged media referenced by a group when database publication fails.
- [x] 4.7 Add tests for valid multi-person publication, mixed reuse/new references, duplicate and cycle conflicts, stale dependencies, audit failure rollback, duplicate publish requests, and no partial formal writes.

## 5. Provenance Enforcement and Presentation

- [x] 5.1 Implement family-scoped provenance validation that rejects deleted, missing, cross-family, or incompatible material and media references.
- [x] 5.2 Require at least one supported provenance entry or an explicit manual-knowledge declaration before revision or group submission.
- [x] 5.3 Persist immutable intake source snapshots or safe digests/excerpts separately from general audit summaries and authorize their collaboration-only reads.
- [x] 5.4 Extend revision and publication services to retain contributor, reviewer, publisher, operation, provenance kind, source identifier, and safe historical source label.
- [x] 5.5 Build provenance controls in manual and AI revision interfaces and publication-history links to authorized material summaries.
- [x] 5.6 Ensure file preview/download remains independently authorized and no provenance response exposes storage keys, physical paths, credentials, full intake text, or file bytes.
- [x] 5.7 Add tests for material-backed, media-backed, intake-backed, and manual contributions plus deleted-source, cross-family-source, and unauthorized-file scenarios.

## 6. Collaboration Audit History

- [x] 6.1 Extend operation action and entity unions for revision-group creation, group submission, review, publication, provenance, and withdrawal events.
- [x] 6.2 Define typed safe audit-summary builders that whitelist stable IDs, content types, counts, roles, statuses, and safe source labels while redacting tokens and payload bodies.
- [x] 6.3 Update owner operation-history queries to include actor identity, affected membership/revision/group, result, review status, publication status, and withdrawal status with stable pagination.
- [x] 6.4 Update the settings operation-history interface with Chinese collaboration action labels, actor display, affected-object summaries, and status badges visible only to OWNER.
- [x] 6.5 Add append-only, secret-redaction, actor-attribution, pagination, unauthorized-read, and audit-rollback tests for collaboration events.

## 7. Publication Withdrawal

- [x] 7.1 Define typed withdrawal actions and content-type dependency adapters for people, events, relationships, materials, media, and material links.
- [x] 7.2 Implement a revision-bound withdrawal preview that reports affected published dependencies and issues an OWNER/ADMIN-scoped, short-lived confirmation.
- [x] 7.3 Implement atomic, idempotent withdrawal with reauthorization, dependency validation, visibility update, `dataRevision` increment, and immutable audit operation.
- [x] 7.4 Update shared normal-read predicates so tree, person, timeline, relationship inference, material, file, export, and snapshot reads exclude withdrawn content without hiding audit history.
- [x] 7.5 Add withdrawal controls and reason collection to authorized publication views, with clear dependency conflicts and no discussion-thread UI.
- [x] 7.6 Add tests for valid relationship/material withdrawal, repeated withdrawal, stale confirmation, dependent-content conflict, unauthorized actor, cross-family identifier, and audit failure rollback.

## 8. Validation and Documentation

- [x] 8.1 Run targeted AI intake, relationship integrity, revision workflow, group publishing, provenance, audit, withdrawal, import/export, snapshot, and file-authorization tests.
- [x] 8.2 Add regression tests proving unpublished groups and withdrawn content never leak into ordinary reads or exports while existing baseline published records remain visible.
- [x] 8.3 Run `npm run lint`, `npm run typecheck`, and the complete `npm test` suite and resolve only regressions introduced by this change.
- [x] 8.4 Run `npm run build` and verify all changed Next.js 16 routes and server components avoid cache and authorization visibility leaks.
- [x] 8.5 Perform end-to-end role checks for AI contribution, review, provenance access, publication, withdrawal, stopped membership, and cross-family access.
- [x] 8.6 Document migration, rollback, provenance semantics, revision-group limits, single-comment review behavior, withdrawal operations, and administrator checks.
