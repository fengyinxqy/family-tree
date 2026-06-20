## ADDED Requirements

### Requirement: Content revisions SHALL reference supported provenance
The system SHALL allow person, event, relationship, material, media, and link revisions to reference active same-family materials or media objects as provenance. A revision without an external source MUST record an explicit manual-entry provenance declaration before submission.

#### Scenario: Editor cites a source material
- **WHEN** an editor creates a revision from a family document
- **THEN** the revision SHALL retain a same-family material reference and optional locator text
- **AND** submission SHALL reject deleted, missing, or cross-family sources

#### Scenario: Editor declares manual knowledge
- **WHEN** no source material exists for a contribution
- **THEN** the editor SHALL be able to declare the contribution as manual family knowledge with an optional rationale

### Requirement: Provenance reads SHALL respect file authorization and publication visibility
Provenance summaries MAY expose source title, category, contributor, locator, and active file summary to authorized members, but MUST continue to authorize file preview and download independently and MUST NOT expose storage internals.

#### Scenario: Authorized member opens publication provenance
- **WHEN** an authorized member views a published revision backed by a material
- **THEN** the system SHALL show the material summary and authorized navigation target
- **AND** file access SHALL still pass through the protected file endpoint

#### Scenario: Referenced material is later withdrawn or deleted
- **WHEN** a provenance source is no longer normally visible
- **THEN** normal product views SHALL hide its protected details
- **AND** owner audit history SHALL retain a non-secret source identifier and historical summary

