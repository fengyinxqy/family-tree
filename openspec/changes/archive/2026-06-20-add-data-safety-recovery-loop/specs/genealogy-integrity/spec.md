## ADDED Requirements

### Requirement: Relationship writes SHALL reject invalid endpoints and duplicates
The system SHALL validate candidate relationships against active records in the target family tree before writing them.

#### Scenario: Self relationship is proposed
- **WHEN** a spouse or parent-child relationship uses the same person at both endpoints
- **THEN** the system SHALL reject it with a `self_relationship` error

#### Scenario: Duplicate spouse relationship is proposed in reverse order
- **WHEN** an active spouse relationship already connects two people and the reverse endpoint order is proposed
- **THEN** the system SHALL reject it with a `duplicate_relationship` error

#### Scenario: Duplicate parent-child relationship is proposed
- **WHEN** the same directed parent-child relationship is already active
- **THEN** the system SHALL reject it with a `duplicate_relationship` error

#### Scenario: Endpoint is inactive or outside the family tree
- **WHEN** either endpoint is deleted, missing, or belongs to another family tree
- **THEN** the system SHALL reject the candidate without revealing data from another tree

### Requirement: Parent-child writes SHALL preserve an acyclic ancestry graph
The system SHALL reject any candidate parent-child relationship that would make a person their own ancestor or descendant through one or more active parent-child edges.

#### Scenario: Direct reverse edge creates a cycle
- **WHEN** A is already a parent of B and a candidate makes B a parent of A
- **THEN** the system SHALL reject the candidate with an `ancestry_cycle` error

#### Scenario: Multi-generation edge creates a cycle
- **WHEN** an active path already makes A an ancestor of C and a candidate makes C an ancestor of A
- **THEN** the system SHALL reject the candidate with an `ancestry_cycle` error
- **AND** the error SHALL identify the conflicting path or related people

### Requirement: Relationship writes SHALL preserve generation consistency
The system SHALL interpret active spouse edges as zero generation difference and active parent-child edges as a one-generation difference, and SHALL reject a candidate that contradicts a generation difference already implied by the connected graph.

#### Scenario: Candidate agrees with existing generation constraints
- **WHEN** a candidate relationship implies the same generation difference as all existing active paths between its endpoints
- **THEN** the system SHALL accept the generation constraint and continue the write

#### Scenario: Candidate contradicts an existing path
- **WHEN** existing active paths imply that two people are in the same generation but a candidate makes one the parent of the other
- **THEN** the system SHALL reject the candidate with a `generation_conflict` error

#### Scenario: Incomplete graph has no prior constraint
- **WHEN** no active path currently establishes a generation difference between valid endpoints
- **THEN** the system SHALL NOT reject the candidate merely because other relatives or dates are missing

### Requirement: Integrity validation SHALL be consistent across every write entry point
Manual relationship maintenance, AI draft application, import preview, import execution, deletion recovery, and snapshot recovery SHALL use the same domain validation rules, and final writes MUST validate against the latest active graph inside the write transaction.

#### Scenario: AI draft contains an invalid relationship
- **WHEN** an AI intake draft proposes a relationship that violates an integrity rule
- **THEN** applying the draft SHALL reject or skip the invalid candidate with the same structured error used by manual maintenance
- **AND** it SHALL NOT partially write that candidate

#### Scenario: Import contains internally invalid relationships
- **WHEN** an import document contains a duplicate, self-reference, ancestor cycle, or generation contradiction
- **THEN** import preview SHALL report the conflict
- **AND** import execution SHALL remain unavailable

#### Scenario: Graph changes between preview and transaction validation
- **WHEN** a candidate passed an earlier preview but conflicts with the latest active graph at execution time
- **THEN** the transactional validation SHALL reject the write and leave business, revision, and audit data unchanged

### Requirement: Integrity errors SHALL be structured and user-actionable
The system SHALL return a stable error code, a user-readable Chinese explanation, and relevant entity identifiers for every rejected integrity rule without exposing records outside the active family tree.

#### Scenario: Client receives a validation rejection
- **WHEN** a relationship candidate is rejected
- **THEN** the response SHALL contain the rule code and a Chinese explanation suitable for display
- **AND** it SHALL identify only the in-scope people or relationships involved in the conflict
