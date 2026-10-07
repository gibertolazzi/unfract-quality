import { EmailEditorView } from "@/components/marketing/EmailEditorView";

export default async function EmailEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmailEditorView campaignId={id} />;
}
