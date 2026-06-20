## Purpose

Define how family trees manage literature and media entries, private file attachments, authorized access, and links to people and events.

## Requirements

### Requirement: Users SHALL manage literature and media entries within a family tree
The system SHALL allow an authorized user to create, view, update, list, and soft-delete a literature or media entry belonging to the active family tree. Each entry MUST have a title and category and MAY record source, era label, contributor, and description.

#### Scenario: User creates a material entry
- **WHEN** an authorized user submits a valid title, supported category, and optional descriptive metadata
- **THEN** the system SHALL create the entry in the active family tree
- **AND** it SHALL return the normalized persisted metadata and stable entry identifier

#### Scenario: User lists family materials
- **WHEN** an authorized user opens the literature and media workspace
- **THEN** the system SHALL return only active entries from the active family tree
- **AND** it SHALL support stable pagination and filtering by category or search text

#### Scenario: Invalid metadata is rejected
- **WHEN** a user submits a blank title, unsupported category, or metadata beyond configured limits
- **THEN** the system SHALL reject the request with field-level validation details
- **AND** it SHALL NOT create or modify an entry

#### Scenario: Cross-tree material access is attempted
- **WHEN** a user requests or mutates a material outside an accessible family tree
- **THEN** the system SHALL reject the request without revealing the material metadata

### Requirement: Material entries SHALL contain validated private files
The system SHALL allow an authorized user to attach one or more supported files to a material entry while storing file bytes outside publicly addressable application paths. The system MUST preserve the original display name, verified media type, byte size, content hash, and stable file identifier.

#### Scenario: User uploads a supported file
- **WHEN** an authorized user uploads a valid PDF, JPEG, PNG, WebP, or TIFF file within configured limits
- **THEN** the system SHALL verify the file type, compute its content hash, persist its metadata, and attach it to the selected material
- **AND** failure in either object storage or metadata persistence SHALL NOT leave an active partial attachment

#### Scenario: Unsupported or unsafe file is rejected
- **WHEN** a file is empty, exceeds a configured limit, has an unsupported signature, or its declared type conflicts with verified content
- **THEN** the system SHALL reject the upload before the file becomes accessible
- **AND** it SHALL return a safe validation error without exposing storage internals

#### Scenario: Multi-file material preserves order
- **WHEN** a material contains multiple files such as ordered scan pages
- **THEN** the system SHALL preserve a stable user-controlled display order for those files

### Requirement: File access SHALL be authorized and non-public
The system MUST authorize every file preview or download against the file's owning family tree and MUST NOT expose permanent public storage URLs, physical paths, storage credentials, or raw storage keys to clients.

#### Scenario: Authorized user previews a file
- **WHEN** a user with access to the owning family requests an active file
- **THEN** the system SHALL stream the file with its verified media type, a safe filename, private cache policy, and content-sniffing protection

#### Scenario: Unauthorized download is attempted
- **WHEN** a user without access to the owning family requests a file identifier
- **THEN** the system SHALL reject the request without revealing whether the file exists or where it is stored

#### Scenario: Deleted material file is requested
- **WHEN** a normal product request targets a file whose material entry is soft-deleted
- **THEN** the system SHALL treat the file as unavailable even if its bytes remain in recovery storage

### Requirement: Materials SHALL link to family records with referential integrity
The system SHALL allow a material entry to remain family-wide or link to one or more active people or person events in the same family tree. Each link MUST identify exactly one supported target and MUST NOT cross family-tree boundaries.

#### Scenario: User links a material to people and events
- **WHEN** an authorized user selects active people or person events from the material's family tree
- **THEN** the system SHALL create deduplicated links to those targets
- **AND** the material SHALL remain a single entry even when it has multiple targets

#### Scenario: Material remains family-wide
- **WHEN** an entry has no person or event links
- **THEN** the system SHALL retain it as a valid family-level material rather than treating it as orphaned

#### Scenario: Invalid target link is rejected
- **WHEN** a target is missing, deleted, belongs to another family tree, or a link identifies multiple target types
- **THEN** the system SHALL reject the link without changing existing valid links

### Requirement: Person details SHALL expose related materials
The system SHALL include active materials directly linked to a person in that person's detail experience without mixing them into the person's life-event records.

#### Scenario: Person has related materials
- **WHEN** an authorized user views a person with one or more active material links
- **THEN** the person detail SHALL show each related material's title, category, era label, contributor, and file summary when available
- **AND** each result SHALL navigate to the authorized material detail

#### Scenario: Person has no related materials
- **WHEN** a person has no active material links
- **THEN** the person detail SHALL show a concise empty state or omit the section without rendering broken placeholders

#### Scenario: Deleted material is hidden from person details
- **WHEN** a linked material is soft-deleted
- **THEN** it SHALL disappear from normal person detail reads while remaining available to authorized recovery operations
