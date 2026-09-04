const { GoogleGenerativeAI } = require("@google/generative-ai");
const apiKey = "AQ.Ab8RN6IKogZyw5dGsGDRSczYIjW9Cs_IAAfm3CphrZ9q-_7hkQ";
const genAI = new GoogleGenerativeAI(apiKey);
async function test() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent("Ciao, dimmi che funzioniamo!");
    console.log("RISPOSTA:", result.response.text());
  } catch (e) {
    console.error("ERRORE:", e.message);
  }
}
test();
