import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Folder, Users, Plus, Loader2 } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { createOrganization } from '@/lib/orgWorkspace';
import { useToast } from '@/contexts/ToastContext';
import { authedFetch } from '@/lib/authedFetch';
import { useTranslation } from '@/contexts/TranslationContext';

interface CreateProjectModalProps {
  onClose: () => void;
  /** Se lancia, la finestra resta aperta: il messaggio lo mostra chi chiama. */
  onCreate: (name: string, organizationIds?: string[]) => Promise<void>;
}

export function CreateProjectModal({ onClose, onCreate }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const { organizations } = useOrganization();
  const { user } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);

  // Organization creation state
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [inviteEmails, setInviteEmails] = useState('');
  const [isSubmittingOrg, setIsSubmittingOrg] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onCreate(name.trim(), selectedOrgIds.length > 0 ? selectedOrgIds : undefined);
    } catch {
      // Errore già mostrato da chi chiama; la finestra resta aperta per riprovare.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim() || !user) return;
    setIsSubmittingOrg(true);
    try {
      // Organizzazione, workspace e accesso del creatore nascono insieme.
      const orgId = await createOrganization(user, newOrgName.trim());
      
      // Handle invites
      const emails = inviteEmails.split(',').map(e => e.trim()).filter(e => e.includes('@'));
      if (emails.length > 0) {
        await Promise.all(emails.map(email =>
          authedFetch('/api/email/invite', {
            method: 'POST',
            body: JSON.stringify({ orgId, email })
          }).catch(err => console.error("Errore invio invito:", err))
        ));
      }

      setSelectedOrgIds([...selectedOrgIds, orgId]);
      setIsCreatingOrg(false);
      setNewOrgName('');
      setInviteEmails('');
      toast.success(t.tasks.orgCreatedSuccess);
    } catch (error) {
      console.error("Errore creazione org:", error);
      toast.error(t.tasks.orgCreateError);
    } finally {
      setIsSubmittingOrg(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/5">
          <h2 className="text-lg font-semibold text-white/90">{t.tasks.newProject}</h2>
          <button onClick={onClose} className="text-[#858585] hover:text-white transition-colors p-1 rounded-md hover:bg-white/10">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm text-white/70 flex items-center gap-2">
              <Folder size={14} className="text-[#006AFF]" /> {t.tasks.projectName}
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t.tasks.projectPlaceholder}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#006AFF] transition-colors"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-white/70 flex items-center gap-2">
                <Users size={14} className="text-[#006AFF]" /> {t.tasks.organization}
              </label>
              {!isCreatingOrg && (
                <button 
                  type="button" 
                  onClick={() => setIsCreatingOrg(true)}
                  className="text-xs text-[#006AFF] hover:text-[#0088FF] flex items-center gap-1 transition-colors"
                >
                  <Plus size={12} /> {t.tasks.createNew}
                </button>
              )}
            </div>

            {isCreatingOrg ? (
              <div className="flex flex-col gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                <input
                  type="text"
                  value={newOrgName}
                  onChange={e => setNewOrgName(e.target.value)}
                  placeholder={t.tasks.orgName}
                  className="bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#006AFF] transition-colors"
                />
                <input
                  type="text"
                  value={inviteEmails}
                  onChange={e => setInviteEmails(e.target.value)}
                  placeholder={t.tasks.inviteEmails}
                  className="bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#006AFF] transition-colors"
                />
                <div className="flex justify-end gap-2 mt-1">
                  <button 
                    type="button" 
                    onClick={() => setIsCreatingOrg(false)}
                    className="px-3 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  >
                    {t.tasks.cancel}
                  </button>
                  <button 
                    type="button" 
                    onClick={handleCreateOrg}
                    disabled={!newOrgName.trim() || isSubmittingOrg}
                    className="px-3 py-1.5 bg-[#006AFF] hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                  >
                    {isSubmittingOrg && <Loader2 size={12} className="animate-spin" />}
                    {t.tasks.createAndInvite}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar p-2 bg-white/5 border border-white/10 rounded-xl">
                {organizations.length === 0 ? (
                  <div className="flex items-center justify-center py-4 px-2 text-center">
                    <span className="text-[#858585] text-xs">{t.tasks.noOrgLinked}</span>
                  </div>
                ) : (
                  organizations.map(org => (
                    <label key={org.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        className="appearance-none shrink-0 h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]"
                        checked={selectedOrgIds.includes(org.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOrgIds([...selectedOrgIds, org.id]);
                          } else {
                            setSelectedOrgIds(selectedOrgIds.filter(id => id !== org.id));
                          }
                        }}
                      />
                      <span className="text-sm text-white/90">{org.name}</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-full font-medium transition-colors">
              {t.tasks.cancel}
            </button>
            <button 
              type="submit" 
              disabled={!name.trim() || isSubmitting}
              className="px-5 py-2.5 bg-[#006AFF] hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-[#006AFF] text-white rounded-full text-sm font-medium transition-colors flex items-center gap-2"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {t.tasks.createProject}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
