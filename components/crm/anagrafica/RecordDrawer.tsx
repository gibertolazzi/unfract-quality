'use client';

import { useState, useRef, useEffect } from 'react';
import {
  X, Pencil, CalendarClock, Archive, ArchiveRestore, Trash2, Copy, Star, MailCheck, MailX, ExternalLink, Send, ChevronDown,
  Paperclip, Download, Plus, Briefcase,
} from 'lucide-react';
import { CrmAccount, CrmContact, CrmCustomer, CrmLead, CrmDocument as CrmDocumentType } from '@/components/crm/types';
import { CUSTOMER_STATUS_LABELS, CUSTOMER_STATUS_COLORS } from '@/lib/crm/anagraficaFilters';
import { LEAD_STATE_LABELS, LEAD_STATE_COLORS } from '@/components/crm/constants';
import { formatDate, Pill } from '../shared/TableUtils';
import { Timeline } from '../timeline/Timeline';
import { TimelineSources } from '@/lib/crm/timeline';
import { UploadPanel, UploadRunner } from '../documenti/UploadPanel';
import { DocumentTarget } from '@/lib/crm/documentUpload';
import { formatBytes } from '@/lib/crm/documentFilters';
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape';
import { CustomListDropdown } from './CustomListDropdown';


function QuickFollowupMenu({ onSelect }: { onSelect: (days?: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useCloseOnEscape(() => setOpen(false));
  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative z-50">
      <button type="button" onClick={() => setOpen(!open)} className="px-3 py-1.5 rounded-lg border border-[#1A1A1A] bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[11px] text-white flex items-center gap-1.5 transition-colors">
        Imposta follow-up <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 min-w-[150px] overflow-hidden rounded-xl border border-[#1A1A1A] bg-[#111111] py-1 shadow-xl">
          <button onClick={() => { onSelect(1); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-white/5 text-white">Domani</button>
          <button onClick={() => { onSelect(3); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-white/5 text-white">Tra 3 giorni</button>
          <button onClick={() => { onSelect(7); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-white/5 text-white">Tra 1 settimana</button>
          <button onClick={() => { onSelect(30); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-white/5 text-white">Tra 1 mese</button>
          <div className="my-1 border-t border-[#1A1A1A]" />
          <button onClick={() => { onSelect(undefined); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-white/5 text-[#0D6EFD]">Personalizzato...</button>
        </div>
      )}
    </div>
  );
}

export type DrawerTarget =
  | { kind: 'account'; record: CrmAccount }
  | { kind: 'contact'; record: CrmContact }
  | { kind: 'customer'; record: CrmCustomer }
  | { kind: 'lead'; record: CrmLead };

interface RecordDrawerProps {
  target: DrawerTarget;
  accounts: CrmAccount[];
  contacts: CrmContact[];
  customers: CrmCustomer[];
  leads: CrmLead[];
  /** Storico del progetto: la timeline ci pesca quello dell'entità aperta. */
  history: TimelineSources;
  ownerName: (uid: string) => string;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete?: () => void;
  onRestore: () => void;
  /** Naviga a un'altra scheda restando nella stessa pagina. */
  onOpen: (target: DrawerTarget) => void;
  /** Crea un contatto già collegato a questa azienda. */
  onAddContact: (accountId: string) => void;
  onAddCustomer?: (accountId: string) => void;
  onRemoveCustomer?: (customer: CrmCustomer) => void;
  onConvertLead?: (lead: CrmLead) => void;
  /** Apre la composizione di un'email verso questo contatto. */
  onCompose: (contact: CrmContact) => void;
  /**
   * Carica un allegato già collegato a questa scheda. È l'unico modo di avere
   * documenti agganciati a un record: dalla scheda Documenti si carica «nel
   * progetto», senza collegamento.
   */
  onUploadDocument: (target: DocumentTarget) => UploadRunner;
  /** Scarica un allegato passando dall'audit, come nella scheda Documenti. */
  onDownloadDocument: (document: CrmDocumentType) => void;
  onQuickFollowup?: (days?: number) => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-[#5A5A5A]">{label}</span>
      <span className="text-right text-xs text-[#C4C4C4]">{children}</span>
    </div>
  );
}

function Section({ title, count, children, action }: {
  title: string; count?: number; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">
          {title}{count !== undefined && ` · ${count}`}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function LinkRow({ title, subtitle, onClick, badge }: {
  title: string; subtitle?: string; onClick: () => void; badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2 text-left transition-colors hover:border-[#2A2A2A]"
    >
      <span className="flex flex-col">
        <span className="flex items-center gap-1.5 text-xs text-white">{title} {badge}</span>
        {subtitle && <span className="text-[11px] text-[#5A5A5A]">{subtitle}</span>}
      </span>
      <ExternalLink size={12} className="shrink-0 text-[#3F3F3F]" />
    </button>
  );
}

/**
 * Scheda del record, di fianco alla lista invece che su una pagina a parte:
 * si apre, si legge, si torna all'elenco senza perdere filtri e posizione.
 */
export function RecordDrawer({
  target, accounts, contacts, customers, leads, history, ownerName,
  onClose, onEdit, onArchive, onDelete, onRestore, onOpen, onAddContact, onAddCustomer, onRemoveCustomer, onConvertLead, onCompose, onUploadDocument, onDownloadDocument, onQuickFollowup,
}: RecordDrawerProps) {
  const { kind, record } = target;
  const [uploading, setUploading] = useState(false);

  useCloseOnEscape(onClose, !uploading);

  /** Il collegamento del documento segue l'entità aperta, non la si sceglie. */
  const documentTarget: DocumentTarget =
    kind === 'account' ? { accountId: record.id }
    : kind === 'contact' ? { contactId: record.id }
    : { customerId: record.id, accountId: (record as CrmCustomer).accountId };

  const attachments = history.documents.filter(document => {
    if (document.archived) return false;
    if (kind === 'account') return document.accountId === record.id;
    if (kind === 'contact') return document.contactId === record.id;
    if (kind === 'lead') return document.leadId === record.id;
    return document.customerId === record.id;
  });

  const accountById = (id: string) => accounts.find(a => a.id === id) || null;
  const contactById = (id: string) => contacts.find(c => c.id === id) || null;

  const title =
    kind === 'account' ? (record as CrmAccount).displayName || (record as CrmAccount).legalName
    : kind === 'contact' ? (record as CrmContact).fullName
    : accountById((record as CrmCustomer).accountId)?.displayName || 'Cliente';

  const subtitle =
    kind === 'account' ? 'Azienda'
    : kind === 'contact' ? ((record as CrmContact).role || 'Contatto')
    : kind === 'customer' ? 'Cliente'
    : 'Lead';

  // Duplicati segnalati: possono puntare a una qualunque delle tre anagrafiche.
  const duplicates = (record as any).duplicateCandidateIds as string[] | undefined;

  const resolveDuplicate = (id: string): DrawerTarget | null => {
    const account = accounts.find(a => a.id === id);
    if (account) return { kind: 'account', record: account };
    const contact = contacts.find(c => c.id === id);
    if (contact) return { kind: 'contact', record: contact };
    return null;
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="flex-1 bg-black/50" onClick={onClose} />

      <aside className="flex h-full w-full max-w-md flex-col overflow-hidden border-l border-[#1A1A1A] bg-[#0B0B0B]">
        <header className="flex items-start justify-between gap-3 border-b border-[#1A1A1A] px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-medium text-white">{title || '—'}</h2>
            <p className="text-[11px] text-[#5A5A5A]">{subtitle}</p>
          </div>

          <div className="flex items-center gap-1">
            <button type="button" onClick={onEdit} title="Modifica" className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-white">
              <Pencil size={14} />
            </button>
            {record.archived ? (
              <button type="button" onClick={onRestore} title="Ripristina" className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-white">
                <ArchiveRestore size={14} />
              </button>
            ) : (
              <> <button type="button" onClick={onArchive} title="Archivia" className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-[#EF4444]">
                <Archive size={14} />
              </button>
              {onDelete && (
                <button type="button" onClick={onDelete} title="Elimina definitivamente" className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-[#EF4444]">
                  <Trash2 size={14} />
                </button>
              )} </>
            )}
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-white">
              <X size={15} />
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-6 overflow-y-auto px-5 py-5">
          
          {/* Quick Actions Bar */}
          <div className="grid grid-cols-2 gap-2 mt-[-10px] mb-2">
            <button
              onClick={() => setUploading(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#0D6EFD]/20 bg-[#0D6EFD]/10 px-4 py-2.5 text-xs font-medium text-[#0D6EFD] transition-colors hover:bg-[#0D6EFD]/20"
            >
              <Paperclip size={14} /> Allega File
            </button>
            <CustomListDropdown recordId={record.id} />
            {kind === 'lead' && onConvertLead && (
              <button
                onClick={() => onConvertLead(record as CrmLead)}
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-[#0D6EFD]/20 bg-[#0D6EFD]/10 px-4 py-2.5 text-xs font-medium text-[#0D6EFD] transition-colors hover:bg-[#0D6EFD]/20"
              >
                <Briefcase size={14} /> Converti in Cliente
              </button>
            )}
            {kind === 'account' && !customers.some(c => c.accountId === record.id && !c.archived) && onAddCustomer && (
              <button
                onClick={() => onAddCustomer(record.id)}
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-[#0D6EFD]/20 bg-[#0D6EFD]/10 px-4 py-2.5 text-xs font-medium text-[#0D6EFD] transition-colors hover:bg-[#0D6EFD]/20"
              >
                <Briefcase size={14} /> Nuovo Cliente
              </button>
            )}
            {kind === 'account' && customers.some(c => c.accountId === record.id && !c.archived) && onRemoveCustomer && (
              <button
                onClick={() => {
                  const customer = customers.find(c => c.accountId === record.id && !c.archived);
                  if (customer) onRemoveCustomer(customer);
                }}
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-transparent bg-[#FF0004]/10 px-4 py-2.5 text-xs font-medium text-[#FF0004] transition-colors hover:bg-[#FF0004]/20"
              >
                <Trash2 size={14} /> Rimuovi Cliente
              </button>
            )}
            {kind === 'contact' && customers.some(c => c.contactIds?.includes(record.id) && !c.archived) && onRemoveCustomer && (
              <button
                onClick={() => {
                  const customer = customers.find(c => c.contactIds?.includes(record.id) && !c.archived);
                  if (customer) onRemoveCustomer(customer);
                }}
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-transparent bg-[#FF0004]/10 px-4 py-2.5 text-xs font-medium text-[#FF0004] transition-colors hover:bg-[#FF0004]/20"
              >
                <Trash2 size={14} /> Rimuovi Cliente
              </button>
            )}
            {kind === 'contact' && !customers.some(c => c.contactIds?.includes(record.id) && !c.archived) && onAddCustomer && (
              <button
                onClick={() => onAddCustomer(record.id)}
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-[#0D6EFD]/20 bg-[#0D6EFD]/10 px-4 py-2.5 text-xs font-medium text-[#0D6EFD] transition-colors hover:bg-[#0D6EFD]/20"
              >
                <Briefcase size={14} /> Nuovo Cliente
              </button>
            )}
          </div>


          {onQuickFollowup && !record.archived && (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-[#1A1A1A] bg-[#0F0F0F] px-4 py-3">
              <CalendarClock size={14} className="text-[#00A6FF]" />
              <span className="text-xs text-[#E5E5E5] mr-2">Prossimo follow-up:</span>
              <QuickFollowupMenu onSelect={onQuickFollowup} />
            </div>
          )}

          {record.archived && (
            <p className="rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2 text-[11px] text-[#858585]">
              Record archiviato il {formatDate(record.archivedAt)}. Non viene cancellato: si può ripristinare.
            </p>
          )}

          {record.origin === 'import' && (
            <p className="rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2 text-[11px] text-[#858585]">
              Importato da <span className="text-[#C4C4C4]">{record.provider || 'file'}</span>
              {record.approvalStatus === 'pending' && ' · da approvare'}
            </p>
          )}

          
          {/* ------------------------------------------------------ lead */}
          {kind === 'lead' && (() => {
            const lead = record as CrmLead;
            return (
              <>
                <div className="flex flex-col gap-3 rounded-2xl border border-[#1A1A1A] px-4 py-4">
                  <Row label="Stato">
                    <Pill color={LEAD_STATE_COLORS[lead.state]} label={LEAD_STATE_LABELS[lead.state]} />
                  </Row>
                  {lead.fullName && <Row label="Nome Completo">{lead.fullName}</Row>}
                  {lead.companyName && <Row label="Azienda">{lead.companyName}</Row>}
                  {(lead as any).role && <Row label="Ruolo">{(lead as any).role}</Row>}
                  {lead.email && <Row label="Email">{lead.email}</Row>}
                  {lead.phone && <Row label="Telefono">{lead.phone}</Row>}
                  {(lead as any).companyWebsite && <Row label="Sito Web">{(lead as any).companyWebsite}</Row>}
                </div>
              </>
            );
          })()}

          {/* ------------------------------------------------------ azienda */}
          {kind === 'account' && (() => {
            const account = record as CrmAccount;
            const accountContacts = contacts.filter(c => c.accountId === account.id && !c.archived);
            const linkedCustomer = customers.find(c => c.accountId === account.id && !c.archived);
            // Lead con lo stesso dominio: non sono collegati formalmente, ma è
            // quasi sempre la stessa azienda arrivata da un'altra strada.
            const relatedLeads = account.domain
              ? leads.filter(l => l.companyDomain === account.domain && !l.archived)
              : [];

            return (
              <>
                <div className="flex flex-col divide-y divide-[#131313]">
                  {account.legalName && <Row label="Ragione sociale">{account.legalName}</Row>}
                  {account.vatNumber && <Row label="Partita IVA">{account.vatNumber}</Row>}
                  {account.taxCode && <Row label="Codice fiscale">{account.taxCode}</Row>}
                  {account.industry && <Row label="Settore">{account.industry}</Row>}
                  {account.sizeRange && <Row label="Dipendenti">{account.sizeRange}</Row>}
                  {account.domain && (
                    <Row label="Sito">
                      <a href={`https://${account.domain}`} target="_blank" rel="noreferrer noopener" className="hover:text-white hover:underline">
                        {account.domain}
                      </a>
                    </Row>
                  )}
                  {(account.address || account.city) && (
                    <Row label="Sede">
                      {[account.address, account.postalCode, account.city, account.region, account.country]
                        .filter(Boolean).join(', ')}
                    </Row>
                  )}
                  <Row label="Owner">{ownerName(account.ownerUid) || '—'}</Row>
                  <Row label="Aggiornato">{formatDate(account.updatedAt)}</Row>
                </div>

                <Section
                  title="Contatti"
                  count={accountContacts.length}
                  action={
                    <button
                      type="button"
                      onClick={() => onAddContact(account.id)}
                      className="text-[11px] text-[#858585] hover:text-white"
                    >
                      + Aggiungi
                    </button>
                  }
                >
                  {accountContacts.length === 0 ? (
                    <p className="text-xs text-[#3F3F3F]">Nessun contatto collegato.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {accountContacts.map(contact => (
                        <LinkRow
                          key={contact.id}
                          title={contact.fullName}
                          subtitle={[contact.role, contact.email].filter(Boolean).join(' · ')}
                          badge={contact.isPrimary ? <Star size={10} className="text-[#F59E0B]" /> : undefined}
                          onClick={() => onOpen({ kind: 'contact', record: contact })}
                        />
                      ))}
                    </div>
                  )}
                </Section>

                {linkedCustomer ? (
                  <Section title="Cliente">
                    <LinkRow
                      title={CUSTOMER_STATUS_LABELS[linkedCustomer.status]}
                      subtitle={`Cliente dal ${formatDate(linkedCustomer.customerSince)}`}
                      onClick={() => onOpen({ kind: 'customer', record: linkedCustomer })}
                    />
                  </Section>
                ) : null}

                {relatedLeads.length > 0 && (
                  <Section title="Lead con lo stesso dominio" count={relatedLeads.length}>
                    <div className="flex flex-col gap-1.5">
                      {relatedLeads.map(lead => (
                        <div key={lead.id} className="flex items-center justify-between gap-2 rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2">
                          <span className="flex flex-col">
                            <span className="text-xs text-white">{lead.fullName || lead.companyName}</span>
                            {lead.email && <span className="text-[11px] text-[#5A5A5A]">{lead.email}</span>}
                          </span>
                          <Pill color={LEAD_STATE_COLORS[lead.state]} label={LEAD_STATE_LABELS[lead.state]} />
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </>
            );
          })()}

          {/* ----------------------------------------------------- contatto */}
          {kind === 'contact' && (() => {
            const contact = record as CrmContact;
            const account = accountById(contact.accountId);
            const asReferent = customers.filter(c => c.contactIds.includes(contact.id) && !c.archived);

            return (
              <>
                <div className="flex flex-col divide-y divide-[#131313]">
                  {contact.email && (
                    <Row label="Email">
                      <a href={`mailto:${contact.email}`} className="hover:text-white hover:underline">{contact.email}</a>
                    </Row>
                  )}
                  {contact.phone && (
                    <Row label="Telefono">
                      <a href={`tel:${contact.phone}`} className="hover:text-white hover:underline">{contact.phone}</a>
                    </Row>
                  )}
                  {contact.role && <Row label="Ruolo">{contact.role}</Row>}
                  {contact.preferredChannel && <Row label="Canale preferito">{contact.preferredChannel}</Row>}
                  {contact.preferredTime && <Row label="Quando contattarlo">{contact.preferredTime}</Row>}
                  <Row label="Aggiornato">{formatDate(contact.updatedAt)}</Row>
                </div>

                <Section
                  title="Consensi"
                  action={
                    <button
                      type="button"
                      onClick={() => onCompose(contact)}
                      className="flex items-center gap-1 text-[11px] text-[#858585] hover:text-white"
                    >
                      <Send size={10} /> Scrivi email
                    </button>
                  }
                >
                  <div className="flex flex-col gap-1.5">
                    {contact.suppressed && (
                      <p className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-[11px] text-[#EF4444]">
                        Escluso da ogni invio{contact.suppressedReason ? `: ${contact.suppressedReason}` : ''}
                      </p>
                    )}
                    {(['email', 'sms'] as const).map(channel => {
                      const consent = contact.consents[channel];
                      return (
                        <div key={channel} className="flex items-center justify-between gap-2 rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2">
                          <span className="flex items-center gap-2 text-xs text-[#C4C4C4]">
                            {consent.granted
                              ? <MailCheck size={13} className="text-[#10B981]" />
                              : <MailX size={13} className="text-[#3F3F3F]" />}
                            {channel === 'email' ? 'Email' : 'SMS'}
                          </span>
                          <span className="text-right text-[11px] text-[#5A5A5A]">
                            {consent.granted
                              ? `${consent.source || 'fonte non indicata'} · ${consent.policyVersion || 'senza versione'}`
                              : 'Non concesso'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Section>

                <Section title="Azienda">
                  {account ? (
                    <LinkRow
                      title={account.displayName || account.legalName}
                      subtitle={[account.industry, account.city].filter(Boolean).join(' · ')}
                      onClick={() => onOpen({ kind: 'account', record: account })}
                    />
                  ) : (
                    <p className="text-xs text-[#3F3F3F]">Nessuna azienda collegata.</p>
                  )}
                </Section>

                {asReferent.length > 0 && (
                  <Section title="Referente per" count={asReferent.length}>
                    <div className="flex flex-col gap-1.5">
                      {asReferent.map(customer => (
                        <LinkRow
                          key={customer.id}
                          title={accountById(customer.accountId)?.displayName || 'Cliente'}
                          subtitle={CUSTOMER_STATUS_LABELS[customer.status]}
                          onClick={() => onOpen({ kind: 'customer', record: customer })}
                        />
                      ))}
                    </div>
                  </Section>
                )}
              </>
            );
          })()}

          {/* ------------------------------------------------------ cliente */}
          {kind === 'customer' && (() => {
            const customer = record as CrmCustomer;
            const account = accountById(customer.accountId);
            const referents = customer.contactIds.map(contactById).filter(Boolean) as CrmContact[];
            const originLead = customer.originLeadId ? leads.find(l => l.id === customer.originLeadId) : null;

            return (
              <>
                <div className="flex flex-col divide-y divide-[#131313]">
                  <Row label="Stato">
                    <Pill color={CUSTOMER_STATUS_COLORS[customer.status]} label={CUSTOMER_STATUS_LABELS[customer.status]} />
                  </Row>
                  <Row label="Cliente dal">{formatDate(customer.customerSince)}</Row>
                  {(customer.monthlyAmount || 0) > 0 && <Row label="Mensile">{new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(customer.monthlyAmount!)}</Row>}
                  {(customer.annualAmount || 0) > 0 && <Row label="Annuale">{new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(customer.annualAmount!)}</Row>}
                  {(customer.oneTimeAmount || 0) > 0 && <Row label="Una tantum">{new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(customer.oneTimeAmount!)}</Row>}
                  <Row label="Owner">{ownerName(customer.ownerUid) || '—'}</Row>
                  <Row label="Progetti collegati">{customer.linkedProjectIds.length || '—'}</Row>
                  <Row label="Aggiornato">{formatDate(customer.updatedAt)}</Row>
                </div>

                <Section title="Azienda">
                  {account ? (
                    <LinkRow
                      title={account.displayName || account.legalName}
                      subtitle={[account.vatNumber && `P.IVA ${account.vatNumber}`, account.city].filter(Boolean).join(' · ')}
                      onClick={() => onOpen({ kind: 'account', record: account })}
                    />
                  ) : (
                    <p className="text-xs text-[#EF4444]">
                      L’azienda collegata non esiste più o non è leggibile.
                    </p>
                  )}
                </Section>

                <Section title="Referenti" count={referents.length}>
                  {referents.length === 0 ? (
                    <p className="text-xs text-[#3F3F3F]">Nessun referente indicato.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {referents.map(contact => (
                        <LinkRow
                          key={contact.id}
                          title={contact.fullName}
                          subtitle={[contact.role, contact.email].filter(Boolean).join(' · ')}
                          onClick={() => onOpen({ kind: 'contact', record: contact })}
                        />
                      ))}
                    </div>
                  )}
                </Section>

                {originLead && (
                  <Section title="Lead di origine">
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2">
                      <span className="text-xs text-white">{originLead.fullName || originLead.companyName}</span>
                      <Pill color={LEAD_STATE_COLORS[originLead.state]} label={LEAD_STATE_LABELS[originLead.state]} />
                    </div>
                  </Section>
                )}

                {customer.privateNotes && (
                  <Section title="Note riservate">
                    <p className="whitespace-pre-wrap rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2 text-xs text-[#C4C4C4]">
                      {customer.privateNotes}
                    </p>
                  </Section>
                )}
              </>
            );
          })()}

          {duplicates && duplicates.length > 0 && (
            <Section title="Possibili duplicati" count={duplicates.length}>
              <div className="flex flex-col gap-1.5">
                {duplicates.map(id => {
                  const resolved = resolveDuplicate(id);
                  return resolved ? (
                    <LinkRow
                      key={id}
                      title={resolved.kind === 'account'
                        ? (resolved.record as CrmAccount).displayName
                        : (resolved.record as CrmContact).fullName}
                      subtitle={resolved.kind === 'account' ? 'Azienda' : 'Contatto'}
                      badge={<Copy size={10} className="text-[#F59E0B]" />}
                      onClick={() => onOpen(resolved)}
                    />
                  ) : (
                    <p key={id} className="text-[11px] text-[#5A5A5A]">
                      Segnalato un duplicato che non è più raggiungibile ({id}).
                    </p>
                  );
                })}
              </div>
              <p className="text-[10px] text-[#3F3F3F]">
                Segnalati e non fusi: l’unione è una decisione, non un automatismo.
              </p>
            </Section>
          )}

          <Section
            title="Allegati"
            count={attachments.length}
            action={
              <button
                type="button"
                onClick={() => setUploading(true)}
                className="flex items-center gap-1 text-[10px] text-[#858585] transition-colors hover:text-white"
              >
                <Plus size={10} /> Allega
              </button>
            }
          >


            {attachments.length === 0 ? (
              <p className="text-[11px] text-[#5A5A5A]">Nessun allegato su questa scheda.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {attachments.map(document => (
                  <li
                    key={document.id}
                    className="flex items-center gap-2 rounded-xl border border-[#1A1A1A] px-3 py-2"
                  >
                    <Paperclip size={11} className="shrink-0 text-[#5A5A5A]" />
                    <span className="min-w-0 flex-1 truncate text-[11px] text-[#C4C4C4]">
                      {document.fileName}
                    </span>
                    {document.versions.length > 1 && (
                      <span className="shrink-0 text-[10px] text-[#5A5A5A]">v{document.versions.length}</span>
                    )}
                    <span className="shrink-0 text-[10px] text-[#3F3F3F]">{formatBytes(document.sizeBytes)}</span>
                    <button
                      type="button"
                      onClick={() => onDownloadDocument(document)}
                      title="Scarica"
                      className="shrink-0 rounded-lg p-1 text-[#5A5A5A] transition-colors hover:text-white"
                    >
                      <Download size={11} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Timeline
            sources={history}
            reference={
              kind === 'account' ? { accountId: record.id }
              : kind === 'contact' ? { contactId: record.id }
              : { customerId: record.id, accountId: (record as CrmCustomer).accountId }
            }
            ownerName={ownerName}
            emptyHint="Nessuna attività registrata su questa scheda."
          />

          {(record as any).notes && (
            <Section title="Note">
              <p className="whitespace-pre-wrap rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2 text-xs text-[#C4C4C4]">
                {(record as any).notes}
              </p>
            </Section>
          )}
        </div>
      </aside>

      {uploading && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative flex w-full max-w-[420px] flex-col overflow-hidden rounded-[24px] border border-[#1A1A1A] bg-[#111111] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#1A1A1A] px-5 py-4">
              <h2 className="text-[15px] font-medium text-white">Allega File</h2>
              <button
                onClick={() => setUploading(false)}
                className="rounded-lg p-1.5 text-[#858585] transition-colors hover:bg-white/5 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5">
              <UploadPanel
                compact
                targetLabel={title || 'questa scheda'}
                onUpload={onUploadDocument(documentTarget)}
                onDone={() => setUploading(false)}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
