# Kairo Design Specification

**Status:** Approved and locked  
**Date:** 2026-08-20  
**Approved:** 2026-08-20  
**Product:** Kairo (pronounced “KYE-roh”)  
**Design basis:** Approved Design Sections 1–15 and all locked amendments from the “Design Local Knowledge Foundation” conversation  

## 1. Purpose and product vision

Kairo is a personal Clinical Systems Copilot and evidence-backed institutional-memory system. Its product goal is:

> A Tier-4 MANA Clinical Systems Engineer in the user’s pocket.

Kairo must understand MANA’s clinical ecosystem as one interconnected machine rather than as isolated applications or product manuals. It combines clinical-IT fundamentals, deep vendor/product knowledge, and MANA-specific evidence about applications, versions, environments, servers, databases where known, interfaces, HL7, DICOM, DMWL, modality and reporting workflows, incidents, workarounds, projects, decisions, planned architecture, and unresolved questions.

Kairo begins as a single-user personal tool. Its architecture may evolve into a shared MANA analyst platform and later an enterprise or cloud product, but V1 must not absorb multi-user or enterprise complexity merely to preserve that option.

Kairo is completely separate from CSOL: separate product, repository, relay, storage, and architecture. V1 has no CSOL dependency.

### 1.1 Governing principles

1. Kairo owns the knowledge; AI models reason over that knowledge.
2. Important knowledge is evidence-backed, scoped, and temporal.
3. Kairo captures broadly, believes carefully, and promotes deliberately.
4. Product capability never silently becomes MANA implementation truth.
5. Project or planned architecture never silently overwrites production truth.
6. Temporary troubleshooting identifiers never silently become durable memory.
7. Kairo remains advisory-only and cannot directly operate clinical production systems.
8. Every important answer must be able to explain, “Why do you know that?”
9. Original artifacts remain immutable historical evidence.
10. V1 proves the complete knowledge lifecycle, not every future feature.

## 2. Product evolution, expertise, and scope

### 2.1 Product evolution

- **Phase 1:** Personal Kairo, single-user and local-first.
- **Phase 2:** Shared MANA analyst knowledge platform.
- **Phase 3:** Optional enterprise/cloud form.

Only interfaces and separations needed for later evolution belong in V1. Enterprise collaboration itself does not.

### 2.2 Expertise hierarchy

Kairo combines three layers:

1. **Clinical-IT fundamentals:** HL7, DICOM, DMWL, RIS/PACS, identity and order lifecycles, routing, reconciliation, reporting, interoperability, modality workflows, radiology workflows, and troubleshooting methodology.
2. **Product/vendor expertise:** Merge/AMICAS PACS, Merge RIS, AbbaDox CareFlow, MagView, Hologic, eClinicalWorks, PowerScribe, Rad AI, Altamont, DynaCAD, and future products.
3. **MANA-specific knowledge:** exact versions, environments, servers, queues, interfaces, routing, configuration, incidents, local exceptions, projects, decisions, observations, and validated workflows.

When evidence conflicts, the default reasoning priority is:

1. Direct MANA production validation
2. MANA screenshots and configuration evidence
3. MANA internal documentation
4. MANA observed behavior and history
5. Authenticated or official vendor documentation
6. Interoperability standards
7. Reputable external technical research
8. General clinical-IT knowledge
9. AI inference

Authority is contextual: a vendor manual can be highly authoritative about product capability while proving nothing about whether MANA enabled that capability.

### 2.3 Initial knowledge domains

The initial domain includes Merge/AMICAS PACS, Merge RIS, AbbaDox CareFlow, MagView, eClinicalWorks, Hologic, PowerScribe, Rad AI, Altamont, DynaCAD, modalities, radiology workflows, and external partners such as Baxter. The model must accept systems and relationships discovered later without redesign.

## 3. Kairo Core and multi-client architecture

### 3.1 Logical ownership

Kairo is one product with multiple clients. **Kairo Core owns the durable Brain.** Android is the first and primary mobile client, not the definition or sole owner of the domain model. A browser-based desktop client is also required in V1.

```text
                       KAIRO CORE
        ┌──────────────────┼──────────────────┐
        │                  │                  │
  Evidence graph      Source vault       Retrieval
        └──────────────────┼──────────────────┘
                           │
                 Versioned Core interfaces
                           │
                 ┌─────────┴─────────┐
                 │                   │
           Android client      Browser desktop
```

