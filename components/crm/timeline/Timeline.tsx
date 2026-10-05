'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import {
  Phone, Mail, Users, FileText, StickyNote, CalendarClock, Activity, MessageSquare,
} from 'lucide-react';
import {
  TimelineSources, TimelineRef, TimelineKind, TimelineEntry,
  ALL_KINDS, TIMELINE_KIND_LABELS, TIMELINE_KIND_COLORS,
  buildTimeline, groupByDay,
} from '@/lib/crm/timeline';

interface TimelineProps {
  sources: TimelineSources;
  reference: TimelineRef;
  ownerName: (uid: string) => string;
  /** Mostrato quando non c'è nulla: cambia a seconda dell'entità. */
  emptyHint?: string;
  /** Quante voci mostrare prima del «mostra tutto». */
  limit?: number;
}

const KIND_ICONS: Record<TimelineKind, any> = {
  interaction: Activity,
  followup: CalendarClock,
  communication: Mail,
  document: FileText,
};

const BADGE_ICONS: Record<string, any> = {
  Telefonata: Phone,
  Email: Mail,
  SMS: MessageSquare,
  Meeting: Users,
  Nota: StickyNote,
};

const formatDay = (day: string, locale: string, t: ReturnType<typeof useTranslation>['t']) => {
  if (!day) return t.crm.dateUndated;
  const date = new Date(day);
  if (Number.isNaN(date.getTime())) return t.crm.dateUndated;

  const today = new Date().toISOString().slice(0, 10);
  if (day === today) return t.crm.dateToday;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (day === yesterday) return t.crm.dateYesterday;

  return date.toLocaleDateString(locale === 'it' ? 'it-IT' : 'en-US', { day: '2-digit', month: 'long', year: 'numeric' });
};

function Entry({ entry, ownerName, planned }: {
  entry: TimelineEntry; ownerName: (uid: string) => string; planned?: boolean;
}) {
  const Icon = BADGE_ICONS[entry.badge] || KIND_ICONS[entry.kind];
  const color = TIMELINE_KIND_COLORS[entry.kind];

  return (
    <li className={`flex gap-3 ${entry.archived ? 'opacity-50' : ''}`}>
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${color}1A`, color }}
      >
        <Icon size={12} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-xs text-white">{entry.title || '—'}</span>
          <span className="text-[10px]" style={{ color }}>{entry.badge}</span>
          {planned && <span className="text-[10px] text-[#F59E0B]">da fare</span>}
        </div>

        {entry.subtitle && <span className="text-[11px] text-[#858585]">{entry.subtitle}</span>}
        {entry.detail && <span className="text-[11px] text-[#5A5A5A]">{entry.detail}</span>}

        <span className="text-[10px] text-[#3F3F3F]">
          {entry.at ? new Date(entry.at).toLocaleString('it-IT', {
            hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short',
          }) : 'senza data'}
          {ownerName(entry.actorUid) && ` · ${ownerName(entry.actorUid)}`}
        </span>
      </div>
    </li>
  );
}

/**
 * Timeline unica di un'entità: quello che è successo e quello che resta da
 * fare, tenuti separati. Un follow-up ancora aperto non è una cosa successa:
 * mescolarlo allo storico fa sembrare fatto ciò che è solo programmato.
 */
export function Timeline({ sources, reference, ownerName, emptyHint, limit = 12 }: TimelineProps) {
  const { locale, t } = useTranslation();
  const [kinds, setKinds] = useState<TimelineKind[]>(ALL_KINDS);
  const [expanded, setExpanded] = useState(false);

  const timeline = useMemo(
    () => buildTimeline(sources, reference, { kinds, includeArchived: false }),
    [sources, reference, kinds]
  );

  const shown = expanded ? timeline.past : timeline.past.slice(0, limit);
  const groups = groupByDay(shown);

  const toggle = (kind: TimelineKind) => {
    setKinds(prev => (prev.includes(kind) ? prev.filter(k => k !== kind) : [...prev, kind]));
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <h3 className="mr-1 text-[10px] uppercase tracking-wide text-[#5A5A5A]">Timeline</h3>
        {ALL_KINDS.map(kind => {
          const count = timeline.counts[kind];
          const on = kinds.includes(kind);
          return (
            <button
              key={kind}
              type="button"
              onClick={() => toggle(kind)}
              disabled={count === 0}
              className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                on ? 'border-white/30 bg-white/5 text-white' : 'border-[#1A1A1A] text-[#5A5A5A] hover:text-white'
              } disabled:cursor-default disabled:opacity-30 disabled:hover:text-[#5A5A5A]`}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: TIMELINE_KIND_COLORS[kind] }} />
              {TIMELINE_KIND_LABELS[kind]}
              <span className="text-[#5A5A5A]">{count}</span>
            </button>
          );
        })}
      </div>

      {timeline.total === 0 ? (
        <p className="text-xs text-[#3F3F3F]">
          {emptyHint || 'Nessuna attività registrata.'}
        </p>
      ) : (
        <>
          {timeline.upcoming.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-[#F59E0B]/20 bg-[#F59E0B]/[0.04] px-3 py-2.5">
              <span className="text-[10px] uppercase tracking-wide text-[#F59E0B]">
                Da fare · {timeline.upcoming.length}
              </span>
              <ul className="flex flex-col">
                {timeline.upcoming.map(entry => (
                  <Entry key={entry.id} entry={entry} ownerName={ownerName} planned />
                ))}
              </ul>
            </div>
          )}

          {groups.length === 0 ? (
            <p className="text-xs text-[#3F3F3F]">Nulla di già successo con questi filtri.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {groups.map(group => (
                <div key={group.day} className="flex flex-col gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-[#3F3F3F]">
                    {formatDay(group.day, locale, t)}
                  </span>
                  <ul className="flex flex-col border-l border-[#1A1A1A] pl-3">
                    {group.entries.map(entry => (
                      <Entry key={`${entry.kind}-${entry.id}`} entry={entry} ownerName={ownerName} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {timeline.past.length > limit && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="w-fit text-[11px] text-[#858585] hover:text-white"
            >
              {expanded ? 'Mostra meno' : `Mostra tutte (${timeline.past.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
