const fs = require('fs');
const filePath = 'lib/gemini.ts';
let content = fs.readFileSync(filePath, 'utf8');

const oldArray = 'const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro", "gemini-2.0-flash"];';
const newArray = `  // Usa gemini-3.5-transcribe come modello primario assoluto (ottimizzato per l'audio) se c'è un fileUri
  const modelsToTry = fileUri 
    ? ["gemini-3.5-transcribe", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"]
    : ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro", "gemini-2.0-flash"];`;

content = content.replace(oldArray, newArray);
fs.writeFileSync(filePath, content);
