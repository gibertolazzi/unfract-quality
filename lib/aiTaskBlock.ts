/**
 * Il blocco con cui l'AI dell'AI Hub chiede di creare un task.
 *
 * Il prompt del server chiede `$CREATE_TASK$ {...} $END_TASK$`, mentre il
 * browser cercava `$$CREATE_TASK$$`: i task proposti dall'AI non venivano mai
 * creati. Qui si accettano entrambe le forme, e anche un JSON dentro ```json.
 */

export interface AiTaskDraft {
  title: string;
  description: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  category: string;
}

const BLOCK = /\${1,2}CREATE_TASK\${1,2}([\s\S]*?)\${1,2}END_TASK\${1,2}/;
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * Cerca il blocco nella risposta. `block` è il testo esatto da sostituire,
 * `task` è null se il JSON non si legge.
 */
export function findAiTaskBlock(reply: string): { block: string; task: AiTaskDraft | null } | null {
  const match = reply.match(BLOCK);
  if (!match) return null;

  const body = match[1].replace(/```(?:json)?/gi, '').trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  let task: AiTaskDraft | null = null;
  if (start !== -1 && end > start) {
    try {
      const raw = JSON.parse(body.slice(start, end + 1));
      const priority = PRIORITIES.find(p => p.toLowerCase() === text(raw?.priority, 20).toLowerCase()) ?? 'Medium';
      task = {
        title: text(raw?.title, 200) || 'Nuova Task',
        description: text(raw?.description, 5000),
        priority,
        category: text(raw?.category, 50) || 'General',
      };
    } catch {
      task = null;
    }
  }
  return { block: match[0], task };
}
