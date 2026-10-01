const fs = require('fs');
const filePath = 'contexts/ToastContext.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `        {toasts.map((toast) => {
          if (toast.type === 'success') {
            return (
              <div
                key={toast.id}
                className="pointer-events-auto relative w-[332px] h-[54px] shadow-2xl transform transition-all duration-300 ease-out animate-in slide-in-from-top-5 fade-in"
              >
                {/* Literal SVG Background from User */}
                <svg className="absolute inset-0 pointer-events-none" width="332" height="54" viewBox="0 0 332 54" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#clip0_419_4684)">
                    <rect width="332" height="54" rx="16" fill="#0E0E0E"/>
                    <g filter="url(#filter0_f_419_4684)">
                      <ellipse cx="31" cy="27" rx="48" ry="41" fill="#006AFF"/>
                    </g>
                    {/* Checkmark Icon */}
                    <path d="M25 18.875C23.393 18.875 21.8221 19.3515 20.486 20.2443C19.1498 21.1371 18.1084 22.406 17.4935 23.8907C16.8785 25.3753 16.7176 27.009 17.0311 28.5851C17.3446 30.1612 18.1185 31.6089 19.2548 32.7452C20.3911 33.8815 21.8388 34.6554 23.4149 34.9689C24.991 35.2824 26.6247 35.1215 28.1093 34.5065C29.594 33.8916 30.8629 32.8502 31.7557 31.514C32.6485 30.1779 33.125 28.607 33.125 27C33.1227 24.8458 32.266 22.7805 30.7427 21.2573C29.2195 19.734 27.1542 18.8773 25 18.875ZM28.5672 25.5672L24.1922 29.9422C24.1341 30.0003 24.0652 30.0464 23.9893 30.0779C23.9135 30.1093 23.8321 30.1255 23.75 30.1255C23.6679 30.1255 23.5865 30.1093 23.5107 30.0779C23.4348 30.0464 23.3659 30.0003 23.3078 29.9422L21.4328 28.0672C21.3155 27.9499 21.2497 27.7909 21.2497 27.625C21.2497 27.4591 21.3155 27.3001 21.4328 27.1828C21.5501 27.0655 21.7092 26.9997 21.875 26.9997C22.0409 26.9997 22.1999 27.0655 22.3172 27.1828L23.75 28.6164L27.6828 24.6828C27.7409 24.6247 27.8098 24.5787 27.8857 24.5473C27.9616 24.5158 28.0429 24.4997 28.125 24.4997C28.2071 24.4997 28.2884 24.5158 28.3643 24.5473C28.4402 24.5787 28.5091 24.6247 28.5672 24.6828C28.6253 24.7409 28.6713 24.8098 28.7027 24.8857C28.7342 24.9616 28.7504 25.0429 28.7504 25.125C28.7504 25.2071 28.7342 25.2884 28.7027 25.3643C28.6713 25.4402 28.6253 25.5091 28.5672 25.5672Z" fill="#006AFF"/>
                  </g>
                  <defs>
                    <filter id="filter0_f_419_4684" x="-117" y="-114" width="296" height="282" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                      <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                      <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                      <feGaussianBlur stdDeviation="50" result="effect1_foregroundBlur_419_4684"/>
                    </filter>
                    <clipPath id="clip0_419_4684">
                      <rect width="332" height="54" rx="16" fill="white"/>
                    </clipPath>
                  </defs>
                </svg>

                {/* Content Overlay */}
                <div className="absolute inset-0 flex items-center justify-between z-10 pointer-events-auto px-[18px]">
                  <div className="flex items-center gap-[14px] pl-[26px]">
                    {/* The Check icon is rendered by the SVG behind, so we just pad the text. */}
                    <p className="text-[14px] text-white font-normal whitespace-nowrap">
                      {toast.message}
                    </p>
                  </div>
                  
                  {/* Exact SVG X Close Button */}
                  <button
                    onClick={() => removeToast(toast.id)}
                    className="flex-shrink-0 mr-3 text-white/70 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-[14px] h-[14px]" strokeWidth={2} />
                  </button>
                </div>
              </div>
            );
          }`;

const newStr = `        {toasts.map((toast) => {`;

content = content.replace(targetStr, newStr);

const fallbackStr = `            <div
              key={toast.id}
              className={\`
                pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-2xl min-w-[300px] max-w-sm
                transform transition-all duration-300 ease-out animate-in slide-in-from-top-5 fade-in
                border backdrop-blur-xl
                \${toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-white' : ''}
                \${toast.type === 'info' ? 'bg-blue-500/10 border-blue-500/20 text-white' : ''}
              \`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
              </div>`;

const fallbackNew = `            <div
              key={toast.id}
              className={\`
                pointer-events-auto flex items-center gap-3 p-4 rounded-xl shadow-2xl min-w-[300px] max-w-sm
                transform transition-all duration-300 ease-out animate-in slide-in-from-top-5 fade-in
                border backdrop-blur-xl
                \${toast.type === 'success' ? 'bg-[#006AFF]/10 border-[#006AFF]/20 text-white' : ''}
                \${toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-white' : ''}
                \${toast.type === 'info' ? 'bg-blue-500/10 border-blue-500/20 text-white' : ''}
              \`}
            >
              <div className="flex-shrink-0">
                {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#006AFF]" />}
                {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
              </div>`;

content = content.replace(fallbackStr, fallbackNew);

fs.writeFileSync(filePath, content);
