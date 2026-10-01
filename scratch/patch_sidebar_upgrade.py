import re

with open('components/layout/Sidebar.tsx', 'r') as f:
    content = f.read()

# Add UpgradeModal import
if 'UpgradeModal' not in content:
    content = content.replace("import { CreateProjectModal } from '@/components/tasks/CreateProjectModal';", "import { CreateProjectModal } from '@/components/tasks/CreateProjectModal';\nimport { UpgradeModal } from '@/components/marketing/UpgradeModal';")

# Add state
if 'isUpgradeOpen' not in content:
    content = content.replace("const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);", "const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);\n  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);")

# Update button
old_button = '<div className="flex items-center justify-between px-4 py-3 border border-white/10 rounded-2xl bg-gradient-to-b from-white/10 to-transparent cursor-pointer hover:border-white/20 transition-all overflow-hidden">'
new_button = '<div onClick={() => setIsUpgradeOpen(true)} className="flex items-center justify-between px-4 py-3 border border-white/10 rounded-2xl bg-gradient-to-b from-[#006AFF]/20 to-transparent cursor-pointer hover:border-[#006AFF]/50 transition-all overflow-hidden">'
content = content.replace(old_button, new_button)

# Render modal
old_modals = "{isCreateModalOpen && ("
new_modals = "{isUpgradeOpen && <UpgradeModal onClose={() => setIsUpgradeOpen(false)} />}\n      {isCreateModalOpen && ("
content = content.replace(old_modals, new_modals)

with open('components/layout/Sidebar.tsx', 'w') as f:
    f.write(content)

print("Sidebar patched with Upgrade Modal")
