import re

with open('components/marketing/EmailEditorView.tsx', 'r') as f:
    content = f.read()

# Add import
import_stmt = "import { generateEmailHtml } from '@/lib/utils/emailCompiler';\n"
content = content.replace(
    "import { updateCampaign } from '@/lib/services/marketingService';",
    "import { updateCampaign } from '@/lib/services/marketingService';\n" + import_stmt
)

# Update handleSaveAndExit
old_save = """  const handleSaveAndExit = async () => {
    toast.success('Modello salvato con successo nei tuoi modelli.');
    let finalHtml = '';
    if (editorType === 'simple') finalHtml = simpleHtml;
    else if (editorType === 'html') finalHtml = customHtml;
    else finalHtml = 'dnd-template'; // mock

    await updateCampaign(campaignId, { designHtml: finalHtml });
    router.push(`/marketing/campaigns/${campaignId}`);
  };"""

new_save = """  const handleSaveAndExit = async () => {
    let finalHtml = '';
    if (editorType === 'simple') {
      // Basic wrapper for simple RTF
      finalHtml = `<!DOCTYPE html><html><body>${simpleHtml.replace(/\\n/g, '<br>')}</body></html>`;
    } else if (editorType === 'html') {
      finalHtml = customHtml;
    } else {
      // Compile D&D blocks into responsive email tables
      finalHtml = generateEmailHtml(blocks);
    }

    await updateCampaign(campaignId, { designHtml: finalHtml });
    toast.success('Modello email salvato correttamente.');
    router.push(`/marketing/campaigns/${campaignId}`);
  };"""

content = content.replace(old_save, new_save)

with open('components/marketing/EmailEditorView.tsx', 'w') as f:
    f.write(content)

print("Phase 4 Patched")
