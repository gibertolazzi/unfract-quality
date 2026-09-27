const fs = require('fs');
const filePath = 'lib/gemini.ts';
let content = fs.readFileSync(filePath, 'utf8');

const oldArrayRegex = /const modelsToTry = fileUri\s*\?\s*\["gemini-3\.5-transcribe", "gemini-1\.5-flash", "gemini-1\.5-pro", "gemini-pro"\]\s*:\s*\["gemini-1\.5-flash", "gemini-1\.5-pro", "gemini-pro", "gemini-2\.0-flash"\];/;

const newArray = `  const modelsToTry = fileUri 
    ? ["gemini-3.5-transcribe", "gemini-3.6-flash"]
    : ["gemini-3.6-flash"];`;

content = content.replace(oldArrayRegex, newArray);
fs.writeFileSync(filePath, content);
