export interface EmailCampaignAdvancedSettings {
  customToField?: boolean;
  replyTo?: string;
  utmTracking?: boolean;
  ignoreListSettings?: boolean;
  hasAttachment?: boolean;
  tag?: string;
  expirationDate?: string;
  customUnsubscribePage?: boolean;
  updateProfileForm?: boolean;
  customHeader?: boolean;
  customFooter?: boolean;
  viewInBrowserLink?: boolean;
}

export interface EmailCampaign {
  id: string;
  projectId: string;
  name: string;
  status: 'draft' | 'scheduled' | 'sent';
  sender?: { name: string; email: string };
  subject?: string;
  recipients?: string[];
  designHtml?: string;
  advancedSettings?: EmailCampaignAdvancedSettings;
  createdAt?: any;
  updatedAt?: any;
}
