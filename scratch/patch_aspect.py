import re

with open('components/marketing/TemplateSelectionView.tsx', 'r') as f:
    content = f.read()

# Replace aspect-[3/4] with h-60 (fixed height, responsive width) or aspect-square
content = content.replace('className="aspect-[3/4] bg-white relative flex flex-col overflow-hidden"', 'className="aspect-square bg-white relative flex flex-col overflow-hidden"')

with open('components/marketing/TemplateSelectionView.tsx', 'w') as f:
    f.write(content)

print("Aspect ratio patched")
