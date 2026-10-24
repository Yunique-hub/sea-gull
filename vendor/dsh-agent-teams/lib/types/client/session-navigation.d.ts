/** Version-tolerant navigation into durable AgentTeams member transcripts. */
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SubagentAddress } from '@deepseek-ai/dsh-subagent/client';
/** Narrow sessions-service face used by the activity panel and team card. */
export interface AgentTeamsSessionNavigator {
    /** Legacy/ordinary session navigation. */
    open?(id: SessionId): void;
    /** rc.8 addressed subagent navigation. */
    openSubagent?(address: SubagentAddress): void;
    /** Refresh the exact parent's durable direct-child catalog. */
    refreshSubagents?(parentSessionId: SessionId): Promise<void>;
    /** Reuse an address already retained by the client runtime when available. */
    subagentAddress?(id: SessionId): SubagentAddress | undefined;
}
/** Newer sessions retain view ownership instead of publishing list.current. */
export declare function currentSessionId(state: {
    readonly current?: SessionId;
    readonly byId: Readonly<Record<string, {
        readonly id: SessionId;
        readonly retainedBy?: Readonly<Record<string, number>>;
    }>>;
}): SessionId | undefined;
export interface AgentTeamsWorkspaceNavigator {
    openSession(target: SessionId | SubagentAddress): void;
}
/** Main-panel navigation added in Harness 0.1.5; older layouts omit these actions. */
export interface AgentTeamsLayoutNavigator {
    selectPanel?(panelId: null): void;
    beginNavigation?(): AbortSignal;
}
/**
 * Open one member's persisted transcript.
 *
 * Harness rc.8 intentionally removed cold subagents from the ordinary session
 * list. They must first be rediscovered in their parent's catalog, then opened
 * with the exact parent/child/mode address. Older runtimes have only `open()`;
 * the fallback preserves ordinary-session navigation. New layouts also select
 * the Conversation panel and cancel catalog refreshes superseded by navigation.
 */
export declare function openAgentTeamMember(sessions: AgentTeamsSessionNavigator, parentSessionId: SessionId, childSessionId: SessionId, layout?: AgentTeamsLayoutNavigator, workspace?: AgentTeamsWorkspaceNavigator): Promise<'subagent' | 'session' | 'cancelled'>;
