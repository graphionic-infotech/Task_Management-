export interface TeamMember {
    id: string;
    name: string;
    role: 'Admin' | 'Team Member';
    isAdmin: boolean;
    color: string;
    accentBg: string;
    accentText: string;
    accentBorder: string;
}

export const GRAPHIONIC_TEAM_MEMBERS: TeamMember[] = [
    {
        id: 'mayank',
        name: 'Mayank',
        role: 'Admin',
        isAdmin: true,
        color: '#0ea5e9',
        accentBg: 'rgba(14, 165, 233, 0.15)',
        accentText: '#38bdf8',
        accentBorder: 'rgba(14, 165, 233, 0.4)',
    },
    {
        id: 'rudra',
        name: 'Rudra',
        role: 'Team Member',
        isAdmin: false,
        color: '#6366f1',
        accentBg: 'rgba(99, 102, 241, 0.15)',
        accentText: '#818cf8',
        accentBorder: 'rgba(99, 102, 241, 0.4)',
    },
    {
        id: 'lay',
        name: 'Lay',
        role: 'Team Member',
        isAdmin: false,
        color: '#a855f7',
        accentBg: 'rgba(168, 85, 247, 0.15)',
        accentText: '#c084fc',
        accentBorder: 'rgba(168, 85, 247, 0.4)',
    },
    {
        id: 'vedant',
        name: 'Vedant',
        role: 'Team Member',
        isAdmin: false,
        color: '#10b981',
        accentBg: 'rgba(16, 185, 129, 0.15)',
        accentText: '#34d399',
        accentBorder: 'rgba(16, 185, 129, 0.4)',
    },
    {
        id: 'bhumi',
        name: 'Bhumi',
        role: 'Team Member',
        isAdmin: false,
        color: '#f43f5e',
        accentBg: 'rgba(244, 63, 94, 0.15)',
        accentText: '#fb7185',
        accentBorder: 'rgba(244, 63, 94, 0.4)',
    },
];

export const DEFAULT_ASSIGNER = 'Mayank';

export function getTeamMember(name?: string | null): TeamMember | undefined {
    if (!name) return undefined;
    const lower = name.trim().toLowerCase();
    return GRAPHIONIC_TEAM_MEMBERS.find(
        (m) => m.name.toLowerCase() === lower || m.id === lower
    );
}

export function isTeamAdmin(name?: string | null): boolean {
    if (!name) return false;
    return getTeamMember(name)?.isAdmin === true;
}
