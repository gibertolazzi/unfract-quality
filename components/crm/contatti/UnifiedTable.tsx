import { ChevronDown, ChevronUp } from 'lucide-react';
import { CrmAccount, CrmContact, CrmCustomer, CrmLead } from '../types';

const tableClass = "w-full text-left border-collapse";
const thClass = "px-4 py-3 text-[10px] font-medium uppercase tracking-wide text-[#5A5A5A] border-b border-[#1A1A1A]";
const tdClass = "px-4 py-3 text-xs text-[#858585] border-b border-[#1A1A1A]";


export type UnifiedEntity = 'lead' | 'account' | 'contact' | 'customer';

export interface UnifiedRecord {
  id: string;
  type: UnifiedEntity;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  status: string;
  value?: number;
  raw: any;
}

interface UnifiedTableProps {
  records: UnifiedRecord[];
  onOpen: (record: UnifiedRecord) => void;
  selectedIds: string[];
  onSelect: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
}

export function UnifiedTable({ records, onOpen, selectedIds, onSelect, onSelectAll }: UnifiedTableProps) {
  const allSelected = records.length > 0 && records.every(r => selectedIds.includes(r.id));
  const typeLabel = {
    lead: 'Lead',
    account: 'Azienda',
    contact: 'Contatto',
    customer: 'Cliente',
  };

  return (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={thClass} style={{ width: '40px' }}>
              <input 
                type="checkbox" 
                checked={allSelected}
                onChange={e => onSelectAll(e.target.checked)}
                className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]"
              />
            </th>
            <th className={thClass}>Nome</th>
            <th className={thClass}>Tipo</th>
            <th className={thClass}>Azienda</th>
            <th className={thClass}>Email</th>
            <th className={thClass}>Telefono</th>
            <th className={thClass}>Stato / Info</th>
            <th className={thClass}>Valore</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr>
              <td colSpan={8} className={`${tdClass} text-center py-8 text-[#858585]`}>
                Nessun record trovato
              </td>
            </tr>
          ) : (
            records.map(record => (
              <tr
                key={`${record.type} data-drag-id={item.id} data-drag-type={item.type} data-drag-name={item.name}-${record.id}`}
                onClick={() => onOpen(record)}
                className="group cursor-pointer hover:bg-white/5 transition-colors"
              >
                <td className={tdClass} onClick={e => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(record.id)}
                    onChange={e => onSelect(record.id, e.target.checked)}
                    className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]"
                  />
                </td>
                <td className={`${tdClass} font-medium text-white`}>{record.name}</td>
                <td className={tdClass}>
                  <span className="inline-block rounded px-2 py-0.5 text-[10px] uppercase tracking-wider bg-white/10 text-white/70">
                    {typeLabel[record.type]}
                  </span>
                </td>
                <td className={tdClass}>{record.companyName}</td>
                <td className={tdClass}>{record.email}</td>
                <td className={tdClass}>{record.phone}</td>
                <td className={tdClass}>{record.status}</td>
                <td className={tdClass}>{record.value ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(record.value) : '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
