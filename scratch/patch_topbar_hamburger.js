const fs = require('fs');
let content = fs.readFileSync('components/layout/TopBar.tsx', 'utf-8');

const hamburgerHTML = `
      {/* Mobile Hamburger */}
      <button onClick={onMenuClick} className="md:hidden p-2 -ml-2 rounded-lg text-[#858585] hover:text-white hover:bg-white/5 transition-colors">
        <Menu size={20} />
      </button>
      
      {/* CENTER: Cerca (Allargata e allineata a sinistra) */}`;

content = content.replace(/\{\/\* CENTER: Cerca \(Allargata e allineata a sinistra\) \*\/\}/, hamburgerHTML);

fs.writeFileSync('components/layout/TopBar.tsx', content);
