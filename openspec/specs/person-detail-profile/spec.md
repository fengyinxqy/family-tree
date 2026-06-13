# person-detail-profile

## Purpose

为人物详情页提供增强档案字段（别名、排行/代际标签、籍贯、维护备注）、人生事件记录与关系摘要展示能力，将人物页从基础名片升级为可持续沉淀家族档案的工作台。

---

## Requirements

### Requirement: Person detail SHALL expose an enriched profile

The system SHALL allow a person record to store and display enriched archive fields beyond the MVP profile, including aliases, generation label, native place, and maintenance notes, while preserving existing basic fields such as name, gender, birth date, death date, and bio.

#### Scenario: Detail page renders enriched archive fields

- **WHEN** a person has one or more enriched archive fields populated
- **THEN** the person detail page SHALL render those fields in clearly labeled sections without hiding the existing basic profile information

#### Scenario: Empty archive fields do not create noisy placeholders

- **WHEN** a person has no aliases, generation label, native place, or maintenance notes
- **THEN** the person detail page SHALL omit empty field rows and keep the layout readable

#### Scenario: Edit flow preserves enriched archive fields

- **WHEN** a user updates a person through the create or edit flow
- **THEN** the system SHALL validate, persist, and return the enriched archive fields together with the existing basic profile fields

### Requirement: Person detail SHALL support timeline events

The system SHALL support attaching ordered life events to a person profile and presenting them as a unified timeline together with the person's existing birth and death information.

#### Scenario: User records custom life events

- **WHEN** a user saves a person with one or more life events such as marriage, migration, or other milestones
- **THEN** the system SHALL persist those events with enough information to display event type, date label, and descriptive text on the person detail page

#### Scenario: Timeline includes system-derived birth and death milestones

- **WHEN** a person has `birthDate` and/or `deathDate` populated
- **THEN** the person detail page SHALL include those milestones in the timeline even if no custom event records exist

#### Scenario: Timeline remains readable with partial dates

- **WHEN** one or more events have incomplete or approximate dates
- **THEN** the system SHALL still render the events in a stable order and display the provided date label without rejecting the entire timeline

### Requirement: Person detail SHALL provide relationship summary context

The system SHALL summarize a person's family context on the detail page using the existing relationship graph, while still allowing users to inspect the underlying parent, spouse, and child records.

#### Scenario: Detail page shows relationship summary

- **WHEN** a person has related parent, spouse, or child records
- **THEN** the person detail page SHALL display a relationship summary that helps the user quickly understand the person's family position before the grouped relationship lists

#### Scenario: Summary and grouped lists stay consistent

- **WHEN** relationship data for a person changes
- **THEN** the computed relationship summary and the grouped parent, spouse, and child sections SHALL reflect the same underlying records in the same response

#### Scenario: No relationships still yields a meaningful empty state

- **WHEN** a person has no related parent, spouse, or child records
- **THEN** the person detail page SHALL show a clear empty state instead of rendering an empty summary block
