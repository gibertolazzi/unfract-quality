import re

with open('components/marketing/UpgradeModal.tsx', 'r') as f:
    content = f.read()

# Replace all standard buttons rounded-full -> rounded-[18px] and text-[13px] -> text-[14px]
# Note: only the standard buttons, not the 'Più scelto' badge or close button.
# Let's specifically target the button classes.

target_classes = 'w-full py-2.5 px-4 rounded-full border border-white/10 text-white text-[13px] font-medium hover:bg-white/5 transition-colors mb-10'
new_classes = 'w-full py-3 px-4 rounded-[18px] border border-white/10 text-white text-[14px] font-medium hover:bg-white/5 transition-colors mb-10'

content = content.replace(target_classes, new_classes)

with open('components/marketing/UpgradeModal.tsx', 'w') as f:
    f.write(content)

print("Buttons patched")
