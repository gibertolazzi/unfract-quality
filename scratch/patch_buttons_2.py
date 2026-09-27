import re

with open('components/marketing/EmailEditorView.tsx', 'r') as f:
    content = f.read()

# Change aspect-[4/3] to aspect-[3/2] and reduce icon size
content = content.replace('aspect-[4/3]', 'aspect-[3/2]')
content = content.replace('size={28}', 'size={24}')

# Main tab buttons
content = content.replace('w-16 h-16 rounded-xl gap-1', 'w-14 h-14 rounded-xl gap-1')

with open('components/marketing/EmailEditorView.tsx', 'w') as f:
    f.write(content)

print("Buttons patched further")
