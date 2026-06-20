## ADDED Requirements

### Requirement: AI contributions SHALL become immutable revision groups
The system SHALL convert an accepted AI intake draft or AI relationship proposal into a family-scoped revision group before any proposed person, event, or relationship affects formal business records. The group MUST preserve the initiating user, source snapshot, ordered member revisions, reference mapping, schema versions, and group status.

#### Scenario: User accepts an AI intake draft
- **WHEN** an authorized EDITOR accepts a ready AI intake draft containing new people and relationships
- **THEN** the system SHALL create one revision group with typed member revisions
- **AND** it SHALL NOT create or update formal people, events, or relationships

#### Scenario: AI proposal reuses a published person
- **WHEN** a proposal references an existing active person in the same family
- **THEN** the revision group SHALL preserve that published identifier as a scoped dependency
- **AND** publishing SHALL reject the group if the dependency becomes invalid or conflicting

### Requirement: AI revision groups SHALL be reviewed and published atomically
The system SHALL submit, review, and publish an AI revision group as one attributable unit. Publishing MUST resolve internal temporary references, rerun current genealogy integrity validation, apply all formal writes, increment the family revision, and persist audit records in one transaction.

#### Scenario: Reviewer approves a valid AI group
- **WHEN** an authorized reviewer approves an IN_REVIEW AI revision group
- **THEN** the entire immutable group SHALL become APPROVED
- **AND** no member revision SHALL become formally visible before publication

#### Scenario: One proposed relationship conflicts at publish time
- **WHEN** any relationship in an approved AI group would create a duplicate, cycle, self-reference, or generation conflict
- **THEN** the system SHALL reject the entire publication
- **AND** no person, event, relationship, family revision, or success audit state SHALL change

### Requirement: AI apply endpoints SHALL not bypass revision authorization
Every AI apply endpoint SHALL authorize the current family action and SHALL return revision-group metadata rather than direct formal-write results.

#### Scenario: Viewer calls AI apply directly
- **WHEN** a VIEWER bypasses the client and calls an AI apply endpoint
- **THEN** the system SHALL reject the request without creating a revision group or formal record

