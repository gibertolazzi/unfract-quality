import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export async function processMeetingTranscript(audioBlob?: Blob | null, roughTranscript?: string) {
  if (!API_KEY) {
    throw new Error("Manca la API Key di Gemini. Inserisci NEXT_PUBLIC_GEMINI_API_KEY nel file .env.local");
  }

    

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

    // Usa gemini-3.5-transcribe come modello primario assoluto (ottimizzato per l'audio) se c'è un fileUri
    const modelsToTry = fileUri 
    ? ["gemini-3.5-transcribe", "gemini-3.6-flash"]
    : ["gemini-3.6-flash"];
  let lastError;
  const MAX_RETRIES = 3;

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Tentativo ${attempt}/${MAX_RETRIES} di generazione con il modello: ${modelName}`);
        // Fallback a un MIME type testuale per gemini-pro che a volte non supporta application/json
        const responseMimeType = modelName === 'gemini-pro' ? 'text/plain' : 'application/json';
        const currentModel = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType } });
        
        let result;
        if (fileUri && mimeType) {
          result = await currentModel.generateContent([
            prompt,
            {
              fileData: {
                mimeType: mimeType,
                fileUri: fileUri
              }
            }
          ]);
        } else {
          result = await currentModel.generateContent(prompt);
        }
        
        const response = await result.response;
        let text = response.text();
        
        // Rimuovi eventuali blocchi markdown
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        return JSON.parse(text);
      } catch (error: any) {
        lastError = error;
        
        // Se è un 503 o 429, ritentiamo sullo stesso modello con exponential backoff
        if (error.message && (error.message.includes('503') || error.message.includes('429'))) {
          if (attempt < MAX_RETRIES) {
            const delay = attempt * 2000;
            console.warn(`Modello ${modelName} sovraccarico (503/429). Ritento tra ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
            continue; // Prova di nuovo
          }
        }
        
        // Se non è un 503/429 o abbiamo esaurito i tentativi, loggiamo l'errore e passiamo al prossimo modello.
        console.error(`Errore definitivo con il modello ${modelName} (dopo ${attempt} tentativi):`, error.message || error);
        break; // Passa al modello successivo in modelsToTry
      }
    }
  }

  console.error("Tutti i modelli hanno fallito. Ultimo errore:", lastError);
  throw lastError;
}
