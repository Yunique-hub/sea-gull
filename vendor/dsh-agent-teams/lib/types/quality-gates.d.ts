/**
 * Pure quality-gate rules: contracts, path audit, completion, follow-up,
 * coverage, and resume. Tools and persistence call these; they do not I/O.
 * @module dsh-agent-teams/quality-gates
 */
import { type AcceptanceResult, type ArtifactDigest, type ArtifactScopeGap, type ArtifactSnapshot, type CommandResult, type FindingSeverity, type ReviewFinding, type ReviewPolicy, type ReviewVerdict, type TaskKind, type TaskEvidence, type TaskRevision, type TaskStatus, type TeamState, type TeamTask } from './types.ts';
declare const QUALITY_KINDS: readonly TaskKind[];
declare const WRITE_KINDS: readonly TaskKind[];
declare const DEFAULT_REVIEW_POLICY: Required<Pick<ReviewPolicy, 'requirementsMinRounds' | 'requirementsMaxRounds' | 'codeMaxRounds' | 'maxRepairAttempts'>>;
export type PathClassification = 'in_scope' | 'out_of_scope' | 'undeclared' | 'illegal';
export interface CreateTaskInput {
    subject: string;
    description?: string;
    dependencies?: string[];
    assignee?: string;
    kind?: TaskKind;
    round?: number;
    objective?: string;
    inScope?: string[];
    outOfScope?: string[];
    acceptance?: string[];
    verify?: string[];
    deliverables?: string[];
    nonGoals?: string[];
    reviewedTaskId?: string;
    sourceTaskId?: string;
    sourceFindingIds?: string[];
    coverageOf?: string[];
    resume?: boolean;
    resumeReason?: string;
}
export interface ValidateCreateTaskResult {
    ok: boolean;
    error?: string;
    kind?: TaskKind;
    task?: Partial<TeamTask>;
    team?: TeamState;
}
export interface QualityCompletionUpdate {
    status?: TaskStatus;
    output?: string;
    verdict?: ReviewVerdict;
    findings?: ReviewFinding[];
    changedPaths?: string[];
    acceptanceResults?: AcceptanceResult[];
    commandsRun?: CommandResult[];
}
export interface QualityCompletionResult {
    ok: boolean;
    error?: string;
    requiredStatus?: TaskStatus;
}
export interface PlannedFollowUpTask {
    id?: string;
    kind: TaskKind;
    subject?: string;
    description?: string;
    assignee?: string;
    dependencies?: string[];
    round?: number;
    objective?: string;
    inScope?: string[];
    outOfScope?: string[];
    acceptance?: string[];
    verify?: string[];
    sourceTaskId?: string;
    sourceFindingIds?: string[];
    findingSourceTaskIds?: string[];
    reviewedTaskId?: string;
    /**
     * Paths whose current bytes the generated contract was derived from. The
     * caller snapshots them so the work order can later be marked stale.
     */
    contractPaths?: string[];
}
export interface PlanQualityFollowUpResult {
    created: PlannedFollowUpTask[];
    tasks: PlannedFollowUpTask[];
    escalated?: boolean;
    status?: 'escalated';
    /** Why the automatic loop stopped; surfaced to the captain. */
    reason?: string;
    /** Findings that were refused as contract material (default-excluded paths). */
    excludedFindings?: string[];
}
export interface CoverageRow {
    goal_item: string;
    task_ids: string[];
    status: 'missing' | 'in_progress' | 'passed' | 'blocked';
    evidence?: string;
}
export interface DeliveryResult {
    ok: boolean;
    blockers: string[];
    /**
     * Non-blocking observations: gates that legitimately drifted because a later
     * revision superseded them, and generated work orders whose cited files
     * moved on. Delivery is still allowed, but never silently.
     */
    warnings: string[];
}
/**
 * Current workspace bytes handed to the delivery check. The rules stay pure:
 * the caller (which owns the workspace path) reads the digests and passes them
 * in. Omit it when no workspace is available — the attempt-level staleness
 * checks still run, and content checks simply cannot be made.
 */
