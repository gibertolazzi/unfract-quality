import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export async function processMeetingTranscript(audioBlob?: Blob | null, roughTranscript?: string) {
  if (!API_KEY) {
    throw new Error("Manca la API Key di Gemini. Inserisci NEXT_PUBLIC_GEMINI_API_KEY nel file .env.local");
  }

  // Using gemini-3.1-pro for highest quality transcription and processing of 1h+ meetings
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro", generationConfig: { responseMimeType: "application/json" } });

  let fileUri: string | null = null;
  let mimeType: string | null = null;

  if (audioBlob) {
    console.log("Uploading audio to Gemini File API...", Math.round(audioBlob.size / 1024 / 1024), "MB");
    try {
      const uploadUrlResponse = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${API_KEY}`, {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': audioBlob.size.toString(),
          'X-Goog-Upload-Header-Content-Type': audioBlob.type || 'audio/webm',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file: { display_name: 'meeting_audio.webm' } })
      });
      
      if (uploadUrlResponse.ok) {
        const uploadUrl = uploadUrlResponse.headers.get('x-goog-upload-url');
        if (uploadUrl) {
          const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'X-Goog-Upload-Protocol': 'resumable',
              'X-Goog-Upload-Command': 'upload, finalize',
              'X-Goog-Upload-Offset': '0',
            },
            body: audioBlob
          });
          
          if (uploadRes.ok) {
            const fileInfo = await uploadRes.json();
            fileUri = fileInfo.file.uri;
            mimeType = fileInfo.file.mimeType;
            console.log("Audio uploaded successfully! URI:", fileUri);
            
            // Poll for state to become ACTIVE (Gemini needs a few seconds to process long audio files)
            let state = fileInfo.file.state;
            while (state === 'PROCESSING') {
               console.log("Audio is processing, waiting...");
               await new Promise(r => setTimeout(r, 2000));
               const statusRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileInfo.file.name}?key=${API_KEY}`);
               const statusJson = await statusRes.json();
               state = statusJson.state;
            }
            if (state === 'FAILED') {
               console.error("Gemini failed to process audio file, falling back to text.");
               fileUri = null; // Fallback to text
            }
          } else {
            console.error("Upload failed", await uploadRes.text());
          }
        }
      } else {
         console.error("Start upload failed", await uploadUrlResponse.text());
      }
    } catch(err) {
       console.error("Error uploading to Gemini File API, falling back to text only", err);
    }
  }

  const prompt = `
Sei un assistente AI specializzato nell'analisi dei meeting aziendali.
${fileUri ? "Ascolta l'audio allegato a questo messaggio." : "Leggi la seguente trascrizione del meeting:"}
${roughTranscript ? `Ecco una trascrizione parziale/grezza (usala come base per l'analisi):\n${roughTranscript}\n` : ""}

Devi estrarre le seguenti informazioni ed emettere ESATTAMENTE questo formato JSON (nessun altro testo, solo JSON valido).

{
  "summary": "Un riassunto discorsivo di max 3 paragrafi del meeting.",
  "decisions": ["Decisione 1", "Decisione 2"],
  "tasks": [
    { 
      "title": "Titolo del task", 
      "assignee": "Nome persona (se specificato, altrimenti vuoto)",
      "priority": "LOW" // Valori possibili: LOW, MEDIUM, HIGH, CRITICAL. Scegli la priorità più adatta.
    }
  ]
}
`;

  try {
    let result;
    if (fileUri && mimeType) {
      result = await model.generateContent([
        prompt,
        {
          fileData: {
            mimeType: mimeType,
            fileUri: fileUri
          }
        }
      ]);
    } else {
      result = await model.generateContent(prompt);
    }
    
    const response = await result.response;
    let text = response.text();
    
    // Rimuovi eventuali blocchi markdown ```json ... ```
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    return JSON.parse(text);
  } catch (error) {
    console.error("Errore durante l'elaborazione con Gemini:", error);
    throw error;
  }
}
