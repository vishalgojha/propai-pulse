'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, Loader2, MapPin, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSupabaseClient } from '@/lib/supabase';

type Profile = {
    full_name?: string | null;
    agency_name?: string | null;
    city?: string | null;
    primary_phone?: string | null;
};

function normalizePhone(value: string) {
    return value.replace(/\D/g, '').slice(0, 10);
}

export default function OnboardingPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [profile, setProfile] = useState<Profile>({
        full_name: '',
        agency_name: '',
        city: '',
        primary_phone: '',
    });

    useEffect(() => {
        const boot = async () => {
            const supabase = getSupabaseClient();
            if (!supabase) {
                router.replace('/login');
                return;
            }

            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.replace('/login');
                return;
            }

            try {
                const res = await apiFetch('/api/profile');
                if (res.ok) {
                    const data = await res.json();
                    setProfile({
                        full_name: data?.profile?.full_name || '',
                        agency_name: data?.profile?.agency_name || '',
                        city: data?.profile?.city || '',
                        primary_phone: data?.profile?.primary_phone || '',
                    });
                }
            } catch {
                // Keep the form usable even if prefill fails.
            } finally {
                setLoading(false);
            }
        };

        void boot();
    }, [router]);

    const profileComplete = Boolean(profile.full_name?.trim() && profile.primary_phone?.trim());

    const saveProfile = async () => {
        setSaving(true);
        setError('');
        setMessage('');

        try {
            const res = await apiFetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: profile.full_name?.trim() || null,
                    agency_name: profile.agency_name?.trim() || null,
                    city: profile.city?.trim() || null,
                    primary_phone: normalizePhone(profile.primary_phone || ''),
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || 'Could not save broker profile');
            }

            setProfile({
                full_name: data?.profile?.full_name || profile.full_name || '',
                agency_name: data?.profile?.agency_name || profile.agency_name || '',
                city: data?.profile?.city || profile.city || '',
                primary_phone: data?.profile?.primary_phone || normalizePhone(profile.primary_phone || ''),
            });
            setMessage('Broker profile saved. Continue to WhatsApp connection.');
            router.push('/whatsapp');
        } catch (err: any) {
            setError(err?.message || 'Could not save broker profile');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#173127_0%,#0b1115_42%,#070a0d_100%)] text-white">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-300">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading onboarding
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,#173127_0%,#0b1115_42%,#070a0d_100%)] px-4 py-8 text-white md:px-8">
            <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <section className="rounded-[28px] border border-emerald-400/25 bg-[linear-gradient(135deg,rgba(18,88,61,0.95),rgba(10,39,29,0.95))] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-50">
                        <ShieldCheck className="h-4 w-4" />
                        Broker setup
                    </div>
                    <h1 className="mt-5 text-4xl font-semibold tracking-tight">Create your broker profile first</h1>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-emerald-50/85">
                        PropAI should know who you are before it connects a device or reads any conversations. Save your broker identity once, then WhatsApp setup becomes a simple QR connect.
                    </p>

                    <div className="mt-8 grid gap-4 md:grid-cols-3">
                        <ChecklistCard title="Identity locked" body="Your name and phone become the trusted broker record." />
                        <ChecklistCard title="No repeat entry" body="WhatsApp setup reuses the saved profile instead of asking again." />
                        <ChecklistCard title="Better routing" body="Agent logic stops guessing which number belongs to the broker." />
                    </div>
                </section>

                <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
                    <div className="mb-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Profile</p>
                        <h2 className="mt-2 text-2xl font-semibold">Broker identity</h2>
                        <p className="mt-2 text-sm text-slate-400">Required before WhatsApp connect.</p>
                    </div>

                    <div className="space-y-4">
                        <Field
                            label="Full name"
                            icon={<UserRound className="h-4 w-4" />}
                            value={profile.full_name || ''}
                            onChange={(value) => setProfile((current) => ({ ...current, full_name: value }))}
                            placeholder="Vishal Ojha"
                        />
                        <Field
                            label="WhatsApp number"
                            icon={<Phone className="h-4 w-4" />}
                            value={profile.primary_phone || ''}
                            onChange={(value) => setProfile((current) => ({ ...current, primary_phone: normalizePhone(value) }))}
                            placeholder="9876543210"
                            helper="Indian mobile number only. Saved once and reused for WhatsApp setup."
                        />
                        <Field
                            label="Agency"
                            icon={<Building2 className="h-4 w-4" />}
                            value={profile.agency_name || ''}
                            onChange={(value) => setProfile((current) => ({ ...current, agency_name: value }))}
                            placeholder="PropAI Realty"
                        />
                        <Field
                            label="City"
                            icon={<MapPin className="h-4 w-4" />}
                            value={profile.city || ''}
                            onChange={(value) => setProfile((current) => ({ ...current, city: value }))}
                            placeholder="Mumbai"
                        />
                    </div>

                    {error ? (
                        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                            {error}
                        </div>
                    ) : null}
                    {message ? (
                        <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                            {message}
                        </div>
                    ) : null}

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <button
                            type="button"
                            onClick={() => void saveProfile()}
                            disabled={saving || !profile.full_name?.trim() || normalizePhone(profile.primary_phone || '').length !== 10}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                            Save and continue to WhatsApp
                        </button>
                        {profileComplete ? (
                            <button
                                type="button"
                                onClick={() => router.push('/whatsapp')}
                                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                            >
                                Skip, already saved
                            </button>
                        ) : null}
                    </div>
                </section>
            </div>
        </main>
    );
}

function ChecklistCard({ title, body }: { title: string; body: string }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-black/12 p-4">
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-2 text-sm leading-6 text-emerald-50/75">{body}</p>
        </div>
    );
}

function Field({
    label,
    icon,
    value,
    onChange,
    placeholder,
    helper,
}: {
    label: string;
    icon: ReactNode;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    helper?: string;
}) {
    return (
        <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {icon}
                {label}
            </span>
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#0a1014] px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/40"
            />
            {helper ? <p className="mt-2 text-xs text-slate-500">{helper}</p> : null}
        </label>
    );
}
