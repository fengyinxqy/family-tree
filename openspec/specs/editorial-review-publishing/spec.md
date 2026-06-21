## Purpose

定义家庭协作内容从修订、审核到发布的治理规则，确保已发布数据保持稳定、变更可追溯，并避免绕过审核流程直接修改或撤回公开内容。

## Requirements

### Requirement: Collaborative content changes SHALL be stored as revisions
Changes to people, relationships, person events, literature, media metadata, and their links SHALL be represented as family-scoped content revisions before they affect published business records. Each revision MUST record its author, content type, payload schema version, base family revision, status, and immutable submission history.

#### Scenario: Editor changes a published person
- **WHEN** an EDITOR saves changes to a published person's biography
- **THEN** the system SHALL create or update that editor's DRAFT revision
- **AND** the published person read SHALL remain unchanged

#### Scenario: Editor drafts new content
- **WHEN** an EDITOR creates a new person or material draft
- **THEN** the system SHALL assign a stable revision identifier without creating a published business record

### Requirement: Revision payloads SHALL be type-safe and family-scoped
The system SHALL validate each revision payload against the supported schema for its content type and SHALL verify that every referenced entity belongs to the same active family before saving, submitting, reviewing, or publishing the revision.

#### Scenario: Revision references another family
- **WHEN** a revision payload contains a person, event, material, file, or relationship identifier from another family
- **THEN** the system SHALL reject the revision without exposing the referenced record

#### Scenario: Unknown payload schema is submitted
- **WHEN** a revision declares an unsupported content type or schema version
- **THEN** the system SHALL reject submission with a structured validation error

### Requirement: Submitted revisions SHALL follow a controlled review state machine
The system SHALL allow only `DRAFT → IN_REVIEW → APPROVED → PUBLISHED`, `IN_REVIEW → CHANGES_REQUESTED`, and `CHANGES_REQUESTED → new DRAFT revision` transitions. A submitted revision MUST become immutable, and every transition MUST record its actor and timestamp.

#### Scenario: Editor submits a valid draft
- **WHEN** an EDITOR submits a valid DRAFT revision
- **THEN** the system SHALL mark it IN_REVIEW, preserve its submitted payload immutably, and add it to the family review queue

#### Scenario: Submitted payload is edited in place
- **WHEN** any user attempts to alter the payload of an IN_REVIEW, APPROVED, or PUBLISHED revision
- **THEN** the system SHALL reject the mutation and require a new derived draft where applicable

#### Scenario: Invalid transition is requested
- **WHEN** a user attempts to publish a DRAFT or resubmit a PUBLISHED revision
- **THEN** the system SHALL reject the request without changing revision or business state

### Requirement: Review decisions SHALL be attributable and actionable
An authorized reviewer SHALL approve or request changes on an IN_REVIEW revision with an attributable decision. A changes-requested decision MUST include a non-empty review comment suitable for the author to act on.

#### Scenario: Reviewer requests changes
- **WHEN** a REVIEWER requests changes and provides a comment
- **THEN** the system SHALL mark the revision CHANGES_REQUESTED and preserve the reviewer, comment, and decision time

#### Scenario: Reviewer approves another member's revision
- **WHEN** a REVIEWER approves an eligible IN_REVIEW revision authored by another user
- **THEN** the system SHALL mark the revision APPROVED and preserve the review decision

#### Scenario: Reviewer attempts self-review
- **WHEN** a REVIEWER attempts to approve or reject their own revision
- **THEN** the system SHALL reject the decision without changing revision state

#### Scenario: Owner performs an emergency self-review
- **WHEN** an OWNER or ADMIN reviews their own revision with a non-empty override reason
- **THEN** the system SHALL record the decision and explicit override reason in the immutable audit trail

### Requirement: Publishing SHALL atomically apply an approved revision
Only an active OWNER or ADMIN SHALL publish an APPROVED revision. Publishing MUST reauthorize the actor, revalidate payload and domain integrity against current family data, apply the business mutation, increment the family data revision, mark the content revision PUBLISHED, and write immutable audit records in one transaction.

#### Scenario: Approved person revision is published
- **WHEN** an authorized publisher publishes a valid APPROVED person revision
- **THEN** the formal person record SHALL reflect the approved payload
- **AND** the family revision, revision state, and audit operation SHALL commit atomically

#### Scenario: Relationship revision violates current graph integrity
- **WHEN** an approved relationship revision would create a duplicate, self-reference, ancestry cycle, or generation conflict at publish time
- **THEN** the system SHALL reject the entire publish with structured conflict details
- **AND** no business, revision, family revision, or audit-success state SHALL change

#### Scenario: Audit persistence fails during publish
- **WHEN** the publish business write succeeds but its required audit write fails inside the transaction
- **THEN** the system SHALL roll back the complete publish operation

### Requirement: Stale revisions SHALL not overwrite conflicting published changes
Before publishing, the system SHALL compare the revision's base version with current family and target state. If intervening changes affect the target or its integrity dependencies, publishing MUST be rejected with structured conflict details and the user SHALL be able to derive a new draft from current published data.

#### Scenario: Same person changed after draft creation
- **WHEN** a person has been published with newer changes after another revision used it as a base
- **THEN** publishing the older revision SHALL be rejected without overwriting the newer person

#### Scenario: Unrelated material changed
- **WHEN** the family revision changed only because an unrelated material was published
- **THEN** the system MAY publish the revision after confirming its target and integrity dependencies are unchanged

### Requirement: Unpublished revisions SHALL remain outside published reads and exports
Normal tree views, person details, relationship inference, timelines, family exports, snapshots, file downloads, and any enabled public presentation SHALL use only published business records. Collaboration workspace reads SHALL expose drafts and review data only to members whose role permits that workspace access.

#### Scenario: Viewer opens a person with a pending revision
- **WHEN** a VIEWER opens a published person that has an IN_REVIEW biography change
- **THEN** the viewer SHALL receive the published biography and SHALL NOT receive the pending payload or review comments

#### Scenario: Family backup is exported during review
- **WHEN** an authorized user exports the family while unpublished revisions exist
- **THEN** the normal backup SHALL contain only published business data and SHALL exclude revision payloads and review comments by default

### Requirement: Published content changes SHALL require a new revision
The system SHALL not mutate a PUBLISHED revision in place. Corrections and deletion proposals SHALL create a new attributable revision that preserves the previously published history. The product SHALL NOT expose a direct publication-withdrawal operation.

#### Scenario: Published biography needs correction
- **WHEN** an editor changes content after its revision was published
- **THEN** the system SHALL create a new DRAFT based on the current published state
- **AND** the earlier published revision SHALL remain immutable

#### Scenario: Publisher wants to remove or correct published content
- **WHEN** an OWNER or ADMIN needs to remove or correct a published item
- **THEN** the system SHALL require a new attributable revision and the normal review-and-publish workflow
- **AND** no direct withdrawal endpoint or settings control SHALL be available
