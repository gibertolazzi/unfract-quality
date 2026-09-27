import { EmailEditorView } from "@/components/marketing/EmailEditorView";

export default function EmailEditorPage({ params }: { params: { id: string } }) {
  return <EmailEditorView campaignId={params.id} />;
}