export interface ScopeEntry {
    path: string;
    present: boolean;
}
export interface DeliveryAudit {
    /** Current bytes of the paths recorded by verdicts and work orders. */
    artifacts?: readonly ArtifactDigest[];
    /**
     * Current contents of the scope patterns recorded verdicts bound. A path that
     * appears here but not in the verdict's recorded artifacts was never
     * reviewed, so a broad scope cannot silently absorb it.
     */
    expandedScope?: readonly ScopeEntry[];
    /**
     * Parts of the *current* read that could not be completed (expansion cap,
     * unreadable directory or file, illegal pattern). A non-empty list means the
     * audit itself is incomplete, so no verdict may be confirmed from it.
     */
    gaps?: readonly ArtifactScopeGap[];
}
export interface ResumeTeamResult {
    ok?: boolean;
    status: 'resumed' | 'already_running' | 'rejected';
    team?: TeamState;
    error?: string;
}
export type QualityLoopState = 'running' | 'halted' | 'escalated' | 'deliverable' | 'blocked';
export interface QualityLoopSnapshot {
    state: QualityLoopState;
    halted: boolean;
    escalated: boolean;
    deliverable: boolean;
    summary: string;
    /** Non-blocking gate observations (stale verdicts and work orders). */
    warnings: string[];
}
export interface QualityGraphDraft {
    subject: string;
    kind: TaskKind;
    assignee?: string;
    dependencies: string[];
    objective: string;
    acceptance: string[];
    inScope?: string[];
    verify?: string[];
    coverageOf?: string[];
}
export declare const DEFAULT_REVIEW_ACCEPTANCE: readonly ["The latest implementation meets the user goal", "No unresolved blocker or high findings"];
export declare const DEFAULT_REVIEW_OBJECTIVE = "Review whether the latest implementation satisfies the user goal";
export declare function taskKindOf(task: Pick<TeamTask, 'kind'> | undefined): TaskKind;
export declare function isQualityKind(kind: TaskKind | undefined): boolean;
export declare function resolveReviewPolicy(policy: ReviewPolicy | undefined): Required<typeof DEFAULT_REVIEW_POLICY> & ReviewPolicy;
export declare function isReviewPolicy(value: unknown): value is ReviewPolicy;
/** Normalize a workspace-relative POSIX path. `undefined` means illegal. */
export declare function normalizeWorkspacePath(path: string): string | undefined;
export declare function pathMatchesScope(path: string, pattern: string): boolean;
/**
 * Paths no quality contract may claim: version control, harness/plugin state,
 * secrets and private keys. Exported because the completion gate and contract
 * generation (including the artifact reader that must not walk into
 * `.agent-teams/`, `secrets/` or `.env*`) have to share exactly one predicate.
 */
export declare function isDefaultExcludedPath(path: string): boolean;
export declare function classifyChangedPath(path: string, inScope?: readonly string[], outOfScope?: readonly string[]): PathClassification;
export declare function collectChangedPaths(gitStatusText: string): string[];
export declare function inScopeOverlap(left: readonly string[] | undefined, right: readonly string[] | undefined): string[];
export declare function validateCreateTask(team: TeamState, input: CreateTaskInput): ValidateCreateTaskResult;
export declare function evaluateQualityCompletion(task: TeamTask, update: QualityCompletionUpdate): QualityCompletionResult;
/**
 * Derive the repair round's inScope from the findings that caused it.
 *
 * `finding.file` records where the problem was OBSERVED, but the fix often
 * targets a different file named in `requiredFix` (docs vs sample data,
 * config vs code). Deriving the scope from both keeps the auto-generated
 * repair contract satisfiable; deriving from `file` alone can produce a
 * contract where the acceptance ("edit README.md") names a path the scope
 * forbids, so no honest completion exists and the repair dead-locks.
 *
 * Absolute and otherwise illegal paths are dropped (they can never match
 * workspace-relative scope patterns anyway), and so are paths the completion
 * gate refuses by default (`secrets/` segments, `.env*`, `.git`, `.dsh`,
 * `id_rsa*` — issue #183). `classifyChangedPath` checks that default-exclusion
 * set BEFORE inScope, so collecting such a path here would generate a contract
 * that demands an edit the gate calls `out_of_scope`: no honest completion
 * exists and the repair burns its rounds. Contract generation and the
 * completion gate must agree; the exemption channel stays the user-configured
 * outOfScope list, never a reviewer's finding.
 *
 * When nothing legal remains, the source task's own inScope is kept as the
 * fallback. Over-inclusion is accepted otherwise: inScope is an audit upper
 * bound, and the requiredFix text still tells the implementer what to touch.
 * Keep every remaining derived path until the generator resolves inherited
 * exclusions; filtering those first would silently discard a required fix
 * target.
 */
