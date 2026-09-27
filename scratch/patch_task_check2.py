import re

with open('components/dashboard/DashboardView.tsx', 'r') as f:
    content = f.read()

# Replace the text class again to match screenshot exactly
old_text_class = 'className={`text-[13px] font-medium block truncate ${status === "done" ? "text-white/60" : "text-white/90"}`}'
new_text_class = 'className={`text-[13px] font-medium block truncate text-white/90`}'
content = content.replace(old_text_class, new_text_class)

with open('components/dashboard/DashboardView.tsx', 'w') as f:
    f.write(content)

print("Text class patched")
