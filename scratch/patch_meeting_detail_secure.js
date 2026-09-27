const fs = require('fs');
const filePath = 'app/(authenticated)/meetings/[id]/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

if (content.indexOf("import { getMeetingById, updateMeeting }") === -1) {
    content = content.replace("import { getMeetingById } from '@/lib/meetings';", "import { getMeetingById, updateMeeting } from '@/lib/meetings';\nimport { processMeetingTranscript } from '@/lib/gemini';\nimport { RefreshCw } from 'lucide-react';");
}
if (content.indexOf("isRetrying") === -1) {
    content = content.replace('const [isEditingTitle, setIsEditingTitle] = useState(false);', 'const [isEditingTitle, setIsEditingTitle] = useState(false);\n  const [isRetrying, setIsRetrying] = useState(false);');
}

if (content.indexOf("handleRetryTranscription") === -1) {
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
      
      await updateDoc(doc(db, "meetings", params.id), newData);
      
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

  const saveTitle = async () => {`;
    content = content.replace('const saveTitle = async () => {', retryFunc);
}

const targetRender = `<h1 className="text-[32px] font-medium text-white tracking-wide">
              {meeting.title}
            </h1>`;
const newRender = `<h1 className="text-[32px] font-medium text-white tracking-wide flex items-center gap-3 flex-wrap">
              {meeting.title}
              {meeting.title.includes('Fallita') && (
                  <button 
                    onClick={handleRetryTranscription}
                    disabled={isRetrying}
                    className="ml-4 flex items-center gap-2 px-3 py-1.5 bg-[#FF0004]/10 border border-[#FF0004]/30 text-[#FF0004] rounded-lg text-[13px] font-medium hover:bg-[#FF0004]/20 transition-colors disabled:opacity-50"
                  >
                    {isRetrying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Riprova Elaborazione AI
                  </button>
                )}
            </h1>`;

content = content.replace(targetRender, newRender);

fs.writeFileSync(filePath, content);
