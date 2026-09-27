/**
 * Le divisioni ATECO che servono davvero, con le parole che ci portano.
 *
 * Due cose sul perimetro, dette subito perché cambiano cosa ci si può fare:
 *
 * 1. **Si stima la divisione, due cifre.** Non il codice a sei. Il codice pieno
 *    lo assegna la Camera di commercio e si legge in una visura: dedurlo da tre
 *    parole in homepage vorrebbe dire produrre un dato che sembra ufficiale e
 *    non lo è. `28` con scritto «macchinari» è utile e difendibile; `28.99.99`
 *    dedotto da un sito è una bugia precisa.
 * 2. **L'elenco è curato, non completo.** Sono le quarantaquattro divisioni in cui
 *    ricade la quasi totalità del B2B italiano. Un'azienda che non ricade in
 *    nessuna resta **senza settore stimato**, e la scheda lo scrive: è meglio
 *    di un settore approssimativo scelto perché era l'unico che somigliava.
 *
 * Le parole sono in italiano e in inglese perché i siti italiani sono metà e
 * metà, e spesso la pagina più esplicita su cosa fanno è quella in inglese.
 */

export interface SectorDef {
  /** Divisione ATECO, due cifre. Più di così serve una visura. */
  code: string;
  label: string;
  /** Le parole che portano qui. Una vale un punto. */
  keywords: string[];
  /**
   * Le parole che da sole dicono quasi tutto. Valgono due punti: «pastificio»
   * non lascia molti dubbi, «produzione» sì.
   */
  strong?: string[];
  /**
   * Le divisioni che tipicamente **comprano** da questa. Serve al cliente-tipo.
   * Vuoto quando non ha senso.
   */
  serveA?: string[];
  /**
   * Vero per i settori che vendono a chiunque — software, consulenza,
   * marketing, ricerca del personale. Per questi il cliente-tipo **non si
   * deduce dal settore**, e dirlo è più utile che elencare mezza economia.
   */
  orizzontale?: boolean;
}

