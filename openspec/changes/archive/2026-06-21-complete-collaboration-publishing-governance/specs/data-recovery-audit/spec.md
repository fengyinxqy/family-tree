## MODIFIED Requirements

### Requirement: Key mutations SHALL produce immutable audit records
The system SHALL create append-only audit records for person, relationship, deletion, recovery, import, snapshot-restore, family invitation, membership, role, ownership transfer, AI revision-group creation, revision submission, review decision, publication, and publication-withdrawal mutations in the same transaction as the authoritative state change.

#### Scenario: Owner inspects collaboration operation history
- **WHEN** the family tree OWNER opens operation history
- **THEN** the system SHALL provide paginated records showing action, timestamp, actor, affected member, revision or revision group summary, result, and recovery, review, publication, or withdrawal status

#### Scenario: Business write succeeds but audit write fails
- **WHEN** the audit record cannot be persisted during a key mutation
- **THEN** the entire mutation SHALL roll back

#### Scenario: Audit record modification is attempted
- **WHEN** a normal product request attempts to update or delete an existing audit record
- **THEN** the system SHALL reject the operation

#### Scenario: Collaboration event is audited
- **WHEN** an invitation is accepted, a role changes, an AI revision group is created, a review decision is recorded, or a publication is published or withdrawn
- **THEN** the audit record SHALL identify the family, actor, action, affected membership, revision or group, and non-secret result metadata
- **AND** it SHALL NOT store invitation plaintext tokens, credentials, file bytes, full intake text, or review payloads unnecessary for accountability

#### Scenario: Non-owner requests operation history
- **WHEN** an ADMIN, EDITOR, REVIEWER, or VIEWER requests owner operation history
- **THEN** the system SHALL reject the request without returning audit entries

