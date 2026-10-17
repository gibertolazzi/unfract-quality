# Checklist amministrativa Unfract

Checklist interna per preparare un Workspace e verificare che le sezioni principali siano operative.

## 1. Identità e accesso

- [ ] Dominio applicativo configurato.
- [ ] Login email/password verificato.
- [ ] Login Google verificato su desktop e iPhone.
- [ ] Client OAuth web corretto associato al provider Firebase.
- [ ] `https://app.unfract.com/__/auth/handler` presente negli URI autorizzati.
- [ ] Domini `app.unfract.com` e `unfract.com` presenti in Firebase Authentication.
- [ ] Privacy policy e contatto sviluppatore configurati nella schermata OAuth.

## 2. Workspace

- [ ] Workspace creato.
- [ ] Nome e modalità (`flat`, `teams` o `corporate`) verificati.
- [ ] Logo/banner caricati, se necessari.
- [ ] Workspace attivo correttamente selezionabile dalla Sidebar.
- [ ] Quote inizializzate: storage, limite storage, crediti AI e limite crediti.
- [ ] Pulsante Usage mostra valori coerenti.
- [ ] Cambio workspace aggiorna project e contenuti visibili.

## 3. Projects

- [ ] Project creato nel Workspace corretto.
- [ ] Project rinominabile.
- [ ] Project selezionabile dalla Sidebar.
- [ ] Colonne `To Do`, `Doing`, `Done` presenti.
- [ ] Task, documenti, meeting, chat e CRM appartengono al project corretto.
- [ ] Prima di eliminare un project è stato fatto un export o un controllo dei dati collegati.

## 4. Teams e ruoli

- [ ] Membri invitati tramite link o email.
- [ ] Invito ricevuto e completato.
- [ ] Team creato.
- [ ] Membri assegnati al team.
- [ ] Ruolo custom creato.
- [ ] Permesso `read` testato.
- [ ] Permesso `write` testato.
- [ ] Utente senza permesso verificato su CRM, Tasks e Documentation.
- [ ] Richiesta di accesso testata.
- [ ] Owner e workspace admin verificati.

## 5. Tasks

- [ ] Nuova task creata.
- [ ] Priorità e scadenza salvate.
- [ ] Task spostata tra colonne.
- [ ] Colonna riordinata.
- [ ] Epic creata e collegata.
- [ ] Commento aggiunto.
- [ ] Mention inviata.
- [ ] Allegato caricato.
- [ ] Allegato eliminato.
- [ ] Task spostata in `Done`.
- [ ] Task completata non viene più proposta dall'AI Hub.
- [ ] Vista Kanban, elenco e cronologia verificate.

## 6. CRM

- [ ] Azienda/account creato.
- [ ] Contatto collegato.
- [ ] Cliente creato.
- [ ] Lead creato.
- [ ] Opportunità aperta nella pipeline.
- [ ] Fase e valore aggiornati.
- [ ] Follow-up creato e assegnato.
- [ ] Import CSV/XLSX eseguito in ambiente di prova.
- [ ] Duplicati controllati.
- [ ] Lead convertito.
- [ ] Documento CRM caricato.
- [ ] Versione documento aggiunta.
- [ ] Report prospect generato con AI.
- [ ] Report salvato come bozza.

## 7. Documentation

- [ ] Documento creato.
- [ ] Documento annidato sotto un altro documento.
- [ ] Titoli, liste e link verificati.
- [ ] Blocco codice verificato.
- [ ] Immagine caricata.
- [ ] Video/audio caricati.
- [ ] Riferimento a task o meeting inserito.
- [ ] Commento e cronologia verificati.
- [ ] Generazione AI cloud verificata.
- [ ] Modello locale verificato, se il browser supporta WebGPU.
- [ ] Eliminazione documento e cleanup media verificati.

## 8. Calendar

- [ ] Evento locale creato.
- [ ] Evento modificato e trascinato.
- [ ] Viste giorno/settimana/mese/anno verificate.
- [ ] Fuso orario controllato.
- [ ] Export `.ics` verificato.
- [ ] Link video predefinito configurato.
- [ ] Google Calendar collegato.
- [ ] Microsoft Outlook collegato.
- [ ] Evento esterno visibile come read-only.
- [ ] Sync verificata.
- [ ] Link pubblico `/book/[userId]` verificato.

## 9. Meetings

