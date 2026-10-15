export interface OrgMember {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  initials: string;
  role: 'admin' | 'member';
  /** Sospeso: resta nell'elenco ma non ha accesso (lib/server/orgMembers.ts). */
  suspended?: boolean;
  suspendedAt?: number;
}

export interface Organization {
  id: string;
  name: string;
  ownerId: string;
  memberCount: number;
  members: OrgMember[];
  bannerGradient?: string;
  bannerUrl?: string;
  logoUrl?: string;
  structureMode?: 'flat' | 'teams' | 'corporate'; // Added for Workspace migration
  createdAt?: any;
}
