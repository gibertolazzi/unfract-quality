import re

with open('components/marketing/TemplateSelectionView.tsx', 'r') as f:
    content = f.read()

# Remove pointer-events-none from the parent div and apply it only to the thumbnail container
content = content.replace(
    'className="aspect-[3/4] bg-white relative flex flex-col overflow-hidden pointer-events-none"',
    'className="aspect-[3/4] bg-white relative flex flex-col overflow-hidden"'
)

content = content.replace(
    'className="w-full h-full transform scale-[0.6] origin-top flex flex-col gap-2 p-2"',
    'className="w-full h-full transform scale-[0.6] origin-top flex flex-col gap-2 p-2 pointer-events-none"'
)

with open('components/marketing/TemplateSelectionView.tsx', 'w') as f:
    f.write(content)

print("Pointer events fixed")
