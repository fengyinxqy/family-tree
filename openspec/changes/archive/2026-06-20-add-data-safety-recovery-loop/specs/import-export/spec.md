## ADDED Requirements

### Requirement: System SHALL preview restore impact before destructive import
The system SHALL provide a read-only preflight for a valid JSON backup before replacing active family data, and SHALL bind the preview to the authenticated user, active family tree, exact import document, and current family revision.

#### Scenario: Valid backup is previewed
- **WHEN** an authenticated user submits a valid backup for preview
- **THEN** the system SHALL return counts and summaries for records that will be added, replaced, removed, ignored, or rejected
- **AND** it SHALL include warnings and structured conflicts
- **AND** it SHALL NOT change family data or create a business audit entry

#### Scenario: Invalid backup has no executable preview
- **WHEN** document validation or genealogy integrity validation fails
- **THEN** the system SHALL return validation details
- **AND** it SHALL NOT issue an executable confirmation

#### Scenario: Family changes after preview
- **WHEN** the active family revision no longer matches the preview baseline
- **THEN** the system SHALL reject execution and require a new preview

## MODIFIED Requirements

### Requirement: System SHALL import a valid JSON backup as an atomic restore operation
The system SHALL allow an authenticated user to restore family data from a valid system-generated JSON backup only after confirming an unexpired preview for that exact document and unchanged family revision, and the restore MUST be atomic.

#### Scenario: Confirmed import restores people, relationships, and events together
- **WHEN** a user confirms a valid and current import preview
- **THEN** the system SHALL first persist a recoverable snapshot of the current active family data
- **AND** it SHALL restore all included people, relationships, and person events into that user's active family tree
- **AND** references between imported records SHALL remain consistent after new database identifiers are assigned
- **AND** it SHALL consume the confirmation so it cannot be reused

#### Scenario: Import confirmation does not match the document
- **WHEN** the confirmed document differs from the document used to create the preview
- **THEN** the system SHALL reject the import without changing family data, snapshots, revision, or audit state

#### Scenario: Import failure does not leave partial data
- **WHEN** snapshot creation, final validation, restoration, revision update, or audit persistence fails
- **THEN** the system SHALL reject the import
- **AND** it SHALL leave the target family data, snapshots, revision, and audit state unchanged

### Requirement: System SHALL validate import payload structure and compatibility before writing data
The system SHALL validate document structure, format compatibility, record references, and genealogy integrity during preview and MUST repeat safety-critical validation inside the confirmed restore transaction before any replacement writes occur.

#### Scenario: Unsupported backup version is rejected
- **WHEN** a user previews a backup with an unsupported format version
- **THEN** the system SHALL reject the preview with a compatibility error

#### Scenario: Broken references are rejected
- **WHEN** a backup contains a relationship or event that references a missing person record
- **THEN** the system SHALL reject the preview instead of issuing an executable confirmation

#### Scenario: Invalid document shape is rejected
- **WHEN** a user previews a malformed or incomplete backup document
- **THEN** the system SHALL reject it with validation feedback before any database writes occur

#### Scenario: Imported graph violates genealogy integrity
- **WHEN** the backup contains a self-reference, duplicate relationship, ancestry cycle, or generation contradiction
- **THEN** the system SHALL reject the preview with structured integrity conflicts
- **AND** it SHALL leave the target family data unchanged
