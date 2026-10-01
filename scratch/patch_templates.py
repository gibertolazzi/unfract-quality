import re

with open('components/marketing/TemplateSelectionView.tsx', 'r') as f:
    content = f.read()

# Replace handleSelectTemplate
old_handle = """  const handleSelectTemplate = async (templateId: string) => {
    // Save chosen template to campaign (mocked as designHtml for now)
    await updateCampaign(campaignId, { designHtml: `template_${templateId}` });
    // Navigate to editor
    router.push(`/marketing/editor/${campaignId}`);
  };"""

new_handle = """  const handleSelectTemplate = async (templateId: string) => {
    // Save chosen template to campaign
    await updateCampaign(campaignId, { designHtml: `template_${templateId}` });
    
    // Navigate to editor
    const type = templateId === 'simple' ? 'simple' : 'dnd';
    router.push(`/marketing/editor/${campaignId}?type=${type}&template=${templateId}`);
  };"""

content = content.replace(old_handle, new_handle)

with open('components/marketing/TemplateSelectionView.tsx', 'w') as f:
    f.write(content)

print("TemplateSelection patched")