- [ ] Permesso microfono concesso.
- [ ] Registrazione avviata.
- [ ] Trascrizione live verificata.
- [ ] Picture-in-Picture verificato.
- [ ] Audio salvato.
- [ ] Riepilogo e decisioni generati.
- [ ] Task estratte dal meeting.
- [ ] Task assegnata alla board.
- [ ] Transcript scaricabile.
- [ ] Retry trascrizione verificato.
- [ ] Fallback registrazione grezza verificato.
- [ ] Audio eliminato insieme al meeting quando previsto.

## 10. Chat

- [ ] Canale creato.
- [ ] Messaggio inviato.
- [ ] Messaggio diretto creato.
- [ ] Mention utente verificata.
- [ ] Mention task/documento/meeting verificata.
- [ ] Immagine/file/video caricati.
- [ ] Voice message caricato.
- [ ] Notifica in-app ricevuta.
- [ ] Email notification verificata.
- [ ] Eliminazione per sé verificata.
- [ ] Eliminazione per tutti verificata.
- [ ] Eliminazione canale verificata.
- [ ] Cleanup allegati verificato.

## 11. AI Hub

- [ ] Chat nuova creata.
- [ ] Chat esistente riaperta.
- [ ] Contesto project verificato.
- [ ] Task aperte visibili al modello.
- [ ] Task `Done` escluse dalle raccomandazioni.
- [ ] Domanda con riferimento a task verificata.
- [ ] Creazione task automatica verificata.
- [ ] Allegato caricato.
- [ ] Voce verificata.
- [ ] Titolo chat generato.
- [ ] Gemini cloud incrementa i crediti.
- [ ] Gemini Nano/WebLLM locale non incrementa i crediti cloud.
- [ ] Eliminazione chat libera gli allegati tracciati.
- [ ] MCP: un assistente (es. Claude) si collega con l'indirizzo mostrato nell'AI Hub, chiede login e scelta del workspace, e vede solo i progetti di quel workspace.
- [ ] MCP: un membro senza permesso «Task» o «Documenti» non li vede nemmeno dall'assistente.
- [ ] MCP: «Scollega» in Impostazioni ferma subito l'assistente.
- [ ] MCP: l'amministratore spegne gli assistenti dalla pagina dell'organizzazione e quelli collegati si fermano; un membro normale non vede l'interruttore.
- [ ] MCP in prod: acceso solo dopo l'OK, con `MCP_ENABLED=true`.

## 12. Quote e cleanup

- [ ] Upload piccolo mostrato in KB/MB, non come `0,0 GB`.
- [ ] Upload grande mostrato in GB.
- [ ] Crediti AI aggiornati dopo una risposta cloud riuscita.
- [ ] Periodo mensile AI verificato.
- [ ] Workspace legacy inizializzato con i campi quota.
- [ ] Eliminazione task libera gli allegati tracciati.
- [ ] Eliminazione chat libera gli allegati tracciati.
- [ ] Eliminazione meeting libera l'audio tracciato.
- [ ] Eliminazione documentazione libera i media tracciati.
- [ ] I file legacy senza metadati non vengono sottratti arbitrariamente.

## 13. Lingue

- [ ] Italiano selezionato.
- [ ] Inglese selezionato.
- [ ] Sidebar aggiornata senza reload completo.
- [ ] Task Board aggiornata.
- [ ] Calendar aggiornata.
- [ ] CRM aggiornata.
- [ ] Meeting aggiornata.
- [ ] Formattazione date aggiornata.
- [ ] Cookie `NEXT_LOCALE` valorizzato correttamente.
- [ ] Nessuna voce importante resta nella lingua precedente.

## 14. Schermate da catturare per la guida

- [ ] Sidebar e selettori Workspace/Project.
- [ ] Organization e Team.
- [ ] Ruolo e permessi.
- [ ] Task Board.
- [ ] Task detail.
- [ ] CRM dashboard.
- [ ] Pipeline.
- [ ] Import.
- [ ] Documentation editor.
- [ ] Calendar.
- [ ] Calendar integration.
- [ ] Meeting detail.
- [ ] Chat.
- [ ] AI Hub.
- [ ] Usage dropdown.

## Esito

- [ ] Test completato in desktop Chrome.
- [ ] Test completato in Safari/iPhone per login, Tasks, Calendar e Chat.
- [ ] Build di produzione superata.
- [ ] Regole Firebase verificate prima della pubblicazione.
- [ ] Segreti server non presenti nel repository.
- [ ] Risultato documentato nel changelog interno.
