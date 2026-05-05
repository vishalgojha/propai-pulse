'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, MessageSquare, RefreshCw, Search, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getSupabaseClient } from '@/lib/supabase';
import { Badge } from '@/components/ui/Badge';

type MessageRow = {
    id: string;
    remote_jid: string;
    sender?: string | null;
    message_text?: string | null;
    text?: string | null;
    timestamp?: string | null;
    created_at?: string | null;
};

type ChatSummary = {
    id: string;
    title: string;
    preview: string;
    isGroup: boolean;
    lastMessageAt: string;
    count: number;
};

function normalizeText(message: MessageRow) {
    return String(message.message_text || message.text || '').trim();
}

function formatStamp(value?: string | null) {
    if (!value) return 'Unknown time';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown time';
    return date.toLocaleString();
}

function labelFromJid(remoteJid: string, sender?: string | null) {
    if (remoteJid.endsWith('@g.us')) return sender?.trim() || remoteJid.replace('@g.us', '');
    const phone = remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '');
    return phone ? `+${phone}` : remoteJid;
}

export default function MonitorPage() {
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const [messages, setMessages] = useState<MessageRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [selectedChatId, setSelectedChatId] = useState('');

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

    const loadMessages = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch('/api/whatsapp/messages');
            const data = await res.json().catch(() => []);
            if (!res.ok) {
                throw new Error(data?.error || 'Failed to load WhatsApp messages');
            }
            const rows = Array.isArray(data) ? data.filter((row): row is MessageRow => Boolean(row?.remote_jid)) : [];
            setMessages(rows);
            if (!selectedChatId && rows[0]?.remote_jid) {
                setSelectedChatId(rows[0].remote_jid);
            }
        } catch (err: any) {
            setError(err?.message || 'Failed to load WhatsApp messages');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!ready) return;
        void loadMessages();
    }, [ready]);

    const chats = useMemo(() => {
        const map = new Map<string, ChatSummary>();
        for (const row of messages) {
            const id = row.remote_jid;
            const preview = normalizeText(row);
            const timestamp = row.timestamp || row.created_at || new Date().toISOString();
            const existing = map.get(id);
            if (!existing) {
                map.set(id, {
                    id,
                    title: labelFromJid(id, row.sender),
                    preview,
                    isGroup: id.endsWith('@g.us'),
                    lastMessageAt: timestamp,
                    count: 1,
                });
                continue;
            }

            existing.count += 1;
            if (new Date(timestamp).getTime() >= new Date(existing.lastMessageAt).getTime()) {
                existing.preview = preview;
                existing.lastMessageAt = timestamp;
                existing.title = labelFromJid(id, row.sender);
            }
        }

        const filtered = Array.from(map.values())
            .sort((left, right) => new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime())
            .filter((chat) => {
                const haystack = `${chat.title} ${chat.preview}`.toLowerCase();
                return haystack.includes(search.trim().toLowerCase());
            });

        return filtered;
    }, [messages, search]);

    const activeChat = selectedChatId || chats[0]?.id || '';

    const activeMessages = useMemo(
        () =>
            messages
                .filter((message) => message.remote_jid === activeChat)
                .sort(
                    (left, right) =>
                        new Date(left.timestamp || left.created_at || 0).getTime() -
                        new Date(right.timestamp || right.created_at || 0).getTime(),
                ),
        [activeChat, messages],
    );

    useEffect(() => {
        if (!selectedChatId && chats[0]?.id) {
            setSelectedChatId(chats[0].id);
        }
    }, [chats, selectedChatId]);

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
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Monitor</p>
                            <h1 className="mt-2 text-3xl font-semibold tracking-tight">WhatsApp live monitor</h1>
                            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
                                Restored from the removed route shell. This view reads the live saved-message feed and gives you direct chat-level inspection again.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => void loadMessages()}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/10"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </header>

                <section className="grid gap-4 md:grid-cols-3">
                    <MetricCard label="Chats" value={String(chats.length)} icon={<Users className="h-4 w-4" />} />
                    <MetricCard label="Messages" value={String(messages.length)} icon={<MessageSquare className="h-4 w-4" />} />
                    <MetricCard
                        label="Groups"
                        value={String(chats.filter((chat) => chat.isGroup).length)}
                        icon={<Badge variant="processing">group feed</Badge>}
                    />
                </section>

                <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <Search className="h-4 w-4 text-gray-500" />
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search chat or message preview"
                                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                            />
                        </div>

                        {error ? (
                            <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                {error}
                            </div>
                        ) : null}

                        <div className="mt-4 space-y-3">
                            {loading ? (
                                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-400">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading chats
                                </div>
                            ) : null}
                            {chats.map((chat) => (
                                <button
                                    key={chat.id}
                                    type="button"
                                    onClick={() => setSelectedChatId(chat.id)}
                                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                                        activeChat === chat.id
                                            ? 'border-cyan-400 bg-cyan-400/10'
                                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-white">{chat.title}</p>
                                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-400">{chat.preview || 'No message body'}</p>
                                        </div>
                                        <Badge variant={chat.isGroup ? 'processing' : 'medium'}>
                                            {chat.isGroup ? 'group' : 'direct'}
                                        </Badge>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
                                        <span>{chat.count} messages</span>
                                        <span>{formatStamp(chat.lastMessageAt)}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                        <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Conversation</p>
                                <h2 className="mt-2 text-xl font-semibold">{chats.find((chat) => chat.id === activeChat)?.title || 'Select a chat'}</h2>
                            </div>
                            {activeChat ? <Badge variant="processing">{activeMessages.length} entries</Badge> : null}
                        </div>

                        <div className="space-y-3">
                            {activeMessages.length === 0 ? (
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-gray-400">
                                    Pick a chat to inspect its message flow.
                                </div>
                            ) : null}

                            {activeMessages.map((message) => (
                                <div key={message.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                    <div className="flex items-center justify-between gap-3 text-[11px] text-gray-500">
                                        <span>{message.sender || 'Unknown sender'}</span>
                                        <span>{formatStamp(message.timestamp || message.created_at)}</span>
                                    </div>
                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-100">
                                        {normalizeText(message) || 'No message body'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}

function MetricCard({
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
