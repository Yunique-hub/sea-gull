import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ISidebarRight } from '@deepseek-ai/dsh-client-ui-sidebar-right/client';
import { type ActivityPanelProps } from './ActivityPanel.tsx';
import { type WorkspaceActivityState } from './workspace-state.ts';
export declare const TEAM_TAB_KIND = "agent-teams";
export declare const TEAM_TAB_ID = "@nanmicoder/dsh-agent-teams/activity";
/** Optional host integration is observable so installing/removing it also switches the fallback. */
export declare function createWorkspaceBridge(): {
    getSnapshot: () => ISidebarRight | undefined;
    subscribe: (listener: () => void) => () => void;
    set(value: ISidebarRight | undefined): void;
};
export declare function ActivitySurface({ bridge, state, ...props }: ActivityPanelProps & {
    bridge: ReturnType<typeof createWorkspaceBridge>;
    state: WorkspaceActivityState;
}): import("react").JSX.Element;
export type WorkspaceActivityProps = PropsRuntime<'sidebar.right.pane.tab'> & PropsLocale<'agentTeams'> & {
    state: WorkspaceActivityState;
    modelDirectories: ActivityPanelProps['modelDirectories'];
    openMember: ActivityPanelProps['openMember'];
};
export declare function WorkspaceActivity({ sessionId, useTabInfo, t, state, modelDirectories, openMember }: WorkspaceActivityProps): import("react").JSX.Element;
