import re

with open('components/marketing/EmailEditorView.tsx', 'r') as f:
    content = f.read()

# Replace aspect-square with aspect-[4/3] or h-24
content = content.replace(
    'className="aspect-square bg-[#141414] border border-white/5 hover:border-[#0D6EFD]/50 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-grab hover:bg-[#1A1A1A] transition-all group"',
    'className="aspect-[4/3] bg-[#141414] border border-white/5 hover:border-[#0D6EFD]/50 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-grab hover:bg-[#1A1A1A] transition-all group"'
)

content = content.replace(
    'className="aspect-square bg-[#141414] border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-3 opacity-50"',
    'className="aspect-[4/3] bg-[#141414] border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 opacity-50"'
)

with open('components/marketing/EmailEditorView.tsx', 'w') as f:
    f.write(content)

print("Buttons patched")
