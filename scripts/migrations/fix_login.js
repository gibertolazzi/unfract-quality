const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/auth/LoginScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldBg = `{/* Background SVGs with animations */}
      <div className="absolute inset-0 z-0 pointer-events-none flex items-end justify-center opacity-80 overflow-hidden">
        <div className="relative w-full h-full flex items-end justify-center animate-pulse-slow">
          {/* Blue Glow */}
          <div className="absolute bottom-[-30%] left-1/2 -translate-x-1/2 w-[200vw] md:w-[150vw] h-[100vw] md:h-[80vw] bg-[#006AFF] rounded-[100%] blur-[120px] opacity-30 animate-float-slow"></div>
          
          {/* White Glow */}
          <div className="absolute bottom-[-20%] left-1/2 -translate-x-1/2 w-[150vw] md:w-[100vw] h-[80vw] md:h-[60vw] bg-white rounded-[100%] blur-[100px] opacity-20 animate-float-delayed"></div>
        </div>
      </div>`;

const newBg = `{/* Motion gradient from AI Hub */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute bottom-[-45%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-[#006AFF] opacity-[0.35] blur-[140px] rounded-full animate-[pulse_6s_ease-in-out_infinite]" />
      </div>`;

content = content.replace(oldBg, newBg);
fs.writeFileSync(path, content, 'utf8');
