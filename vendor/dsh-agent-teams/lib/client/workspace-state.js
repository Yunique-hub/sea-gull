export function createWorkspaceState() {
    let snapshot = { statuses: new Map(), history: new Map(), selected: new Map() };
    const listeners = new Set();
    const publish = (next) => {
        snapshot = next;
        for (const listener of listeners)
            listener();
    };
    return {
        getSnapshot: () => snapshot,
        subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
        status(session, status) {
            if (snapshot.statuses.get(session) === status)
                return;
            publish({ ...snapshot, statuses: new Map(snapshot.statuses).set(session, status) });
        },
        select(session, team) {
            if (snapshot.selected.get(session) === team)
                return;
            publish({ ...snapshot, selected: new Map(snapshot.selected).set(session, team) });
        },
        remember(session, data) {
            const owner = data.captainSessionId || session;
            if (owner !== session)
                return;
            publish({ ...snapshot,
                history: new Map(snapshot.history).set(`${owner}:${data.teamId}`, { ...data, captainSessionId: owner }),
                selected: new Map(snapshot.selected).set(owner, data.teamId),
            });
        },
    };
}
/** Records restored at mount never reopen a closed tab; new teams are announced once. */
export function createTeamDiscovery() {
    let restored = false;
    let known = new Set();
    return (teams) => {
        const added = restored ? teams.find(team => !known.has(team.teamId))?.teamId : undefined;
        known = new Set(teams.map(team => team.teamId));
        restored = true;
        return added;
    };
}
