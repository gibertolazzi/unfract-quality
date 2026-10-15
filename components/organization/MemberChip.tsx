'use client';

import React, { useEffect, useState } from 'react';
import { OrgMember } from '@/types/organization';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useProject } from '@/contexts/ProjectContext';
import { useTranslation } from '@/contexts/TranslationContext';

interface MemberChipProps {
  member: OrgMember;
  orgId: string;
  onClick: () => void;
}

export function MemberChip({ member, orgId, onClick }: MemberChipProps) {
  const { projects } = useProject();
  const { t } = useTranslation();
  const [roleLabel, setRoleLabel] = useState<string>(member.role === 'admin' ? 'Admin' : 'Member');

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        // Find all projects belonging to this org
        const orgProjects = projects.filter(p => p.organizationIds?.includes(orgId));
        if (orgProjects.length === 0) return;

        // Find this member's access in these projects
        const memberQuery = query(collection(db, 'project_members'), where('userId', '==', member.uid));
        const memberSnap = await getDocs(memberQuery);
        
        const roleIds = new Set<string>();
        memberSnap.forEach(d => {
          const data = d.data();
          if (orgProjects.some(p => p.id === data.projectId)) {
            roleIds.add(data.roleId);
          }
        });

        if (roleIds.size > 0) {
          const roleNames: string[] = [];
          for (const roleId of Array.from(roleIds)) {
            const roleSnap = await getDoc(doc(db, 'project_roles', roleId));
            if (roleSnap.exists()) {
              roleNames.push(roleSnap.data().name);
            }
          }
          if (roleNames.length > 0) {
            setRoleLabel(roleNames.join(', '));
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchRoles();
  }, [member.uid, projects, orgId, member.role]);

  return (
    <div 
      onClick={onClick}
      className={`flex items-center justify-between min-w-[180px] h-[64px] bg-[#0E0E0E] rounded-[24px] border border-white/10 px-4 hover:border-white/20 transition-all cursor-pointer ${member.suspended ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-3">
        <UserAvatar
          src={member.photoURL}
          name={member.displayName}
          initials={member.initials}
          className="w-[34px] h-[34px] rounded-full bg-[#006AFF] flex items-center justify-center text-white text-[12px] font-bold tracking-wider overflow-hidden"
          imageClassName="w-full h-full object-cover"
        />
        <div className="flex flex-col">
          <span className="text-[14px] text-white font-medium">{member.displayName}</span>
          <span className={`text-[11px] capitalize line-clamp-1 ${member.suspended ? 'text-amber-400' : 'text-[#858585]'}`}>{member.suspended ? t.organization.suspended : roleLabel}</span>
        </div>
      </div>
    </div>
  );
}
