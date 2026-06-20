## ADDED Requirements

### Requirement: AI relationship proposals SHALL use the editorial revision path
The system SHALL represent an accepted AI relationship proposal as a typed relationship revision or a member of an AI revision group. It MUST NOT invoke the legacy direct relationship mutation path.

#### Scenario: User accepts an AI relationship proposal
- **WHEN** an authorized editor accepts a proposed spouse or parent-child relationship
- **THEN** the system SHALL create an attributable DRAFT revision
- **AND** the published graph SHALL remain unchanged until approved publication

### Requirement: Published relationship revisions SHALL preserve derived sibling semantics
Publishing a relationship revision SHALL rerun current relationship integrity validation and SHALL continue deriving sibling context only from successfully published parent-child links.

#### Scenario: Parent-child revision is published
- **WHEN** an approved child relationship revision is published successfully
- **THEN** downstream sibling context SHALL reflect the new published link
- **AND** no sibling edge SHALL be persisted

#### Scenario: Relationship revision remains unpublished
- **WHEN** a relationship revision is DRAFT, IN_REVIEW, CHANGES_REQUESTED, or APPROVED
- **THEN** it SHALL NOT affect sibling derivation, tree edges, generation calculations, or kinship answers

