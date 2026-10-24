/**
 * AgentTeams conversation card: a lightweight in-conversation summary shown
 * when a team is created — the captain's name, the member roster with whale
 * avatars, and an entry point that re-activates the top-right activity
 * panel (useful after the floater was closed, or when re-opening an old
 * session for review).
 *
 * The fold anchors to the Harness's durable `tool/call` + `tool/result`
 * records for `agent_teams_create`. Those are first-party session events, so
 * the card survives restarts without writing an out-of-repo event type.
 * @module dsh-agent-teams/client/card
 */
import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { ChatConversationViewNode } from '@deepseek-ai/dsh-client-ui-chat/client';
/** Final keyed Chat payload for the team summary card. */
export interface AgentTeamsCardData {
    readonly teamId: string;
    /** The captain session that owns this team (panel follows it). */
    readonly captainSessionId: string;
    readonly teamName: string;
    readonly members: readonly {
        readonly id: string;
        readonly name: string;
        readonly role: string;
    }[];
}
declare module '@deepseek-ai/dsh-client-ui-chat/client' {
    interface ChatNodeDataMap {
        /** Lightweight team summary card anchoring the conversation. */
        'agent-teams': AgentTeamsCardData;
    }
}
/** One roster row folded from the create result. */
export interface AgentTeamsCardMember {
    readonly id: string;
    readonly name: string;
    readonly role: string;
}
/** Folded team record (the node's business state). */
export interface AgentTeamsNodeState {
    readonly teamId: string;
    readonly name: string;
    readonly accepted: boolean;
    /** Captain session the host reported, or `''` for a pre-#203 record. */
    readonly captainSessionId: string;
    /** Roster the host reported, or `[]` for a pre-#203 record. */
    readonly members: readonly AgentTeamsCardMember[];
}
/**
 * Canonical identity the host publishes on the create result (issue #203).
 * The display name intentionally stays the create call's own name.
 */
export interface AgentTeamsCreateIdentity {
    readonly teamId: string;
    readonly captainSessionId: string;
    readonly members: readonly AgentTeamsCardMember[];
}
/**
 * Fold a team name the way the host's `sanitizeKey` does, minus the host's
 * digest fallback. The host keeps Unicode letters and digits, so an ASCII-only
 * client derivation turned every CJK name into the shared `team` key and the
 * card could never match its live team (issue #203). Names with no letters or
 * digits at all, and names longer than the host's key limit, still need the
 * host's canonical id; the create result now carries it.
 * @param name - the create call's team name.
 * @returns the host-shaped key for the name.
 */
export declare function teamKeyFromName(name: string): string;
/** Parse the only create-call fields the historic card owns. */
export declare function parseAgentTeamsCreateArgs(value: string): {
    teamId: string;
    name: string;
} | undefined;
/**
 * Read the canonical identity the host attaches to the `agent_teams_create`
 * result. Records written before the host published it carry no metadata, so
 * an absent or malformed payload falls back to the client derivation.
 * @param meta - the durable `tool/result` metadata payload, if any.
 * @returns the canonical identity, or `undefined` when the host published none.
 */
export declare function parseAgentTeamsCreateResult(meta: unknown): AgentTeamsCreateIdentity | undefined;
/**
 * Read the canonical team id out of a `tool/result` recorded before the host
 * published {@link parseAgentTeamsCreateResult}'s metadata. Both historic
 * renderings carry it and have been stable since they were introduced:
 * `Team "<name>" created (id <canonical>) under <state_dir>. You are the
 * captain.` and the staged `Team "<name>" plan created under <state_dir>. It is
 * staged: …`, whose `state_dir` ends in the canonical id. This is the only
 * legacy path for names the client cannot re-derive (host digest fallback,
 * over-long names). Matches are taken right-to-left because the team name sits
 * in front of the canonical segment and may itself contain a look-alike.
 * @param text - the concatenated text blocks of one successful create result.
 * @returns the canonical id, or `undefined` when the text carries none.
 */
export declare function teamIdFromCreateResultText(text: string): string | undefined;
/** Durable first-party tool events folded into one keyed Chat node. */
export declare const agentTeamsCardDefinition: ConversationNodeDefinition<AgentTeamsNodeState>;
/** Concatenate the text blocks of one durable tool-result message. */
export declare function resultText(message: {
    readonly content: readonly unknown[];
}): string;
/** V4 tool-role results carry isError directly; older logs nest tool-result blocks. */
export declare function toolResultFailed(message: {
    readonly content: readonly unknown[];
    readonly isError?: boolean;
}): boolean;
/** Keep summaries tied to the create turn, including multiple teams in one turn. */
export declare function teamCardsForTurn(nodes: Iterable<ChatConversationViewNode>, turn: number): ChatConversationViewNode[];
