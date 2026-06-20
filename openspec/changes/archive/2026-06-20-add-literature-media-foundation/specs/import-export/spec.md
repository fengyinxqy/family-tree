## MODIFIED Requirements

### Requirement: System SHALL export a complete JSON backup for the current user's family data
The system SHALL allow an authenticated user to export a versioned family exchange package that contains the complete persistent family data owned by that user, including people, raw relationships, person events, active material entries, file metadata, target links, and file payloads. The system SHALL continue to recognize the previous JSON-only backup version for import compatibility.

#### Scenario: User exports a family backup
- **WHEN** an authenticated user triggers a family data export
- **THEN** the system SHALL return a versioned exchange package containing that user's people, relationships, person events, materials, material links, file manifest, and file payloads
- **AND** every file payload SHALL be referenced by a stable export identifier and verified content hash rather than a database identifier or storage key

#### Scenario: Derived relationship views are excluded from backup
- **WHEN** the system generates an export document
- **THEN** it SHALL include only persistent source records
- **AND** it SHALL NOT serialize derived sibling summaries, signed download URLs, storage credentials, physical paths, audit logs, confirmations, or other read-time and internal recovery data

#### Scenario: Exported file payload becomes unavailable
- **WHEN** an active material references a file object that cannot be read during export
- **THEN** the system SHALL fail the export with a structured integrity error
- **AND** it SHALL NOT produce a package that claims to be complete

### Requirement: System SHALL import a valid JSON backup as an atomic restore operation
The system SHALL allow an authenticated user to restore family data from a valid supported JSON backup or family exchange package only after confirming an unexpired preview for that exact input and unchanged family revision. Database restoration MUST be atomic, and file-object writes MUST use compensating cleanup so a failed import leaves no active partial restore.

#### Scenario: Confirmed import restores all persistent family records together
- **WHEN** a user confirms a valid and current import preview
- **THEN** the system SHALL first persist a recoverable snapshot of the current active family data
- **AND** it SHALL restore all included people, relationships, person events, materials, file metadata, target links, and file payloads into that user's active family tree
- **AND** references between imported records SHALL remain consistent after new database and storage identifiers are assigned
- **AND** it SHALL consume the confirmation so it cannot be reused

#### Scenario: Legacy JSON backup is imported
- **WHEN** a user previews and confirms a supported backup version that predates materials
- **THEN** the system SHALL restore its people, relationships, and events without inventing material records
- **AND** the restored family SHALL remain compatible with later material creation

#### Scenario: Import confirmation does not match the package
- **WHEN** the confirmed manifest or any file payload differs from the input used to create the preview
- **THEN** the system SHALL reject the import without changing family data, stored files, snapshots, revision, or audit state

#### Scenario: Import failure does not leave partial data or files
- **WHEN** object staging, snapshot creation, final validation, restoration, revision update, audit persistence, or object finalization fails
- **THEN** the system SHALL reject the import
- **AND** it SHALL leave the target family data, active file objects, snapshots, revision, and audit state unchanged

### Requirement: System SHALL validate import payload structure and compatibility before writing data
The system SHALL validate document or archive structure, format compatibility, record references, genealogy integrity, material target integrity, file paths, file counts, declared and expanded sizes, verified media types, and content hashes during preview. It MUST repeat safety-critical validation inside the confirmed restore operation before replacement writes become active.

#### Scenario: Unsupported backup version is rejected
- **WHEN** a user previews a backup with an unsupported format version
- **THEN** the system SHALL reject the preview with a compatibility error

#### Scenario: Broken family or material references are rejected
- **WHEN** a backup contains a relationship, event, material link, or file manifest entry that references a missing source record
- **THEN** the system SHALL reject the preview instead of issuing an executable confirmation

#### Scenario: Invalid archive shape is rejected
- **WHEN** a user uploads a malformed package, an absolute or traversing archive path, duplicate manifest path, excess file count, or payload beyond configured limits
- **THEN** the system SHALL reject the import with validation feedback before any business or file writes occur

#### Scenario: File payload does not match its manifest
- **WHEN** an imported file has a missing payload, unsupported verified type, size mismatch, or content-hash mismatch
- **THEN** the system SHALL reject the preview and identify the invalid manifest entry

#### Scenario: Imported graph violates genealogy integrity
- **WHEN** the backup contains a self-reference, duplicate relationship, ancestry cycle, or generation contradiction
- **THEN** the system SHALL reject the preview with structured integrity conflicts
- **AND** it SHALL leave the target family data unchanged
