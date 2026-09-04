export interface OrgMember {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  initials: string;
  role: 'admin' | 'member';
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
  createdAt?: any;
}
