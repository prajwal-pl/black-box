<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Product Vision

This product is an AI Investigation Operating System.

It is NOT:

- A chatbot
- A PDF Q&A tool
- A generic RAG application
- A document summarizer
- A search interface with AI attached

The platform exists to help users investigate, connect evidence, build theories, discover relationships, identify contradictions, and uncover insights from large collections of unstructured information.

The product should feel like:

- Batman's detective computer
- Palantir for investigators
- A digital evidence war room
- An intelligence analysis platform
- A modern investigation operating system

The core experience is visual investigation.

Chat exists only as an auxiliary tool.

The graph, timeline, evidence board, contradiction engine, and hypothesis system are the primary product.

Every feature should reinforce:

- Reasoning
- Traceability
- Explainability
- Discovery
- Investigation workflow
- Evidence-backed conclusions

Never generate generic SaaS dashboards or chat-centric layouts.

Always prioritize investigation tooling.

---

# Core Principles

## Visual First

Users should understand a case visually before reading AI responses.

Preferred visualizations:

- Evidence Graphs
- Timelines
- Relationship Maps
- Event Flows
- Entity Networks
- Investigation Boards
- Contradiction Views
- Evidence Chains

The interface should constantly answer:

> What happened?

> Who is connected?

> Why does this matter?

> What evidence supports this?

---

## Explainability Above Everything

Every AI-generated insight must be explainable.

Every claim must contain:

- Supporting evidence
- Source references
- Confidence score
- Reasoning path

Bad:

"Michael is likely involved."

Good:

"Michael is connected to Company X through 4 transactions, 2 emails, and 1 contract signature."

Always surface reasoning.

Never provide black-box conclusions.

---

## Investigation Over Search

The user should feel like they are solving a case.

Not searching documents.

Bad workflow:

Upload → Ask Question → Get Answer

Good workflow:

Upload → Extract Entities → Build Graph → Detect Events → Build Timeline → Discover Contradictions → Generate Hypotheses → Validate Evidence

---

## Case-Centric Architecture

Everything belongs to a case.

Examples:

- Corporate Fraud Investigation
- Insurance Claim Investigation
- Financial Crime Investigation
- Cybersecurity Incident
- Research Investigation
- Internal HR Investigation
- Due Diligence Analysis
- OSINT Investigation

Users work inside investigations.

Not folders.

Not projects.

Not workspaces.

Cases.

---

# Design Language

## Theme

Dark cinematic intelligence interface.

Inspired by:

- Intelligence command centers
- Security operation centers
- Bloomberg terminals
- Sci-fi investigation systems
- Tactical analysis software

Avoid:

- Generic SaaS appearance
- Startup landing page aesthetics
- White dashboards
- Minimal productivity tools

Desired feeling:

"High-tech investigation console"

---

## Color Palette

Primary:

- Near black backgrounds
- Graphite surfaces
- Deep navy accents

Highlights:

- Electric blue
- Amber
- Crimson
- Emerald

Purpose:

Blue:
Information

Amber:
Warnings

Red:
Contradictions

Green:
Verified evidence

---

## Visual Density

Dense but readable.

Users should feel surrounded by information.

Prefer:

- Panels
- Overlays
- Data cards
- Interactive canvases

Avoid:

- Excessive whitespace
- Empty layouts
- Oversized cards

---

# Primary Application Structure

## Dashboard

Purpose:

Case overview.

Display:

- Open Cases
- Active Investigations
- Recent Discoveries
- New Contradictions
- New Relationships
- AI Findings
- Investigation Health
- Evidence Growth
- Team Activity

Dashboard should feel alive.

Changes should appear continuously.

---

## Case Workspace

This is the primary screen.

Layout:

### Left Panel

Case navigation.

Contains:

- Case tree
- Evidence sources
- Saved views
- Bookmarks
- Investigation folders
- Team members

Width:
240-320px

Collapsible.

---

### Center Canvas

Main investigation area.

Default mode:

Evidence Graph

Alternative modes:

- Timeline
- Evidence Board
- Entity Network
- Relationship Explorer
- Hypothesis View

Must support:

- Zoom
- Pan
- Multi-select
- Node expansion
- Dragging
- Context menus
- Deep linking

This is the most important area of the application.

---

### Right Panel

Detective Assistant.

Capabilities:

- Ask questions
- Investigate entities
- Explain relationships
- Validate hypotheses
- Find contradictions
- Summarize evidence
- Suggest next actions

Assistant never dominates layout.

It supports investigation.

It is not the product.

Width:

320-420px

---

# Core Investigation Components

## Evidence Graph

Most important visualization.

Use:

- React Flow
- D3
- Custom graph layouts

Node types:

- Person
- Organization
- Company
- Location
- Event
- Email
- Phone
- Transaction
- Vehicle
- Device
- Document
- Website
- Account

