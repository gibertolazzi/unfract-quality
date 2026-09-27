'use client';

import { useEffect } from 'react';

/**
 * La pila dei pannelli aperti.
 *
 * Serve perché i pannelli si sovrappongono: dalla scheda di un contatto si
 * apre la composizione di un'email, e in quel momento sono aperti in due. Se
 * ognuno ascoltasse Esc per conto proprio, un solo tasto li chiuderebbe
 * entrambi e chi scriveva l'email si ritroverebbe a fissare l'elenco, con il
 * testo perso.
 *
 * Reagisce solo chi sta in cima. Quello sotto resta dov'è, ed Esc lo chiude al
 * colpo successivo — che è quello che chiunque si aspetta.
 */
const pila: symbol[] = [];

/**
 * Chiude un pannello sovrapposto con Esc.
 *
 * Nel CRM ci sono dodici fra modali e pannelli laterali. Senza questo, per
 * chiuderne uno bisogna trovare la X con il mouse: chi lavora tutto il giorno
 * sulla tastiera se ne accorge alla terza volta, ed è la convenzione che tutti
 * si aspettano da qualcosa che copre la pagina.
 *
 * `enabled` serve a non chiudere mentre un'operazione sta scrivendo: durante
 * un'importazione o un invio, un Esc battuto per riflesso farebbe sparire
 * l'unica finestra che sta raccontando cosa sta succedendo. L'operazione
 * andrebbe avanti lo stesso, ma senza più nessuno a guardarla.
 *
 * Il listener sta su `window` in fase di cattura, così arriva anche quando il
 * fuoco è dentro un campo di testo.
 */
export function useCloseOnEscape(onClose: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const token = Symbol('pannello');
    pila.push(token);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (pila[pila.length - 1] !== token) return;
      onClose();
    }

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      const posizione = pila.lastIndexOf(token);
      if (posizione >= 0) pila.splice(posizione, 1);
    };
  }, [onClose, enabled]);
}
