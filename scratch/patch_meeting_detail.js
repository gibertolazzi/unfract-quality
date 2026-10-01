const fs = require('fs');
const filePath = 'app/(authenticated)/meetings/[id]/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add imports
const importRegex = /import \{ getMeetingById \} from '@\/lib\/meetings';/;
content = content.replace(importRegex, "import { getMeetingById, updateMeeting } from '@/lib/meetings';\nimport { processMeetingTranscript } from '@/lib/gemini';\nimport { RefreshCw } from 'lucide-react';");

// Add state for retrying
const stateRegex = /const \[isEditingTitle, setIsEditingTitle\] = useState\(false\);\n\s*const \[editedTitle, setEditedTitle\] = useState\(""\);/;
content = content.replace(stateRegex, "const [isEditingTitle, setIsEditingTitle] = useState(false);\n  const [editedTitle, setEditedTitle] = useState(\"\");\n  const [isRetrying, setIsRetrying] = useState(false);");

// Add retry function
const funcRegex = /const handleTitleSave = async \(\) => \{/;

const retryFunc = `
  const handleRetryTranscription = async () => {
    if (!meeting) return;
    setIsRetrying(true);
    try {
      const result = await processMeetingTranscript(null, meeting.transcript);
      const newTitle = meeting.title.replace(" (Trascrizione Fallita)", "");
      
      const newData = {
        title: newTitle,
        summary: result.summary,
        decisions: result.decisions,
        tasks: result.tasks
      };
      
      await updateMeeting(meeting.id, newData);
      
      setMeeting({
        ...meeting,
        ...newData
      });
      toast.success("Trascrizione rigenerata con successo!");
    } catch (e) {
      console.error(e);
      toast.error("Elaborazione AI fallita di nuovo. Riprova più tardi.");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleTitleSave = async () => {`;

content = content.replace(funcRegex, retryFunc);

// Add button in the header
const headerRegex = /<h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">/;
const newHeader = `<h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3 flex-wrap">`;
content = content.replace(headerRegex, newHeader);

const titleRenderRegex = /<span className="cursor-pointer hover:text-white\/80 transition-colors" onClick=\{\(\) => \{ setEditedTitle\(meeting\.title\); setIsEditingTitle\(true\); \}\}>\n\s*\{meeting\.title\}\n\s*<\/span>/;

const newTitleRender = `<span className="cursor-pointer hover:text-white/80 transition-colors" onClick={() => { setEditedTitle(meeting.title); setIsEditingTitle(true); }}>
                  {meeting.title}
                </span>
                {meeting.title.includes('Fallita') && (
                  <button 
                    onClick={handleRetryTranscription}
                    disabled={isRetrying}
                    className="ml-4 flex items-center gap-2 px-3 py-1.5 bg-[#FF0004]/10 border border-[#FF0004]/30 text-[#FF0004] rounded-lg text-[13px] font-medium hover:bg-[#FF0004]/20 transition-colors disabled:opacity-50"
                  >
                    {isRetrying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Riprova Elaborazione AI
                  </button>
                )}`;

content = content.replace(titleRenderRegex, newTitleRender);

fs.writeFileSync(filePath, content);
