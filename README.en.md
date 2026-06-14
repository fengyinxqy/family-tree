# Family Genealogy Copilot

[中文说明](./README.md) | [MIT License](./LICENSE)

An AI-powered genealogy workspace built for Chinese family history digitization.

This project combines family tree visualization, profile management, archival maintenance, AI-assisted data intake, and kinship reasoning into one product-style workspace. It is suitable both as an open-source GitHub project and as a polished AI product portfolio piece.

## What It Is

**Family Genealogy Copilot** is not just a CRUD admin panel. It is a vertical AI application designed around real genealogy workflows:

- visualize family structures with tree, lineage table, branch view, and timeline
- turn natural language, images, and documents into structured genealogy drafts
- answer kinship questions with deterministic relationship reasoning
- maintain person profiles, life events, native place, notes, and family links in one place

The current version is best described as an **AI product MVP / prototype**, but it already has the shape and narrative of a strong open-source showcase project.

## Preview

![Family Genealogy Copilot target UI](./target.png)

## Why This Project Is Worth Showcasing

- **Product completeness**: not just an AI demo, but a workflow-driven product prototype
- **Practical AI integration**: LLMs handle understanding and extraction, while rule-based logic handles final kinship reasoning
- **Clear vertical focus**: Chinese genealogy, kinship naming, and family archive maintenance
- **Full-stack scope**: UI, data model, auth, import/export, and AI orchestration all live in one repository

## Core Features

### 1. Genealogy Workspace

- family tree visualization
- lineage table by generation
- branch-focused view
- event timeline
- generation filtering, node focus, and side-panel assistant linkage

### 2. Person Profile Management

- manage name, gender, birth/death, and biography
- record aliases, native place, notes, and generation labels
- manage life events such as birth, marriage, and migration
- maintain parent, spouse, and child relationships

### 3. AI-Assisted Intake

- convert natural language narration into structured person and relationship drafts
- support clarification rounds for ambiguous input
- require human confirmation before persistence
- ready for OCR, scan parsing, and document ingestion workflows

### 4. AI Kinship Q&A

- ask questions like "What is the relationship between A and B?"
- auto-match people in the tree
- return relationship path and human-readable explanation
- use deterministic TypeScript logic for final kinship inference

### 5. Import and Export

- export current genealogy data as backup
- restore family data from backup
- leave room for future GEDCOM support

## AI Design

This project does not push everything into the model. Instead, it uses a product-oriented layered approach:

- **LLM layer**: language understanding, entity extraction, clarification prompts
- **Business logic layer**: kinship path calculation, relation resolution, structural consistency
- **Human-in-the-loop layer**: review and confirm before writing data

This makes the system more reliable, more explainable, and more suitable for real product scenarios.

## Tech Stack

### Frontend

- Next.js 16
- React 19
- Tailwind CSS 4
- shadcn/ui
- @xyflow/react

### Backend and Data

- Next.js App Router API Routes
- Prisma 7
- PostgreSQL
- NextAuth.js v5

### AI and Engineering

- schema-driven structured I/O with Zod
- switchable AI provider support
  - DeepSeek
  - OpenAI
- deterministic kinship engine written in TypeScript

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Example:

```env
DATABASE_URL="postgresql://family:family123@localhost:5432/familydb"
AUTH_SECRET="generate-a-random-secret-here"

AI_PROVIDER="deepseek"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_API_KEY="your-deepseek-api-key"
DEEPSEEK_MODEL="deepseek-v4-flash"

OPENAI_API_KEY="your-openai-api-key"
OPENAI_AGENT_MODEL="gpt-5.5"
```

### 3. Start PostgreSQL

If you use Docker:

```bash
docker compose up -d postgres
```

### 4. Run database migrations

```bash
npx prisma migrate dev
```

### 5. Start the development server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Useful Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test
```

## Project Structure

```text
src/
  app/           Next.js routes and API handlers
  components/    UI, tree components, and AI panel
  lib/           rules engine, AI schemas, shared utilities
  services/      business service layer
  types/         TypeScript types
prisma/
  schema.prisma  data schema
  migrations/    database migrations
docs/
  agent-mvp.md   AI feature notes
public/          static assets
target.png       target product preview
```

## Current Status

The repository already includes:

- registration and login
- genealogy tree visualization
- person and relationship management
- AI intake draft endpoints
- AI kinship Q&A endpoints
- import/export support

Best current positioning:

- **AI product prototype**
- **vertical intelligent application**
- **iterative MVP open-source project**

## Great Fit for GitHub?

Yes. In fact, it is stronger than a typical AI demo because it shows product thinking, system design, and workflow depth.

Suggested one-line positioning:

> A Chinese-first AI-powered family genealogy workspace for family tree editing, archival maintenance, and kinship reasoning.

## Roadmap Ideas

- OCR and image-based genealogy extraction
- GEDCOM import/export
- multi-family collaboration
- genealogy version history
- richer albums, documents, and ancestral hall modules
- hosted demo and product walkthrough video

## License

This project is licensed under the [MIT License](./LICENSE).
