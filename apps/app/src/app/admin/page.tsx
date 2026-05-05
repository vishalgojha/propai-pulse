'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Shield, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getSupabaseClient } from '@/lib/supabase';
import { Badge } from '@/components/ui/Badge';

type WorkspaceRecord = {
    id: string;
    email: string;
    fullName?: string | null;
    subscription?: {
        plan?: string | null;
        status?: string | null;
    };
    whatsapp?: {
        connectedSessions?: number;
        messagesParsed24h?: number;
    };
};

type AdminSummary = {
    totalWorkspaces: number;
    trialWorkspaces: number;
    connectedWorkspaces: number;
    messagesParsed24h: number;
};

export default function AdminPage() {
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const [summary, setSummary] = useState<AdminSummary>({
        totalWorkspaces: 0,
        trialWorkspaces: 0,
        connectedWorkspaces: 0,
        messagesParsed24h: 0,
    });
    const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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
            const res = await apiFetch('/api/admin/workspaces?page=1&limit=20');
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || 'Failed to load admin workspace list');
            }
            setSummary(data?.summary || summary);
            setWorkspaces(Array.isArray(data?.workspaces) ? data.workspaces : []);
        } catch (err: any) {
            setError(err?.message || 'Failed to load admin workspace list');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!ready) return;
        void loadData();
    }, [ready]);

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
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Admin</p>
                            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Workspace control plane</h1>
                            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
                                Restored admin route backed by the recovered `/api/admin` surface.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => void loadData()}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/10"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                        Refresh
                    </button>
                </header>

                {error ? (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {error}
                    </div>
                ) : null}

                <section className="grid gap-4 md:grid-cols-4">
                    <AdminMetric label="Workspaces" value={String(summary.totalWorkspaces)} />
                    <AdminMetric label="Trials" value={String(summary.trialWorkspaces)} />
                    <AdminMetric label="Connected" value={String(summary.connectedWorkspaces)} />
                    <AdminMetric label="Parsed 24h" value={String(summary.messagesParsed24h)} />
                </section>

                <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <div className="mb-5 flex items-center gap-3">
                        <Users className="h-5 w-5 text-cyan-300" />
                        <h2 className="text-lg font-semibold text-white">Recent workspaces</h2>
                    </div>
                    <div className="space-y-3">
                        {loading ? (
                            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-400">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading workspaces
                            </div>
                        ) : null}
                        {workspaces.map((workspace) => (
                            <div key={workspace.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-white">{workspace.fullName || workspace.email}</p>
                                        <p className="mt-1 text-xs text-gray-400">{workspace.email}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Badge variant="medium">{workspace.subscription?.plan || 'No plan'}</Badge>
                                        <Badge variant={workspace.subscription?.status === 'active' ? 'connected' : 'processing'}>
                                            {workspace.subscription?.status || 'unknown'}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                                    <span>Sessions: {workspace.whatsapp?.connectedSessions || 0}</span>
                                    <span>Parsed 24h: {workspace.whatsapp?.messagesParsed24h || 0}</span>
                                    <span>ID: {workspace.id}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}

function AdminMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">{label}</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-white">{value}</p>
        </div>
    );
}
