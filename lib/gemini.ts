import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export async function processMeetingTranscript(audioBase64?: string, roughTranscript?: string) {
  if (!API_KEY) {
    throw new Error("Manca la API Key di Gemini. Inserisci NEXT_PUBLIC_GEMINI_API_KEY nel file .env.local");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash", generationConfig: { responseMimeType: "application/json" } });

  const prompt = `
Sei un assistente AI specializzato nell'analisi dei meeting aziendali.
${audioBase64 ? "Ascolta l'audio allegato a questo messaggio." : "Leggi la seguente trascrizione grezza del meeting:"}
${roughTranscript ? `Ecco una trascrizione parziale (usala come contesto se l'audio è incomprensibile):\n${roughTranscript}\n` : ""}

Devi estrarre le seguenti informazioni ed emettere ESATTAMENTE questo formato JSON (nessun altro testo, solo JSON valido). Assicurati che "transcript" contenga l'esatta trascrizione parola per parola dell'audio.

{
  "transcript": "La trascrizione letterale completa dell'intero meeting parola per parola.",
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
    if (audioBase64) {
      result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: "audio/webm",
            data: audioBase64
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
