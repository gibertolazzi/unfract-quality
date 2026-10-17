'use client';

import React, { useEffect, useState } from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';
import { useToast } from '@/contexts/ToastContext';
import { authedFetch } from '@/lib/authedFetch';
import { formatMessage } from '@/lib/i18n/formatMessage';

interface McpState {
  allowed: boolean;
  canManage: boolean;
  activeConnections: number | null;
}

/**
 * Interruttore degli assistenti AI per il workspace dell'organizzazione
 * (app/api/organizations/mcp). Lo vedono solo proprietario e amministratori;
 * se MCP è spento su tutto il server (prod senza MCP_ENABLED) non compare.
 */
export function McpWorkspaceSection({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [state, setState] = useState<McpState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authedFetch(`/api/organizations/mcp?workspaceId=${encodeURIComponent(workspaceId)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (!cancelled) setState(data); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [workspaceId]);

  if (!state?.canManage) return null;

  const change = async (allowed: boolean) => {
    if (allowed === state.allowed) return;
    setSaving(true);
    try {
      const response = await authedFetch('/api/organizations/mcp', { method: 'POST', body: JSON.stringify({ workspaceId, allowed }) });
      if (!response.ok) throw new Error(String(response.status));
      setState(await response.json());
      toast.success(t.mcp.orgUpdated);
    } catch {
      toast.error(t.mcp.orgError);
    } finally {
      setSaving(false);
    }
  };

  const option = (on: boolean) =>
    `flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
      state.allowed === on ? 'bg-[#006AFF] text-white' : 'text-[#858585] hover:text-white'
    }`;

  return (
    <section className="px-2 mb-12">
      <h2 className="text-sm font-semibold text-[#858585] tracking-wider uppercase mb-4 flex items-center gap-2">
        <Bot size={15} /> {t.mcp.orgTitle}
      </h2>
      <div className="rounded-2xl border border-white/5 bg-[#111] p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <p className="text-sm text-white/70">{t.mcp.orgDesc}</p>
          {state.activeConnections !== null && (
            <p className="mt-2 text-xs text-[#858585]">{formatMessage(t.mcp.orgConnections, { count: state.activeConnections })}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1 md:w-56">
          <button type="button" disabled={saving} onClick={() => change(true)} className={option(true)} aria-pressed={state.allowed}>
            {t.mcp.orgOn}
          </button>
          <button type="button" disabled={saving} onClick={() => change(false)} className={option(false)} aria-pressed={!state.allowed}>
            {saving ? <Loader2 size={14} className="mx-auto animate-spin" /> : t.mcp.orgOff}
          </button>
        </div>
      </div>
    </section>
  );
}