export const SECTORS: SectorDef[] = [
  { code: '10', label: 'Industrie alimentari',
    keywords: ['alimentare', 'alimentari', 'food', 'food industry', 'pasta', 'bakery', 'conserve', 'ingredienti', 'farine', 'surgelati', 'gastronomia'],
    strong: ['pastificio', 'caseificio', 'salumificio', 'dolciaria', 'molino'],
    serveA: ['46', '47', '55', '56'] },

  { code: '11', label: 'Industria delle bevande',
    keywords: ['bevande', 'beverage', 'coffee', 'birra', 'birrificio', 'vino', 'vini', 'cantina', 'distilleria', 'torrefazione', 'caffe', 'acque minerali'],
    strong: ['birrificio', 'distilleria', 'torrefazione'],
    serveA: ['46', '47', '55', '56'] },

  { code: '13', label: 'Industrie tessili',
    keywords: ['tessile', 'tessili', 'filati', 'tessuti', 'textile', 'yarn', 'tintoria', 'orditura'],
    strong: ['filatura', 'tessitura', 'tintoria'],
    serveA: ['14', '15', '31'] },

  { code: '14', label: 'Confezione di articoli di abbigliamento',
    keywords: ['abbigliamento', 'moda', 'fashion', 'maglieria', 'confezioni', 'capospalla', 'camiceria', 'sartoria'],
    strong: ['maglieria', 'camiceria'],
    serveA: ['46', '47'] },

  { code: '15', label: 'Pelli, cuoio e calzature',
    keywords: ['calzature', 'scarpe', 'pelletteria', 'cuoio', 'concia', 'footwear', 'leather', 'borse'],
    strong: ['conceria', 'calzaturificio'],
    serveA: ['46', '47'] },

  { code: '16', label: 'Industria del legno',
    keywords: ['legno', 'legname', 'segheria', 'pannelli', 'compensato', 'wood'],
    strong: ['segheria'],
    serveA: ['31', '41', '43'] },

  { code: '17', label: 'Carta e prodotti di carta',
    keywords: ['carta', 'cartotecnica', 'cartone', 'ondulato', 'paper', 'imballaggi in carta'],
    strong: ['cartiera', 'cartotecnica'],
    serveA: ['10', '11', '20', '46'] },

  { code: '18', label: 'Stampa e riproduzione',
    keywords: ['stampa', 'tipografia', 'litografia', 'serigrafia', 'printing', 'stampati', 'etichette'],
    strong: ['tipografia', 'serigrafia'],
    serveA: ['10', '11', '46', '73'] },

  { code: '20', label: 'Industria chimica',
    keywords: ['chimica', 'chimici', 'vernici', 'resine', 'adesivi', 'collanti', 'detergenti', 'polimeri', 'chemical', 'additivi'],
    strong: ['verniciatura industriale', 'resine'],
    serveA: ['22', '23', '24', '25', '28', '41'] },

  { code: '21', label: 'Industria farmaceutica',
    keywords: ['farmaceutico', 'farmaceutica', 'pharmaceutical', 'pharma', 'farmaci', 'integratori', 'nutraceutica', 'pharma', 'principi attivi'],
    strong: ['nutraceutica', 'officina farmaceutica'],
    serveA: ['46', '86'] },

  { code: '22', label: 'Gomma e materie plastiche',
    keywords: ['plastica', 'plastiche', 'plastics', 'moulding', 'stampaggio', 'estrusione', 'termoformatura', 'gomma', 'guarnizioni', 'plastic', 'injection'],
    strong: ['stampaggio a iniezione', 'estrusione', 'termoformatura'],
    serveA: ['10', '20', '27', '28', '29'] },

  { code: '23', label: 'Lavorazione di minerali non metalliferi',
    keywords: ['ceramica', 'ceramiche', 'ceramics', 'tiles', 'piastrelle', 'vetro', 'cemento', 'calcestruzzo', 'laterizi', 'marmo', 'refrattari'],
    strong: ['piastrelle', 'laterizi', 'refrattari'],
    serveA: ['41', '43', '46'] },

  { code: '24', label: 'Metallurgia',
    keywords: ['acciaio', 'acciaieria', 'steelmaking', 'metals', 'metallurgy', 'metallurgia', 'fonderia', 'alluminio', 'laminazione', 'steel', 'ghisa'],
    strong: ['acciaieria', 'fonderia', 'laminatoio'],
    serveA: ['25', '28', '29', '41'] },

  { code: '25', label: 'Prodotti in metallo',
    keywords: ['carpenteria', 'lamiera', 'tornitura', 'fresatura', 'saldatura', 'metalmeccanica', 'metalmeccanico', 'stampi', 'meccanica di precisione', 'lavorazioni meccaniche', 'taglio laser'],
    strong: ['carpenteria metallica', 'tornitura', 'stampi', 'taglio laser'],
    serveA: ['28', '29', '30', '41', '43'] },

  { code: '26', label: 'Computer ed elettronica',
    keywords: ['elettronica', 'schede elettroniche', 'sensori', 'strumentazione', 'misura', 'electronics', 'pcb', 'schede'],
    strong: ['schede elettroniche', 'strumentazione di misura'],
    serveA: ['27', '28', '29', '62'] },

  { code: '27', label: 'Apparecchiature elettriche',
    keywords: ['quadri elettrici', 'cavi', 'motori elettrici', 'illuminazione', 'trasformatori', 'batterie', 'elettrotecnica'],
    strong: ['quadri elettrici', 'trasformatori'],
    serveA: ['28', '41', '43'] },

  { code: '28', label: 'Macchinari e apparecchiature',
    keywords: ['macchinari', 'macchine', 'machines', 'machinery', 'equipment', 'production lines', 'impianti', 'automazione', 'robotica', 'linee di produzione', 'confezionamento', 'packaging', 'machinery', 'automation', 'nastri trasportatori'],
    strong: ['macchine automatiche', 'linee di produzione', 'automazione industriale', 'robotica'],
    serveA: ['10', '11', '13', '20', '21', '22', '23', '24', '25'] },

  { code: '29', label: 'Autoveicoli e componenti',
    keywords: ['automotive', 'autoveicoli', 'componentistica auto', 'ricambi', 'veicoli industriali', 'rimorchi'],
    strong: ['componentistica automotive'],
    serveA: ['45', '46'] },

  { code: '30', label: 'Altri mezzi di trasporto',
    keywords: ['nautica', 'cantiere navale', 'ferroviario', 'aeronautico', 'aerospazio', 'imbarcazioni'],
    strong: ['cantiere navale', 'aerospazio'],
    serveA: ['46', '49', '50'] },

  { code: '31', label: 'Fabbricazione di mobili',
    keywords: ['arredamento', 'arredo', 'mobili', 'cucine', 'imbottiti', 'furniture', 'complementi d arredo'],
    strong: ['arredamento su misura', 'mobilificio'],
    serveA: ['46', '47', '55', '68'] },

  { code: '32', label: 'Altre industrie manifatturiere',
    keywords: ['oreficeria', 'gioielli', 'occhiali', 'occhialeria', 'articoli sportivi', 'dispositivi medici', 'medicali', 'strumenti musicali', 'giocattoli'],
    strong: ['occhialeria', 'dispositivi medici'],
    serveA: ['46', '47', '86'] },

  { code: '33', label: 'Riparazione e manutenzione industriale',
    keywords: ['manutenzione', 'riparazione', 'revisione', 'assistenza tecnica', 'ricondizionamento', 'retrofit', 'service industriale'],
    strong: ['manutenzione industriale', 'retrofit'],
    serveA: ['10', '11', '22', '24', '25', '28'] },

  { code: '41', label: 'Costruzione di edifici',
    keywords: ['edilizia', 'costruzioni', 'ristrutturazioni', 'general contractor', 'cantiere', 'immobili industriali'],
    strong: ['general contractor', 'impresa edile'],
    serveA: ['68', '84'] },

  { code: '43', label: 'Lavori di costruzione specializzati',
    keywords: ['impianti elettrici', 'impianti idraulici', 'climatizzazione', 'condizionamento', 'termoidraulica', 'coibentazione', 'antincendio', 'fotovoltaico', 'impiantistica'],
    strong: ['impianti di climatizzazione', 'impiantistica industriale', 'fotovoltaico'],
    serveA: ['41', '68', '10', '28'] },

  { code: '46', label: 'Commercio all’ingrosso',
    keywords: ['ingrosso', 'distribuzione', 'distributore', 'rivenditore', 'importazione', 'wholesale', 'grossista', 'concessionario'],
    strong: ['distribuzione all ingrosso', 'grossista'],
    serveA: ['47', '55', '56'] },

  { code: '47', label: 'Commercio al dettaglio',
    keywords: ['dettaglio', 'negozio', 'punto vendita', 'e-commerce', 'ecommerce', 'shop online', 'retail', 'boutique'],
    strong: ['punti vendita', 'e-commerce'],
    serveA: [] },

  { code: '49', label: 'Trasporto e logistica',
    keywords: ['logistica', 'logistics', 'trasporti', 'transport', 'spedizioni', 'autotrasporto', 'corriere', 'magazzino', 'freight', 'shipping', 'intermodale'],
    strong: ['autotrasporto', 'spedizioniere', 'logistica integrata'],
    serveA: ['10', '46', '47', '25', '28'] },

  { code: '55', label: 'Alloggio',
    keywords: ['hotel', 'albergo', 'resort', 'ospitalita', 'bed and breakfast', 'agriturismo', 'strutture ricettive'],
    strong: ['struttura ricettiva'],
    serveA: [] },

  { code: '56', label: 'Ristorazione',
    keywords: ['ristorante', 'ristorazione', 'catering', 'mensa', 'banqueting', 'pasticceria', 'tavola calda'],
    strong: ['ristorazione collettiva', 'banqueting'],
    serveA: [] },

  { code: '58', label: 'Editoria e contenuti',
    keywords: ['editoria', 'casa editrice', 'rivista', 'periodico', 'pubblicazioni', 'editoriale'],
    strong: ['casa editrice'],
    serveA: [], orizzontale: true },

  { code: '62', label: 'Software e consulenza informatica',
    keywords: ['software', 'sviluppo software', 'applicazioni', 'gestionale', 'erp', 'crm', 'saas', 'cloud', 'sistemi informativi', 'cybersecurity', 'sicurezza informatica', 'app', 'piattaforma', 'digitalizzazione', 'system integrator'],
    strong: ['sviluppo software', 'system integrator', 'sistemi informativi'],
    serveA: [], orizzontale: true },

  { code: '63', label: 'Servizi di informazione e data center',
    keywords: ['data center', 'datacenter', 'hosting', 'elaborazione dati', 'housing', 'connettivita'],
    strong: ['data center'],
    serveA: [], orizzontale: true },

  { code: '65', label: 'Assicurazioni e intermediazione finanziaria',
    keywords: ['assicurazioni', 'assicurativo', 'broker', 'polizze', 'leasing', 'finanziamenti', 'credito', 'factoring'],
    strong: ['broker assicurativo', 'intermediazione creditizia'],
    serveA: [], orizzontale: true },

  { code: '68', label: 'Attività immobiliari',
    keywords: ['immobiliare', 'immobili', 'property', 'locazione', 'compravendita immobiliare', 'agenzia immobiliare'],
    strong: ['agenzia immobiliare', 'property management'],
    serveA: [] },

  { code: '69', label: 'Attività legali e contabili',
    keywords: ['commercialista', 'studio legale', 'avvocati', 'revisione legale', 'fiscale', 'tributario', 'consulenza del lavoro', 'paghe'],
    strong: ['studio legale', 'dottori commercialisti', 'consulenza del lavoro'],
    serveA: [], orizzontale: true },

  { code: '70', label: 'Consulenza gestionale',
    keywords: ['consulenza', 'management', 'organizzazione aziendale', 'temporary manager', 'lean', 'controllo di gestione', 'strategia'],
    strong: ['consulenza direzionale', 'controllo di gestione'],
    serveA: [], orizzontale: true },

  { code: '71', label: 'Ingegneria e architettura',
    keywords: ['ingegneria', 'progettazione', 'architettura', 'studio tecnico', 'collaudi', 'direzione lavori', 'engineering', 'prove di laboratorio'],
    strong: ['studio di ingegneria', 'direzione lavori'],
    serveA: ['41', '43', '28'] },

  { code: '72', label: 'Ricerca scientifica e sviluppo',
    keywords: ['ricerca e sviluppo', 'laboratorio di ricerca', 'innovazione', 'brevetti', 'prototipazione'],
    strong: ['ricerca e sviluppo'],
    serveA: [], orizzontale: true },

  { code: '73', label: 'Pubblicità e ricerche di mercato',
    keywords: ['marketing', 'pubblicita', 'comunicazione', 'agenzia creativa', 'branding', 'social media', 'advertising', 'ricerche di mercato'],
    strong: ['agenzia di comunicazione', 'ricerche di mercato'],
    serveA: [], orizzontale: true },

  { code: '78', label: 'Ricerca e selezione del personale',
    keywords: ['recruiting', 'selezione del personale', 'somministrazione', 'agenzia per il lavoro', 'head hunting', 'risorse umane'],
    strong: ['agenzia per il lavoro', 'head hunting'],
    serveA: [], orizzontale: true },

  { code: '81', label: 'Servizi per edifici e paesaggio',
    keywords: ['pulizie', 'facility', 'facility management', 'manutenzione verde', 'sanificazione', 'portierato'],
    strong: ['facility management', 'imprese di pulizia'],
    serveA: [], orizzontale: true },

  { code: '82', label: 'Servizi di supporto alle imprese',
    keywords: ['call center', 'back office', 'fiere', 'congressi', 'eventi aziendali', 'contact center', 'outsourcing'],
    strong: ['contact center', 'organizzazione fiere'],
    serveA: [], orizzontale: true },

  { code: '85', label: 'Istruzione e formazione',
    keywords: ['formazione', 'corsi', 'academy', 'scuola', 'training', 'e-learning', 'aggiornamento professionale'],
    strong: ['formazione professionale', 'academy'],
    serveA: [], orizzontale: true },

  { code: '86', label: 'Sanità',
    keywords: ['clinica', 'poliambulatorio', 'sanitario', 'odontoiatrico', 'diagnostica', 'fisioterapia', 'casa di cura'],
    strong: ['poliambulatorio', 'casa di cura'],
    serveA: [] },
];

/** L'etichetta di una divisione, per scriverla accanto al codice. */
export function sectorLabel(code: string): string {
  return SECTORS.find(s => s.code === code)?.label || '';
}

export function sectorByCode(code: string): SectorDef | null {
  return SECTORS.find(s => s.code === code) || null;
}
