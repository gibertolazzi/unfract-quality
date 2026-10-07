import { CampaignSetupView } from "@/components/marketing/CampaignSetupView";

export default async function CampaignSetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CampaignSetupView campaignId={id} />;
}
