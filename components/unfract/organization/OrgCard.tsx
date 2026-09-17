import React from 'react';
import Link from 'next/link';
import { MoreVertical } from 'lucide-react';
import { Organization } from './types';

export function OrgCard({ org }: { org: Organization }) {
  return (
    <Link href={`/organization/${org.id}`} className="block">
      <div className="w-full h-[96px] bg-[#0E0E0E] rounded-[32px] border border-white/10 flex items-center justify-between px-8 transition-all hover:border-white/20 cursor-pointer group">
        <div className="flex items-center gap-5">
          <div className="w-[42px] h-[42px] rounded-full bg-[#006AFF] flex items-center justify-center border-[2px] border-[#006AFF] group-hover:shadow-[0_0_15px_rgba(0,106,255,0.4)] transition-shadow overflow-hidden">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="w-full h-full object-cover" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <h3 className="text-[15px] font-semibold text-white tracking-tight">{org.name}</h3>
            <span className="text-[13px] text-[#858585]">{org.memberCount} members</span>
          </div>
        </div>
        <button className="w-8 h-8 rounded-full flex items-center justify-center text-[#858585] hover:bg-white/10 hover:text-white transition-colors">
          <MoreVertical size={18} />
        </button>
      </div>
    </Link>
  );
}
