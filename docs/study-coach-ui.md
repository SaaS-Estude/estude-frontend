# Prompt 08 — Student AI Study Coach UI handoff

## Implemented surface

Web integrates Study Coach into the existing StudentShell navigation and adds:

- `/student/study-coach`: server-authoritative overview, completed material references
  available from quiz summaries, mastery state counts, current backend next action,
  and shortcuts.
- `/student/study-coach/materials/:materialId/mastery`: document-scoped mastery cards and activity; progress from different materials is never mixed,
  evidence count and target difficulty.
- `/student/study-coach/insights`: student/document scopes, vi/en insight request,
  ready/empty/loading/error/disabled/processing/fallback states and ordered actions.
- Existing `/student/review/flashcards` and `/student/review/quiz` now return to the
  Study Coach loop and expose stable test selectors.

Mobile integrates three new screens into the existing state-based navigator:

- Study Coach Home.
- Study Coach Mastery.
- Study Coach Insights.

Existing Flashcards and Quiz screens remain the learning engines. They now have a
route back to the hub and refetch authoritative backend state when the app becomes
active after an interruption.

## APIs consumed

- `GET /study-coach/flashcards/due`
- `POST /study-coach/flashcards/:id/review`
- `GET /study-coach/quizzes`
- `POST /study-coach/quizzes/:examId/start`
- `GET /study-coach/quizzes/attempts/:attemptId`
- `POST /study-coach/quizzes/attempts/:attemptId/answers`
- `POST /study-coach/quizzes/attempts/:attemptId/submit`
- `GET /study-coach/quizzes/attempts/:attemptId/result` (web)
- `GET /study-coach/mastery`
- `GET /study-coach/mastery/concepts/:conceptId` (client contract; detail UI does not call it yet)
- `GET /study-coach/insights`
- `POST /study-coach/insights/generate`
- `GET /study-coach/insights/:id` (client contract; list DTO is sufficient for current UI)

## State matrix

| State | Web | Mobile |
| --- | --- | --- |
| loading | Inline spinner/panel | ScreenState spinner |
| empty | Materials, mastery, insights, cards, quiz | Same supported API surfaces |
| ready | Overview/cards/actions/results | Overview/cards/actions/results |
| error | Safe status-aware retry | Safe status-aware retry for new surfaces |
| offline | Status 0 copy; no optimistic success | Network copy; AppState refetch |
| disabled | Backend 503 recognized as configuration | Backend 503 recognized as configuration |
| generating | One guarded POST, CTA disabled | One guarded POST, CTA disabled |
| fallback | Clearly identified safe backend fallback | Clearly identified safe backend fallback |

## Security boundaries

The UI does not calculate mastery, state, target difficulty, accuracy or action
priority. It does not call an AI provider or create LearningEvent records. New UI
does not reference answer keys, correctOptionIndexes, alpha/beta, raw prompts,
provider metadata, audit event IDs or studentId. The authenticated API layer and
backend ownership rules remain the authorization boundary.

Active quiz rendering only uses the existing answer-safe attempt contract. Result
rendering displays backend-graded result fields after submission.

## Known backend contract gaps

Prompt 08 prohibits adding or inventing backend contracts, so the following cannot
be completed without a backend extension:

1. There is no student read endpoint for Study Coach LearningMaterial listing/detail.
   The UI therefore cannot restore or show UPLOADING, PROCESSING and FAILED documents,
   safe processing errors, or retry support. Completed document references are shown
   only when returned by the quiz API.
2. There is no student KnowledgeMap/KnowledgeTopic/KnowledgeConceptRelation read API.
   The Knowledge Map shortcut is visibly unavailable; no fake hierarchy is rendered.
3. There is no read-only capability/feature-config endpoint for
   `STUDY_COACH_INSIGHTS_ENABLED`. The UI can recognize the backend disabled response
   after the first explicit generate request, but cannot hide the CTA in advance.
4. `GET /study-coach/mastery` returns persisted ConceptMastery rows only. Concepts
   without mastery evidence are not returned as NEW, so the client does not synthesize
   them.
5. The existing applications have no shared vi/en UI localization infrastructure.
   Insight generation supports vi/en and AI content is rendered without translation;
   the surrounding Study Coach UI remains consistent with the existing Vietnamese app.

## Verification

- Web Study Coach tests: 13/13 PASS.
- Web lint, TypeScript and Next production build: PASS.
- Mobile TypeScript: PASS. The project has no test or lint script; none was introduced.
- Backend regression: 361/361 tests, 42/42 suites PASS.
- No browser E2E, device E2E, real Mongo replica-set, real Gemini, staging migration
  or production feature-flag verification was performed.

Prompt 09 should add browser/device E2E after the missing material/map/config read
contracts and the Prompt 07 StudyAnalysis index migration are delivered.