Clients invoke capabilities such as `AskKairo`, `CaptureSource`, `SearchKnowledge`, `GetSystem`, `TraceWorkflow`, `GetProject`, `ReviewMemoryCandidate`, and `OpenEvidence`. UI code must not directly manipulate database tables.

### 3.2 V1 deployment rule

V1 has one authoritative Kairo Core at a time. Clients do not maintain independently editable knowledge graphs, and full bidirectional synchronization or conflict-free replicated data is deferred.

The Core may initially be physically hosted within the Android application if that is the safest practical first deployment, provided Android uses the same client-to-Core interfaces. The exact physical hosting location of the shared Core is intentionally an implementation/deployment decision, not an unresolved domain decision.

Android must retain meaningful offline capability even if the authoritative Core later moves. Selective replication or synchronization may be added later, but unrestricted independent stores are not part of V1.

### 3.3 Clients

**Android** is optimized for quick questions, field troubleshooting, meetings, camera capture, system and workflow lookup, and offline knowledge access.

**Browser desktop** is optimized for drag-and-drop batch capture, large documents, PDF and spreadsheet review, evidence inspection, project work, and Deep Analyze. It must work on a restricted Windows workstation without administrator installation, Docker, a native database install, or a desktop executable.

Desktop is not required to mirror every Android screen. Both clients use the same domain and API contracts for entities, facts, evidence, sources, workflows, projects, incidents, memory candidates, answers, and trace results.

## 4. Local knowledge foundation

### 4.1 Authoritative and derived storage

The recommended logical storage design has three parts:

1. **Authoritative structured Core:** a relational evidence graph containing what Kairo believes and why.
2. **Source Vault:** immutable original artifacts plus explicit derivatives.
3. **Rebuildable indexes:** lexical and semantic acceleration structures.

The approved initial Android persistence direction is Room/SQLite for authoritative structured data, AppSearch LocalStorage for private full-text indexing, and a versioned local embedding abstraction for semantic retrieval. These are technical directions, not permission for client UI to bind directly to them.

If a search index is lost, it must be rebuildable from the authoritative Core and Source Vault. Search indexes are never the sole copy of knowledge or evidence.

### 4.2 Hybrid evidence graph

Kairo is not a simple RAG application and does not require a specialized graph database in V1. The evidence graph may be relationally represented using concepts including:

- Entity, EntityType, EntityAlias
- Identifier and IdentifierType
- PredicateDefinition
- Fact, FactVersion, FactEvidence, ConflictGroup
- Source, SourceVariant, SourceSegment, SourceAnchor, CaptureSession/IngestionBatch
- Workflow and WorkflowStep
- Project, Incident, TroubleshootingStep, Decision, OpenQuestion, Risk, ActionItem
- MemoryCandidate and MemoryDecision
- IngestionJob, EmbeddingRecord, IndexState, ChangeLog

Core entity types include System, Application, Server, Database, Interface, Endpoint, Modality, Department, Vendor, Protocol, MessageType, Workflow, Project, Incident, Configuration, PersonRole, IdentifierType, Document/Source, Fact, Hypothesis, Decision, and TroubleshootingStep.

Facts serve as evidence-backed graph edges. System profiles and other convenient screens are projections of facts; they are not independent truth records.

### 4.3 Controlled predicates

Relationships should use controlled predicates wherever practical, such as `HOSTS`, `RUNS_ON`, `SENDS_TO`, `RECEIVES_FROM`, `SENDS_ORDER_TO`, `SENDS_RESULT_TO`, `USES_PROTOCOL`, `PARTICIPATES_IN`, `DEPENDS_ON`, `MONITORED_BY`, `STORES_IN`, `ROUTES_TO`, `REPLACED_BY`, `INTEGRATES_WITH`, and `USES_IDENTIFIER`.

Predicate definitions may constrain subject/object types, direction, inverses, and permitted cardinality. This registry powers consistent retrieval and Trace.

### 4.4 Fact model and scope

Important mutable technical claims are first-class facts, not fields silently overwritten on entities. A fact contains at least:

- subject, predicate, and entity or literal object
- knowledge scope
- evidence state
- qualitative confidence
- effective-from and effective-to when known
- recorded-at and last-validated-at
- source evidence and precise anchors
- lineage to facts it supersedes, supports, contradicts, strengthens, or deprecates

Scopes include at minimum:

- `MANA_PRODUCTION`
- `PRODUCT`
- `PROJECT` with a project identifier
- `INCIDENT` or temporary session context
- `EXTERNAL_RESEARCH`

Retrieval and persistence must enforce scope boundaries rather than relying only on prompts.

### 4.5 Evidence states

