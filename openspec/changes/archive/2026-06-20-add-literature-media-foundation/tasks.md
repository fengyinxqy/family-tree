## 1. Implementation Preparation

- [x] 1.1 Read the Next.js 16 guides under `node_modules/next/dist/docs/` for Route Handlers, request/form uploads, caching, and authentication, then record any implementation constraints in the change notes or pull request.
- [x] 1.2 Confirm the production durable-object-storage adapter and required environment variables while keeping the domain service independent of the selected provider.

## 2. Data Model and Migration

- [x] 2.1 Add Prisma models and enums for material entries, file metadata, and explicit person/event links, including family ownership, display order, soft-delete fields, uniqueness constraints, and query indexes; generate and inspect the migration.
- [x] 2.2 Extend shared family DTOs and active-query helpers so normal reads exclude deleted materials and invalid/deleted link targets; add focused data-layer tests.
- [x] 2.3 Add transaction-level integrity validation that permits family-wide materials but rejects duplicate, cross-tree, missing, deleted, or multi-target links; cover each rejection path with tests.

## 3. Private File Storage

- [x] 3.1 Define the server-only storage interface for temporary writes, finalization, streaming reads, existence checks, and compensation cleanup, with no storage keys exposed through client DTOs.
- [x] 3.2 Implement and test the private local-directory adapter outside `public/`, including safe key generation, path containment checks, atomic finalization, and missing-object behavior.
- [x] 3.3 Implement upload validation for allowed signatures, MIME types, safe display filenames, per-file size, per-material file count, SHA-256 hashing, and stable page order; add malicious and boundary-case tests.

## 4. Material Domain and APIs

- [x] 4.1 Implement authorized material list, detail, create, and update services with pagination, category/text filtering, normalized metadata validation, family revision increments, and immutable audit writes.
- [x] 4.2 Implement attachment upload and ordering services using temporary-object compensation so storage or database failures leave no active partial attachment; test both failure directions.
- [x] 4.3 Implement person/event link replacement or mutation services with same-tree integrity checks, deduplication, revision updates, and audit coverage.
- [x] 4.4 Implement revision-bound material deletion preview, confirmed soft deletion, and owner-only batch restoration, including missing-object conflict handling and atomic metadata rollback tests.
- [x] 4.5 Add authorized preview/download Route Handlers that stream verified content with safe disposition, private caching, and `nosniff`, and prove unauthorized, cross-tree, and deleted-file requests reveal no storage details.

## 5. Product Experience

- [x] 5.1 Replace the `/documents` placeholder with an accessible paginated workspace covering loading, empty, error, filter, create, edit, delete-preview, and restored-success states.
- [x] 5.2 Add the material detail and upload experience for metadata, multi-file ordering, validation progress/errors, person links, and event links without exposing storage identifiers.
- [x] 5.3 Extend person detail reads and UI with directly related active-material summaries and an unobtrusive empty state; add component or route-level regression tests.

## 6. Snapshots and Exchange Packages

- [x] 6.1 Extend family snapshot serialization, preview, and restoration with active material metadata and links, excluding file bytes and blocking restore when required objects are missing; add recovery tests.
- [x] 6.2 Define the new versioned ZIP exchange-package manifest with stable export IDs, normalized `files/` paths, hashes, material metadata, and links while retaining legacy JSON import parsing.
- [x] 6.3 Implement streaming package export that fails cleanly on unavailable active objects and never includes database IDs, storage keys, credentials, audit data, or recovery internals; add archive-content tests.
- [x] 6.4 Implement import preflight protections for path traversal, duplicate paths, file-count and expansion limits, signatures, MIME types, sizes, hashes, and family/material references; add hostile-package tests.
- [x] 6.5 Implement confirmed package restore with staged objects, snapshot-first execution, identifier remapping, atomic database replacement, confirmation consumption, and compensation cleanup; test legacy JSON and all rollback paths.

## 7. Validation and Operations

- [x] 7.1 Document storage configuration, private-directory requirements, supported formats and limits, backup compatibility, and the rule that production deployments require durable object storage.
- [x] 7.2 Run the focused material, storage, authorization, recovery, and exchange-package tests and resolve all failures introduced by this change.
- [ ] 7.3 Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`, then verify a manual upload-link-download-delete-restore flow and a package export/import round trip.
