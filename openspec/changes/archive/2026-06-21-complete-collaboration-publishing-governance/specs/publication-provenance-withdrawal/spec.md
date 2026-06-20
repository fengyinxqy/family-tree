## ADDED Requirements

### Requirement: Published contributions SHALL retain attributable provenance
Every published revision or revision group SHALL retain its contributor, reviewer decision, publisher, publication operation, and one or more supported provenance references. Supported provenance MAY identify a source material, media object, immutable intake text snapshot, or explicit manual-entry declaration.

#### Scenario: Material-backed relationship is published
- **WHEN** an approved relationship contribution cites an active source material or media object
- **THEN** the published history SHALL retain that source reference
- **AND** authorized users SHALL be able to navigate from the publication record to the source summary

#### Scenario: Manual contribution has no external material
- **WHEN** an editor submits a manual correction without a source file
- **THEN** the system SHALL require an explicit manual-entry provenance declaration and optional rationale
- **AND** it SHALL NOT invent a source-material relationship

### Requirement: Publication visibility SHALL be withdrawn without deleting history
Only an active OWNER or ADMIN SHALL withdraw a published item from normal published visibility. Withdrawal MUST preserve the formal record, published revision, provenance, review decisions, and previous publication operation while recording the actor, reason, time, and withdrawal operation.

#### Scenario: Publisher withdraws a published item
- **WHEN** an authorized publisher supplies a non-empty reason and confirms withdrawal
- **THEN** normal published reads SHALL stop exposing that item according to its content type
- **AND** authorized collaboration and audit views SHALL retain its complete publication history

#### Scenario: Published item is withdrawn twice
- **WHEN** a second request attempts to withdraw an already withdrawn publication
- **THEN** the system SHALL return the current withdrawn state without creating a duplicate withdrawal operation

### Requirement: Publication withdrawal SHALL be atomic and dependency-aware
Withdrawal SHALL execute in one transaction with authorization, dependency validation, visibility mutation, family revision increment, and immutable audit persistence. The system MUST reject withdrawal when hiding the item would leave invalid visible dependencies unless the confirmed operation includes a valid dependency plan.

#### Scenario: Relationship withdrawal is valid
- **WHEN** an OWNER withdraws a published relationship with no required visible dependents
- **THEN** the relationship SHALL disappear from normal graph and inference reads atomically

#### Scenario: Audit persistence fails during withdrawal
- **WHEN** the visibility mutation succeeds but the withdrawal audit write fails
- **THEN** the entire withdrawal SHALL roll back

### Requirement: Review comments SHALL remain decision-scoped
Each review decision MAY contain one structured comment or override reason. The system SHALL NOT require threaded replies, mentions, reactions, or real-time discussion to complete review and publication.

#### Scenario: Reviewer requests changes
- **WHEN** a reviewer requests changes with one actionable comment
- **THEN** the system SHALL preserve that comment on the immutable decision
- **AND** the author SHALL respond by deriving and submitting a new draft rather than replying in a discussion thread

