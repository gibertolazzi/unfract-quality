# Assistenti AI collegati (MCP): operazioni e privacy

Unfract è un server MCP remoto: Claude, ChatGPT, Cursor e altri assistenti si
collegano a `https://<dominio>/api/mcp`. L'utente entra con il suo account,
sceglie un workspace e conferma; l'assistente legge con i permessi
dell'utente e, solo se l'utente mette la spunta nel consenso, crea e modifica
task. Non cancella mai nulla e non vede il CRM.

Codice: `lib/server/mcp/` (server di autorizzazione OAuth 2.1, permessi,
strumenti), `app/api/mcp`, `app/api/oauth/*`, pagina di consenso
`app/(public)/oauth/authorize`. Manuale utente: `PLATFORM_MANUAL_IT.md`.

## 1. Accensione in produzione

MCP è acceso in sviluppo e su quality, **spento in prod**: lì le route
rispondono 404 finché non c'è la variabile `MCP_ENABLED=true`.

Prima di accenderlo:

1. Prova completa su quality con un assistente vero (es. Claude →
   Impostazioni → Connettori → «Aggiungi connettore personalizzato» con
   `https://unfract--unfract.europe-west4.hosted.app/api/mcp`).
2. Informativa privacy aggiornata e pubblicata (sezione 4).
3. Policy TTL attive su prod (sezione 2).
4. OK di Matteo.

Poi: Firebase Console → App Hosting → backend `unfract` (progetto
`unfract-prod`) → Impostazioni → Variabili d'ambiente → aggiungere
`MCP_ENABLED` = `true` (disponibile al runtime) → nuovo rollout.

Per spegnerlo di nuovo basta `MCP_ENABLED=false` e un rollout: tutte le route
MCP tornano 404 e gli assistenti collegati si fermano. Per un solo workspace
c'è l'interruttore nella pagina dell'organizzazione.

## 2. Pulizia automatica (policy TTL di Firestore)

Codici, token, client registrati e contatori hanno un campo con la data di
scadenza. Firestore li cancella da solo solo se la policy TTL è attiva su
quel campo. Senza, restano nel database (i controlli funzionano lo stesso,
perché il codice guarda le scadenze, ma le raccolte crescono).

| Raccolta | Campo | Cosa contiene | Scade dopo |
|---|---|---|---|
| `mcp_codes` | `expireAt` | codici di autorizzazione (impronte) | 10 minuti |
| `mcp_tokens` | `expireAt` | token di accesso e di rinnovo (impronte) | 1 ora / 30 giorni |
| `mcp_clients` | `expiresAt` | app registrate e documenti dei client in cache | 90 giorni / 30 giorni |
| `mcp_audit` | `expireAt` | registro delle chiamate degli assistenti | 365 giorni |
| `rate_limits` | `expiresAt` | contatori dei limiti di richieste (tutta l'app) | 2 finestre |

Da eseguire una volta per progetto (`unfract` e `unfract-prod`), con un
account che ha il ruolo Owner o Datastore Owner:

```bash
for p in unfract unfract-prod; do
  gcloud firestore fields ttls update expireAt  --collection-group=mcp_codes   --enable-ttl --project=$p
  gcloud firestore fields ttls update expireAt  --collection-group=mcp_tokens  --enable-ttl --project=$p
  gcloud firestore fields ttls update expiresAt --collection-group=mcp_clients --enable-ttl --project=$p
  gcloud firestore fields ttls update expireAt  --collection-group=mcp_audit   --enable-ttl --project=$p
  gcloud firestore fields ttls update expiresAt --collection-group=rate_limits --enable-ttl --project=$p
done
```

In alternativa dalla console: Firestore → TTL → «Crea policy», una per riga
della tabella. La cancellazione non è immediata: Firestore la fa di solito
entro 24 ore dalla scadenza.

`mcp_grants` (i collegamenti) e `mcp_settings` (gli interruttori per
workspace) non scadono: un collegamento revocato resta come traccia.

## 3. Conservazione del registro

Ogni chiamata di un assistente lascia una voce in `mcp_audit`: utente,
workspace, app, strumento, progetto, esito, ora. **Non** contiene il testo di
task, documenti o commenti. Con la policy TTL attiva le voci restano
**365 giorni** (`AUDIT_RETENTION_DAYS` in `lib/server/mcp/tools.ts`). Il
periodo va confermato da chi cura la privacy e indicato nell'informativa.

## 4. Bozza per l'informativa privacy

> Bozza tecnica da far rivedere a chi cura la privacy e da adattare
> all'informativa esistente. Tra parentesi quadre ciò che va completato.

**Collegamento di assistenti AI di terzi (MCP)**

Unfract permette a ciascun utente di collegare al proprio account un
assistente di intelligenza artificiale fornito da terzi (ad esempio Claude di
Anthropic, ChatGPT di OpenAI, Cursor), tramite il protocollo Model Context
Protocol (MCP). Il collegamento avviene solo su iniziativa dell'utente, dopo
l'accesso al proprio account e una conferma esplicita, e riguarda un solo
workspace scelto dall'utente.

*Quali dati.* L'assistente collegato può leggere, per conto dell'utente e con
i suoi stessi permessi: progetti, attività (titoli, descrizioni, commenti,
scadenze, assegnatari), bacheche, documenti, riassunti e trascrizioni delle
riunioni, nomi dei membri del workspace e gli eventi del calendario
dell'utente. Se l'utente lo autorizza con un'apposita opzione, l'assistente
può anche creare, modificare, spostare e commentare attività a nome
dell'utente; non può cancellare dati. I dati del CRM non sono accessibili.
Questi contenuti possono includere dati personali di altre persone (ad
esempio colleghi indicati come assegnatari o nominati in un documento).

*Destinatari.* I dati letti dall'assistente vengono trasmessi al fornitore
dell'assistente scelto dall'utente, che li tratta secondo i propri termini e
la propria informativa, sulla base del rapporto tra l'utente (o la sua
organizzazione) e quel fornitore. [Indicare il ruolo dei fornitori: titolari
autonomi / responsabili, secondo la valutazione legale.] I fornitori possono
trovarsi fuori dallo Spazio economico europeo: [indicare le garanzie
applicabili o rinviare a quelle del fornitore].

*Base giuridica.* [Esecuzione del contratto / richiesta dell'utente, da
valutare.]

*Cosa conserva Unfract.* Per gestire il collegamento Unfract conserva: le
impronte crittografiche (non i valori) dei codici e dei token di accesso, per
la loro durata (al massimo 30 giorni dall'ultimo rinnovo); l'elenco dei
collegamenti dell'utente (app, workspace, permessi, data dell'ultimo uso); un
registro delle operazioni svolte dagli assistenti (utente, app, operazione,
progetto, esito e ora, senza il contenuto dei dati) per 12 mesi, per finalità
di sicurezza e di verifica.

*Controllo.* L'utente può vedere e revocare in ogni momento gli assistenti
collegati da Impostazioni profilo → «Assistenti AI collegati»; la revoca ha
effetto immediato. Il proprietario o un amministratore di un'organizzazione
può disattivare gli assistenti per tutto il workspace. La revoca non cancella
i dati già trasmessi al fornitore dell'assistente: per quelli valgono i
termini del fornitore.

[Diritti dell'interessato e contatti: rinviare alle sezioni esistenti
dell'informativa.]
