import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_AI_HUB_GEMINI_KEY);
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      systemInstruction: `Sei Unfract AI.`
    });
    const chat = model.startChat({ history: [] });
    const result = await chat.sendMessage('ciao');
    console.log("SUCCESS:", await result.response.text());
  } catch(e) {
    console.error("ERROR:", e);
  }
}
run();
