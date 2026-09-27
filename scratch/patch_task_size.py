import re

with open('components/dashboard/DashboardView.tsx', 'r') as f:
    content = f.read()

content = content.replace('<CircleDot size={18}', '<CircleDot size={22}')
content = content.replace('<Circle size={18}', '<Circle size={22}')

old_glow = '<div className={`absolute -top-0.5 -left-0.5 w-5 h-5 rounded-full ${getPriorityGlow(task.priority)} opacity-20 blur-[6px]`} />'
new_glow = '<div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full ${getPriorityGlow(task.priority)} opacity-20 blur-[6px]`} />'
content = content.replace(old_glow, new_glow)

with open('components/dashboard/DashboardView.tsx', 'w') as f:
    f.write(content)

print("Sizes patched")
