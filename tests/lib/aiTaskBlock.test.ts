import { describe, expect, it } from 'vitest';
import { findAiTaskBlock } from '@/lib/aiTaskBlock';

const json = '{"title": "Preparare offerta", "priority": "High", "description": "Per il cliente {Acme}", "category": "Sales"}';

describe('findAiTaskBlock', () => {
  it('legge il blocco con un solo $, come lo chiede il prompt del server', () => {
    const reply = `Ecco fatto.\n$CREATE_TASK$\n${json}\n$END_TASK$`;
    const found = findAiTaskBlock(reply);
    expect(found?.block).toBe(`$CREATE_TASK$\n${json}\n$END_TASK$`);
    expect(found?.task).toEqual({ title: 'Preparare offerta', priority: 'High', description: 'Per il cliente {Acme}', category: 'Sales' });
  });

  it('legge anche la forma con $$ e il JSON dentro ```json', () => {
    const found = findAiTaskBlock(`$$CREATE_TASK$$\n\`\`\`json\n${json}\n\`\`\`\n$$END_TASK$$`);
    expect(found?.task?.title).toBe('Preparare offerta');
  });

  it('valori mancanti o strani diventano quelli predefiniti', () => {
    const found = findAiTaskBlock('$CREATE_TASK$ {"priority": "urgentissima", "title": 42} $END_TASK$');
    expect(found?.task).toEqual({ title: 'Nuova Task', priority: 'Medium', description: '', category: 'General' });
    expect(findAiTaskBlock('$CREATE_TASK$ {"priority": "low"} $END_TASK$')?.task?.priority).toBe('Low');
  });

  it('JSON non valido: blocco trovato, task nullo', () => {
    const found = findAiTaskBlock('$CREATE_TASK$ {title: senza virgolette} $END_TASK$');
    expect(found).not.toBeNull();
    expect(found?.task).toBeNull();
  });

  it('nessun blocco: nessun task', () => {
    expect(findAiTaskBlock('Risposta normale, costa $5.')).toBeNull();
  });
});
