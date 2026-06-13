## Purpose

Define the backup and restore behavior for a user's family data so the system can provide dependable export, recovery, and migration foundations.

## Requirements

### Requirement: System SHALL export a complete JSON backup for the current user's family data
The system SHALL allow an authenticated user to export a versioned JSON backup that contains the complete persistent family data owned by that user, including people, raw relationships, and person events.

#### Scenario: User exports a family backup
- **WHEN** an authenticated user triggers a family data export
- **THEN** the system SHALL return a JSON document containing that user's people, relationships, and person events
- **AND** the document SHALL include a format version so later imports can validate compatibility

#### Scenario: Derived relationship views are excluded from backup
- **WHEN** the system generates an export document
- **THEN** it SHALL include only persistent source records
- **AND** it SHALL NOT serialize derived sibling summaries or other read-time view data

### Requirement: System SHALL import a valid JSON backup as an atomic restore operation
The system SHALL allow an authenticated user to restore family data from a valid system-generated JSON backup, and the restore MUST be atomic.

#### Scenario: Import restores people, relationships, and events together
- **WHEN** a user imports a valid JSON backup
- **THEN** the system SHALL restore all included people, relationships, and person events into that user's family space
- **AND** references between imported records SHALL remain consistent after new database identifiers are assigned

#### Scenario: Import failure does not leave partial data
- **WHEN** an import payload fails during validation or restoration
- **THEN** the system SHALL reject the import
- **AND** it SHALL leave the target family data unchanged

### Requirement: System SHALL validate import payload structure and compatibility before writing data
The system SHALL validate the import document before any restore write begins.

#### Scenario: Unsupported backup version is rejected
- **WHEN** a user imports a backup with an unsupported format version
- **THEN** the system SHALL reject the import with a compatibility error

#### Scenario: Broken references are rejected
- **WHEN** a backup contains a relationship or event that references a missing person record
- **THEN** the system SHALL reject the import instead of attempting a partial restore

#### Scenario: Invalid document shape is rejected
- **WHEN** a user uploads a malformed or incomplete backup document
- **THEN** the system SHALL reject the import with validation feedback before any database writes occur
