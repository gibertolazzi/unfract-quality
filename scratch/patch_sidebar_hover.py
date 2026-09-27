import re

with open('components/layout/AppShell.tsx', 'r') as f:
    content = f.read()

# Replace the mobile overlay
old_overlay = """      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}"""

new_overlay = """      {/* Edge trigger for sidebar reveal on narrow screens */}
      {!isMobileMenuOpen && (
        <div 
          className="fixed inset-y-0 left-0 w-8 z-50 md:hidden" 
          onMouseEnter={() => setIsMobileMenuOpen(true)}
        />
      )}

      {/* Mobile overlay */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />"""

content = content.replace(old_overlay, new_overlay)

with open('components/layout/AppShell.tsx', 'w') as f:
    f.write(content)

with open('components/layout/Sidebar.tsx', 'r') as f:
    content = f.read()

# Make the sidebar transition smoother
old_div = '<div className={`w-[240px] h-full bg-[#080808] text-white p-6 flex flex-col border-r border-white/5 transition-transform duration-300 fixed md:relative z-50 ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>'
new_div = '<div className={`w-[240px] h-full bg-[#080808] text-white p-6 flex flex-col border-r border-white/5 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] fixed md:relative z-50 ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>'
content = content.replace(old_div, new_div)

with open('components/layout/Sidebar.tsx', 'w') as f:
    f.write(content)

print("AppShell and Sidebar patched")
