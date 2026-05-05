import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Loader2, MessageSquareText, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePitchKit } from '../hooks/usePitchKit';
import backendApi, { handleApiError } from '../services/api';
import { ENDPOINTS } from '../services/endpoints';
import type { StreamItem } from '../services/streamAPI';
import { cn } from '../lib/utils';
import { formatClientMessage, formatSelfMessage, normalizeClientPhone } from '../lib/pitchFormatter';

type PitchKitModalProps = {
  mode: 'preview' | 'send';
  open: boolean;
  onClose: () => void;
};

type BrokerProfile = {
  id: string | null;
  name: string;
  phone: string;
};

const initialBrokerProfile: BrokerProfile = {
  id: null,
  name: 'PropAI Broker',
  phone: '',
};

export const PitchKitModal: React.FC<PitchKitModalProps> = ({ mode, open, onClose }) => {
  const { selected, remove, clear } = usePitchKit();
  const { user } = useAuth();
  const [clientPhone, setClientPhone] = React.useState('');
  const [note, setNote] = React.useState('');
  const [sendToClient, setSendToClient] = React.useState(true);
  const [sendToSelf, setSendToSelf] = React.useState(true);
  const [showPreview, setShowPreview] = React.useState(mode === 'preview');
  const [expandedIds, setExpandedIds] = React.useState<Record<string, boolean>>({});
  const [broker, setBroker] = React.useState<BrokerProfile>(initialBrokerProfile);
  const [isLoadingProfile, setIsLoadingProfile] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [sendState, setSendState] = React.useState<'idle' | 'sent'>('idle');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;

    setShowPreview(mode === 'preview');
    setSendState('idle');
    setError(null);
  }, [mode, open]);

  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const loadProfile = async () => {
      setIsLoadingProfile(true);
      try {
        const response = await backendApi.get(ENDPOINTS.whatsapp.profile);
        if (cancelled) return;
        const profile = response.data?.profile;
        setBroker({
          id: profile?.id || null,
          name: profile?.fullName || user?.email || 'PropAI Broker',
          phone: profile?.phone || '',
        });
      } catch {
        if (!cancelled) {
          setBroker({
            id: null,
            name: user?.email || 'PropAI Broker',
            phone: '',
          });
        }
      } finally {
        if (!cancelled) setIsLoadingProfile(false);
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [open, user?.email]);

  const normalizedPhone = React.useMemo(() => normalizeClientPhone(clientPhone), [clientPhone]);
  const clientMessage = React.useMemo(() => formatClientMessage(selected, broker, note), [broker, note, selected]);
  const selfMessage = React.useMemo(() => formatSelfMessage(selected, clientPhone, broker), [broker, clientPhone, selected]);

  const handleSend = React.useCallback(async () => {
    if (!sendToClient && !sendToSelf) {
      setError('Choose at least one recipient before sending.');
      return;
    }

    if (!normalizedPhone) {
      setError('Enter a valid Indian WhatsApp number.');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const response = await backendApi.post('/pitch/send', {
        clientPhone: normalizedPhone,
        listingIds: selected.map((listing) => listing.id),
        clientMessage,
        selfMessage,
        sendToClient,
        sendToSelf,
        note: note.trim() || null,
      });

      const data = response.data || {};
      const urls = [data.clientUrl, data.selfUrl].filter((value: unknown): value is string => typeof value === 'string' && value.length > 0);
      urls.forEach((url) => window.open(url, '_blank', 'noopener,noreferrer'));

      if (!data.success && !data.fallback && !data.partial) {
        throw new Error(data.error || 'Pitch send failed');
      }

      setSendState('sent');
      window.setTimeout(() => {
        clear();
        onClose();
      }, 1500);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsSending(false);
    }
  }, [clear, clientMessage, normalizedPhone, note, onClose, selected, selfMessage, sendToClient, sendToSelf]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 24 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          onClick={(event) => event.stopPropagation()}
          className="grid max-h-[90vh] w-full max-w-6xl gap-0 overflow-hidden rounded-[28px] border border-[color:var(--border-strong)] bg-[var(--bg-elevated)] shadow-[0_28px_80px_rgba(0,0,0,0.55)] lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]"
        >
          <section className="flex min-h-0 flex-col border-b border-[color:var(--border)] lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--text-secondary)]">Pitch Kit</p>
                <h2 className="mt-1 text-xl font-bold text-white">{selected.length} selected listings</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[color:var(--border)] p-2 text-[var(--text-secondary)] transition-colors hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="space-y-3">
                {selected.map((listing) => {
                  const expanded = Boolean(expandedIds[listing.id]);
                  return (
                    <div key={listing.id} className="rounded-2xl border border-[color:var(--border)] bg-[var(--bg-surface)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="inline-flex rounded-full border border-[color:var(--accent-border)] bg-[var(--accent-dim)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--accent)]">
                            {listing.type}
                          </div>
                          <p className="mt-3 text-sm font-bold text-white">{listing.title || listing.location}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">{listing.bhk} · {listing.location}</p>
                          <p className="mt-2 text-sm text-[var(--text-primary)]">{listing.price}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(listing.id)}
                          className="rounded-lg border border-[color:var(--border)] p-2 text-[var(--text-secondary)] transition-colors hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedIds((current) => ({ ...current, [listing.id]: !expanded }))}
                        className="mt-3 flex w-full items-center justify-between text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]"
                      >
                        Raw text
                        <ChevronDown className={cn('h-4 w-4 transition-transform', expanded ? 'rotate-180' : '')} />
                      </button>
                      <p className={cn('mt-2 text-sm leading-6 text-[var(--text-secondary)]', expanded ? '' : 'line-clamp-2')}>
                        {listing.rawText || listing.description || 'No raw message available.'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="flex min-h-0 flex-col">
            <div className="border-b border-[color:var(--border)] px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                {mode === 'preview' ? 'Preview' : 'Send to Client'}
              </p>
              <div className="mt-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                {isLoadingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
                <span>{broker.name}{broker.phone ? ` · ${broker.phone}` : ''}</span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-secondary)]">Client phone</span>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(event) => setClientPhone(event.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                    className="w-full rounded-2xl border border-[color:var(--border-strong)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-white focus:border-[var(--accent)] focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-secondary)]">Personal note</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value.slice(0, 200))}
                    rows={4}
                    placeholder="Add a note for your client..."
                    className="w-full rounded-2xl border border-[color:var(--border-strong)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-white focus:border-[var(--accent)] focus:outline-none"
                  />
                  <div className="mt-1 text-right text-[11px] text-[var(--text-secondary)]">{note.length}/200</div>
                </label>

                <div className="space-y-3 rounded-2xl border border-[color:var(--border)] bg-[var(--bg-surface)] p-4">
                  <label className="flex items-center gap-3 text-sm text-white">
                    <input type="checkbox" checked={sendToClient} onChange={(event) => setSendToClient(event.target.checked)} />
                    Send to client
                  </label>
                  <label className="flex items-center gap-3 text-sm text-white">
                    <input type="checkbox" checked={sendToSelf} onChange={(event) => setSendToSelf(event.target.checked)} />
                    Send reference copy to myself
                  </label>
                </div>

                <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--bg-surface)] p-4">
                  <button
                    type="button"
                    onClick={() => setShowPreview((current) => !current)}
                    className="flex w-full items-center justify-between text-left text-sm font-semibold text-white"
                  >
                    <span>Message Preview</span>
                    <ChevronDown className={cn('h-4 w-4 transition-transform', showPreview ? 'rotate-180' : '')} />
                  </button>

                  {showPreview ? (
                    <div className="mt-4 space-y-4">
                      <pre className="max-h-48 overflow-y-auto rounded-2xl bg-[var(--bg-base)] p-4 font-mono text-xs leading-6 text-[var(--text-primary)] whitespace-pre-wrap">
                        {clientMessage}
                      </pre>
                      {sendToSelf ? (
                        <pre className="max-h-48 overflow-y-auto rounded-2xl bg-[var(--bg-base)] p-4 font-mono text-xs leading-6 text-[var(--text-primary)] whitespace-pre-wrap">
                          {selfMessage}
                        </pre>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {error ? <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p> : null}
                {sendState === 'sent' ? (
                  <p className="rounded-2xl border border-[color:var(--accent-border)] bg-[var(--accent-dim)] px-4 py-3 text-sm font-semibold text-[var(--accent)]">
                    <Check className="mr-2 inline h-4 w-4" />
                    Sent ✓
                  </p>
                ) : null}

                <button
                  type="button"
                  disabled={isSending || selected.length === 0}
                  onClick={() => void handleSend()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-black transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Send via WhatsApp
                </button>
              </div>
            </div>
          </section>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
