/**
 * Il tetto di spesa.
 *
 * VIES e la lettura di un sito sono gratuite. Il motore di ricerca e l'AI si
 * pagano a chiamata, e una sezione che cerca da sola può consumarle in fretta:
 * dieci commerciali che aprono venti schede al giorno fanno duemila chiamate a
 * settimana senza che nessuno abbia l'impressione di aver fatto niente di
 * strano.
 *
 * Qui dentro non c'è nessuna chiamata: si contano quelle già fatte e si dice
 * se la prossima può partire. Funzioni pure, verificabili.
 */

import {
  BilledOperation, BILLED_OPERATIONS, BILLED_OPERATION_LABELS, DEFAULT_MONTHLY_BUDGET,
} from '@/components/crm/ricerca/constants';

export type BudgetConfig = Record<BilledOperation, number>;

/** Quante operazioni a pagamento sono state consumate, per tipo. */
export type BudgetUsage = Partial<Record<BilledOperation, number>>;

export interface BudgetVerdict {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  /** Frase da mostrare così com'è: dice cosa è finito e cosa fare. */
  reason: string;
}

/** Il mese di competenza di una data, in `AAAA-MM`. Il tetto è mensile. */
export function budgetPeriod(when: Date = new Date()): string {
  const mese = String(when.getUTCMonth() + 1).padStart(2, '0');
  return `${when.getUTCFullYear()}-${mese}`;
}

/**
 * Configurazione effettiva: i valori scritti dal progetto, con i predefiniti a
 * coprire i buchi. Un numero negativo o non numerico vale zero — «non
 * configurato» non deve mai significare «illimitato».
 */
export function resolveBudget(configured: Partial<BudgetConfig> = {}): BudgetConfig {
  const risultato = { ...DEFAULT_MONTHLY_BUDGET };
  for (const operazione of BILLED_OPERATIONS) {
    const valore = configured[operazione];
    if (typeof valore === 'number' && Number.isFinite(valore) && valore >= 0) {
      risultato[operazione] = Math.floor(valore);
    }
  }
  return risultato;
}

/** Somma i consumi di più ricerche in un totale per tipo di operazione. */
export function sumUsage(usages: BudgetUsage[]): BudgetUsage {
  const totale: BudgetUsage = {};
  for (const usage of usages) {
    for (const operazione of BILLED_OPERATIONS) {
      const quante = usage[operazione];
      if (typeof quante === 'number' && quante > 0) {
        totale[operazione] = (totale[operazione] || 0) + quante;
      }
    }
  }
  return totale;
}

/**
 * Se la prossima operazione può partire.
 *
 * `cost` è quante chiamate servono: una ricerca per nome ne consuma più di
 * una, e chiedere il permesso per una alla volta lascerebbe passare la prima
 * metà di un'operazione che non può finire.
 */
export function canSpend(
  operation: BilledOperation,
  usage: BudgetUsage,
  budget: BudgetConfig,
  cost = 1
): BudgetVerdict {
  const limite = budget[operation] ?? 0;
  const usate = usage[operation] || 0;
  const restanti = Math.max(0, limite - usate);
  const etichetta = BILLED_OPERATION_LABELS[operation];

  if (limite === 0) {
    return {
      allowed: false, used: usate, limit: 0, remaining: 0,
      reason: `${etichetta}: non è previsto nessun budget per questo progetto. Si abilita alzando il tetto mensile nelle impostazioni della sezione.`,
    };
  }
  if (usate + cost > limite) {
    return {
      allowed: false, used: usate, limit: limite, remaining: restanti,
      reason: restanti === 0
        ? `${etichetta}: esaurite tutte le ${limite} operazioni del mese. Il conteggio riparte il primo del mese prossimo.`
        : `${etichetta}: ne restano ${restanti} questo mese e ne servirebbero ${cost}.`,
    };
  }
  return {
    allowed: true, used: usate, limit: limite, remaining: restanti - cost,
    reason: `${etichetta}: ne restano ${restanti - cost} dopo questa.`,
  };
}

/**
 * Quando avvisare che il budget sta finendo.
 *
 * All'80%: avvisare a zero significa avvisare quando è tardi, e chi stava
 * lavorando si ferma a metà di una ricerca.
 */
export function budgetWarnings(usage: BudgetUsage, budget: BudgetConfig): string[] {
  const avvisi: string[] = [];
  for (const operazione of BILLED_OPERATIONS) {
    const limite = budget[operazione] ?? 0;
    if (limite === 0) continue;
    const usate = usage[operazione] || 0;
    const quota = usate / limite;
    if (quota >= 1) {
      avvisi.push(`${BILLED_OPERATION_LABELS[operazione]}: budget del mese esaurito (${usate} su ${limite}).`);
    } else if (quota >= 0.8) {
      avvisi.push(`${BILLED_OPERATION_LABELS[operazione]}: usato l’${Math.round(quota * 100)}% del budget del mese (${usate} su ${limite}).`);
    }
  }
  return avvisi;
}
