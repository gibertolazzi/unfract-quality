import sys

with open('components/marketing/TemplateSelectionView.tsx', 'r') as f:
    content = f.read()

with open('scratch/createModal.tsx', 'r') as f:
    modal = f.read()

end_str = "    </div>\n  );\n}"
idx = content.rfind(end_str)
if idx != -1:
    new_content = content[:idx] + modal + "\n" + content[idx:]
    with open('components/marketing/TemplateSelectionView.tsx', 'w') as f:
        f.write(new_content)
