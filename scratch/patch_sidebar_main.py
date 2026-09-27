import re

with open('components/layout/Sidebar.tsx', 'r') as f:
    content = f.read()

# Change gap from gap-1 to gap-0.5
content = content.replace(
    'className="flex flex-col gap-1 flex-1 overflow-y-auto overflow-x-hidden pr-1 pb-4"',
    'className="flex flex-col gap-0.5 flex-1 overflow-y-auto overflow-x-hidden pr-1 pb-4"'
)

# Change padding from py-2 to py-1.5
content = content.replace(
    'justify-between px-3 py-2 cursor-pointer',
    'justify-between px-3 py-1.5 cursor-pointer'
)

# Change Icon size from 18 to 16
content = content.replace(
    '<item.Icon size={18}',
    '<item.Icon size={16}'
)

# Change text size from text-sm to text-[13px]
content = content.replace(
    'className={`text-sm truncate font-normal`}',
    'className={`text-[13px] truncate font-normal`}'
)

with open('components/layout/Sidebar.tsx', 'w') as f:
    f.write(content)

print("Sidebar patched")