The approved evidence states are:

- **CONFIRMED:** directly validated against production configuration, messages, logs, documentation, or repeated observation.
- **OBSERVED:** behavior was seen, but underlying configuration is not fully validated.
- **PLANNED:** approved or intended future architecture.
- **PROPOSED:** an option under consideration.
- **HYPOTHESIS:** a reasoned explanation awaiting evidence.
- **VERIFY:** encountered but unsafe to rely on.
- **DEPRECATED:** previously valid but no longer current.
- **CONTRADICTED:** later evidence indicates the prior claim was wrong.

Lifecycle status and evidence state are separate. For example, an approved active fact may still have the evidence state `OBSERVED`.

### 4.6 Temporal model

Kairo uses lightweight bitemporal knowledge:

- **Reality time:** when a claim was true (`effectiveFrom`, `effectiveTo`).
- **Knowledge time:** when Kairo learned or revalidated it (`recordedAt`, `lastValidatedAt`).

Important facts are append-versioned. Kairo calculates a **Current Best Understanding** projection without erasing prior beliefs, contradictory evidence, or historical states. It must be able to distinguish “what was true then?” from “what did Kairo believe then?”

### 4.7 Knowledge temperature and indexing

Hot knowledge includes entities, current facts, system summaries, workflows, active projects, recent incidents, and memory candidates. Warm knowledge includes chunks, embeddings, meeting content, and historical incidents. Cold knowledge includes original full-resolution sources. Cold means less actively indexed, not inaccessible.

Lexical, semantic, and structured retrieval are all required. Embeddings must record model identifier, model version, dimensions, quantization, content hash, and creation time so incompatible models are never mixed. Documents must use structure-aware, domain-aware chunks rather than arbitrary character splits. HL7, configuration blocks, tables, meetings, and conversations retain their native logical boundaries.

## 5. Universal Knowledge Artifact Ingestion

Universal Knowledge Artifact Ingestion is a flagship, locked product capability. Kairo is an artifact-intelligence system, not a note-taking application or file repository.

### 5.1 Required V1 inputs

V1 must ingest:

- PDF, including native, scanned, and mixed PDFs
- DOCX
- XLSX
- CSV
- TXT and Markdown
- PNG and JPG/JPEG, including screenshots
- pasted text

PPTX is included if practical in the first ingestion implementation. HEIC and modern presentation support remain desired. Legacy binary `.doc`, `.xls`, and `.ppt` may be deferred if they materially complicate V1. This V1 scope refinement supersedes the earlier broad format aspiration without changing the universal-ingestion principle.

### 5.2 Capture Sessions

Multiple artifacts uploaded together form one **Capture Session** or ingestion batch and are analyzed as one contextual event. A meeting package may contain notes, PDFs, workflow diagrams, screenshots, and spreadsheets. Cross-artifact context may produce decisions, observations, risks, open questions, action items, entities, and relationship candidates.

One Capture Session must never collapse its members into an unattributed summary. Each claim keeps evidence links to the exact contributing sources.

### 5.3 Ingestion pipeline

The logical pipeline is:

```text
Capture artifacts
→ validate and normalize
→ hash and detect exact duplicates
→ extract metadata, text, layout, tables, and images
→ OCR where required
→ local PHI and credential scan
→ user PHI decision where required
→ classify source and preserve structure
→ detect entities, relationships, decisions, risks, and claims
→ link candidates to evidence anchors
→ create lexical/semantic derivatives
→ Memory Inbox review
→ approved Kairo knowledge
```

Ingestion must be staged, idempotent, resumable, and able to survive app closure, device locking, network loss, and retries. A failed later stage must not reprocess a large document from the beginning.

### 5.4 Source Vault and immutability

Originals are stored as immutable, content-addressed objects identified by a cryptographic hash such as SHA-256. Exact duplicates may share physical storage while retaining their distinct import/context records. Near duplicates may be flagged but never silently removed.

Redaction, OCR text, thumbnails, rendered pages, and other transformations are explicit derivatives linked to the original. Extracted knowledge never replaces the source.

### 5.5 Structural understanding and anchors

Kairo preserves headings, sections, paragraphs, tables, rows, columns, diagrams, image regions, OCR blocks, and configuration groupings. Source anchors must support precise navigation, including page and bounding box for PDFs, region and OCR block for images, section/span for documents, cell/range or table coordinates for spreadsheets, and conversation turn/span for chats.

Perfect visual highlighting for every format may evolve, but evidence traceability to the original location is a V1 requirement.

### 5.6 Screenshot intelligence

