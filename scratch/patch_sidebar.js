const fs = require('fs');

let content = fs.readFileSync('components/layout/Sidebar.tsx', 'utf-8');

// Add Lock to imports
content = content.replace(
  /import { ChevronDown, ChevronUp, Home, CheckCircle2, Calendar, Hash, FileVideo, Users, LogOut, Check, Plus, Trash2, MessageCircle, Sparkles, Handshake, Settings } from "lucide-react";/,
  `import { ChevronDown, ChevronUp, Home, CheckCircle2, Calendar, Hash, FileVideo, Users, LogOut, Check, Plus, Trash2, MessageCircle, Sparkles, Handshake, Settings, Lock } from "lucide-react";`
);

// Add disabled to marketing
content = content.replace(
  /{ id: "marketing", label: "Marketing", Icon: MegaphoneIcon, href: "\/marketing" },/,
  `{ id: "marketing", label: "Marketing", Icon: MegaphoneIcon, href: "/marketing", disabled: true },`
);

// Modify nav item rendering
const oldMapStart = `{navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
          const isDocMenu = item.id === "documentation";`;

const newMapStart = `{navItems.map((item) => {
          const isActive = !item.disabled && (pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href)));
          const isDocMenu = item.id === "documentation";`;

content = content.replace(oldMapStart, newMapStart);

const oldDivStart = `<div 
              key={item.id} 
              className={\`flex flex-col transition-opacity \${draggedItemId === item.id ? 'opacity-30' : 'opacity-100'}\`}
              draggable
              onDragStart={(e) => handleDragStart(e, item.id)}
              onDragOver={(e) => handleDragOver(e, item.id)}
              onDragLeave={(e) => handleDragLeave(e, item.id)}
              onDrop={(e) => handleDrop(e, item.id)}
              onDragEnd={handleDragEnd}
            >`;

const newDivStart = `<div 
              key={item.id} 
              className={\`flex flex-col transition-opacity \${draggedItemId === item.id ? 'opacity-30' : item.disabled ? 'opacity-40' : 'opacity-100'}\`}
              draggable={!item.disabled}
              onDragStart={(e) => !item.disabled && handleDragStart(e, item.id)}
              onDragOver={(e) => !item.disabled && handleDragOver(e, item.id)}
              onDragLeave={(e) => !item.disabled && handleDragLeave(e, item.id)}
              onDrop={(e) => !item.disabled && handleDrop(e, item.id)}
              onDragEnd={handleDragEnd}
            >`;

content = content.replace(oldDivStart, newDivStart);

const oldLink = `<Link
                  href={item.href}
                  className="flex items-center gap-3 flex-1 overflow-hidden"
                  onClick={() => {
                    if (isDocMenu && !isDocsExpanded) setIsDocsExpanded(true);
                  }}
                >
                  <div className="shrink-0">
                    <item.Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={\`text-[13px] truncate font-normal\`}>
                    {item.label}
                  </span>
                </Link>`;

const newLink = `                <Link
                  href={item.disabled ? "#" : item.href}
                  className={\`flex items-center gap-3 flex-1 overflow-hidden \${item.disabled ? 'cursor-not-allowed' : ''}\`}
                  onClick={(e) => {
                    if (item.disabled) {
                      e.preventDefault();
                      return;
                    }
                    if (isDocMenu && !isDocsExpanded) setIsDocsExpanded(true);
                  }}
                >
                  <div className="shrink-0">
                    <item.Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <div className="flex flex-1 items-center justify-between overflow-hidden">
                    <span className={\`text-[13px] truncate font-normal\`}>
                      {item.label}
                    </span>
                    {item.disabled && (
                      <span className="text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded flex items-center gap-1 shrink-0 ml-2">
                        <Lock size={10} />
                        Presto
                      </span>
                    )}
                  </div>
                </Link>`;

content = content.replace(oldLink, newLink);

fs.writeFileSync('components/layout/Sidebar.tsx', content);
