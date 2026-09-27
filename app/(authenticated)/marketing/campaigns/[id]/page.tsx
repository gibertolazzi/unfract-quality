import { CampaignSetupView } from "@/components/marketing/CampaignSetupView";

export default function CampaignSetupPage({ params }: { params: { id: string } }) {
  return <CampaignSetupView campaignId={params.id} />;
}