V1 screenshot processing includes local OCR, visible-text extraction, source-region linkage where practical, application/system-name detection, likely PHI and credential detection, and candidates for hostnames, servers, interfaces, AE Titles, statuses, and errors.

When allowed, a redacted image plus OCR and context may be sent through the stateless reasoning relay for deeper vision analysis. Vision results remain observations or candidates until reviewed; they cannot directly rewrite production truth.

## 6. Sources and evidence intelligence

Every imported artifact is a Source object. Sources are historical evidence, not attachments. Source classes include MANA internal knowledge, production evidence, vendor documentation, external research, and conversation history.

Sources retain origin, type, hash, import time, classification, version lineage, extraction status, and anchors. Updated documents are retained as new versions; Kairo may identify additions, removals, changed values, or workflow changes while preserving both versions.

Source authority depends on the claim being evaluated. Product documentation supports product knowledge. Production configuration and direct observation are stronger for MANA implementation.

The source viewer should expose the original, extracted text/OCR, derived knowledge, and related workflows. Complex analysis may assemble an **Evidence Bundle** containing systems, sources, facts, incidents, and their evidence states. Historical sources remain valuable after becoming outdated because they explain earlier decisions and architecture.

Future export may combine a knowledge package and evidence package. V1 requires encrypted backup/export and integrity validation, but not a full enterprise export platform.

## 7. Retrieval and Tier-4 reasoning orchestration

### 7.1 Ownership and flow

Kairo owns retrieval orchestration. AI providers never receive unrestricted direct access to the raw knowledge store.

```text
Question
→ intent classification and entity resolution
→ decomposition for complex questions
→ graph, structured, lexical, semantic, historical, project, and source retrieval
→ conflict detection and evidence ranking
→ PHI/session guard
→ compact reasoning packet
→ selected reasoning provider
→ structured result
→ evidence and safety validation
→ rendered answer
→ optional memory candidates
```

### 7.2 Intent and entity resolution

Intents include fact lookup, incident analysis, architecture explanation, workflow tracing, project/change analysis, source search, and product research. Complex questions are decomposed into technical subquestions before retrieval. Ambiguous names such as “PACS” are resolved from context with explicit confidence; low-confidence resolution should request or present clarification rather than invent scope.

### 7.3 Hybrid retrieval

All three V1 retrieval modes feed one layer:

- **Structured/graph:** facts, relationships, scopes, workflow and project traversal.
- **Lexical:** exact strings, versions, interface names, errors, AE Titles, and message types.
- **Semantic:** conceptually related passages and incidents even when wording differs.

Historical incidents, document sources, and project context are retrieved where relevant. Graph and structured filters should narrow semantic search rather than applying brute-force vector search to the whole corpus.

### 7.4 Conflict handling and confidence

Conflicts are preserved and explained. Current Best Understanding is selected by scope, time, evidence authority, corroboration, and recency—not by silently deleting the losing claim. Answers use qualitative confidence such as high, medium, or low; arbitrary precise probability displays are avoided.

### 7.5 Quick and Deep Analyze

**Quick** favors local retrieval and concise generation for definitions and known facts. It avoids unnecessary expensive model calls.

**Deep Analyze** expands graph and source retrieval, finds related incidents, examines workflow and project context, compares conflicts, builds an evidence packet, invokes the strongest configured reasoning model, ranks likely failure domains, and recommends the next best diagnostic action. It must avoid generic troubleshooting lists and must identify what remains unknown.

### 7.6 Answer contract

AI responses use versioned structured contracts rather than free text alone. Depending on the question, the rendered answer may contain:

- Assessment
- Current MANA Understanding
- Known facts and evidence states
- Planned or proposed architecture
- Product/vendor knowledge
- Ranked hypotheses or failure domains
- Unknowns and verification needs
- Recommended next actions
- Evidence links
- Memory candidates

Troubleshooting generally follows this layered form. Kairo may explicitly answer, “Insufficient MANA evidence.” Unsupported MANA claims must be qualified, downgraded, or rejected.

## 8. Model Gateway and reasoning relay

Kairo uses a `ReasoningProvider` abstraction. Android and desktop request reasoning capabilities; they do not bind to one provider or model. Provider implementations may support frontier reasoning, smaller hosted models, vision, or future local models.

The authenticated relay:

- validates users/sessions and enforces policy
- protects provider credentials
- selects models and routes Quick/Deep/vision tasks
- constructs or validates structured requests and responses
- removes unnecessary metadata
- applies cost, usage, and failure controls

