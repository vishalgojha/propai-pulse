import React from 'react';
import { cn } from '../lib/utils';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  LoaderIcon,
  RefreshIcon,
  SparklesIcon,
  WorkflowIcon,
} from '../lib/icons';
import backendApi, { handleApiError } from '../services/api';
import { ENDPOINTS } from '../services/endpoints';

type IntelligenceHealth = {
  ok: boolean;
  component?: string;
  enabled?: boolean;
};

type IntelligenceStatus = {
  ok: boolean;
  ready?: boolean;
  version?: string;
};

type IntelligenceAnalyzeResult = {
  inputSummary?: string[];
  verdict?: string;
  score?: number;
  timestamp?: string;
};

export default function IntelligencePage() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRunning, setIsRunning] = React.useState(false);
  const [health, setHealth] = React.useState<IntelligenceHealth | null>(null);
  const [status, setStatus] = React.useState<IntelligenceStatus | null>(null);
  const [result, setResult] = React.useState<IntelligenceAnalyzeResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const healthResp = await backendApi.get(ENDPOINTS.intelligence.health);
      setHealth(healthResp.data || null);

      if (healthResp.data?.enabled === false) {
        setStatus(null);
        return;
      }

      const statusResp = await backendApi.get(ENDPOINTS.intelligence.status);
      setStatus(statusResp.data || null);
    } catch (err) {
      setError(handleApiError(err));
      setHealth(null);
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const runAnalyze = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await backendApi.post(ENDPOINTS.intelligence.analyze, {
        sample: true,
        source: 'workspace_ui',
      });
      setResult(res.data || null);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsRunning(false);
    }
  };

  const stateLabel = !health?.ok
    ? 'Unavailable'
    : health.enabled === false
      ? 'Disabled'
      : status?.ready
        ? 'Ready'
        : 'Starting';

  const stateTone = !health?.ok
    ? 'border-red-500/25 bg-red-500/10 text-red-300'
    : health.enabled === false
      ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
      : status?.ready
        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
        : 'border-[color:var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]';

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">
      <section className="rounded-[24px] border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(17,24,32,0.98),rgba(13,17,23,0.98))] p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--accent-border)] bg-[var(--accent-dim)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--accent)]">
              <WorkflowIcon className="h-3.5 w-3.5" />
              Intelligence
            </div>
            <div className="space-y-2">
              <h2 className="text-[28px] font-bold tracking-[-0.03em] text-[var(--text-primary)] md:text-[34px]">
                Workspace intelligence runtime.
              </h2>
              <p className="max-w-2xl text-[13px] leading-6 text-[var(--text-secondary)]">
                This page checks whether the intelligence service is enabled, whether it is ready, and whether a sample analysis round-trip succeeds on the current API build.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void load()}
              className="rounded-full border border-[color:var(--border)] bg-[var(--bg-elevated)] p-2 text-neutral-500 transition-colors hover:text-white"
              aria-label="Refresh intelligence status"
            >
              <RefreshIcon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </button>
            <button
              onClick={() => void runAnalyze()}
              disabled={isRunning || !health?.ok || health.enabled === false}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#020f07] transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunning ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <SparklesIcon className="h-4 w-4" />}
              Run sample analyze
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-[16px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-[12px] text-red-300">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[20px] border border-[color:var(--border)] bg-[var(--bg-surface)] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Service</p>
          <p className="mt-3 text-[22px] font-bold text-[var(--text-primary)]">{health?.component || 'intelligence'}</p>
          <p className="mt-1 text-[12px] text-[var(--text-secondary)]">Backend component health probe.</p>
        </div>
        <div className="rounded-[20px] border border-[color:var(--border)] bg-[var(--bg-surface)] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">State</p>
          <div className="mt-3">
            <span className={cn('rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]', stateTone)}>
              {isLoading ? 'Checking' : stateLabel}
            </span>
          </div>
          <p className="mt-3 text-[12px] text-[var(--text-secondary)]">
            {health?.enabled === false ? 'Feature flag is off on this API deployment.' : status?.ready ? 'Status endpoint is live and reporting ready.' : 'Waiting for runtime status.'}
          </p>
        </div>
        <div className="rounded-[20px] border border-[color:var(--border)] bg-[var(--bg-surface)] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Version</p>
          <p className="mt-3 text-[22px] font-bold text-[var(--text-primary)]">{status?.version || '—'}</p>
          <p className="mt-1 text-[12px] text-[var(--text-secondary)]">Reported by the intelligence status endpoint.</p>
        </div>
      </section>

      <section className="rounded-[20px] border border-[color:var(--border)] bg-[var(--bg-surface)] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
        <div className="flex items-center gap-3">
          {result ? (
            <CheckCircleIcon className="h-5 w-5 text-[var(--accent)]" />
          ) : (
            <AlertTriangleIcon className="h-5 w-5 text-[var(--text-secondary)]" />
          )}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Analyze output</p>
            <h3 className="mt-1 text-[14px] font-semibold text-[var(--text-primary)]">Current sample response</h3>
          </div>
        </div>

        {!result ? (
          <p className="mt-4 text-[12px] leading-6 text-[var(--text-secondary)]">
            Run the sample analyze call to verify the frontend can talk to the intelligence API and that the current deployment returns structured output.
          </p>
        ) : (
          <pre className="mt-4 overflow-x-auto rounded-[16px] border border-[color:var(--border)] bg-[var(--bg-elevated)] p-4 text-[12px] leading-6 text-[var(--text-primary)]">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
