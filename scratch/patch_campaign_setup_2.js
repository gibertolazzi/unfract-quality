const fs = require('fs');
const path = 'components/marketing/CampaignSetupView.tsx';
let content = fs.readFileSync(path, 'utf8');

// Header update (add "Programma o Invia" button and "Aggiungi lingue")
const headerOld = `      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/marketing" className="p-2 bg-white/5 rounded-full text-[#858585] hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <div className="flex items-center gap-2 text-sm text-[#858585] mb-1">
            <Link href="/marketing" className="hover:text-white transition-colors">Campagne di emailing</Link>
            <ChevronRight size={14} />
            <span className="text-white">Crea una campagna email</span>
          </div>
          <h1 className="text-3xl font-semibold text-white">{campaign.name}</h1>
        </div>
      </div>

      {/* Steps Container */}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl flex flex-col overflow-hidden">`;

const headerNew = `      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
          <Link href="/marketing" className="p-2 bg-white/5 rounded-full text-[#858585] hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-sm text-[#858585] mb-1">
              <Link href="/marketing" className="hover:text-white transition-colors">Campagne di emailing</Link>
              <ChevronRight size={14} />
              <span className="text-white">Crea una campagna email</span>
            </div>
            <h1 className="text-3xl font-semibold text-white">{campaign.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-medium hover:bg-white/10 transition-colors">
            Aggiungi lingue
          </button>
          <button 
            disabled={!(isSenderComplete && isRecipientsComplete && isSubjectComplete && isDesignComplete)}
            className="px-6 py-2.5 bg-[#006AFF] text-white font-medium rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Programma o Invia
          </button>
        </div>
      </div>

      {/* Steps Container */}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl flex flex-col overflow-hidden">`;
content = content.replace(headerOld, headerNew);

// Ideazione
const ideazioneOld = `                {!isDesignComplete && (
                  <p className="text-[#858585]">Crea il design della tua email.</p>
                )}
              </div>
            </div>
            <button 
              onClick={() => router.push(\`/marketing/templates/\${campaign.id}\`)}
              className="px-5 py-2.5 bg-[#0D6EFD]/20 border border-[#0D6EFD]/30 text-[#0D6EFD] rounded-xl font-medium hover:bg-[#0D6EFD]/30 transition-colors shrink-0"
            >
              {isDesignComplete ? 'Modifica design' : 'Crea design'}
            </button>`;

const ideazioneNew = `                {!isDesignComplete && (
                  <p className="text-[#858585]">Crea contenuto email</p>
                )}
              </div>
            </div>
            <button 
              onClick={() => router.push(\`/marketing/templates/\${campaign.id}\`)}
              className="px-5 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl font-medium hover:bg-white/10 transition-colors shrink-0"
            >
              {isDesignComplete ? 'Modifica design' : 'Inizia a progettare'}
            </button>`;
content = content.replace(ideazioneOld, ideazioneNew);

// Impostazioni aggiuntive (at the very bottom)
const bottomOld = `        </div>

      </div>
    </div>
  );
}`;

const bottomNew = `        </div>

        {/* Step 5: Impostazioni aggiuntive */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border-t border-white/10 gap-4">
          <div className="flex items-start gap-4">
            <Circle size={24} className="text-[#858585] shrink-0 mt-0.5 opacity-0" />
            <div>
              <h3 className="text-xl font-medium text-white mb-1">Impostazioni aggiuntive</h3>
            </div>
          </div>
          <button className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-medium hover:bg-white/10 transition-colors shrink-0">
            Modifica impostazioni
          </button>
        </div>

      </div>
    </div>
  );
}`;
content = content.replace(bottomOld, bottomNew);

fs.writeFileSync(path, content);
