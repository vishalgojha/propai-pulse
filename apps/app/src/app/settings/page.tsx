'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Building2,
    CheckCircle2,
    Copy,
    Loader2,
    MapPin,
    Phone,
    PlugZap,
    RotateCcw,
    Save,
    Trash2,
    UserRound,
    XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { apiFetch } from '@/lib/api';

const PROVIDERS = [
    { id: 'Local', name: 'Ollama (Local)', description: 'Run models locally on your machine' },
    { id: 'Google', name: 'Google Gemini', description: 'Advanced models from Google' },
    { id: 'Anthropic', name: 'Anthropic Claude', description: 'High-reasoning models from Anthropic' },
    { id: 'OpenAI', name: 'OpenAI GPT', description: 'Industry standard models from OpenAI' },
    { id: 'Groq', name: 'Groq', description: 'Ultra-fast inference' },
    { id: 'OpenRouter', name: 'OpenRouter', description: 'Unified API for all models' },
];

type ProfileState = {
    full_name: string;
    agency_name: string;
    city: string;
    primary_phone: string;
};

function normalizePhone(value: string) {
    return value.replace(/\D/g, '').slice(0, 10);
}

export default function SettingsPage() {
    const router = useRouter();
    const [keys, setKeys] = useState<Record<string, string>>({});
    const [status, setStatus] = useState<Record<string, 'idle' | 'testing' | 'success' | 'error'>>({});
    const [saving, setSaving] = useState(false);

    const [profile, setProfile] = useState<ProfileState>({
        full_name: '',
        agency_name: '',
        city: '',
        primary_phone: '',
    });
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileMessage, setProfileMessage] = useState<string | null>(null);
    const [profileError, setProfileError] = useState<string | null>(null);

    const [mcpToken, setMcpToken] = useState<string | null>(null);
    const [mcpEndpoint, setMcpEndpoint] = useState('https://mcp.propai.live/mcp');
    const [mcpUpdatedAt, setMcpUpdatedAt] = useState<string | null>(null);
    const [mcpRetrievable, setMcpRetrievable] = useState(true);
    const [mcpStatus, setMcpStatus] = useState<'idle' | 'loading' | 'generating' | 'revoking'>('loading');
    const [mcpMessage, setMcpMessage] = useState<string | null>(null);
    const [copyState, setCopyState] = useState<'idle' | 'done'>('idle');

    const readErrorMessage = async (res: Response, fallback: string) => {
        try {
            const data = await res.json();
            return data?.error || data?.message || fallback;
        } catch {
            return fallback;
        }
    };

    const loadProfile = async () => {
        setProfileLoading(true);
        setProfileError(null);

        try {
            const res = await apiFetch('/api/profile');
            if (!res.ok) {
                throw new Error(await readErrorMessage(res, 'Failed to load broker profile'));
            }

            const data = await res.json();
            setProfile({
                full_name: data?.profile?.full_name || '',
                agency_name: data?.profile?.agency_name || '',
                city: data?.profile?.city || '',
                primary_phone: data?.profile?.primary_phone || '',
            });
        } catch (e: any) {
            setProfileError(e?.message || 'Failed to load broker profile');
        } finally {
            setProfileLoading(false);
        }
    };

    const saveProfile = async () => {
        setProfileSaving(true);
        setProfileError(null);
        setProfileMessage(null);

        try {
            const res = await apiFetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: profile.full_name.trim() || null,
                    agency_name: profile.agency_name.trim() || null,
                    city: profile.city.trim() || null,
                    primary_phone: normalizePhone(profile.primary_phone),
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || 'Failed to save broker profile');
            }

            setProfile({
                full_name: data?.profile?.full_name || profile.full_name,
                agency_name: data?.profile?.agency_name || profile.agency_name,
                city: data?.profile?.city || profile.city,
                primary_phone: data?.profile?.primary_phone || normalizePhone(profile.primary_phone),
            });
            setProfileMessage('Broker profile saved.');
        } catch (e: any) {
            setProfileError(e?.message || 'Failed to save broker profile');
        } finally {
            setProfileSaving(false);
        }
    };

    const profileComplete = Boolean(profile.full_name.trim() && normalizePhone(profile.primary_phone).length === 10);

    const handleKeyChange = (provider: string, value: string) => {
        setKeys((prev) => ({ ...prev, [provider]: value }));
    };

    const testConnection = async (provider: string) => {
        setStatus((prev) => ({ ...prev, [provider]: 'testing' }));
        try {
            const res = await apiFetch('/api/ai/keys/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider }),
            });
            if (!res.ok) throw new Error(await readErrorMessage(res, 'Connection failed'));
            setStatus((prev) => ({ ...prev, [provider]: 'success' }));
        } catch {
            setStatus((prev) => ({ ...prev, [provider]: 'error' }));
        }
    };

    const saveAllKeys = async () => {
        setSaving(true);
        try {
            const entries = Object.entries(keys).filter(([, key]) => key.trim().length > 0);
            await Promise.all(entries.map(async ([provider, key]) => {
                const res = await apiFetch('/api/ai/keys', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ provider, key }),
                });
                if (!res.ok) {
                    throw new Error(await readErrorMessage(res, `Failed to save ${provider} key`));
                }
            }));
            alert('All keys saved successfully!');
        } catch (e: any) {
            alert(e?.message || 'Error saving keys');
        } finally {
            setSaving(false);
        }
    };

    const loadMcpToken = async () => {
        setMcpStatus('loading');
        setMcpMessage(null);
        try {
            const res = await apiFetch('/api/auth/mcp-token');
            if (!res.ok) {
                throw new Error(await readErrorMessage(res, 'Failed to load connector token'));
            }

            const data = await res.json();
            setMcpToken(data?.token || null);
            setMcpEndpoint(data?.endpoint || 'https://mcp.propai.live/mcp');
            setMcpUpdatedAt(data?.updated_at || null);
            setMcpRetrievable(data?.retrievable !== false);
        } catch (e: any) {
            setMcpMessage(e?.message || 'Failed to load connector token');
        } finally {
            setMcpStatus('idle');
        }
    };

    useEffect(() => {
        void loadProfile();
        void loadMcpToken();
    }, []);

    const createOrLoadMcpToken = async (regenerate = false) => {
        setMcpStatus('generating');
        setMcpMessage(null);
        try {
            const res = await apiFetch('/api/auth/mcp-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ regenerate }),
            });

            if (!res.ok) {
                throw new Error(await readErrorMessage(
                    res,
                    regenerate ? 'Failed to regenerate connector token' : 'Failed to generate connector token'
                ));
            }

            const data = await res.json();
            setMcpToken(data?.token || null);
            setMcpEndpoint(data?.endpoint || 'https://mcp.propai.live/mcp');
            setMcpUpdatedAt(data?.updated_at || new Date().toISOString());
            setMcpRetrievable(data?.retrievable !== false);
            setMcpMessage(regenerate ? 'Connector token regenerated.' : data?.reused ? 'Existing connector token loaded.' : 'Connector token ready.');
        } catch (e: any) {
            setMcpMessage(e?.message || 'Failed to generate connector token');
        } finally {
            setMcpStatus('idle');
        }
    };

    const revokeMcpToken = async () => {
        setMcpStatus('revoking');
        setMcpMessage(null);
        try {
            const res = await apiFetch('/api/auth/mcp-token', { method: 'DELETE' });
            if (!res.ok) {
                throw new Error(await readErrorMessage(res, 'Failed to revoke connector token'));
            }
            setMcpToken(null);
            setMcpUpdatedAt(null);
            setMcpRetrievable(true);
            setMcpMessage('Connector token revoked.');
        } catch (e: any) {
            setMcpMessage(e?.message || 'Failed to revoke connector token');
        } finally {
            setMcpStatus('idle');
        }
    };

    const copyMcpToken = async () => {
        if (!mcpToken) return;
        await navigator.clipboard.writeText(mcpToken);
        setCopyState('done');
        window.setTimeout(() => setCopyState('idle'), 1600);
    };

    const maskedMcpToken = mcpToken ? `${mcpToken.slice(0, 16)}...${mcpToken.slice(-8)}` : '';
    const connectorReady = Boolean(mcpToken);

    return (
        <div className="mx-auto max-w-5xl p-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Settings</h1>
                    <p className="text-sm text-gray-400">Broker identity, AI keys, and connector access.</p>
                </div>
                <button
                    onClick={saveAllKeys}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save All Keys
                </button>
            </div>

            <motion.section
                className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <div className="mb-2 flex items-center gap-2">
                            <h2 className="text-lg font-semibold text-white">Broker Profile</h2>
                            <Badge variant={profileComplete ? 'connected' : 'disconnected'}>
                                {profileComplete ? 'Ready' : 'Incomplete'}
                            </Badge>
                        </div>
                        <p className="max-w-2xl text-sm text-emerald-50/80">
                            Save your broker identity once here. WhatsApp connect and agent routing should use this record instead of asking for the number on every login.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => router.push('/whatsapp')}
                        className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                    >
                        Open WhatsApp setup
                    </button>
                </div>

                {profileLoading ? (
                    <div className="mt-5 flex items-center gap-2 text-sm text-emerald-100/80">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading broker profile...
                    </div>
                ) : (
                    <>
                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <ProfileField
                                label="Full name"
                                icon={<UserRound className="h-4 w-4" />}
                                value={profile.full_name}
                                onChange={(value) => setProfile((current) => ({ ...current, full_name: value }))}
                                placeholder="Vishal Ojha"
                            />
                            <ProfileField
                                label="WhatsApp number"
                                icon={<Phone className="h-4 w-4" />}
                                value={profile.primary_phone}
                                onChange={(value) => setProfile((current) => ({ ...current, primary_phone: normalizePhone(value) }))}
                                placeholder="9876543210"
                            />
                            <ProfileField
                                label="Agency"
                                icon={<Building2 className="h-4 w-4" />}
                                value={profile.agency_name}
                                onChange={(value) => setProfile((current) => ({ ...current, agency_name: value }))}
                                placeholder="PropAI Realty"
                            />
                            <ProfileField
                                label="City"
                                icon={<MapPin className="h-4 w-4" />}
                                value={profile.city}
                                onChange={(value) => setProfile((current) => ({ ...current, city: value }))}
                                placeholder="Mumbai"
                            />
                        </div>

                        {profileError ? (
                            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{profileError}</p>
                        ) : null}
                        {profileMessage ? (
                            <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{profileMessage}</p>
                        ) : null}

                        <div className="mt-5 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => void saveProfile()}
                                disabled={profileSaving || !profile.full_name.trim() || normalizePhone(profile.primary_phone).length !== 10}
                                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save broker profile
                            </button>
                        </div>
                    </>
                )}
            </motion.section>

            <motion.section
                className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 shadow-lg shadow-green-500/20">
                            <PlugZap className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <div className="mb-2 flex items-center gap-2">
                                <h2 className="text-lg font-semibold text-white">Connect to AI Assistant</h2>
                                <Badge variant="connected">Connector</Badge>
                            </div>
                            <p className="text-sm text-emerald-50/80">
                                Generate a PropAI MCP bearer token for Claude or ChatGPT custom connectors.
                            </p>
                            <p className="mt-2 text-xs text-emerald-200/80">
                                Endpoint: <span className="font-mono text-emerald-100">{mcpEndpoint}</span>
                            </p>
                            {mcpUpdatedAt ? (
                                <p className="mt-1 text-xs text-emerald-200/70">
                                    Last issued: {new Date(mcpUpdatedAt).toLocaleString()}
                                </p>
                            ) : null}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {!connectorReady ? (
                            <button
                                onClick={() => void createOrLoadMcpToken(false)}
                                disabled={mcpStatus !== 'idle'}
                                className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition-all hover:bg-emerald-400 disabled:opacity-60"
                            >
                                {mcpStatus === 'generating' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                                Generate Token
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => void createOrLoadMcpToken(true)}
                                    disabled={mcpStatus !== 'idle'}
                                    className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-white/20 disabled:opacity-60"
                                >
                                    {mcpStatus === 'generating' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                                    Regenerate
                                </button>
                                <button
                                    onClick={() => void revokeMcpToken()}
                                    disabled={mcpStatus !== 'idle'}
                                    className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition-all hover:bg-red-500/20 disabled:opacity-60"
                                >
                                    {mcpStatus === 'revoking' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    Revoke
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/40 p-4">
                    {mcpStatus === 'loading' ? (
                        <div className="flex items-center gap-2 text-sm text-emerald-100/80">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading connector token...
                        </div>
                    ) : connectorReady ? (
                        <div className="space-y-4">
                            <div>
                                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-emerald-300">Bearer Token</p>
                                <div className="flex flex-col gap-3 md:flex-row">
                                    <input
                                        type="text"
                                        readOnly
                                        value={mcpToken ?? ''}
                                        className="flex-1 rounded-lg border border-emerald-500/20 bg-black/30 px-3 py-3 font-mono text-sm text-emerald-50 focus:outline-none"
                                    />
                                    <button
                                        onClick={() => void copyMcpToken()}
                                        className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-medium text-slate-950 transition-all hover:bg-emerald-400"
                                    >
                                        <Copy className="h-4 w-4" />
                                        {copyState === 'done' ? 'Copied' : 'Copy Token'}
                                    </button>
                                </div>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                    <p className="mb-1 text-sm font-semibold text-white">Claude</p>
                                    <p className="text-xs text-gray-300">Custom connector URL: <span className="font-mono text-emerald-200">{mcpEndpoint}</span></p>
                                    <p className="mt-1 text-xs text-gray-300">Header: <span className="font-mono text-emerald-200">Authorization: Bearer {maskedMcpToken}</span></p>
                                </div>
                                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                    <p className="mb-1 text-sm font-semibold text-white">ChatGPT</p>
                                    <p className="text-xs text-gray-300">Use the same MCP endpoint and paste the bearer token when the connector asks for auth.</p>
                                    <p className="mt-1 text-xs text-gray-300">Keep this token private. Regenerate it here if it is ever shared.</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2 text-sm text-gray-300">
                            <p>No connector token generated yet.</p>
                            {!mcpRetrievable ? (
                                <p className="text-amber-300">A legacy token exists but cannot be shown again. Regenerate it to switch to retrievable storage.</p>
                            ) : null}
                        </div>
                    )}
                </div>

                {mcpMessage ? (
                    <p className="mt-3 text-sm text-emerald-200">{mcpMessage}</p>
                ) : null}
            </motion.section>

            <div className="grid gap-6">
                {PROVIDERS.map((provider) => (
                    <motion.div
                        key={provider.id}
                        className="glass flex flex-col items-start gap-6 rounded-xl border border-white/10 p-6 md:flex-row md:items-center"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2">
                                <h3 className="font-semibold text-white">{provider.name}</h3>
                                {provider.id === 'Local' ? <Badge variant="local">Local</Badge> : null}
                            </div>
                            <p className="mb-4 text-xs text-gray-400">{provider.description}</p>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    placeholder="Enter API Key"
                                    value={keys[provider.id] || ''}
                                    onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <button
                                    onClick={() => void testConnection(provider.id)}
                                    className="rounded-lg bg-white/10 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-white/20"
                                >
                                    Test
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {status[provider.id] === 'testing' ? <Loader2 className="h-4 w-4 animate-spin text-blue-400" /> : null}
                            {status[provider.id] === 'success' ? <CheckCircle2 className="h-5 w-5 text-green-400" /> : null}
                            {status[provider.id] === 'error' ? <XCircle className="h-5 w-5 text-red-400" /> : null}
                            {(!status[provider.id] || status[provider.id] === 'idle') ? <span className="text-xs text-gray-500">Not tested</span> : null}
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="mt-8 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-xs text-blue-400">
                <p><strong>Tip:</strong> Aapke paas Groq ka free API key nahi hai — <a href="https://console.groq.com/keys" target="_blank" className="font-bold underline">yahan se lein</a>, bilkul free hai!</p>
            </div>
        </div>
    );
}

function ProfileField({
    label,
    icon,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    icon: ReactNode;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
}) {
    return (
        <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">
                {icon}
                {label}
            </span>
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/40"
            />
        </label>
    );
}