export declare function repairScopeFromFindings(findings: readonly ReviewFinding[], fallback: string[] | undefined): string[] | undefined;
/**
 * Every workspace-relative path one finding names, before any exclusion rule:
 * the observed file plus the fix targets referenced by `requiredFix`.
 */
export declare function findingDerivedPaths(finding: ReviewFinding): string[];
/**
 * Findings whose every cited path is default-excluded. They cannot become an
 * honest repair contract (see {@link repairScopeFromFindings}), so they are
 * surfaced to the captain instead of silently disappearing or dead-locking a
 * member. A finding that names no path at all is NOT excluded: it simply falls
 * back to the judged task's own scope, exactly as before.
 */
export declare function excludedFindingsOf(findings: readonly ReviewFinding[], pathExists?: (path: string) => boolean): ReviewFinding[];
/** Captain-only amendment payload: replacement values for contract fields. */
export interface ContractAmendmentInput {
    objective?: string;
    acceptance?: string[];
    verify?: string[];
    inScope?: string[];
    outOfScope?: string[];
}
export interface AmendTaskContractResult {
    ok: boolean;
    error?: string;
    task?: TeamTask;
    revision?: TaskRevision;
}
/**
 * Controlled contract amendment (the pure rule; tooling keeps it
 * captain-only). When a quality contract is wrong — a verify command that
 * cannot pass, an inScope that forbids the file the objective names — the
 * worker has no honest completion and either dead-locks or games the gate.
 * Instead the captain may fix the contract mid-flight: every amendment is
 * recorded on the task as a {@link TaskRevision} (previous values + reason),
 * and once a review/requirements task has passed judgment on this task the
 * contract is frozen. Amendments replace whole fields (lists are full
 * replacements, not deltas); the implementer re-reads the amended contract
 * before its next quality gate. Completion gates need no special casing:
 * they read the task's current fields, so they naturally evaluate the
 * amended contract.
 */
export declare function amendTaskContract(team: TeamState, task: TeamTask, input: ContractAmendmentInput, by: string, reason: string): AmendTaskContractResult;
/** Remove drifting line anchors from generated contract text. */
export declare function stripLineAnchors(text: string): string;
export interface PlanQualityFollowUpOptions {
    /**
     * Whether a derived path exists in the workspace. Used only to classify a
     * finding as excluded-only; without it every derived path counts.
     */
    pathExists?: (path: string) => boolean;
}
export declare function planQualityFollowUp(team: TeamState, closed: TeamTask, options?: PlanQualityFollowUpOptions): PlanQualityFollowUpResult;
export declare function buildCoverageMatrix(goalItems: readonly string[], tasks: readonly TeamTask[]): CoverageRow[];
/** Kinds whose completion is a verdict about a revision. */
export declare function isVerdictKind(kind: TaskKind | undefined): boolean;
/**
 * Compare recorded bytes against the bytes on disk now. Every returned entry
 * is a reason a verdict or a work order no longer describes the workspace.
 * "Cannot be read" is reported as its own reason: a permission error is not a
 * match, and a partial read is not proof of an unchanged file.
 */
