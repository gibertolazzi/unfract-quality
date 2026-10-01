const fs = require('fs');
const filePath = 'contexts/ToastContext.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `              <div
                key={toast.id}
                className="pointer-events-auto relative overflow-hidden flex items-center gap-3.5 h-[56px] pl-4 pr-5 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.4)] transform transition-all duration-300 ease-out animate-in slide-in-from-top-5 fade-in bg-[#0E0E0E] border border-white/5"
              >
                {/* Smooth Glowing Background Effect */}
                <div className="absolute -left-8 top-1/2 -translate-y-1/2 w-[120px] h-[120px] bg-[#006AFF] rounded-full blur-[40px] opacity-40 pointer-events-none" />

                {/* Solid Blue Circle Checkmark (matches mockup) */}
                <div className="relative z-10 w-[22px] h-[22px] rounded-full bg-[#006AFF] flex items-center justify-center flex-shrink-0">
                  <Check className="w-3.5 h-3.5 text-[#050505]" strokeWidth={3.5} />
                </div>
                
                {/* Crisp Text */}
                <p className="relative z-10 flex-1 text-[15.5px] text-white whitespace-nowrap pr-4 font-normal tracking-wide">
                  {toast.message}
                </p>
                
                {/* Thin Close Button */}
                <button
                  onClick={() => removeToast(toast.id)}
                  className="relative z-10 flex-shrink-0 text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-[18px] h-[18px]" strokeWidth={1.5} />
                </button>
              </div>`;

const newStr = `              <div
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
                    <svg width="12" height="13" viewBox="0 0 12 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12.068 11.4332C12.126 11.4912 12.172 11.5602 12.203 11.636C12.235 11.7119 12.251 11.7932 12.251 11.8753C12.251 11.9575 12.235 12.0388 12.203 12.1147C12.172 12.1905 12.126 12.2595 12.068 12.3175C12.009 12.3756 11.941 12.4217 11.865 12.4531C11.789 12.4845 11.707 12.5007 11.625 12.5007C11.543 12.5007 11.462 12.4845 11.386 12.4531C11.31 12.4217 11.241 12.3756 11.183 12.3175L6 7.1339L0.818 12.3175C0.7 12.4348 0.541 12.5007 0.375 12.5007C0.209 12.5007 0.05 12.4348 -0.067 12.3175C-0.184 12.2003 -0.25 12.0412 -0.25 11.8753C-0.25 11.7095 -0.184 11.5504 -0.067 11.4332L5.117 6.2503L-0.067 1.0675C-0.184 0.9503 -0.25 0.7912 -0.25 0.6253C-0.25 0.4595 -0.184 0.3004 -0.067 0.1832C0.05 0.0659 0.209 0 0.375 0C0.541 0 0.7 0.0659 0.818 0.1832L6 5.3668L11.183 0.1832C11.3 0.0659 11.459 0 11.625 0C11.791 0 11.95 0.0659 12.068 0.1832C12.185 0.3004 12.251 0.4595 12.251 0.6253C12.251 0.7912 12.185 0.9503 12.068 1.0675L6.884 6.2503L12.068 11.4332Z" fill="currentColor"/>
                    </svg>
                  </button>
                </div>
              </div>`;

content = content.replace(targetStr, newStr);

fs.writeFileSync(filePath, content);
