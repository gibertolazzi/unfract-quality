import { TemplateSelectionView } from "@/components/marketing/TemplateSelectionView";

export default function TemplateSelectionPage({ params }: { params: { id: string } }) {
  return <TemplateSelectionView campaignId={params.id} />;
}
