/**
 * Il contratto di un motore di ricerca, e il fatto che oggi non ce n'è uno.
 *
 * La ricerca per nome è l'unico percorso della sezione che **non si può fare
 * gratis**, e il motivo è strutturale: partita IVA e dominio sono chiavi — VIES
 * risponde dalla prima, il sito esiste alla seconda. Un nome non è una chiave:
 * per trasformarlo in un'azienda serve qualcuno che abbia già indicizzato i
 * siti del mondo o i registri delle imprese, e nessuno lo fa gratis via API.
 * OpenCorporates ha l'indice per nome di tutta Europa e risponde `401` senza
 * chiave; il Registro Imprese costa a visura.
 *
 * Deciso il 17 settembre 2026: **la sezione resta senza motore**. La
 * conseguenza è scritta, non nascosta — la ricerca per nome guarda in casa e
 * lo dice.
 *
 * L'alternativa scartata, e vale la pena scrivere perché: indovinare il
 * dominio dal nome (`marchesini.it`, `marchesinigroup.com`) sarebbe gratis e
 * funzionerebbe a volte. Quando sbaglia costruisce una scheda completa
 * sull'azienda sbagliata — con tanto di partita IVA confermata da VIES, che è
 * la parte peggiore, perché sembra verificata. Una ricerca che non trova
 * niente è meglio di una che trova l'azienda di qualcun altro.
 *
 * Il contratto resta scritto perché collegare un motore, il giorno che si
 * decide di pagarlo, sia una riga e non un rifacimento.
 */

export interface WebSearchHit {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchFailure {
  code: 'NOT_CONFIGURED' | 'RATE_LIMITED' | 'QUOTA_EXCEEDED' | 'NETWORK' | 'UNEXPECTED';
  message: string;
  retryable: boolean;
}

export type WebSearchOutcome =
  | { ok: true; hits: WebSearchHit[] }
  | { ok: false; failure: WebSearchFailure };

export interface WebSearchProvider {
  id: string;
  label: string;
  /** Sempre vero per un motore vero: si vede in interfaccia prima del clic. */
  billed: boolean;
  /** Falso finché non c'è una chiave. L'interfaccia lo chiede prima di offrire il pulsante. */
  configured: boolean;
  search(query: string, limit?: number): Promise<WebSearchOutcome>;
}

/**
 * Il motore che non c'è.
 *
 * Non è un segnaposto vuoto: risponde, e risponde **dicendo cosa manca**. Così
 * il resto del codice è scritto contro il contratto vero fin da ora, e chi
 * usa la sezione legge una frase che spiega, non un pulsante che non fa niente.
 */
export const motoreNonConfigurato: WebSearchProvider = {
  id: 'nessuno',
  label: 'Nessun motore configurato',
  billed: false,
  configured: false,

  async search(): Promise<WebSearchOutcome> {
    return { ok: false, failure: {
      code: 'NOT_CONFIGURED',
      retryable: false,
      message: 'La ricerca sul web non è attiva: richiede la chiave di un motore di ricerca, che è a pagamento. Per ora si cerca per partita IVA o per indirizzo del sito, che sono gratuiti.',
    }};
  },
};

/** Il motore in uso. Oggi è quello che non c'è, e lo dichiara. */
export const webSearchProvider: WebSearchProvider = motoreNonConfigurato;