/** One reason an artifact set no longer describes the workspace. */
export interface ArtifactDriftDetail {
    /** The implicated path, when the reason is about one concrete file. */
    path?: string;
    message: string;
}
/**
 * Compare recorded bytes against the bytes on disk now, keeping the path each
 * reason belongs to. "Cannot be read" is reported as its own reason: a
 * permission error is not a match, and a partial read is not proof of an
 * unchanged file.
 */
export declare function artifactDriftDetails(recorded: readonly ArtifactDigest[] | undefined, current: readonly ArtifactDigest[] | undefined): ArtifactDriftDetail[];
/** Message-only view of {@link artifactDriftDetails}. */
export declare function artifactDrift(recorded: readonly ArtifactDigest[] | undefined, current: readonly ArtifactDigest[] | undefined): string[];
/** A partially enumerated scope is incomplete evidence, never a silent pass. */
export declare function gapDrift(gaps: readonly ArtifactScopeGap[] | undefined): string[];
/**
 * The task a verdict is about: an explicit `reviewedTaskId`/`sourceTaskId`
 * first, otherwise the implementation/repair this gate depends on.
 */
export declare function reviewedTargetOf(team: TeamState, task: TeamTask): TeamTask | undefined;
/**
 * Bind a closing verdict to the revision it judged: the target's execution
 * generation plus the bytes of the paths it changed. Without this a `pass` is
 * only a task record, and delivery cannot tell that the reviewed bytes were
 * edited or deleted afterwards. `gaps` carries the parts of the reviewed scope
 * that could not be enumerated, `scope` the patterns it bound, and
 * `duringDrift` any change observed between claim and close — partial or
 * moving coverage is never read as complete.
 */
export interface ReviewBinding {
    artifacts: readonly ArtifactDigest[];
    gaps?: readonly ArtifactScopeGap[];
    scope?: readonly string[];
    duringDrift?: readonly string[];
}
export declare function bindReviewToRevision(team: TeamState, task: TeamTask, binding: ReviewBinding): TeamTask;
/**
 * Scope a verdict must bind: the paths the judged task changed, otherwise the
 * scope patterns of its contract (expanded by the caller).
 */
export declare function verdictScopePatterns(team: TeamState, task: TeamTask): string[];
/** Scope patterns recorded verdicts bound, for new-file detection. */
export declare function deliveryScopePatterns(team: TeamState): string[];
/** Paths whose current bytes decide whether recorded verdicts and orders hold. */
export declare function deliveryArtifactPaths(team: TeamState): string[];
/**
 * Every completed verdict that claims to cover the current revision but no
 * longer does.
 *
 * A drifted review/requirements pass is the delivery evidence itself, so it
 * blocks — unless a later sound verdict covers the same lineage, which is the
 * normal shape of `pass → repair → new pass` and must converge instead of
 * blocking forever behind an old snapshot. A drifted `verification` is only a
 * warning: a later repair legitimately supersedes it, but never silently.
 * A verdict that predates content binding is reported as an unauditable gap
 * rather than being read as a pass over the current bytes.
 */
/** One audited verdict observation, attributed to the task that carries it. */
export interface VerdictAuditNote {
    taskId: string;
    /**
     * `blocker` when this pass is the delivery evidence itself, `warning` when a
     * later sound verdict supersedes it or when it is an intermediate gate.
     */
    level: 'blocker' | 'warning';
    message: string;
}
/**
 * Audit every completed verdict against the current revision (issue #161).
 *
 * A drifted review/requirements pass is the delivery evidence itself, so it
 * blocks — unless a later sound verdict covers the same lineage, which is the
 * normal shape of `pass → repair → new pass` and must converge instead of
 * blocking forever behind an old snapshot. A drifted `verification` or a
 * superseded pass is reported as a warning: a later repair legitimately
 * supersedes it, but never silently. A verdict that predates content binding
 * is reported as an unauditable gap rather than being read as a pass over the
 * current bytes.
 */
