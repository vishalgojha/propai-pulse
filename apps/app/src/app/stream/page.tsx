'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, Building2, Loader2, RefreshCw, Waves } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getSupabaseClient } from '@/lib/supabase';
import { buildSavedLogStream, type MessageLogEntry } from '@/lib/messageLogFallback';
import { Badge } from '@/components/ui/Badge';

type StreamItem = ReturnType<typeof buildSavedLogStream>[number];

export default function StreamPage() {
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const [items, setItems] = useState<StreamItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [mode, setMode] = useState('message_feed');

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

    const loadFeed = async () => {
        setLoading(true);
        setError('');
        try {
            const mirrorRes = await apiFetch('/api/intelligence/mirror?hours=24&limit=40');
            const mirrorData = await mirrorRes.json().catch(() => ({}));
            if (mirrorRes.ok && Array.isArray(mirrorData?.items) && mirrorData.items.length > 0) {
                setItems(mirrorData.items as StreamItem[]);
                setMode(mirrorData?.mode || 'parsed_only');
                return;
            }

            const messagesRes = await apiFetch('/api/whatsapp/messages');
            const messagesData = await messagesRes.json().catch(() => []);
            if (!messagesRes.ok) {
                throw new Error(mirrorData?.error || 'Failed to load stream feed');
            }
            setItems(buildSavedLogStream(Array.isArray(messagesData) ? (messagesData as MessageLogEntry[]) : [], 40));
            setMode('message_feed');
        } catch (err: any) {
            setError(err?.message || 'Failed to load stream feed');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!ready) return;
        void loadFeed();
    }, [ready]);

    const stats = useMemo(
        () => ({
            total: items.length,
            sale: items.filter((item) => item.price_type !== 'monthly').length,
            rental: items.filter((item) => item.price_type === 'monthly').length,
        }),
        [items],
    );

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
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Stream</p>
                            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Parsed feed and market pulse</h1>
                            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
                                This route is wired back to the canonical mirror feed with a WhatsApp message fallback when parsing is sparse.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => void loadFeed()}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/10"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </header>

                <section className="grid gap-4 md:grid-cols-3">
                    <StreamMetric label="Fresh items" value={String(stats.total)} icon={<Waves className="h-4 w-4" />} />
                    <StreamMetric label="Sale signals" value={String(stats.sale)} icon={<Building2 className="h-4 w-4" />} />
                    <StreamMetric label="Rental signals" value={String(stats.rental)} icon={<BarChart3 className="h-4 w-4" />} />
                </section>

                <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Feed</p>
                            <h2 className="mt-2 text-xl font-semibold">Last 24 hours</h2>
                        </div>
                        <Badge variant={mode === 'message_feed' ? 'medium' : 'processing'}>{mode}</Badge>
                    </div>

                    {error ? (
                        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                            {error}
                        </div>
                    ) : null}

                    <div className="space-y-3">
                        {loading ? (
                            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-400">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading stream
                            </div>
                        ) : null}
                        {items.map((item) => (
                            <div key={item.source_message_id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-white">{item.title || item.source_group_name || 'Feed item'}</p>
                                        <p className="mt-1 text-xs text-gray-400">{item.location || item.area || item.source_group_name || 'Unknown source'}</p>
                                    </div>
                                    <Badge variant="processing">
                                        {item.price_type === 'monthly' ? 'rental' : item.listing_type || 'signal'}
                                    </Badge>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-gray-200">{item.description || 'No description available.'}</p>
                                <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                                    {item.price != null ? <span>₹{Math.round(item.price).toLocaleString('en-IN')}</span> : null}
                                    <span>{new Date(item.message_timestamp || item.created_at || Date.now()).toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}

function StreamMetric({
    label,
    value,
    icon,
}: {
    label: string;
    value: string;
    icon: ReactNode;
}) {
    return (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">{label}</p>
                <div className="text-cyan-300">{icon}</div>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-white">{value}</p>
        </div>
    );
}
