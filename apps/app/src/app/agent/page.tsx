'use client';

import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bot, Loader2, Send, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getSupabaseClient } from '@/lib/supabase';
import { Badge } from '@/components/ui/Badge';

type AgentMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    model?: string | null;
    timestamp: string;
};

type RuntimeStatus = {
    models?: Record<
        string,
        {
            name?: string;
            latency?: number;
            status?: 'online' | 'offline' | 'checking';
        }
    >;
};

const quickActions = [
    'Show my pending callback queue and tell me who I should call first.',
    'Summarize the latest buyer requirements from my WhatsApp data.',
    'Draft a follow-up for a 2BHK rental lead in Powai.',
    'What inventory should I pitch for a buyer in Bandra under 4 Cr?',
];

export default function AgentPage() {
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
    const [messages, setMessages] = useState<AgentMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: 'Ask in plain language. Pulse can help draft replies, summarize activity, and reason over your operating data.',
            timestamp: new Date().toISOString(),
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [runtimeLoading, setRuntimeLoading] = useState(true);
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

    const loadRuntime = async () => {
        setRuntimeLoading(true);
        try {
            const res = await apiFetch('/api/ai/status');
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || 'Failed to load runtime status');
            }
            setRuntime(data);
        } catch (err: any) {
            setError(err?.message || 'Failed to load runtime status');
        } finally {
            setRuntimeLoading(false);
        }
    };

    useEffect(() => {
        if (!ready) return;
        void loadRuntime();
    }, [ready]);

    const runtimeCards = useMemo(() => Object.entries(runtime?.models || {}), [runtime]);

    const sendPrompt = async (prompt: string) => {
        const value = prompt.trim();
        if (!value || loading) return;

        const nextUserMessage: AgentMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: value,
            timestamp: new Date().toISOString(),
        };

        setMessages((current) => [...current, nextUserMessage]);
        setInput('');
        setLoading(true);
        setError('');

        try {
            const res = await apiFetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: value, modelPreference: 'Auto' }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || 'Pulse could not answer that prompt');
            }

            setMessages((current) => [
                ...current,
                {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: data?.text || 'No response returned.',
                    model: data?.model || null,
                    timestamp: new Date().toISOString(),
                },
            ]);
        } catch (err: any) {
            setError(err?.message || 'Pulse could not answer that prompt');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        await sendPrompt(input);
    };

    if (!ready) {
        return <div className="flex min-h-screen items-center justify-center bg-black text-sm text-gray-400">Checking session…</div>;
    }

    return (
        <main className="min-h-screen bg-black px-4 py-6 text-white md:px-8">
            <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
                <aside className="space-y-4 rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Agent</p>
                            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Pulse operator</h1>
                            <p className="mt-2 text-sm leading-6 text-gray-400">Recovered route with live AI runtime and direct prompt execution.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => router.push('/dashboard')}
                            className="rounded-full border border-white/10 bg-white/5 p-3 text-gray-300 transition hover:bg-white/10 hover:text-white"
                            aria-label="Back to dashboard"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-white">Runtime</h2>
                            <button
                                type="button"
                                onClick={() => void loadRuntime()}
                                className="text-xs text-cyan-300 transition hover:text-cyan-200"
                            >
                                Refresh
                            </button>
                        </div>
                        {runtimeLoading ? (
                            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-400">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Checking providers
                            </div>
                        ) : null}
                        {runtimeCards.map(([provider, model]) => (
                            <div key={provider} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-white">{provider}</p>
                                        <p className="mt-1 text-xs text-gray-400">{model?.name || 'Unnamed model'}</p>
                                    </div>
                                        <Badge variant={model?.status === 'online' ? 'connected' : 'disconnected'}>
                                        {model?.status || 'unknown'}
                                    </Badge>
                                </div>
                                <p className="mt-3 text-xs text-gray-500">
                                    {typeof model?.latency === 'number' && model.latency >= 0
                                        ? `${model.latency} ms latency`
                                        : 'Latency unavailable'}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-sm font-semibold text-white">Quick actions</h2>
                        {quickActions.map((prompt) => (
                            <button
                                key={prompt}
                                type="button"
                                onClick={() => void sendPrompt(prompt)}
                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                </aside>

                <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
                    <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300">
                                <Bot className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-white">Conversation</h2>
                                <p className="text-sm text-gray-400">Direct chat against the restored `/api/ai/chat` endpoint.</p>
                            </div>
                        </div>
                        <Badge variant="processing">{messages.length - 1} messages</Badge>
                    </div>

                    <div className="mt-5 space-y-4">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-3xl rounded-3xl px-4 py-3 text-sm leading-6 ${
                                        message.role === 'user'
                                            ? 'bg-cyan-500 text-black'
                                            : 'border border-white/10 bg-white/5 text-gray-100'
                                    }`}
                                >
                                    <div className="whitespace-pre-wrap">{message.content}</div>
                                    <div className="mt-2 flex items-center gap-2 text-[11px] opacity-70">
                                        <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                                        {message.model ? <span>• {message.model}</span> : null}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {loading ? (
                            <div className="flex justify-start">
                                <div className="flex items-center gap-2 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Pulse is thinking
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {error ? (
                        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                            {error}
                        </div>
                    ) : null}

                    <form onSubmit={handleSubmit} className="mt-5 flex gap-3">
                        <textarea
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            placeholder="Ask Pulse anything about leads, callbacks, inventory, or a draft reply…"
                            className="min-h-[72px] flex-1 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-cyan-400"
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-3xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Send
                        </button>
                    </form>

                    <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                        <Sparkles className="h-3.5 w-3.5" />
                        This route was rewired from a redirect shell and now hits the live AI backend again.
                    </div>
                </section>
            </div>
        </main>
    );
}