The relay does not contain the permanent Kairo database, Source Vault, MANA corpus, memory, or a durable conversation store. Provider API keys never exist in the Android APK.

The model is stateless from Kairo’s perspective. Model responses do not become memory. A response-validation or “hallucination firewall” checks unsupported facts, contradictions, MANA/product confusion, leaked temporary identifiers, wrong temporal scope, and prohibited operational suggestions before display.

Controlled external research may be routed through the gateway. Results remain `PRODUCT` or `EXTERNAL_RESEARCH` knowledge until MANA-specific validation. External research is a V1 stretch, not a launch blocker.

Offline Kairo can browse and retrieve local knowledge but cannot use frontier reasoning, external research, or cloud vision. The UI must make this boundary explicit.

## 9. Security, privacy, PHI, and clinical safety

### 9.1 Advisory-only boundary

Kairo may analyze, explain, search, correlate, troubleshoot, recommend checks, and create diagnostic plans. It must not restart services, resend HL7, alter AE Titles, modify routes or clinical configuration, change patient records, or execute production actions. High confidence never grants operational permission.

Future integrations default to read-oriented access. Any later write behavior would require a new design and safety approval; it is not implied by this specification.

### 9.2 Security zones

Kairo separates:

1. **Durable knowledge:** institutional memory with no automatically retained PHI or credentials.
2. **Temporary session context:** troubleshooting material that may contain identifiers.
3. **External reasoning context:** the minimum necessary, preferably de-identified or redacted packet.

These zones must not silently mix.

### 9.3 Local detection and user choice

Artifacts are inspected locally for possible patient names, MRNs, accession/order numbers, DOB, addresses, contact details, Study UIDs, encounter/visit IDs, credentials, secrets, tokens, private keys, and connection strings before cloud reasoning or durable promotion.

When possible PHI is detected, Kairo offers:

- **Redact** before durable storage or external reasoning
- **Temporary Use** for the current troubleshooting session only
- **Cancel**

Temporary identifiers stay out of durable facts, embeddings, normal backups, and ordinary Source Vault retention, and must be clearable. Durable memory may retain the generalized workflow, failure, cause, validation, or solution without remembering the patient.

System identifiers such as hostnames, ports, interface names, AE Titles, IP addresses, architecture diagrams, and vendor URLs may not be PHI but are still **Institutional Sensitive Data** and require protected storage and transmission.

### 9.4 Local and backup security

V1 requires encrypted durable storage, protected application access, device authentication with biometric option where available, encrypted storage keys, an authenticated relay, encrypted export/backup, integrity validation, and an auditable history of memory changes. Temporary PHI is excluded from normal backups.

Audit history records imports, candidate decisions, fact changes, evidence-state transitions, and source lineage. Future multi-user attribution may add actor identity without changing the event model.

## 10. Knowledge lifecycle and Memory Inbox

Kairo’s lifecycle is:

```text
DISCOVERED → CANDIDATE → REVIEWED → ACTIVE → VALIDATED
                                      └────→ DEPRECATED/HISTORICAL
```

Lifecycle meanings:

- **DISCOVERED:** newly detected; no trust implied.
- **CANDIDATE:** potentially useful structured knowledge awaiting review.
- **REVIEWED:** a human has approved, edited, rejected, or deferred it.
- **ACTIVE:** accepted as useful Kairo knowledge.
- **VALIDATED:** strengthened by repeated or authoritative evidence.
- **DEPRECATED/HISTORICAL:** no longer current but retained.

The Memory Inbox is the human quality gate. Kairo may aggressively discover systems, versions, relationships, incidents, fixes, decisions, risks, questions, and action items, but AI-generated or incomplete claims cannot bypass review. The user can Approve, Edit, Reject/Ignore, or Defer.

Duplicate propositions consolidate under one fact lineage with multiple evidence links. Near duplicates and contradictions are not silently deleted. Knowledge ages: validation dates and triggers such as upgrades, projects, incidents, conflicting evidence, or vendor replacement can request review.

Troubleshooting sessions may generate reusable incident patterns containing symptom, affected workflow, root cause, resolution, prevention, and evidence. The specific patient context is excluded.

## 11. Workflow intelligence and Trace

Workflows are first-class objects generated from facts, relationships, workflow definitions, and evidence. Each workflow step may include system, clinical purpose, protocol, identifiers, dependencies, evidence, failure domains, version, and temporal scope.

Trace connects clinical and technical meaning across order creation, registration, scheduling, interfaces, DMWL, acquisition, DICOM storage/routing, interpretation, results, and reconciliation. It explicitly models MRN, external MRN, accession number, Study UID, order ID, encounter/visit ID, and their mappings where known.

