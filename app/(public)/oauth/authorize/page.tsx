"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { authedFetch } from '@/lib/authedFetch';
import { CONSENT_CARD, McpConsentCard, type ConsentDetails as Details } from '@/components/auth/McpConsentCard';

/**
 * Consenso a un assistente AI (Claude, ChatGPT, Cursor…) che vuole collegarsi
 * a Unfract via MCP: è l'«authorization endpoint» di OAuth.
 *
 * L'utente entra come sempre (email o Google), sceglie il workspace e
 * conferma. La pagina non decide niente: client, indirizzo di ritorno e
 * parametri li controlla il server (`/api/oauth/authorize`) sia all'apertura
 * sia alla conferma. Non si può mettere in un iframe (next.config.mjs).
 */

const PARAMS = ['response_type', 'client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state', 'scope', 'resource'];

function Consent() {
  const { user, loading, logout } = useAuth();
  const { t } = useTranslation();
  const search = useSearchParams();
  const params = useMemo(() => Object.fromEntries(PARAMS.map(key => [key, search.get(key) ?? undefined])), [search]);

  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const checkedFor = useRef<string | null>(null);

  const go = (url: string) => {
    setLeaving(true);
    window.location.assign(url);
  };

  useEffect(() => {
    if (loading || !user || checkedFor.current === user.uid) return;
    checkedFor.current = user.uid;
    (async () => {
      try {
        const response = await authedFetch('/api/oauth/authorize', { method: 'POST', body: JSON.stringify({ action: 'check', params }) });
        const data = await response.json().catch(() => ({}));
        if (response.status === 404) return setError(t.mcp.disabled);
        if (!response.ok) {
          // Client e indirizzo verificati: l'errore torna all'app, come vuole OAuth.
          if (data.redirect) return go(data.redirect);
          return setError(data.error || t.mcp.errorTitle);
        }
        setDetails(data.details);
        if (data.details.workspaces.length === 1) setWorkspaceId(data.details.workspaces[0].id);
      } catch {
        setError(t.mcp.errorTitle);
      }
    })();
  }, [loading, user, params, t]);

  const answer = async (action: 'approve' | 'deny') => {
    setBusy(true);
    setError(null);
    try {
      const response = await authedFetch('/api/oauth/authorize', { method: 'POST', body: JSON.stringify({ action, params, workspaceId }) });
      const data = await response.json().catch(() => ({}));
      if (data.redirect) return go(data.redirect);
      setError(data.error || t.mcp.errorTitle);
    } catch {
      setError(t.mcp.errorTitle);
    } finally {
      setBusy(false);
    }
  };

  if (!loading && !user) return <LoginScreen />;

  if (leaving || (!details && !error)) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex items-center gap-3 text-white/70">
          <Loader2 className="h-5 w-5 animate-spin text-[#006AFF]" />
          {leaving ? t.mcp.redirecting : t.mcp.checking}
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className={CONSENT_CARD}>
          <h1 className="mb-3 text-xl font-semibold text-white">{t.mcp.errorTitle}</h1>
          <p className="text-sm text-white/70">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center py-6">
      <McpConsentCard
        details={details}
        workspaceId={workspaceId}
        onWorkspace={setWorkspaceId}
        busy={busy}
        error={error}
        email={user?.email || ''}
        onAnswer={answer}
        onSwitchAccount={() => { checkedFor.current = null; setDetails(null); logout(); }}
      />
    </div>
  );
}

export default function AuthorizePage() {
  return (
    <Suspense fallback={null}>
      <Consent />
    </Suspense>
  );
}
