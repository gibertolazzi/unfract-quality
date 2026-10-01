import re

with open('components/layout/TopBar.tsx', 'r') as f:
    content = f.read()

target = """          <button 
            onClick={onMenuClick}
            className="md:hidden text-white/70 hover:text-white transition-colors w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5 mr-2 shrink-0"
          >
            <Menu size={20} />
          </button>"""

content = content.replace(target, '')

with open('components/layout/TopBar.tsx', 'w') as f:
    f.write(content)

print("Hamburger removed")
