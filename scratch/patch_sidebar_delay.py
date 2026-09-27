import re

with open('components/layout/AppShell.tsx', 'r') as f:
    content = f.read()

# Add useRef to the imports if not present
if 'import { useState, useRef }' not in content:
    content = content.replace('import { useState }', 'import { useState, useRef }')

# Add the timeout logic
target_state = 'const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);'
new_state = """const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleEdgeHover = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsMobileMenuOpen(true);
    }, 250);
  };

  const handleEdgeLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };"""

content = content.replace(target_state, new_state)

# Replace the edge trigger
old_trigger = """      {/* Edge trigger for sidebar reveal on narrow screens */}
      {!isMobileMenuOpen && (
        <div 
          className="fixed inset-y-0 left-0 w-8 z-50 md:hidden" 
          onMouseEnter={() => setIsMobileMenuOpen(true)}
        />
      )}"""

new_trigger = """      {/* Edge trigger for sidebar reveal on narrow screens */}
      {!isMobileMenuOpen && (
        <div 
          className="fixed inset-y-0 left-0 w-6 z-[100] md:hidden" 
          onMouseEnter={handleEdgeHover}
          onMouseLeave={handleEdgeLeave}
        />
      )}"""

content = content.replace(old_trigger, new_trigger)

# Replace the overlay z-index
old_overlay = 'className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isMobileMenuOpen ? \'opacity-100 pointer-events-auto\' : \'opacity-0 pointer-events-none\'}`}'
new_overlay = 'className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[90] md:hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isMobileMenuOpen ? \'opacity-100 pointer-events-auto\' : \'opacity-0 pointer-events-none\'}`}'

content = content.replace(old_overlay, new_overlay)

with open('components/layout/AppShell.tsx', 'w') as f:
    f.write(content)


with open('components/layout/Sidebar.tsx', 'r') as f:
    sidebar_content = f.read()

# Replace the sidebar z-index
old_sidebar = '<div className={`w-[240px] h-full bg-[#080808] text-white p-6 flex flex-col border-r border-white/5 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] fixed md:relative z-50 ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>'
new_sidebar = '<div className={`w-[240px] h-full bg-[#080808] text-white p-6 flex flex-col border-r border-white/5 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] fixed md:relative z-[100] ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>'
sidebar_content = sidebar_content.replace(old_sidebar, new_sidebar)

with open('components/layout/Sidebar.tsx', 'w') as f:
    f.write(sidebar_content)

print("Delay and z-index patched")
