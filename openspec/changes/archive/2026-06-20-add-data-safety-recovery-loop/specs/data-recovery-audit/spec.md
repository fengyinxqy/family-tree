## ADDED Requirements

### Requirement: Active family reads SHALL exclude soft-deleted records
The system SHALL treat people and relationships with a deletion timestamp as inactive and SHALL exclude them from normal family reads, including tree views, search, person details, timelines, relationship inference, AI context, and exports.

#### Scenario: Deleted person disappears from product views
- **WHEN** a person is soft-deleted
- **THEN** the person SHALL no longer appear in the tree, search, timeline, AI context, relationship inference, or exported family data
- **AND** the person's persistent record and events SHALL remain available to authorized recovery operations

#### Scenario: Deleted relationship stops affecting the graph
- **WHEN** a relationship is soft-deleted
- **THEN** it SHALL no longer affect tree edges, derived siblings, generation calculations, relationship summaries, or kinship answers

### Requirement: Destructive actions SHALL provide a revision-bound impact preview
Before deleting a person or executing another destructive recovery action, the system SHALL return an impact preview and a short-lived, single-use confirmation bound to the current user, family tree, operation input, and family data revision.

#### Scenario: Person deletion preview lists affected records
- **WHEN** an authorized user requests a deletion preview for an active person
- **THEN** the system SHALL report the person, adjacent active relationships, attached events, and other records that will become hidden or be changed
- **AND** it SHALL NOT mutate family data

#### Scenario: Stale confirmation is rejected
- **WHEN** family data changes after a preview is created and the user attempts to confirm that preview
- **THEN** the system SHALL reject the destructive action without changing data
- **AND** it SHALL require a new preview

#### Scenario: Confirmation cannot be reused across scope
- **WHEN** a confirmation is expired, already consumed, belongs to another user or tree, or is paired with different operation input
- **THEN** the system SHALL reject it without changing data

### Requirement: Person and relationship deletion SHALL be atomic and recoverable
The system SHALL soft-delete people and relationships instead of physically removing them from an active family tree, and all records affected by one delete action MUST be associated with the same operation batch.

#### Scenario: Deleting a person preserves a recoverable batch
- **WHEN** an authorized user confirms deletion of a person with active events and relationships
- **THEN** the system SHALL atomically soft-delete the person and all adjacent active relationships
- **AND** it SHALL preserve the person's events and original identifiers
- **AND** it SHALL record one deletion operation containing the affected records

#### Scenario: Deleting a relationship preserves both people
- **WHEN** an authorized user confirms deletion of an active relationship
- **THEN** the system SHALL soft-delete only that relationship
- **AND** both endpoint people SHALL remain active

#### Scenario: Deletion transaction fails
- **WHEN** any deletion, revision increment, or audit write fails
- **THEN** the system SHALL leave the person, relationships, revision, and audit state unchanged

### Requirement: Authorized users SHALL restore recoverable deletion batches
The system SHALL allow the family tree owner to restore a deletion batch atomically when its records still belong to that tree and the restored graph passes current integrity validation.

#### Scenario: Person deletion is restored
- **WHEN** the owner restores a valid person deletion batch
- **THEN** the system SHALL reactivate the person and the relationships deleted by that same batch
- **AND** the person's preserved events SHALL become visible again
- **AND** the restore SHALL be recorded as a new operation

#### Scenario: Relationship restore conflicts with current graph
- **WHEN** restoring one or more relationships would create a duplicate, self-reference, ancestor cycle, or generation contradiction
- **THEN** the system SHALL reject the entire restore without reactivating any record
- **AND** it SHALL return structured conflict details

#### Scenario: Cross-tree recovery is attempted
- **WHEN** a user attempts to restore a deletion batch outside its owning family tree
- **THEN** the system SHALL reject the request without revealing or modifying the batch contents

### Requirement: Key mutations SHALL produce immutable audit records
The system SHALL create append-only audit records for person, relationship, deletion, recovery, import, and snapshot-restore mutations in the same transaction as the business change.

#### Scenario: User inspects operation history
- **WHEN** the family tree owner opens operation history
- **THEN** the system SHALL provide paginated records showing action, timestamp, actor, affected entity summary, result, and recovery status

#### Scenario: Business write succeeds but audit write fails
- **WHEN** the audit record cannot be persisted during a key mutation
- **THEN** the entire mutation SHALL roll back

#### Scenario: Audit record modification is attempted
- **WHEN** a normal product request attempts to update or delete an existing audit record
- **THEN** the system SHALL reject the operation

### Requirement: Family snapshots SHALL support controlled recovery
The family tree owner SHALL be able to create a server-side snapshot manually, and the system MUST create a pre-operation snapshot before destructive import or snapshot restoration.

#### Scenario: Owner creates a manual snapshot
- **WHEN** the owner requests a manual snapshot
- **THEN** the system SHALL persist a versioned snapshot of the active business records with its creator, reason, family revision, and creation time
- **AND** it SHALL list the snapshot in the family's recovery interface

#### Scenario: Snapshot restoration uses safety preview
- **WHEN** the owner selects a snapshot to restore
- **THEN** the system SHALL show a revision-bound impact preview before writing data
- **AND** a confirmed restore SHALL create another snapshot of the immediately preceding state before atomically replacing active data

#### Scenario: Internal recovery data is exported
- **WHEN** a user downloads a normal family JSON backup
- **THEN** the backup SHALL NOT include audit logs, confirmation records, or server-side snapshot metadata by default
