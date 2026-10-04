import { CreateMLCEngine } from "@mlc-ai/web-llm";

let engineInstance: any = null;

export async function getWebLLMEngine(onProgress?: (text: string) => void) {
  if (engineInstance) return engineInstance;

  // We use a small 1B model that fits within ~800MB
  const selectedModel = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
  
  engineInstance = await CreateMLCEngine(selectedModel, {
    initProgressCallback: (info) => {
      if (onProgress) onProgress(info.text);
    }
  });

  return engineInstance;
}

export function isWebLLMLoaded() {
  return engineInstance !== null;
}
