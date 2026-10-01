import re

with open('components/dashboard/DashboardView.tsx', 'r') as f:
    content = f.read()

# Add getPriorityBorderColor right after getPriorityGlow
border_color_func = """  const getPriorityBorderColor = (priority: string) => {
    if (priority === "High" || priority === "Critical") return "border-[#FF0004]";
    if (priority === "Medium") return "border-[#FFB800]";
    return "border-[#006AFF]";
  };"""

content = content.replace('  const getPriorityGlow = (priority: string) => {', border_color_func + '\n\n  const getPriorityGlow = (priority: string) => {')

# Replace the checkmarks logic
old_logic = """                        {status === "done" ? (
                          <CircleDot size={22} className={`${getPriorityTextColor(task.priority)}`} />
                        ) : (
                          <Circle size={22} className={`${getPriorityTextColor(task.priority)} opacity-50 group-hover/dot:opacity-100 transition-opacity`} />
                        )}"""

new_logic = """                        {status === "done" ? (
                          <div className={`w-[20px] h-[20px] rounded-full border-[2px] ${getPriorityBorderColor(task.priority)} flex items-center justify-center`}>
                            <div className={`w-[10px] h-[10px] rounded-full ${getPriorityGlow(task.priority)}`} />
                          </div>
                        ) : (
                          <div className={`w-[20px] h-[20px] rounded-full border-[2px] ${getPriorityBorderColor(task.priority)} opacity-50 group-hover/dot:opacity-100 transition-opacity`} />
                        )}"""

content = content.replace(old_logic, new_logic)

# Replace the text class to restore strikethrough for done tasks
old_text_class = 'className={`text-[13px] font-medium block truncate text-white/90`}'
new_text_class = 'className={`text-[13px] font-medium block truncate ${status === "done" ? "text-[#858585] line-through" : "text-white/90"}`}'
content = content.replace(old_text_class, new_text_class)

with open('components/dashboard/DashboardView.tsx', 'w') as f:
    f.write(content)

print("Custom checkboxes patched")
