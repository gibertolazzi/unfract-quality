const fs = require('fs');
const filePath = 'lib/gemini.ts';
let content = fs.readFileSync(filePath, 'utf8');

const targetLoop = `  let lastError;

  for (const modelName of modelsToTry) {
    try {
      console.log(\`Tentativo di generazione con il modello: \${modelName}\`);
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
      text = text.replace(/\`\`\`json\\n?/g, '').replace(/\`\`\`\\n?/g, '').trim();

      return JSON.parse(text);
    } catch (error: any) {
      console.error(\`Errore con il modello \${modelName}:\`, error.message || error);
      lastError = error;
      // Se è un 503 o 429, continua al prossimo modello
      if (error.message && (error.message.includes('503') || error.message.includes('429'))) {
        continue;
      }
      // Se il modello non è stato trovato (404), continua
      if (error.message && error.message.includes('404')) {
        continue;
      }
      // Altrimenti, è un errore di parsing JSON o altro, riprova comunque col prossimo.
    }
  }`;

const newLoop = `  let lastError;
  const MAX_RETRIES = 3;

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(\`Tentativo \${attempt}/\${MAX_RETRIES} di generazione con il modello: \${modelName}\`);
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
        text = text.replace(/\`\`\`json\\n?/g, '').replace(/\`\`\`\\n?/g, '').trim();

        return JSON.parse(text);
      } catch (error: any) {
        lastError = error;
        
        // Se è un 503 o 429, ritentiamo sullo stesso modello con exponential backoff
        if (error.message && (error.message.includes('503') || error.message.includes('429'))) {
          if (attempt < MAX_RETRIES) {
            const delay = attempt * 2000;
            console.warn(\`Modello \${modelName} sovraccarico (503/429). Ritento tra \${delay}ms...\`);
            await new Promise(r => setTimeout(r, delay));
            continue; // Prova di nuovo
          }
        }
        
        // Se non è un 503/429 o abbiamo esaurito i tentativi, loggiamo l'errore e passiamo al prossimo modello.
        console.error(\`Errore definitivo con il modello \${modelName} (dopo \${attempt} tentativi):\`, error.message || error);
        break; // Passa al modello successivo in modelsToTry
      }
    }
  }`;

content = content.replace(targetLoop, newLoop);
fs.writeFileSync(filePath, content);
