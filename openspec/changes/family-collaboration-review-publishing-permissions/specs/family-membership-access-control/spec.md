## ADDED Requirements

### Requirement: Every family SHALL have one authoritative owner membership
The system SHALL keep exactly one active OWNER membership for each family tree, and that membership's user MUST match `FamilyTree.ownerId`.

#### Scenario: Existing family is migrated
- **WHEN** a family tree created before membership support is migrated
- **THEN** the system SHALL create an active OWNER membership for its current owner
- **AND** existing family data SHALL remain accessible to that owner

#### Scenario: Last owner removal is attempted
- **WHEN** any request attempts to suspend, remove, or demote the only OWNER membership
- **THEN** the system SHALL reject the request without changing membership or ownership data

### Requirement: Family invitations SHALL be scoped, expiring, and single-use
The system SHALL allow an OWNER or ADMIN to invite a normalized email address into one family with an allowed non-owner role, using an expiring token whose plaintext is not persisted.

#### Scenario: Eligible user accepts an invitation
- **WHEN** a logged-in user whose normalized email matches a current unused invitation accepts it before expiry
- **THEN** the system SHALL atomically create an active membership with the invited role, consume the invitation, and write an audit operation

#### Scenario: Invalid invitation is presented
- **WHEN** an invitation is expired, revoked, consumed, addressed to another email, or belongs to a family where the user is already a member
- **THEN** the system SHALL reject acceptance without revealing additional family data

#### Scenario: Administrator attempts to invite an owner
- **WHEN** an ADMIN creates an invitation with the OWNER role
- **THEN** the system SHALL reject the invitation because ownership can change only through ownership transfer

### Requirement: Preset roles SHALL map to a stable permission matrix
The system SHALL enforce the OWNER, ADMIN, EDITOR, REVIEWER, and VIEWER roles through a centralized server-side action matrix. OWNER SHALL have all family actions; ADMIN SHALL manage non-owner members, edit, review, and publish; EDITOR SHALL create and submit revisions; REVIEWER SHALL read the collaboration workspace and review eligible revisions; VIEWER SHALL read published family content only.

#### Scenario: Editor attempts member management
- **WHEN** an EDITOR attempts to invite, remove, suspend, or change the role of another member
- **THEN** the system SHALL reject the request without mutating membership data

#### Scenario: Viewer attempts a mutation
- **WHEN** a VIEWER attempts to create a revision or change family content
- **THEN** the system SHALL reject the request without creating business, revision, or audit records

#### Scenario: Administrator manages a non-owner member
- **WHEN** an ADMIN changes an EDITOR to REVIEWER within the same family
- **THEN** the system SHALL apply the role change atomically and write an immutable audit record

### Requirement: Authorization SHALL be enforced at every server entry point
Every family-scoped page, route handler, service mutation, file request, import, export, AI action, review action, and recovery action SHALL authorize the authenticated user for the requested family action before reading protected data or writing state. Client-side controls MUST NOT be treated as authorization.

#### Scenario: Cross-family identifier is submitted
- **WHEN** a member of one family submits an entity, revision, file, or membership identifier belonging to another family
- **THEN** the system SHALL reject the request without revealing whether the out-of-scope record exists

#### Scenario: Hidden button endpoint is called directly
- **WHEN** a user without publish permission calls the publish endpoint directly
- **THEN** the system SHALL reject the request even if the client UI was bypassed

### Requirement: Suspended and removed members SHALL lose access immediately
The system SHALL deny all family access to suspended or removed members on their next server request, and SHALL invalidate outstanding invitations or confirmations whose continued use would grant access through that membership.

#### Scenario: Active editor is suspended
- **WHEN** an OWNER or ADMIN suspends an active EDITOR
- **THEN** subsequent family reads and mutations by that user SHALL be denied
- **AND** the user's existing draft history SHALL remain attributable and available to authorized collaborators

#### Scenario: Member is reactivated
- **WHEN** an authorized manager reactivates a suspended non-owner member
- **THEN** the member SHALL regain only the permissions of the membership's current role

### Requirement: Ownership transfer SHALL be explicit and atomic
Only the current OWNER SHALL transfer ownership to another active family member, and the system MUST atomically update `FamilyTree.ownerId`, promote the recipient to OWNER, demote the previous owner to ADMIN, and write an audit operation.

#### Scenario: Owner transfers to an active member
- **WHEN** the current OWNER confirms transfer to an active ADMIN, EDITOR, REVIEWER, or VIEWER in the same family
- **THEN** the recipient SHALL become the sole OWNER and the previous owner SHALL become ADMIN in one transaction

#### Scenario: Non-owner attempts ownership transfer
- **WHEN** any non-owner attempts ownership transfer
- **THEN** the system SHALL reject the request without changing either role or `ownerId`

### Requirement: High-risk recovery actions SHALL remain owner-only
Manual snapshot creation, deletion-batch restoration, snapshot restoration, and ownership transfer SHALL require the active OWNER role even when another role can edit or publish family content.

#### Scenario: Administrator attempts snapshot restoration
- **WHEN** an ADMIN requests or confirms snapshot restoration
- **THEN** the system SHALL reject the operation without creating a confirmation, snapshot, business mutation, or audit success record