Relationships:

- Owns
- Sent
- Received
- Met
- Called
- Paid
- Connected To
- Mentioned In
- Created
- Approved
- Accessed

Nodes should:

- Expand dynamically
- Show confidence
- Show source count
- Display relationship strength

Graph should animate as new evidence arrives.

---

## Timeline View

Chronological reconstruction.

Displays:

- Events
- Communications
- Transactions
- Meetings
- Travel
- Document creation
- Evidence discovery

Capabilities:

- Zoom by hour/day/week/month/year
- Event clustering
- Gap detection
- Conflict highlighting

AI should automatically identify:

- Missing periods
- Suspicious sequences
- Important event chains

---

## Evidence Board

Visual detective board.

Supports:

- Pinning evidence
- Grouping evidence
- Manual annotations
- Drawing connections
- Investigation notes
- Theory building

Should feel like:

Digital detective wall.

---

## Entity Profile

Every entity receives a dedicated intelligence page.

Displays:

### Summary

- Name
- Type
- Confidence
- Aliases

### Relationships

Interactive network.

### Timeline

Events involving entity.

### Documents

Evidence mentioning entity.

### Communications

Messages, emails, interactions.

### AI Insights

Automatically generated observations.

---

## Contradiction Center

Dedicated contradiction discovery interface.

Displays:

- Conflicting statements
- Inconsistent evidence
- Timeline conflicts
- Identity conflicts
- Location conflicts

Layout:

Source A

VS

Source B

AI explanation beneath.

Severity score visible.

---

## Hypothesis Lab

Purpose:

Theory generation and validation.

Contains:

### Hypotheses

Examples:

- Fraud Scheme
- Insider Trading
- Data Leak
- Money Laundering

Each hypothesis includes:

- Confidence
- Supporting Evidence
- Contradicting Evidence
- Missing Evidence
- AI Reasoning

Users can:

- Create hypotheses
- Merge hypotheses
- Compare hypotheses
- Validate hypotheses

---

# AI System Design

The AI should operate as a collection of specialized agents.

Never design around a single assistant.

---

## Entity Extraction Agent

Responsible for:

- NER
- Entity normalization
- Alias detection
- Entity merging

---

## Relationship Agent

Responsible for:

- Relationship discovery
- Connection scoring
- Link validation

---

## Timeline Agent

Responsible for:

- Event extraction
- Temporal reasoning
- Sequence reconstruction

---

## Contradiction Agent

Responsible for:

- Conflict detection
- Claim validation
- Evidence comparison

---

## Hypothesis Agent

Responsible for:

- Theory generation
- Alternative explanations
- Confidence estimation

---

## Research Agent

Responsible for:

- External information gathering
- Public records
- OSINT enrichment
- Context generation

---

## Summarization Agent

Responsible for:

- Reports
- Case summaries
- Executive briefings

---

# Evidence Standards

Every piece of evidence must contain:

- Source
- Timestamp
- Confidence
- Extracted entities
- Related events
- Related relationships

Evidence should always remain traceable.

Never lose provenance.

Never detach insights from sources.

---

# Interaction Guidelines

Whenever building interfaces:

Prefer:

- Investigation workflows
- Relationship exploration
- Discovery experiences
- Evidence navigation
- Contextual reasoning

Avoid:

- Generic CRUD screens
- Generic admin tables
- Upload forms as primary UI
- Chat-first experiences
- Empty dashboard templates

---

# Technical Stack

Framework:

- Next.js 16
- TypeScript

UI:

- Tailwind CSS
- shadcn/ui
- Framer Motion

Visualization:

- React Flow
- D3.js
- Visx

Backend:

- Node.js
- Express

Storage:

- PostgreSQL
- Prisma

Graph Layer:

- Neo4j

Vector Search:

- Qdrant

Caching:

- Redis

Realtime:

- WebSockets
- Server Sent Events

AI:

- LangGraph
- OpenAI
- Gemini
- Claude

File Processing:

- OCR
- Document Parsing
- Entity Extraction Pipelines

---

# Generation Rules

When generating code, pages, components, layouts, features, or UX:

1. Visual investigation is always more important than chat.
2. Evidence graphs should be treated as first-class citizens.
3. Every insight must be explainable.
4. Prefer graph reasoning over simple retrieval.
5. Favor immersive investigation experiences.
6. Design for analysts, investigators, journalists, researchers, intelligence teams, auditors, and security professionals.
7. The application should feel like an intelligence platform rather than a productivity tool.
8. Every screen should help answer:
   - What happened?
   - Who is connected?
   - What evidence exists?
   - What contradictions exist?
   - What theories are most likely?
9. Always surface relationships and evidence visually when possible.
10. Never reduce the product to a chat interface.