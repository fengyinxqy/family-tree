## ADDED Requirements

### Requirement: Relationship maintenance SHALL derive sibling context from parent-child links
The system SHALL treat sibling relationships as derived context built from existing parent-child links. When a user creates a new `child` relationship, the system MUST recognize all existing children that share at least one parent with the affected person and make those sibling relationships available to downstream views.

#### Scenario: Adding a younger son creates a brother relationship context
- **WHEN** a user links a second male child to a parent who already has one male child
- **THEN** the system SHALL recognize the two children as siblings
- **AND** the derived sibling label between them SHALL be `兄弟`

#### Scenario: Adding a daughter beside an existing son creates a mixed sibling relationship context
- **WHEN** a user links a female child to a parent who already has one male child
- **THEN** the system SHALL recognize the two children as siblings
- **AND** the derived sibling label between them SHALL be `兄妹`

#### Scenario: Sharing only one parent still creates sibling context
- **WHEN** two people share the same father or the same mother through existing `child` relationships
- **THEN** the system SHALL include them in each other's derived sibling context even if the other parent relationship is missing

### Requirement: Relationship maintenance SHALL keep sibling context out of the tree edge model
The system SHALL NOT persist sibling relationships as new graph edges when deriving sibling context from parent-child links.

#### Scenario: Derived siblings do not create extra relationship edges
- **WHEN** the system derives a sibling relationship after a parent-child update
- **THEN** it SHALL keep the persisted `Relationship` records limited to the original supported raw types
- **AND** family tree edge rendering SHALL remain based only on those raw relationship records
