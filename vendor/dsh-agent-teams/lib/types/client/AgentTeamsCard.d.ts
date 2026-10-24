/**
 * AgentTeams conversation card: the lightweight in-conversation summary for
 * one team — the captain's whale avatar and name, the member roster as
 * clickable whale avatars (opening the member's subagent transcript), and
 * an "activity panel" button that re-activates the top-right floater.
 *
 * The floater and this card share the `agent-teams:open-panel` window event
 * so the card can summon the panel even after it was closed (or when an old
 * session is re-opened for review).
 * @module dsh-agent-teams/client/card
 */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { AgentTeamsCardData } from './agent-teams-card-definition.ts';
/** Window event name the floater listens for to open itself. */
export declare const OPEN_PANEL_EVENT = "agent-teams:open-panel";
/** Navigation action injected from the plugin's own SessionsService access. */
export interface AgentTeamsCardInjected {
    readonly workspaceBridge?: {
        getSnapshot: () => unknown;
        subscribe: (listener: () => void) => () => void;
    };
    readonly openMember: (parentId: SessionId, childId: SessionId) => void;
}
/** Complete keyed Chat renderer props. */
export type AgentTeamsCardProps = PropsRuntime<'conversation.chat.node', 'agent-teams'> & PropsLocale<'agentTeams'> & AgentTeamsCardInjected;
/** Open the matching team view, carrying this team's summary
 * so the panel can show it even when the team no longer exists on disk
 * (historical session review). */
export declare function openActivityPanel(data: AgentTeamsCardData): void;
export declare function AgentTeamsCard({ node, openMember, sessionId, t, workspaceBridge }: AgentTeamsCardProps): import("react").JSX.Element | null;
export declare function AgentTeamsSummary({ data, openMember, sessionId, t }: AgentTeamsCardInjected & PropsLocale<'agentTeams'> & {
    data: AgentTeamsCardData;
    sessionId: string;
}): import("react").JSX.Element;
