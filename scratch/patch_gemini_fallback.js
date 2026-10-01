const fs = require('fs');
const filePath = 'lib/gemini.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Replace the single model initialization
content = content.replace(
  'const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash", generationConfig: { responseMimeType: "application/json" } });',
  ''
);
content = content.replace(
  '// Using gemini-3.8-flash per evitare limiti di quota (limit: 0) sul modello pro\n',
  ''
);

const generationBlock = `  try {
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
    
    // Rimuovi eventuali blocchi markdown \`\`\`json ... \`\`\`
    text = text.replace(/\`\`\`json\\n?/g, '').replace(/\`\`\`\\n?/g, '').trim();

    return JSON.parse(text);
  } catch (error) {
    console.error("Errore durante l'elaborazione con Gemini:", error);
    throw error;
  }`;

const newGenerationBlock = `  const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro", "gemini-2.0-flash"];
  let lastError;

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
  }

  console.error("Tutti i modelli hanno fallito. Ultimo errore:", lastError);
  throw lastError;`;

content = content.replace(generationBlock, newGenerationBlock);

fs.writeFileSync(filePath, content);
