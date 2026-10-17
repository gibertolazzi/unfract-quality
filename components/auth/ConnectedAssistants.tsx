'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';
import { authedFetch } from '@/lib/authedFetch';
import { formatMessage } from '@/lib/i18n/formatMessage';

interface Connection {
  id: string;
  clientName: string;
  workspaceName: string | null;
  scopes: string[];
  lastUsedAt: number | null;
}

/**
 * Assistenti AI collegati a Unfract via MCP (app/api/oauth/connections).
 * Scollegandone uno, i suoi token smettono subito di valere.
 * Se il server MCP è spento (404) la sezione non compare.
 */
export function ConnectedAssistants() {
  const { t, locale } = useTranslation();
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await authedFetch('/api/oauth/connections');
      if (response.status === 404) return setHidden(true);
      if (!response.ok) throw new Error(String(response.status));
      setConnections((await response.json()).connections || []);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const revoke = async (connection: Connection) => {
    if (!window.confirm(formatMessage(t.mcp.disconnectConfirm, { client: connection.clientName }))) return;
    setRevoking(connection.id);
    try {
      await authedFetch('/api/oauth/connections', { method: 'POST', body: JSON.stringify({ action: 'revoke', id: connection.id }) });
    } finally {
      setRevoking(null);
      load();
    }
  };

  if (hidden) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#858585]">
          <Bot size={14} /> {t.mcp.connectionsTitle}
        </h3>
        <p className="text-[13px] leading-relaxed text-[#858585]">{t.mcp.connectionsDesc}</p>
      </div>

      {error ? (
        <p className="text-sm text-red-300">{t.mcp.connectionsLoadError}</p>
      ) : connections === null ? (
        <Loader2 size={18} className="animate-spin text-[#858585]" />
      ) : connections.length === 0 ? (
        <p className="text-sm text-white/60">{t.mcp.connectionsEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {connections.map(connection => (
            <li key={connection.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white/90">{connection.clientName}</p>
                <p className="truncate text-xs text-[#858585]">
                  {[connection.workspaceName, t.mcp.readOnly, connection.lastUsedAt
                    ? formatMessage(t.mcp.lastUsed, { date: new Date(connection.lastUsedAt).toLocaleString(locale) })
                    : t.mcp.neverUsed].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => revoke(connection)}
                disabled={revoking === connection.id}
                className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
              >
                {revoking === connection.id ? <Loader2 size={14} className="animate-spin" /> : t.mcp.disconnect}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
