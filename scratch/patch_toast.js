const fs = require('fs');
const filePath = 'contexts/ToastContext.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldSuccessToast = `              <div
                key={toast.id}
                className="pointer-events-auto flex items-center gap-3.5 pl-4 pr-5 py-3 rounded-full shadow-2xl transform transition-all duration-300 ease-out animate-in slide-in-from-top-5 fade-in bg-gradient-to-r from-[#0C2A59] to-[#0A0A0A]"
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0D6EFD] flex items-center justify-center">
                  <Check className="w-4 h-4 text-[#050505]" strokeWidth={3} />
                </div>
                
                <p className="flex-1 text-[15px] text-white whitespace-nowrap pr-2 font-normal">
                  {toast.message}
                </p>
                
                <button
                  onClick={() => removeToast(toast.id)}
                  className="flex-shrink-0 text-white hover:text-[#E5E5E5] transition-colors"
                >
                  <X className="w-[18px] h-[18px]" strokeWidth={1.5} />
                </button>
              </div>`;

const newSuccessToast = `              <div
                key={toast.id}
                className="pointer-events-auto relative overflow-hidden flex items-center gap-3 h-[54px] pl-5 pr-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] transform transition-all duration-300 ease-out animate-in slide-in-from-top-5 fade-in bg-[#0E0E0E] border border-white/5"
              >
                {/* Glow Effect as designed in SVG */}
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-[96px] h-[82px] bg-[#006AFF] rounded-full blur-[40px] opacity-60 pointer-events-none" />

                <div className="relative z-10 flex-shrink-0 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="16 18 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M25 18.875C23.393 18.875 21.8221 19.3515 20.486 20.2443C19.1498 21.1371 18.1084 22.406 17.4935 23.8907C16.8785 25.3753 16.7176 27.009 17.0311 28.5851C17.3446 30.1612 18.1185 31.6089 19.2548 32.7452C20.3911 33.8815 21.8388 34.6554 23.4149 34.9689C24.991 35.2824 26.6247 35.1215 28.1093 34.5065C29.594 33.8916 30.8629 32.8502 31.7557 31.514C32.6485 30.1779 33.125 28.607 33.125 27C33.1227 24.8458 32.266 22.7805 30.7427 21.2573C29.2195 19.734 27.1542 18.8773 25 18.875ZM28.5672 25.5672L24.1922 29.9422C24.1341 30.0003 24.0652 30.0464 23.9893 30.0779C23.9135 30.1093 23.8321 30.1255 23.75 30.1255C23.6679 30.1255 23.5865 30.1093 23.5107 30.0779C23.4348 30.0464 23.3659 30.0003 23.3078 29.9422L21.4328 28.0672C21.3155 27.9499 21.2497 27.7909 21.2497 27.625C21.2497 27.4591 21.3155 27.3001 21.4328 27.1828C21.5501 27.0655 21.7092 26.9997 21.875 26.9997C22.0409 26.9997 22.1999 27.0655 22.3172 27.1828L23.75 28.6164L27.6828 24.6828C27.7409 24.6247 27.8098 24.5787 27.8857 24.5473C27.9616 24.5158 28.0429 24.4997 28.125 24.4997C28.2071 24.4997 28.2884 24.5158 28.3643 24.5473C28.4402 24.5787 28.5091 24.6247 28.5672 24.6828C28.6253 24.7409 28.6713 24.8098 28.7027 24.8857C28.7342 24.9616 28.7504 25.0429 28.7504 25.125C28.7504 25.2071 28.7342 25.2884 28.7027 25.3643C28.6713 25.4402 28.6253 25.5091 28.5672 25.5672Z" fill="#006AFF"/>
                  </svg>
                </div>
                
                <p className="relative z-10 flex-1 text-[15px] text-white whitespace-nowrap pr-6 font-medium">
                  {toast.message}
                </p>
                
                <button
                  onClick={() => removeToast(toast.id)}
                  className="relative z-10 flex-shrink-0 text-[#666666] hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>`;

content = content.replace(oldSuccessToast, newSuccessToast);

// Let's also adjust the top position of the toast container so it's more visible as requested
// "<div className="fixed top-6 left-1/2 -translate-x-1/2 z-[999999] flex flex-col gap-3 pointer-events-none">"
content = content.replace(
  'className="fixed top-6 left-1/2 -translate-x-1/2 z-[999999] flex flex-col gap-3 pointer-events-none"',
  'className="fixed top-10 left-1/2 -translate-x-1/2 z-[999999] flex flex-col gap-3 pointer-events-none"'
);

fs.writeFileSync(filePath, content);
