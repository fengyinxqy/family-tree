## MODIFIED Requirements

### Requirement: Key mutations SHALL produce immutable audit records
The system SHALL create append-only audit records for person, relationship, deletion, recovery, import, snapshot-restore, family invitation, membership, role, ownership transfer, revision submission, review decision, publish, and publication-withdrawal mutations in the same transaction as the authoritative state change.

#### Scenario: Owner inspects operation history
- **WHEN** the family tree OWNER opens operation history
- **THEN** the system SHALL provide paginated records showing action, timestamp, actor, affected entity summary, result, and recovery or collaboration status

#### Scenario: Business write succeeds but audit write fails
- **WHEN** the audit record cannot be persisted during a key mutation
- **THEN** the entire mutation SHALL roll back

#### Scenario: Audit record modification is attempted
- **WHEN** a normal product request attempts to update or delete an existing audit record
- **THEN** the system SHALL reject the operation

#### Scenario: Collaboration event is audited
- **WHEN** an invitation is accepted, a member role changes, a review decision is recorded, or a revision is published
- **THEN** the audit record SHALL identify the family, actor, action, affected membership or revision, and non-secret result metadata
- **AND** it SHALL NOT store invitation plaintext tokens, credentials, file bytes, or review payloads unnecessary for accountability
