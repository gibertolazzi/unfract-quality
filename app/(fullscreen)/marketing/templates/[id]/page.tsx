import { TemplateSelectionView } from "@/components/marketing/TemplateSelectionView";

export default async function TemplateSelectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TemplateSelectionView campaignId={id} />;
}
