/** Plugin-instance state shared by the monitor and any number of native tabs. */
import type { AgentTeamsCardData } from './agent-teams-card-definition.ts';
import type { ActivityTeam } from './activity-monitor.ts';
export type ConnectionStatus = 'loading' | 'ready' | 'error';
export interface WorkspaceSnapshot {
    readonly statuses: ReadonlyMap<string, ConnectionStatus>;
    readonly history: ReadonlyMap<string, AgentTeamsCardData>;
    readonly selected: ReadonlyMap<string, string>;
}
export declare function createWorkspaceState(): {
    getSnapshot: () => WorkspaceSnapshot;
    subscribe: (listener: () => void) => () => void;
    status(session: string, status: ConnectionStatus): void;
    select(session: string, team: string): void;
    remember(session: string, data: AgentTeamsCardData): void;
};
export type WorkspaceActivityState = ReturnType<typeof createWorkspaceState>;
/** Records restored at mount never reopen a closed tab; new teams are announced once. */
export declare function createTeamDiscovery(): (teams: readonly ActivityTeam[]) => string | undefined;
