import re

with open('components/layout/AppShell.tsx', 'r') as f:
    content = f.read()

if 'import { useState } from "react";' not in content:
    content = content.replace('export function AppShell({ children }: { children: React.ReactNode }) {', 'import { useState } from "react";\n\nexport function AppShell({ children }: { children: React.ReactNode }) {\n  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);')

content = content.replace('<Sidebar />', """<Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}""")

content = content.replace('<TopBar />', '<TopBar onMenuClick={() => setIsMobileMenuOpen(true)} />')

with open('components/layout/AppShell.tsx', 'w') as f:
    f.write(content)

with open('components/layout/TopBar.tsx', 'r') as f:
    content = f.read()

content = content.replace('export function TopBar() {', 'export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {')
content = content.replace("import { Search, Bell", "import { Menu, Search, Bell")

target = '<div className="relative w-full max-w-md hidden md:block group">'
replacement = """
          <button 
            onClick={onMenuClick}
            className="md:hidden text-white/70 hover:text-white transition-colors w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5 mr-2 shrink-0"
          >
            <Menu size={20} />
          </button>
          <div className="relative w-full max-w-md hidden md:block group">"""
content = content.replace(target, replacement)

with open('components/layout/TopBar.tsx', 'w') as f:
    f.write(content)

with open('components/layout/Sidebar.tsx', 'r') as f:
    content = f.read()

content = content.replace('export function Sidebar() {', 'export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {')

old_div = '<div className="w-[240px] h-full bg-[#080808] text-white p-6 flex flex-col hidden md:flex border-r border-white/5 transition-all duration-300">'
new_div = '<div className={`w-[240px] h-full bg-[#080808] text-white p-6 flex flex-col border-r border-white/5 transition-transform duration-300 fixed md:relative z-50 ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>'
content = content.replace(old_div, new_div)

target_hook = "  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);"
use_effect = """  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    if (onClose && isOpen) onClose();
  }, [pathname]);"""
content = content.replace(target_hook, use_effect)

with open('components/layout/Sidebar.tsx', 'w') as f:
    f.write(content)

print("Responsiveness patched")
