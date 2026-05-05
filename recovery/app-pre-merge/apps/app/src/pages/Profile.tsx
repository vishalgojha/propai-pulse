import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import {
  CreditCardIcon,
  MailIcon,
  ShieldIcon,
  SmartphoneIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react';
import backendApi, { handleApiError } from '../services/api';
import { ENDPOINTS } from '../services/endpoints';
import { useAuth } from '../context/AuthContext';

type ProfileRecord = {
  id?: string | null;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
};

type WhatsappStatus = {
  activeCount: number;
  limit: number;
  plan: string;
  status: 'connected' | 'connecting' | 'disconnected';
  connectedPhoneNumber?: string | null;
  connectedOwnerName?: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'Not set'
    : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusTone = (status?: string | null) => {
  switch (String(status || '').toLowerCase()) {
    case 'active':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'trial':
    case 'trialing':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    default:
      return 'border-[color:var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]';
  }
};

export const Profile: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = React.useState<ProfileRecord | null>(null);
  const [waStatus, setWaStatus] = React.useState<WhatsappStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [profileResp, statusResp] = await Promise.all([
          backendApi.get(ENDPOINTS.whatsapp.profile),
          backendApi.get(ENDPOINTS.whatsapp.status),
        ]);

        if (!mounted) return;
        setProfile(profileResp.data?.profile || null);
        setWaStatus(statusResp.data || null);
      } catch (err) {
        if (!mounted) return;
        setError(handleApiError(err));
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const subscription = user?.subscription;
  const displayName = profile?.fullName || user?.email || 'Workspace user';
  const displayEmail = profile?.email || user?.email || '—';
  const displayPhone = profile?.phone || waStatus?.connectedPhoneNumber || 'Not set';
  const displayPlan = subscription?.plan || waStatus?.plan || 'Free';

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">
      <section className="rounded-[24px] border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(17,24,32,0.98),rgba(13,17,23,0.98))] p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--accent-border)] bg-[var(--accent-dim)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--accent)]">
              <ShieldIcon className="h-3.5 w-3.5" />
              Account center
            </div>
            <div className="space-y-2">
              <h2 className="text-[28px] font-bold tracking-[-0.03em] text-[var(--text-primary)] md:text-[34px]">
                Profile, workspace access, and billing at a glance.
              </h2>
              <p className="max-w-2xl text-[13px] leading-6 text-[var(--text-secondary)]">
                Review who is signed in, what plan this workspace is on, how many WhatsApp devices are active, and where to go next for settings, team access, and billing.
              </p>
            </div>
          </div>

          <div className="rounded-[14px] border border-[color:var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-left lg:min-w-[220px] lg:text-right">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]">Signed in as</p>
            <p className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">{displayEmail}</p>
            <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--accent)]">{user?.appRole || 'broker'}</p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-[16px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-[12px] text-red-300">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[20px] border border-[color:var(--border)] bg-[var(--bg-surface)] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[color:var(--border)] bg-[var(--bg-elevated)]">
              <UserIcon className="h-5 w-5 text-[var(--accent)]" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Profile</p>
              <h3 className="mt-1 text-[14px] font-semibold text-[var(--text-primary)]">Workspace identity</h3>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Full name', value: displayName, icon: UserIcon },
              { label: 'Email', value: displayEmail, icon: MailIcon },
              { label: 'Phone', value: displayPhone, icon: SmartphoneIcon },
              { label: 'Role', value: user?.appRole || 'broker', icon: ShieldIcon },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-[16px] border border-[color:var(--border)] bg-[var(--bg-elevated)] p-4">
                  <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <Icon className="h-4 w-4" />
                    <p className="text-[10px] font-medium uppercase tracking-[0.08em]">{item.label}</p>
                  </div>
                  <p className="mt-2 text-[14px] font-semibold text-[var(--text-primary)]">
                    {isLoading ? 'Loading…' : item.value || 'Not set'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[20px] border border-[color:var(--border)] bg-[var(--bg-surface)] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[color:var(--border)] bg-[var(--bg-elevated)]">
              <CreditCardIcon className="h-5 w-5 text-[var(--accent)]" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Plan</p>
              <h3 className="mt-1 text-[14px] font-semibold text-[var(--text-primary)]">Billing and subscription</h3>
            </div>
          </div>

          <div className="rounded-[18px] border border-[color:var(--border)] bg-[linear-gradient(135deg,rgba(37,211,102,0.08),rgba(8,12,16,0.95))] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]">Current plan</p>
                <p className="mt-1 text-[20px] font-bold text-[var(--text-primary)]">{displayPlan}</p>
              </div>
              <span className={cn('rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]', statusTone(subscription?.status))}>
                {subscription?.status || 'unknown'}
              </span>
            </div>
            {typeof subscription?.trial_days_remaining === 'number' ? (
              <p className="mt-3 text-[12px] text-[var(--amber)]">
                {subscription.trial_days_remaining} day{subscription.trial_days_remaining === 1 ? '' : 's'} left on this workspace.
              </p>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[16px] border border-[color:var(--border)] bg-[var(--bg-elevated)] p-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]">Activated</p>
              <p className="mt-2 text-[14px] font-semibold text-[var(--text-primary)]">{formatDate(subscription?.created_at)}</p>
            </div>
            <div className="rounded-[16px] border border-[color:var(--border)] bg-[var(--bg-elevated)] p-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]">Renews / expires</p>
              <p className="mt-2 text-[14px] font-semibold text-[var(--text-primary)]">{formatDate(subscription?.renewal_date)}</p>
            </div>
          </div>

          <p className="mt-4 text-[11px] leading-5 text-[var(--text-secondary)]">
            For billing changes, renewals, or payment support, use the plan screen or contact support@propai.live.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[20px] border border-[color:var(--border)] bg-[var(--bg-surface)] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <div className="flex items-center gap-3">
            <UsersIcon className="h-5 w-5 text-[var(--accent)]" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Workspace</p>
              <h3 className="mt-1 text-[14px] font-semibold text-[var(--text-primary)]">Access snapshot</h3>
            </div>
          </div>
          <div className="mt-4 space-y-3 text-[12px]">
            <div className="flex items-center justify-between rounded-[14px] border border-[color:var(--border)] bg-[var(--bg-elevated)] px-3 py-3">
              <span className="text-[var(--text-secondary)]">WhatsApp devices</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {waStatus ? `${waStatus.activeCount}/${waStatus.limit}` : isLoading ? 'Loading…' : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-[14px] border border-[color:var(--border)] bg-[var(--bg-elevated)] px-3 py-3">
              <span className="text-[var(--text-secondary)]">Connected number</span>
              <span className="font-semibold text-[var(--text-primary)]">{waStatus?.connectedPhoneNumber || 'Not connected'}</span>
            </div>
            <div className="flex items-center justify-between rounded-[14px] border border-[color:var(--border)] bg-[var(--bg-elevated)] px-3 py-3">
              <span className="text-[var(--text-secondary)]">Device status</span>
              <span className="font-semibold capitalize text-[var(--text-primary)]">{waStatus?.status || 'unknown'}</span>
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-[color:var(--border)] bg-[var(--bg-surface)] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] md:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Quick actions</p>
          <h3 className="mt-1 text-[14px] font-semibold text-[var(--text-primary)]">Manage your workspace</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { title: 'WhatsApp setup', copy: 'Connect devices and monitor sync health.', path: '/whatsapp' },
              { title: 'Plan and pricing', copy: 'Review plan tier and billing context.', path: '/pricing' },
              { title: 'Studio settings', copy: 'AI keys, defaults, and account controls.', path: '/settings' },
              { title: 'Team access', copy: 'Review member roles and workspace activity.', path: '/team' },
            ].map((action) => (
              <button
                key={action.title}
                type="button"
                onClick={() => navigate(action.path)}
                className="rounded-[16px] border border-[color:var(--border)] bg-[var(--bg-elevated)] p-4 text-left transition-colors hover:border-[color:var(--accent-border)] hover:bg-[var(--bg-hover)]"
              >
                <p className="text-[13px] font-semibold text-[var(--text-primary)]">{action.title}</p>
                <p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">{action.copy}</p>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
