'use client';

import React from 'react';
import { AlertTriangle, Check, Loader2, ShieldCheck, X } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';
import { formatMessage } from '@/lib/i18n/formatMessage';

/** Cosa mostra il consenso: lo calcola il server (lib/server/mcp/authorize.ts). */
export interface ConsentDetails {
  clientName: string;
  verifiedDomain: string | null;
  redirectHost: string;
  localRedirect: boolean;
  scopes: string[];
  workspaces: { id: string; name: string }[];
}

export const CONSENT_CARD = 'w-full max-w-lg rounded-3xl border border-white/10 bg-[#111] p-6 sm:p-8 shadow-2xl';

/** La scheda di consenso di `/oauth/authorize`: solo presentazione. */
export function McpConsentCard({ details, workspaceId, onWorkspace, busy, error, email, onAnswer, onSwitchAccount }: {
  details: ConsentDetails;
  workspaceId: string;
  onWorkspace: (id: string) => void;
  busy: boolean;
  error: string | null;
  email: string;
  onAnswer: (action: 'approve' | 'deny') => void;
  onSwitchAccount: () => void;
}) {
  const { t } = useTranslation();
  const warning = 'mb-3 flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200';

  return (
    <div className={CONSENT_CARD}>
      <h1 className="mb-4 text-xl font-semibold leading-snug text-white">
        {formatMessage(t.mcp.consentTitle, { client: details.clientName })}
      </h1>

      {details.verifiedDomain ? (
        <p className="mb-3 flex items-center gap-2 text-sm text-emerald-300">
          <ShieldCheck size={16} className="shrink-0" />
          {formatMessage(t.mcp.verifiedDomain, { domain: details.verifiedDomain })}
        </p>
      ) : (
        <p className={warning}>
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {t.mcp.unverifiedName}
        </p>
      )}
      <p className="mb-3 break-all text-sm text-white/70">{formatMessage(t.mcp.returnTo, { host: details.redirectHost })}</p>
      {details.localRedirect && (
        <p className={warning}>
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {t.mcp.localWarning}
        </p>
      )}

      <div className="my-5">
        {details.workspaces.length === 0 ? (
          <p className="text-sm text-white/70">{t.mcp.noWorkspace}</p>
        ) : (
          <label className="flex flex-col gap-2">
            <span className="text-sm text-white/70">{t.mcp.chooseWorkspace}</span>
            <select
              value={workspaceId}
              onChange={e => onWorkspace(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-[#006AFF]"
            >
              <option value="" className="bg-[#1A1A1A]">—</option>
              {details.workspaces.map(ws => <option key={ws.id} value={ws.id} className="bg-[#1A1A1A]">{ws.name}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="mb-5 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <p className="mb-2 font-medium text-white/90">{t.mcp.canTitle}</p>
          <p className="flex gap-2 text-white/70"><Check size={15} className="mt-0.5 shrink-0 text-emerald-400" />{t.mcp.canRead}</p>
        </div>
        <div>
          <p className="mb-2 font-medium text-white/90">{t.mcp.cannotTitle}</p>
          {[t.mcp.cannotWrite, t.mcp.cannotCrm, t.mcp.cannotOther].map(text => (
            <p key={text} className="mb-1 flex gap-2 text-white/70"><X size={15} className="mt-0.5 shrink-0 text-red-400" />{text}</p>
          ))}
        </div>
      </div>

      <p className="mb-5 text-xs text-[#858585]">{t.mcp.revokeHint}</p>
      {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={() => onAnswer('deny')}
          className="rounded-full px-5 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white disabled:opacity-50"
        >
          {t.mcp.deny}
        </button>
        <button
          type="button"
          disabled={busy || !workspaceId}
          onClick={() => onAnswer('approve')}
          className="flex items-center justify-center gap-2 rounded-full bg-[#006AFF] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0055CC] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {t.mcp.allow}
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-4 text-xs text-[#858585]">
        <span className="truncate">{formatMessage(t.mcp.signedInAs, { email })}</span>
        <button type="button" onClick={onSwitchAccount} className="hover:text-white">
          {t.mcp.switchAccount}
        </button>
      </div>
    </div>
  );
}
