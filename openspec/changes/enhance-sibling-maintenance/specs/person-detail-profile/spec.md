## MODIFIED Requirements

### Requirement: Person detail SHALL provide relationship summary context

The system SHALL summarize a person's family context on the detail page using the existing relationship graph, while still allowing users to inspect the underlying parent, spouse, child, and derived sibling records.

#### Scenario: Detail page shows relationship summary

- **WHEN** a person has related parent, spouse, child, or derived sibling records
- **THEN** the person detail page SHALL display a relationship summary that helps the user quickly understand the person's family position before the grouped relationship lists

#### Scenario: Detail page shows derived sibling relationships

- **WHEN** a person shares at least one parent with one or more other people in the family graph
- **THEN** the person detail page SHALL display those people in a sibling section
- **AND** each sibling entry SHALL show a derived label such as `兄弟`、`兄妹`、`姐妹`

#### Scenario: Summary and grouped lists stay consistent

- **WHEN** relationship data for a person changes
- **THEN** the computed relationship summary and the grouped parent, spouse, child, and sibling sections SHALL reflect the same underlying records in the same response

#### Scenario: No relationships still yields a meaningful empty state

- **WHEN** a person has no related parent, spouse, child, or derived sibling records
- **THEN** the person detail page SHALL show a clear empty state instead of rendering an empty summary block