Known failure categories attach to stages rather than becoming generic checklists. Historical incidents influence ranking but cannot be blindly reused as a fix.

Workflow versions preserve current, transition, future, and historical states. Project workflows never overwrite production workflows. Trace visualizations expose evidence states and unknown/unverified hops.

### 11.1 Locked MANA temporal distinction

Kairo must preserve the difference between the current and planned imaging architectures:

- **Breast Centers / mammography:** continue using **Merge RIS**, planned through approximately **February 2027**. The continuation date is `PLANNED` until later validated as an effective production milestone.
- **Non-breast imaging:** planned to transition to **AbbaDox CareFlow RIS** at AbbaDox go-live.
- Exact future interface and DMWL mechanics remain `VERIFY`, `OBSERVED`, or `CONFIRMED` only as evidence warrants.

Kairo must answer “How does imaging work today?” differently from “How will it work after the AbbaDox transition?” The breast exception remains visible in future-state and transition traces.

V1 proves Trace with three reference domains:

1. Breast imaging: eCW → Merge RIS → Merge PACS DMWL → Hologic modality → Merge PACS → MagView, with reporting elements only where verified.
2. Non-breast future state: eCW → AbbaDox CareFlow → Merge PACS/DMWL path → modality → Merge PACS, with unverified mechanics clearly marked.
3. Baxter external workflow: external identity, imaging performed/read at MANA, results returned to Baxter, and identifier reconciliation.

## 12. Projects, change, and decision intelligence

Projects are first-class temporary architecture-evolution domains, not folders. Project states may progress through Idea, Discovery, Planning, Implementation, Validation, Go-Live, Hypercare, Completed, and Historical.

Every project can represent:

- objective, status, timeline, systems, and stakeholders/roles
- current, transition, and future architecture
- decisions and alternatives with supporting evidence
- open questions, risks, mitigations, and action items
- meetings and Capture Sessions
- testing, validation, go-live, and hypercare history

Project statements remain project-scoped and carry appropriate evidence states. A proposed or planned relationship cannot become MANA production truth merely because it appears in a project or model response. Validated outcomes may be promoted into production knowledge while retaining the entire planned-to-confirmed history.

Meeting intelligence extracts structured outcomes without treating them as confirmed automatically. Migration intelligence may identify affected domains such as orders, scheduling, ORM/ADT, DMWL, accession numbers, reports, billing, external partners, and provider access.

V1 project support includes at least AbbaDox, Baxter, Rad AI, and Altamont examples, with project name, objective, status, systems, current/planned state, decisions, risks, open questions, sources, and meeting captures.

## 13. Android and desktop user experience

### 13.1 Shared UX principles

Kairo is chat-first. Opening it should feel like consulting a highly knowledgeable clinical-systems engineer, not browsing a database. Complexity and evidence depth appear on demand.

The visual identity is dark, premium, sophisticated, technical, and intelligence-focused: obsidian/graphite surfaces, readable light text, cool accents, deliberate motion, high information density, and low clutter. It should not resemble generic hospital software or a generic chatbot.

### 13.2 Android V1

Primary navigation includes:

- Copilot
- Systems
- Workflows
- Projects
- Knowledge
- Capture

Android V1 includes Copilot, generated System and Workflow views, Projects, knowledge search, Capture, Memory Inbox, Sources, Quick, online Deep Analyze, and meaningful offline browsing/search. Evidence is reachable from important claims. Accessibility supports one-handed use, dark environments, readable technical detail, zoomable screenshots, and easy copying.

Offline Android supports local knowledge browsing and search, system profiles, workflows, projects, locally available source reading, and memory review. It clearly marks frontier reasoning, external research, and cloud vision as unavailable.

### 13.3 Browser desktop V1

Desktop V1 includes Ask Kairo, Deep Analyze, file upload, drag-and-drop batch capture, source viewing, evidence inspection, Memory Inbox, and Projects. Large-screen layouts may place source/evidence beside analysis. No administrator installation is required.

Desktop and Android need not have feature parity; each specializes while honoring the same Core contracts and evidence rules.

## 14. Testing, validation, and trust framework

Kairo is tested for trust and correctness as well as software function. Required layers include unit, knowledge-model, retrieval, reasoning, security, workflow, migration, offline, regression, and user-acceptance tests.

### 14.1 Required trust properties

