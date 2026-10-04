import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '');

export async function askAI(prompt: string, systemInstruction?: string) {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemInstruction || "Sei un assistente editor utile. Rispondi usando ESCLUSIVAMENTE sintassi HTML base (<h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <blockquote>). Non usare markdown. Solo HTML puro. Non racchiudere la risposta in backtick.",
    });
    
    const result = await model.generateContent(prompt);
    let response = await result.response.text();
    // Clean up backticks in case the model ignored instructions
    response = response.replace(/^\s*\`\`\`(html)?/g, '').replace(/\`\`\`\s*$/g, '').trim();
    return response;
  } catch (error) {
    console.error("AI Generation Error:", error);
    throw error;
  }
}
