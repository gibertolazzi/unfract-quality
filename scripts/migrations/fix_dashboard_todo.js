const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/dashboard/DashboardSection.tsx';
let content = fs.readFileSync(path, 'utf8');

// Aggiungiamo onOpenRecord ai props
content = content.replace(
  'onShowCustomers: () => void;\n}',
  'onShowCustomers: () => void;\n  onOpenRecord?: (target: { kind: "lead" | "account" | "contact" | "customer"; recordId: string }) => void;\n}'
);

const oldWidgetTarget = `      <WidgetCard
        title="Chiamate e meeting imminenti"
        subtitle="Prossimi 14 giorni"
        notes={contacts.notes}
        action={{ label: 'Apri i follow-up', onClick: () => onShowFollowups('week') }}
      >
        {contacts.data.length === 0 ? (
          <EmptyLine text="Niente in programma nei prossimi 14 giorni." />
        ) : (
          <ul className="flex flex-col gap-1">
            {contacts.data.slice(0, 6).map(({ followup, due, typeLabel }) => {
              const Icon = followup.type === 'call' ? Phone : Users;
              return (
                <li key={followup.id} className="flex items-center gap-2 rounded-xl border border-[#1A1A1A] px-3 py-2">
                  <Icon size={11} className="shrink-0 text-[#5A5A5A]" />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-white">{followup.title || typeLabel}</span>
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: PRIORITY_COLORS[followup.priority] }}
                    title={\`Priorità \${followup.priority}\`}
                  />
                  <span className="shrink-0 text-[10px] text-[#858585]">
                    {due === todayISO() ? 'oggi' : formatDate(due)}
                  </span>
                  <span className="shrink-0 text-[10px] text-[#5A5A5A]">{ownerName(followup.assigneeUid)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </WidgetCard>`;

const newWidgetTarget = `      <WidgetCard
        title="Da fare oggi"
        subtitle="Task in ritardo o in scadenza oggi"
        notes={['Lista unificata di tutti i follow-up che richiedono la tua attenzione oggi. Clicca su un task per aprire direttamente la scheda del contatto.']}
        action={{ label: 'Vedi tutti', onClick: () => onShowFollowups('today') }}
      >
        {(() => {
          const today = todayISO();
          const isLive = (f: any) => !f.archived && (f.state === 'OPEN' || f.state === 'IN_PROGRESS');
          
          const todoList = followups
            .filter(isLive)
            .filter(f => f.dueDate && f.dueDate <= today)
            .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

          if (todoList.length === 0) {
            return <EmptyLine text="Nessun task per oggi! Ottimo lavoro." />;
          }

          return (
            <ul className="flex flex-col gap-1.5 overflow-y-auto max-h-[300px] pr-1 custom-scrollbar">
              {todoList.map((f) => {
                const isOverdue = f.dueDate && f.dueDate < today;
                const kind = f.leadId ? 'lead' : f.customerId ? 'customer' : f.accountId ? 'account' : f.contactId ? 'contact' : null;
                const targetId = f.leadId || f.customerId || f.accountId || f.contactId;

                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => {
                         if (kind && targetId && props.onOpenRecord) {
                           props.onOpenRecord({ kind: kind as any, recordId: targetId });
                         } else {
                           onShowFollowups('today');
                         }
                      }}
                      className="w-full flex items-center justify-between gap-3 rounded-xl border border-[#1A1A1A] bg-[#0B0B0B] px-3 py-2.5 transition-all hover:border-white/20 hover:bg-white/5 text-left group"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[12px] font-medium text-white truncate">{f.title || 'Senza titolo'}</span>
                        <span className="text-[10px] text-[#858585] truncate">
                          {kind === 'lead' ? 'Lead' : kind === 'customer' ? 'Cliente' : kind === 'contact' ? 'Contatto' : kind === 'account' ? 'Azienda' : 'Generico'} 
                          {f.notes ? \` • \${f.notes}\` : ''}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={\`text-[10px] font-medium px-1.5 py-0.5 rounded \${isOverdue ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}\`}>
                          {isOverdue ? 'In ritardo' : 'Oggi'}
                        </span>
                        <span className="text-[9px] text-[#5A5A5A] opacity-0 group-hover:opacity-100 transition-opacity">
                          Clicca per aprire →
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          );
        })()}
      </WidgetCard>`;

content = content.replace(oldWidgetTarget, newWidgetTarget);

fs.writeFileSync(path, content, 'utf8');