- Entities and environments do not merge incorrectly.
- Important facts retain versions rather than being destructively overwritten.
- Every approved important claim can trace to original evidence.
- Product/MANA and project/production boundaries remain intact.
- Retrieval benchmark questions return the expected facts, workflows, incidents, and sources.
- Unknown-answer tests produce qualified uncertainty, not invented MANA facts.
- Workflow traces match verified architecture and expose unknown hops.
- AI inference and speculative language enter as candidates/hypotheses, not confirmed facts.
- PHI and credentials are detected before unsafe durable or external processing.
- The relay retains no permanent corpus, source, prompt, or memory store.
- Offline features behave correctly and unavailable features are clear.
- Database migrations preserve facts, evidence, history, scopes, and audit events; derived indexes may rebuild.
- New knowledge does not regress prior benchmark answers.

### 14.2 Validation corpus

A private Kairo validation corpus will contain known MANA facts, workflows, incidents, screenshots, documents, benchmark questions, and expected evidence. It guides retrieval, hallucination, evidence-compliance, workflow, and regression evaluation. Expert Review may later score retrieved evidence, reasoning packets, answers, usefulness, and safety.

## 15. V1 launch boundary and Definition of Done

### 15.1 V1 product goal

V1 must feel like a personal MANA Clinical Systems Copilot with evidence-backed memory and prove this complete loop:

```text
Source → Ingest → Understand → Store → Retrieve
→ Reason → Show evidence → Capture new knowledge
```

### 15.2 Required V1 capability set

V1 requires:

- the entity/fact/relationship/evidence/source/project/incident/workflow/temporal Core
- product/MANA, project/production, and current/planned distinctions
- universal modern artifact ingestion and batch Capture Sessions
- immutable originals, hashes, exact deduplication, and evidence anchors
- basic screenshot OCR and intelligence
- PHI/session separation and credential protection
- structured, lexical, and semantic retrieval
- Ask Kairo with evidence-aware answers
- Quick and Deep Analyze
- evidence exploration from fact to source location
- controlled Memory Inbox promotion
- generated System views
- usable Projects and initial Trace workflows
- a controlled Genesis Corpus
- Android and browser desktop clients
- meaningful Android offline functionality
- authenticated stateless relay and provider abstraction
- encrypted durable storage, access protection, encrypted backup/export, and audit history

### 15.3 Genesis Corpus

Kairo must not launch empty. The controlled initial corpus prioritizes Merge/AMICAS PACS, Merge RIS, AbbaDox CareFlow, MagView, eClinicalWorks, Hologic, PowerScribe, Rad AI, Altamont, and DynaCAD, plus AbbaDox migration, Baxter, Rad AI/ViewPoint-retirement direction, and relevant breast-imaging changes.

Sources include curated MANA knowledge, workflow aggregates, selected screenshots, available manuals, project summaries, and selected relevant raw ChatGPT history. Curated/confirmed knowledge outranks casual discussion. Raw conversations remain source evidence and never become fact merely because an assistant stated something. Importing every historical conversation is not a launch requirement.

### 15.4 End-to-end Definition of Done

Kairo V1 is done when this scenario works reliably:

1. On desktop, the user uploads AbbaDox meeting notes (`.docx`), a workflow PDF, an interface screenshot, and a mapping spreadsheet as one Capture Session.
2. Kairo preserves and hashes the originals, extracts text and structure, and detects likely systems and project context.
3. Kairo detects possible PHI before unsafe durable or external processing and applies the user’s Redact, Temporary Use, or Cancel choice.
4. Kairo creates evidence-linked candidate facts, relationships, decisions, risks, action items, and open questions without promoting them automatically.
5. The user reviews and approves selected candidates in Memory Inbox; the evidence graph and Current Best Understanding projection update without destroying history.
6. Later, on Android, the user asks for the current understanding of AbbaDox worklist routing.
7. Kairo retrieves approved knowledge and clearly distinguishes confirmed, observed, planned, proposed/hypothetical, and unverified claims.
8. Important claims cite and open their supporting source evidence.
9. Deep Analyze expands relevant graph, source, incident, project, and workflow context; ranks unresolved failure or validation points; and recommends the next best thing to verify.
10. Kairo does not invent missing MANA configuration, leak temporary identifiers, or detach claims from evidence.

### 15.5 Launch acceptance criteria

**Knowledge:** no destructive fact overwrite; evidence states and temporal history are preserved; production/project and product/MANA separation work.

**Evidence:** approved important claims trace to accessible original sources and anchors.

**Retrieval:** known MANA benchmark questions retrieve the expected evidence.

