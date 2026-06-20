## ADDED Requirements

### Requirement: Material mutations SHALL be auditable and recoverable
The system SHALL include material entries, file metadata, and target links in the family data-safety boundary. Create, update, link, unlink, soft-delete, and restore operations MUST update the family revision and persist an immutable audit record atomically with the business metadata change.

#### Scenario: Material mutation succeeds
- **WHEN** an authorized user creates or changes a material, file attachment, or target link
- **THEN** the system SHALL commit the business metadata, family revision increment, and audit entry together
- **AND** the audit summary SHALL identify the affected material and mutation type without storing file bytes

#### Scenario: Material audit write fails
- **WHEN** audit persistence or family revision update fails during a material mutation
- **THEN** the system SHALL roll back all database changes for that mutation
- **AND** it SHALL compensate any uncommitted object-storage write

### Requirement: Material deletion SHALL preserve a recoverable source record
The system SHALL soft-delete a material entry and hide its file metadata and links from normal reads as one operation batch while retaining enough metadata and file bytes to restore the entry during the configured recovery period.

#### Scenario: User previews material deletion
- **WHEN** an authorized user requests deletion impact for an active material
- **THEN** the system SHALL report the entry, attached files, person links, and event links that will become hidden
- **AND** it SHALL issue a revision-bound confirmation without mutating family data

#### Scenario: Confirmed material deletion completes
- **WHEN** an authorized user confirms a current material deletion preview
- **THEN** the system SHALL atomically mark the material and its active dependent metadata as deleted under one operation batch
- **AND** normal listing, person details, preview, and download requests SHALL no longer expose them

#### Scenario: Owner restores a material deletion
- **WHEN** the family owner restores a valid material deletion batch whose referenced file objects still exist
- **THEN** the system SHALL reactivate the entry, file metadata, and links atomically
- **AND** it SHALL record restoration as a new operation

#### Scenario: Required file object is missing during restore
- **WHEN** a material restore references a file object that is no longer available
- **THEN** the system SHALL reject the entire restore with structured conflict details
- **AND** it SHALL NOT reactivate a partially readable material

### Requirement: Family snapshots SHALL include material metadata and links
Family snapshots SHALL preserve active material entries, file metadata, display order, and target links without embedding file bytes, storage credentials, or physical storage paths.

#### Scenario: Snapshot captures materials
- **WHEN** a family snapshot is created while active materials exist
- **THEN** the snapshot SHALL contain sufficient material and link metadata to reconstruct those active records
- **AND** it SHALL refer to file objects only through stable internal identifiers

#### Scenario: Snapshot restore validates file availability
- **WHEN** an owner previews restoration of a snapshot containing materials
- **THEN** the system SHALL verify that all referenced file objects remain available before issuing an executable confirmation
- **AND** missing objects SHALL be reported as blocking conflicts
