/**
 * The single workspace audit shared by every surface that reports a delivery
 * or quality-loop conclusion.
 *
 * `agent_teams_status`, the activity-panel route and any Web API consumer must
 * read the same current bytes: if only one of them compared recorded verdicts
 * against the workspace, the other would keep advertising a passing gate over
 * a revision no review ever saw (issue #161).
 *
 * The audit consumes the artifact reader's *complete* result — digests, the
 * enumeration gaps and unreadable paths — because a partial read must never
 * look like a clean one: a scope that outgrew its cap after the review would
 * otherwise be reported as fully verified.
 * @module dsh-agent-teams/workspace-audit
 */
import type { DeliveryAudit } from './quality-gates.ts';
import type { TeamState } from './types.ts';
/**
 * Read the current workspace bytes a team's recorded verdicts and generated
 * work orders depend on.
 * @param workspace - absolute path of the owning workspace.
 * @param team - the durable team record.
 * @returns digests of every recorded path, the current contents of the scopes
 * the verdicts bound (so a new file cannot slip into a broad scope), and every
 * gap that makes this audit incomplete.
 */
export declare function auditTeamWorkspace(workspace: string, team: TeamState): DeliveryAudit;