**AI:** unsupported MANA claims are qualified; structured responses pass evidence and safety validation.

**PHI:** temporary identifiers do not silently enter durable facts, embeddings, or ordinary backups.

**Migration:** an upgrade test preserves the existing corpus and audit history.

**Offline:** the documented local Android capabilities work without internet.

**Desktop:** document upload, batch capture, evidence review, and query work through a browser without administrator installation.

### 15.6 Explicitly deferred from V1

- multi-user collaboration and enterprise RBAC
- Active Directory/SSO, MDM integration, and enterprise administration
- direct write access to PACS/RIS/EHR or automated production operations
- automatic HL7 resend, AE Title changes, or service restarts
- full independent offline desktop knowledge store
- full bidirectional multi-device sync or conflict-free replicated data
- enterprise cloud knowledge database
- desktop native executable
- voice assistant
- continuous monitoring
- CSOL integration
- ticketing automation
- live SharePoint/vendor-wiki connectors
- automatic Slack/Teams ingestion
- every historical conversation and every possible file format
- complete MANA enterprise model
- controlled external research as a launch blocker

V1 does not need to know everything about MANA. It must prove that Kairo can learn MANA correctly.

## 16. Development constraints retained from the approved design

This section records architecture constraints, not an implementation plan.

- Use a private monorepo initially with logical separation for Android, browser desktop, Core, relay, shared contracts/schemas, validation, and documentation.
- The Domain Core must not depend on Android UI frameworks.
- Shared contracts are versioned.
- Do not prematurely require Kotlin Multiplatform or maximize shared runtime code as a goal.
- Development must be portable across work and home computers and remote environments; secrets are never committed.
- Evidence infrastructure precedes sophisticated AI functionality.
- The Genesis Corpus and Universal Capture arrive early enough to validate against real data.
- Implementation decisions that refine technologies are recorded as ADRs.
- Coding work is divided into small, architecture-bound tasks with explicit tests and exclusions.
- The implementation plan is a separate artifact and is intentionally not included here.

## 17. Self-review and resolution record

This specification was reviewed for placeholders, contradictions, ambiguity, and scope.

### 17.1 Resolved contradictions

1. **Android owns the Brain vs Kairo Core owns the Brain:** the later locked multi-client amendment governs logical ownership. Android-hosted Core remains a valid initial physical deployment only if the client/Core seam is preserved.
2. **Broad legacy format support vs V1 scope:** universal ingestion remains locked, while V1 launch requires modern formats. Legacy `.doc`, `.xls`, and `.ppt` may be deferred; PPTX is included if practical.
3. **Offline Android vs one authoritative Core:** offline Android remains mandatory. V1 does not require unrestricted independent editing or full sync; the initial deployment or a controlled local subset must satisfy offline use without creating two authoritative graphs.
4. **No-PHI durable memory vs original-source retention:** likely-PHI artifacts require an explicit Redact, Temporary Use, or Cancel decision before durable retention. Temporary-use originals are not ordinary durable sources or backups. Redacted derivatives can become durable evidence when approved.
5. **AI capture vs human promotion:** models may extract candidates aggressively, but no model output bypasses Memory Inbox for durable knowledge promotion.
6. **Confidence field vs qualitative UI:** internal records may retain machine confidence for extraction/ranking, while user-facing answers avoid false-precision percentages and present evidence-based qualitative confidence.

### 17.2 Deliberately deferred implementation choices

The following are bounded implementation decisions, not missing design placeholders:

- the first physical hosting location of Kairo Core
- the relay implementation language/runtime and hosting provider
- the initial embedding model and vector-search implementation
- the exact cross-client transport and pairing/authentication mechanism
- final package/directory names and exact database table/Kotlin class mapping
- selective offline replication details beyond the required V1 user capability

Each must preserve the locked security, evidence, one-authoritative-Core, offline, and no-admin desktop constraints.

### 17.3 Scope check

This document defines product behavior, trust boundaries, logical architecture, V1 scope, and acceptance criteria. It does not contain task sequencing, estimates, dependency order, coding work units, repository creation actions, or an implementation backlog. Those belong in the implementation plan after this specification is approved.

### 17.4 Placeholder check

No unfinished-work marker, fill-in token, or unresolved approval marker remains. Items intentionally left to implementation are explicitly listed in Section 17.2 with governing constraints.

## 18. Approval gate

This specification was approved and locked on 2026-08-20 as the formal Kairo Design Specification. The next artifact is the implementation plan; implementation must not begin before that plan is created and approved under the selected workflow.
