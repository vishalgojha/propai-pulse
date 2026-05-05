'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Plus, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getSupabaseClient } from '@/lib/supabase';
import { Badge } from '@/components/ui/Badge';

type WorkspaceSummary = {
    ownerId: string;
    ownerEmail?: string | null;
    ownerName?: string | null;
    memberRole: string;
    canManageTeam: boolean;
    canSendOutbound?: boolean;
};

type WorkspaceMember = {
    id: string;
    email: string;
    fullName?: string | null;
    phone?: string | null;
    role: string;
    status: string;
    invitedAt?: string | null;
    lastActiveAt?: string | null;
};

type WorkspaceActivity = {
    id: string;
    actor_email?: string | null;
    event_type: string;
    summary: string;
    created_at: string;
};

export default function TeamPage() {
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
    const [members, setMembers] = useState<WorkspaceMember[]>([]);
    const [activity, setActivity] = useState<WorkspaceActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        email: '',
        fullName: '',
        phone: '',
        role: 'realtor',
    });

    useEffect(() => {
        const init = async () => {
            const supabase = getSupabaseClient();
            if (!supabase) {
                router.replace('/login');
                return;
            }

            const { data } = await supabase.auth.getUser();
            if (!data.user) {
                router.replace('/login');
                return;
            }

            setReady(true);
        };

        void init();
    }, [router]);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [teamRes, activityRes] = await Promise.all([
                apiFetch('/api/workspace/team'),
                apiFetch('/api/workspace/activity'),
            ]);
            const teamData = await teamRes.json().catch(() => ({}));
            const activityData = await activityRes.json().catch(() => ({}));

            if (!teamRes.ok) {
                throw new Error(teamData?.error || 'Failed to load team');
            }
            if (!activityRes.ok) {
                throw new Error(activityData?.error || 'Failed to load workspace activity');
            }

            setWorkspace(teamData?.workspace || null);
            setMembers(Array.isArray(teamData?.members) ? teamData.members : []);
            setActivity(Array.isArray(activityData?.activity) ? activityData.activity : []);
        } catch (err: any) {
            setError(err?.message || 'Failed to load team');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!ready) return;
        void loadData();
    }, [ready]);

    const addMember = async () => {
        if (!workspace?.canManageTeam || !form.email.trim()) return;

        setSaving(true);
        setError('');
        try {
            const res = await apiFetch('/api/workspace/team', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || 'Failed to add team member');
            }
            setForm({ email: '', fullName: '', phone: '', role: 'realtor' });
            await loadData();
        } catch (err: any) {
            setError(err?.message || 'Failed to add team member');
        } finally {
            setSaving(false);
        }
    };

    if (!ready) {
        return <div className="flex min-h-screen items-center justify-center bg-black text-sm text-gray-400">Checking session…</div>;
    }

    return (
        <main className="min-h-screen bg-black px-4 py-6 text-white md:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
                <header className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <button
                            type="button"
                            onClick={() => router.push('/dashboard')}
                            className="rounded-full border border-white/10 bg-white/5 p-3 text-gray-300 transition hover:bg-white/10 hover:text-white"
                            aria-label="Back to dashboard"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Team</p>
                            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Workspace members</h1>
                            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
                                Restored team management against the recovered workspace API surface.
                            </p>
                        </div>
                    </div>
                    <Badge variant="processing">{members.length + 1} seats</Badge>
                </header>

                {error ? (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {error}
                    </div>
                ) : null}

                <section className="grid gap-4 md:grid-cols-3">
                    <SummaryCard label="Workspace owner" value={workspace?.ownerName || workspace?.ownerEmail || 'Workspace'} />
                    <SummaryCard label="Your role" value={workspace?.memberRole || 'owner'} />
                    <SummaryCard label="Access" value={workspace?.canManageTeam ? 'Can manage team' : workspace?.canSendOutbound ? 'Outbound access' : 'Read only'} />
                </section>

                <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
                    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300">
                                <Plus className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Add member</h2>
                                <p className="text-sm text-gray-400">Invite a realtor, ops teammate, or internal admin.</p>
                            </div>
                        </div>

                        <div className="mt-5 space-y-3">
                            <input
                                value={form.email}
                                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                                placeholder="Email address"
                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
                            />
                            <input
                                value={form.fullName}
                                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                                placeholder="Full name"
                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
                            />
                            <input
                                value={form.phone}
                                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                                placeholder="Phone number"
                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
                            />
                            <select
                                value={form.role}
                                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
                            >
                                <option value="realtor">Realtor</option>
                                <option value="ops">Ops</option>
                                <option value="admin">Admin</option>
                                <option value="viewer">Viewer</option>
                            </select>
                            <button
                                type="button"
                                onClick={() => void addMember()}
                                disabled={!workspace?.canManageTeam || saving || !form.email.trim()}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Invite member
                            </button>
                        </div>
                    </section>

                    <section className="space-y-6">
                        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                            <div className="mb-4 flex items-center gap-3">
                                <Users className="h-5 w-5 text-cyan-300" />
                                <h2 className="text-lg font-semibold text-white">Members</h2>
                            </div>
                            <div className="space-y-3">
                                {loading ? (
                                    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-400">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading team
                                    </div>
                                ) : null}
                                {members.map((member) => (
                                    <div key={member.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-medium text-white">{member.fullName || member.email}</p>
                                                <p className="mt-1 text-xs text-gray-400">{member.email}</p>
                                            </div>
                                            <Badge variant={member.status === 'active' ? 'connected' : 'medium'}>
                                                {member.status}
                                            </Badge>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                                            <span>Role: {member.role}</span>
                                            {member.phone ? <span>{member.phone}</span> : null}
                                            {member.lastActiveAt ? <span>Last active: {new Date(member.lastActiveAt).toLocaleString()}</span> : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                            <h2 className="text-lg font-semibold text-white">Recent activity</h2>
                            <div className="mt-4 space-y-3">
                                {activity.map((entry) => (
                                    <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                        <p className="text-sm text-white">{entry.summary}</p>
                                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                                            <span>{entry.actor_email || entry.event_type}</span>
                                            <span>{new Date(entry.created_at).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">{label}</p>
            <p className="mt-4 text-xl font-semibold tracking-tight text-white">{value}</p>
        </div>
    );
}
