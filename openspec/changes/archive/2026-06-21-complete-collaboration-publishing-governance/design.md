## Context

The repository now has family memberships, a typed action matrix, content revisions, immutable review decisions, staged media, and atomic publishing adapters. The remaining gaps are concentrated in legacy AI apply paths, provenance consistency, owner-facing collaboration audit presentation, and publication withdrawal. The current review model already stores one decision comment and does not need a discussion subsystem.

This change crosses Prisma data models, AI tools and route handlers, editorial services, normal published reads, operation history, and collaboration UI. Implementation must follow the repository's Next.js 16 documentation before modifying routes, server components, cache invalidation, or mutations.

## Goals / Non-Goals

**Goals:**

- Route AI intake and relationship acceptance through immutable, reviewable revisions.
- Publish multi-record AI contributions atomically with stable internal reference mapping.
- Make provenance explicit and family-scoped for every submitted contribution.
- Present collaboration audit events to the OWNER without exposing secrets or unnecessary payloads.
- Support authorized, audited, dependency-aware publication withdrawal without deleting history.

**Non-Goals:**

- Threaded comments, replies, mentions, reactions, or real-time collaboration.
- Automatic approval or publication of AI output.
- Anonymous public publishing, SEO pages, or social activity feeds.
- Automatic field-level merges for conflicting revisions.

## Decisions

### 1. Introduce a revision group for atomic AI contributions

An AI intake can create several people whose relationships reference one another before formal identifiers exist. Add a revision-group aggregate with immutable source snapshot metadata and ordered member revisions. Member payloads use stable temporary references resolved only inside the publish transaction. This is preferred over independently submitting revisions because partial approval or publication would produce incomplete family graphs.

AI relationship proposals involving only existing people MAY create a single relationship revision, while proposals containing new people join a revision group. All legacy direct apply functions become internal parsers/builders and lose formal-write responsibility.

### 2. Model provenance as structured references, not free text only

Each submitted revision or group records one or more provenance entries with a kind: material, media object, intake text snapshot, or manual family knowledge. Material and media identifiers are validated against the active family. Intake source text is persisted as an immutable, access-controlled snapshot or digest plus safe excerpt metadata; full text is excluded from general audit summaries.

A manual declaration remains valid because not all family knowledge has a document, but it must be explicit. This avoids making source uploads mandatory while preventing silent "no source" publications.

### 3. Keep one review comment per immutable decision

The existing `ReviewDecision` remains the complete review-comment model. A requested-change decision carries one actionable comment; the author responds through a derived draft. No comment table, thread hierarchy, notification fan-out, or real-time transport is added.

### 4. Treat withdrawal as visibility state plus immutable operation

Withdrawal does not modify or delete a PUBLISHED revision. Add explicit publication visibility state and withdrawal metadata linked to an operation batch. Normal published reads exclude withdrawn entities or relationships through shared active-published query predicates, while collaboration and owner audit views retain history.

Before withdrawal, adapters compute dependent visible records. Simple records can be withdrawn directly; dependency conflicts require a preview-bound plan or are rejected. The transaction reauthorizes OWNER/ADMIN, validates dependencies, changes visibility, increments `dataRevision`, and writes audit records atomically.

### 5. Extend operation history with typed safe summaries

Expand operation/action unions and presentation mapping for revision groups, review, publish, and withdrawal. Summaries contain stable IDs, content type, actor, status, counts, and safe source labels only. Invite tokens, full revision payloads, intake transcripts, credentials, and file bytes are prohibited.

## Risks / Trade-offs

- [Temporary AI references resolve incorrectly] → Validate a closed reference graph before persistence and resolve all references in one serializable publish transaction.
- [Large AI groups create long transactions] → Cap member counts and payload size, prevalidate outside the transaction, and rerun only authoritative checks inside it.
- [Provenance source is deleted later] → Preserve historical non-secret labels and identifiers while enforcing current access rules for source details and files.
- [Withdrawal breaks graph integrity] → Use content-type dependency adapters and confirmation-bound previews; reject unplanned dependent changes.
- [Existing published records lack provenance] → Treat them as historical baseline; require provenance only for newly submitted revisions after migration.
- [Two active OpenSpec changes overlap] → Implement this change after the collaboration foundation or explicitly reconcile overlapping pending tasks before archive.

## Migration Plan

1. Read relevant Next.js 16 guides and inventory remaining direct AI/formal writes and normal published-read predicates.
2. Add revision-group, provenance, and publication-visibility schema changes with indexes and baseline-safe defaults.
3. Implement pure payload/reference validation and migration tests before switching routes.
4. Convert AI intake and relationship apply endpoints to create revisions/groups; keep formal reads unchanged.
5. Add group review and atomic publish adapters, then provenance views and owner audit presentation.
6. Add withdrawal preview/confirm transactions and shared normal-read filters.
7. Run targeted tests, full quality gates, production build, and role-matrix end-to-end checks.

Rollback disables AI apply, provenance submission, and withdrawal endpoints first. Existing formal records and published revisions remain valid. New groups and provenance records remain read-only history; visibility defaults must preserve the last successfully published state.

## Open Questions

- Whether withdrawal of a person should be prohibited while active relationships exist or require a multi-item dependency plan; implementation should choose the safer preview-and-plan behavior.
- Maximum AI revision-group size should be derived from current intake limits and measured transaction duration rather than left unbounded.
