import os

replacements = {
    " '@/components/AppShell'": " '@/components/unfract/layout/AppShell'",
    ' "@/components/AppShell"': ' "@/components/unfract/layout/AppShell"',
    " '@/components/unfract/Sidebar'": " '@/components/unfract/layout/Sidebar'",
    ' "@/components/unfract/Sidebar"': ' "@/components/unfract/layout/Sidebar"',
    " '@/components/unfract/TopBar'": " '@/components/unfract/layout/TopBar'",
    ' "@/components/unfract/TopBar"': ' "@/components/unfract/layout/TopBar"',
    " '@/components/unfract/TaskList'": " '@/components/unfract/tasks/TaskList'",
    ' "@/components/unfract/TaskList"': ' "@/components/unfract/tasks/TaskList"',
    " '@/components/unfract/TaskModal'": " '@/components/unfract/tasks/TaskModal'",
    ' "@/components/unfract/TaskModal"': ' "@/components/unfract/tasks/TaskModal"',
    " '@/components/unfract/TaskTimeline'": " '@/components/unfract/tasks/TaskTimeline'",
    ' "@/components/unfract/TaskTimeline"': ' "@/components/unfract/tasks/TaskTimeline"',
    " '@/components/unfract/CreateProjectModal'": " '@/components/unfract/tasks/CreateProjectModal'",
    ' "@/components/unfract/CreateProjectModal"': ' "@/components/unfract/tasks/CreateProjectModal"',
    " '@/components/unfract/DeleteProjectModal'": " '@/components/unfract/tasks/DeleteProjectModal'",
    ' "@/components/unfract/DeleteProjectModal"': ' "@/components/unfract/tasks/DeleteProjectModal"',
    " '@/components/TaskBoard'": " '@/components/unfract/tasks/TaskBoard'",
    ' "@/components/TaskBoard"': ' "@/components/unfract/tasks/TaskBoard"',
    " '@/components/unfract/CalendarBoard'": " '@/components/unfract/calendar/CalendarBoard'",
    ' "@/components/unfract/CalendarBoard"': ' "@/components/unfract/calendar/CalendarBoard"',
    " '@/components/unfract/EventModal'": " '@/components/unfract/calendar/EventModal'",
    ' "@/components/unfract/EventModal"': ' "@/components/unfract/calendar/EventModal"',
    " '@/components/unfract/LoginScreen'": " '@/components/unfract/auth/LoginScreen'",
    ' "@/components/unfract/LoginScreen"': ' "@/components/unfract/auth/LoginScreen"',
    " '@/components/unfract/UserSettingsModal'": " '@/components/unfract/auth/UserSettingsModal'",
    ' "@/components/unfract/UserSettingsModal"': ' "@/components/unfract/auth/UserSettingsModal"',
    " '@/components/unfract/MentionDropdown'": " '@/components/unfract/shared/MentionDropdown'",
    ' "@/components/unfract/MentionDropdown"': ' "@/components/unfract/shared/MentionDropdown"',
    " '@/components/unfract/CustomPrompt'": " '@/components/unfract/shared/CustomPrompt'",
    ' "@/components/unfract/CustomPrompt"': ' "@/components/unfract/shared/CustomPrompt"',
    
    " './UserSettingsModal'": " '@/components/unfract/auth/UserSettingsModal'",
    ' "./UserSettingsModal"': ' "@/components/unfract/auth/UserSettingsModal"',
    " './MentionDropdown'": " '@/components/unfract/shared/MentionDropdown'",
    ' "./MentionDropdown"': ' "@/components/unfract/shared/MentionDropdown"',
    " '../CustomPrompt'": " '@/components/unfract/shared/CustomPrompt'",
    ' "../CustomPrompt"': ' "@/components/unfract/shared/CustomPrompt"',
    " './CustomPrompt'": " '@/components/unfract/shared/CustomPrompt'",
    ' "./CustomPrompt"': ' "@/components/unfract/shared/CustomPrompt"',
    " './unfract/TaskModal'": " '@/components/unfract/tasks/TaskModal'",
    ' "./unfract/TaskModal"': ' "@/components/unfract/tasks/TaskModal"',
    " './unfract/TaskList'": " '@/components/unfract/tasks/TaskList'",
    ' "./unfract/TaskList"': ' "@/components/unfract/tasks/TaskList"',
    " './unfract/TaskTimeline'": " '@/components/unfract/tasks/TaskTimeline'",
    ' "./unfract/TaskTimeline"': ' "@/components/unfract/tasks/TaskTimeline"',
    " './unfract/CustomPrompt'": " '@/components/unfract/shared/CustomPrompt'",
    ' "./unfract/CustomPrompt"': ' "@/components/unfract/shared/CustomPrompt"',
    " './EventModal'": " '@/components/unfract/calendar/EventModal'",
    ' "./EventModal"': ' "@/components/unfract/calendar/EventModal"',
    
    " './calendar/types'": " './types'",
    ' "./calendar/types"': ' "./types"',
    " './calendar/MonthView'": " './MonthView'",
    " './calendar/WeekView'": " './WeekView'",
    " './calendar/DayView'": " './DayView'",
    " './calendar/YearView'": " './YearView'",
    
    " './DeleteProjectModal'": " '@/components/unfract/tasks/DeleteProjectModal'",
    ' "./DeleteProjectModal"': ' "@/components/unfract/tasks/DeleteProjectModal"',
    " './CreateProjectModal'": " '@/components/unfract/tasks/CreateProjectModal'",
    ' "./CreateProjectModal"': ' "@/components/unfract/tasks/CreateProjectModal"',
}

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    new_content = content
    for old, new in replacements.items():
        new_content = new_content.replace(old, new)
        
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, _, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root or '.next' in root:
        continue
    for file in files:
        if file.endswith('.ts') or file.endswith('.tsx'):
            process_file(os.path.join(root, file))

print("Done.")
