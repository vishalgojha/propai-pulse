import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Eye, X } from 'lucide-react';
import { usePitchKit } from '../hooks/usePitchKit';
import { PitchKitModal } from './PitchKitModal';

export const PitchKitBar: React.FC = () => {
  const { count, max, clear, notice, dismissNotice } = usePitchKit();
  const [mode, setMode] = React.useState<'preview' | 'send'>('send');
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <AnimatePresence>
        {notice ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-28 left-1/2 z-40 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-red-500/30 bg-[#241313] px-4 py-3 text-sm text-red-200 shadow-[0_16px_48px_rgba(0,0,0,0.35)]"
          >
            <div className="flex items-center justify-between gap-3">
              <span>{notice}</span>
              <button type="button" onClick={dismissNotice} className="text-red-200/70 hover:text-red-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {count > 0 ? (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-5 left-1/2 z-40 w-[min(94vw,760px)] -translate-x-1/2"
          >
            <div className="flex flex-col gap-3 rounded-[24px] border border-[#25d3664d] bg-[#0d1117] px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)] sm:flex-row sm:items-center sm:justify-between sm:rounded-full sm:px-5">
              <div className="flex items-center gap-3">
                <span className="inline-flex rounded-full bg-[var(--accent)] px-3 py-1 font-mono text-xs font-bold text-black">
                  {count}/{max}
                </span>
                <span className="text-sm text-white">{count} properties selected</span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode('preview');
                    setOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-white"
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('send');
                    setOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black transition-colors hover:brightness-105"
                >
                  Send to Client
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={clear}
                  className="inline-flex items-center justify-center rounded-full border border-[color:var(--border)] px-3 py-2 text-[var(--text-secondary)] transition-colors hover:text-white"
                  aria-label="Clear pitch kit"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <PitchKitModal mode={mode} open={open} onClose={() => setOpen(false)} />
    </>
  );
};
