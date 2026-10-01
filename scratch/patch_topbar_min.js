const fs = require('fs');
let content = fs.readFileSync('components/layout/TopBar.tsx', 'utf-8');

content = content.replace(/className="w-10 bg-transparent([^"]+)"\n\s*placeholder="25"/,
  'className="w-8 bg-transparent$1"\n                    placeholder="25"');

content = content.replace(/onKeyDown=\{\(e\) => \{\n\s*if \(e\.key === 'Enter'\) \{\n\s*const val = parseInt\(e\.currentTarget\.value\);\n\s*if \(val > 0\) setCustomTimer\(val\);\n\s*e\.currentTarget\.blur\(\);\n\s*\}\n\s*\}\}\n\s*\/>/,
  `onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = parseInt(e.currentTarget.value);
                        if (val > 0) setCustomTimer(val);
                        e.currentTarget.blur();
                      }
                    }}
                  />
                  <span className="text-[10px] uppercase tracking-wider text-[#858585]/70 font-semibold ml-[-4px]">min</span>`);

fs.writeFileSync('components/layout/TopBar.tsx', content);