export declare function verdictAuditNotes(team: TeamState, audit?: DeliveryAudit): VerdictAuditNote[];
/** Staleness of one auto-generated work order against the current workspace. */
export declare function contractStaleness(task: TeamTask, current: readonly ArtifactDigest[] | undefined): string[];
export interface WorkOrderWarning {
    taskId: string;
    message: string;
}
/**
 * Open auto-generated work orders whose cited bytes moved on (issue #174).
 * A repair round's acceptance/inScope is a snapshot of the workspace at
 * finding-generation time; every later round invalidates it, and nothing used
 * to say so — a member following it literally edits the wrong line or redoes
 * work that is already done.
 */
export declare function workOrderWarnings(team: TeamState, current: readonly ArtifactDigest[] | undefined): WorkOrderWarning[];
export declare function canDeclareDelivery(team: TeamState, audit?: DeliveryAudit): DeliveryResult;
export declare function resumeTeamState(team: TeamState, reason: string): ResumeTeamResult;
/**
 * The durable `findings[].line` contract, shared by the write-side parser
 * (`parseFindings`) and the durable validator (`isReviewFinding`) so the two
 * cannot drift apart again (issue #188, #105 class).
 */
export declare function isValidFindingLine(value: unknown): value is number;
export declare function isReviewFinding(value: unknown): value is ReviewFinding;
export declare function isAcceptanceResult(value: unknown): value is AcceptanceResult;
export declare function isCommandResult(value: unknown): value is CommandResult;
export declare function isTaskRevision(value: unknown): value is TaskRevision;
export declare function isArtifactDigest(value: unknown): value is ArtifactDigest;
export declare function isArtifactScopeGap(value: unknown): value is ArtifactScopeGap;
export declare function isArtifactSnapshot(value: unknown): value is ArtifactSnapshot;
/**
 * Normalize blank optional task fields to omitted ("blank means absent").
 * Blank string scalars are deleted; string lists have blank entries filtered
 * out, and a list that only contained blanks is omitted entirely. Non-blank
 * values and every other field are passed through untouched, so durable-state
 * validation stays strict.
 */
export declare function normalizeBlankOptionalTaskFields<T extends object>(task: T): T;
/**
 * Treat an out-of-contract **numeric** sentinel as absent, including
 * `findings[].line` (contract: `isValidFindingLine`).
 *
 * Only numbers are healed. A value of any other type (`round: "oops"`,
 * `attempt: {}`, `line: "12"`) is left exactly as written and stays a hard,
 * named validation failure, so genuine corruption is never silently swallowed
 * while `-1`-style sentinels — the #188 brick — self-heal. Field order, unknown
 * fields and every in-range value are preserved.
 */
export declare function normalizeSentinelNumericTaskFields<T extends object>(task: T): T;
export declare function hasValidQualityTaskFields(value: Record<string, unknown>): boolean;
export declare function isTaskKind(value: unknown): value is TaskKind;
export declare function isReviewVerdict(value: unknown): value is ReviewVerdict;
export declare function isFindingSeverity(value: unknown): value is FindingSeverity;
export declare function looksLikeGateTestContract(value: string | undefined): boolean;
export declare function sanitizeReviewObjective(value: string | undefined, fallback?: string): string;
export declare function sanitizeReviewAcceptance(values: readonly string[] | undefined): string[];
export declare function defaultQualityDeliveryGraph(input: {
    goal: string;
    implementer?: string;
    reviewer?: string;
    analyst?: string;
    tester?: string;
    integrator?: string;
}): QualityGraphDraft[];
export declare function qualityPlanningPrompt(): string;
export declare function describeQualityLoop(team: TeamState, audit?: DeliveryAudit): QualityLoopSnapshot;
export { QUALITY_KINDS, WRITE_KINDS };
/** Persisted evidence must remain loadable after process restart. */
export declare function isTaskEvidence(value: unknown): value is TaskEvidence;
/** Append observations without mutating the original result or its completion time. */
export declare function appendTaskEvidence(task: TeamTask, input: QualityCompletionUpdate & {
    evidence_note?: string;
}, by: string): boolean;
