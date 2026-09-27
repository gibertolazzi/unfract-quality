import re

with open('components/dashboard/DashboardView.tsx', 'r') as f:
    content = f.read()

# Make sure CircleDot is imported
if 'CircleDot' not in content:
    content = content.replace('import { CheckCircle2, Circle', 'import { CheckCircle2, Circle, CircleDot')

# Replace the checkmark logic
old_logic = """                        {status === "done" ? (
                          <CheckCircle2 size={18} className="text-[#00D222]" />
                        ) : (
                          <Circle size={18} className={`${getPriorityTextColor(task.priority)} opacity-50 group-hover/dot:opacity-100 transition-opacity`} />
                        )}"""

new_logic = """                        {status === "done" ? (
                          <CircleDot size={18} className={`${getPriorityTextColor(task.priority)}`} />
                        ) : (
                          <Circle size={18} className={`${getPriorityTextColor(task.priority)} opacity-50 group-hover/dot:opacity-100 transition-opacity`} />
                        )}"""
content = content.replace(old_logic, new_logic)

# Replace the line-through logic
old_text_class = 'className={`text-[13px] font-medium block truncate ${status === "done" ? "text-[#858585] line-through" : "text-white/90"}`}'
new_text_class = 'className={`text-[13px] font-medium block truncate ${status === "done" ? "text-white/60" : "text-white/90"}`}'
content = content.replace(old_text_class, new_text_class)

with open('components/dashboard/DashboardView.tsx', 'w') as f:
    f.write(content)

print("Checkmarks patched")
