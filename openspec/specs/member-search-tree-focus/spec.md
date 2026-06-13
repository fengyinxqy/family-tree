## Purpose

TBD — 提供家谱树工作台中的成员搜索与树图聚焦能力，让用户无需离开树视图即可定位成员、居中查看目标节点、并随时退出搜索模式。

## Requirements

### Requirement: System SHALL allow users to search family members from the tree workspace
The system SHALL provide an in-workspace search control that lets users locate a person from the currently loaded family tree data without leaving the tree view.

#### Scenario: Search shows matching family members
- **WHEN** a user enters member text into the tree search input
- **THEN** the system SHALL show matching family members from the current tree dataset
- **AND** it SHALL provide a clear empty state when no match is found

#### Scenario: Search supports keyboard-friendly result navigation
- **WHEN** search results are visible and the user uses arrow keys or Enter
- **THEN** the system SHALL move through the result list predictably
- **AND** it SHALL allow selecting the active result without requiring a mouse

### Requirement: System SHALL focus the tree viewport on the selected search result
Selecting a search result MUST move the user's attention to the target node in the rendered family tree.

#### Scenario: Selecting a result centers and highlights the target node
- **WHEN** a user selects a member from the tree search results
- **THEN** the system SHALL center the tree viewport on that member's rendered node
- **AND** it SHALL visually highlight the selected node

#### Scenario: Highlight survives tree re-layout while the same member remains selected
- **WHEN** the tree nodes are regenerated after layout or state refresh while a member is still selected from search
- **THEN** the system SHALL preserve the highlight on the same member

### Requirement: System SHALL let users reset search context and return to normal tree browsing
The search interaction MUST be reversible so users can leave search mode without stale focus state lingering in the tree workspace.

#### Scenario: Clearing search removes transient search state
- **WHEN** a user clears the search input or dismisses the current search context
- **THEN** the system SHALL clear the active result navigation state
- **AND** it SHALL close the result list
- **AND** it SHALL remove the current search-driven node highlight

#### Scenario: Search selection does not require tree data mutation
- **WHEN** a user searches for and focuses a member
- **THEN** the system SHALL complete the interaction using already loaded tree data
- **AND** it SHALL NOT require creating or mutating relationship records as part of search
