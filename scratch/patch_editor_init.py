import re

with open('components/marketing/EmailEditorView.tsx', 'r') as f:
    content = f.read()

# Locate useState for blocks and simpleHtml
target_blocks_init = """  const [blocks, setBlocks] = useState<any[]>([
    { id: '1', type: 'title', content: 'Questo è il tuo titolo.' },
    { id: '2', type: 'image', content: 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&q=80&w=400' },
    { id: '3', type: 'text', content: 'Scrivi qui il tuo messaggio...' },
    { id: '4', type: 'button', content: 'Clicca qui' }
  ]);

  const [simpleHtml, setSimpleHtml] = useState('<p>Caro cliente,</p><p>Questo è un messaggio semplice.</p>');"""

new_blocks_init = """
  const templateId = searchParams.get('template');
  
  const initialBlocks = React.useMemo(() => {
    switch(templateId) {
      case 'sell':
        return [
          { id: '1', type: 'image', content: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600', style: { borderRadius: '12px' } },
          { id: '2', type: 'title', content: 'Nuova Collezione Invernale', style: { textAlign: 'center', padding: '20px 0 10px' } },
          { id: '3', type: 'text', content: 'Scopri i nostri ultimi arrivi...', style: { textAlign: 'center', padding: '0 0 20px', color: '#666666' } },
          { id: '4', type: 'button', content: 'Acquista la collezione', style: { backgroundColor: '#0D6EFD', color: '#ffffff', padding: '12px 24px', borderRadius: '8px' } },
          { id: 'div1', type: 'divider', content: '', style: {} },
          { id: 'p1_img', type: 'image', content: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400', style: { borderRadius: '8px' } },
          { id: 'p1_btn', type: 'button', content: 'Acquista Ora', style: { backgroundColor: '#1A1A1A', color: '#ffffff', padding: '10px 20px', borderRadius: '8px' } },
          { id: 'div2', type: 'divider', content: '', style: {} },
          { id: 'promo_title', type: 'title', content: 'PROMO20', style: { textAlign: 'center', padding: '20px', backgroundColor: '#F3F4F6', color: '#1A1A1A', borderRadius: '8px' } },
          { id: 'footer', type: 'text', content: 'Offerta valida fino al 31 Dicembre. Non cumulabile.', style: { textAlign: 'center', padding: '20px 0', color: '#999999' } }
        ];
      case 'story':
        return [
          { id: '1', type: 'image', content: 'https://images.unsplash.com/photo-1455390582262-044cdead27d8?auto=format&fit=crop&q=80&w=600', style: { borderRadius: '12px' } },
          { id: '2', type: 'image', content: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&q=80&w=400', style: { borderRadius: '8px' } },
          { id: '3', type: 'text', content: 'Tutto è iniziato con una semplice idea nel nostro piccolo ufficio...', style: { textAlign: 'left', padding: '20px 0', color: '#333333' } },
          { id: '4', type: 'title', content: 'Il nostro viaggio', style: { textAlign: 'left', padding: '10px 0' } },
          { id: '5', type: 'text', content: 'Negli anni abbiamo costruito una community fantastica...', style: { textAlign: 'left', padding: '0 0 20px', color: '#666666' } },
          { id: '6', type: 'image', content: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=600', style: { borderRadius: '12px' } },
          { id: '7', type: 'title', content: 'Guardando al futuro', style: { textAlign: 'left', padding: '20px 0 10px' } },
          { id: '8', type: 'text', content: 'Siamo entusiasti di condividere con voi i prossimi passi.', style: { textAlign: 'left', padding: '0 0 20px', color: '#666666' } },
          { id: 'footer', type: 'text', content: 'Grazie per essere parte della nostra storia.', style: { textAlign: 'center', padding: '40px 0 20px', color: '#999999' } }
        ];
      case 'event':
        return [
          { id: '1', type: 'image', content: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=600', style: { borderRadius: '12px' } },
          { id: '2', type: 'title', content: 'Tech Conference 2026', style: { textAlign: 'center', padding: '20px 0 10px' } },
          { id: '3', type: 'image', content: 'https://images.unsplash.com/photo-1551818255-e6e10975bc17?auto=format&fit=crop&q=80&w=600', style: { borderRadius: '12px' } },
          { id: '4', type: 'text', content: 'Unisciti a noi per 3 giorni di innovazione e networking a Milano.', style: { textAlign: 'center', padding: '20px 0', color: '#333333' } },
          { id: '5', type: 'button', content: 'Prenota un posto', style: { backgroundColor: '#0D6EFD', color: '#ffffff', padding: '12px 30px', borderRadius: '8px' } },
          { id: 'div1', type: 'divider', content: '', style: {} },
          { id: '6', type: 'title', content: 'Incontra i nostri relatori', style: { textAlign: 'center', padding: '20px 0' } },
          { id: 's1_img', type: 'image', content: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=150', style: { borderRadius: '100px' } },
          { id: 's1_txt', type: 'text', content: '<b>Marco Rossi</b><br>CEO, TechCorp', style: { textAlign: 'center', padding: '10px 0 20px' } },
          { id: 's2_img', type: 'image', content: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150', style: { borderRadius: '100px' } },
          { id: 's2_txt', type: 'text', content: '<b>Giulia Bianchi</b><br>Senior Manager', style: { textAlign: 'center', padding: '10px 0 20px' } },
          { id: 's3_img', type: 'image', content: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=150', style: { borderRadius: '100px' } },
          { id: 's3_txt', type: 'text', content: '<b>Luca Verdi</b><br>Lead Designer', style: { textAlign: 'center', padding: '10px 0 20px' } },
          { id: 'btn2', type: 'button', content: 'Vedi tutti i relatori', style: { backgroundColor: '#1A1A1A', color: '#ffffff', padding: '10px 20px', borderRadius: '8px' } },
          { id: 'footer', type: 'text', content: 'I posti sono limitati.', style: { textAlign: 'center', padding: '40px 0 20px', color: '#999999' } }
        ];
      case 'default':
      default:
        return [
          { id: '1', type: 'title', content: 'Il tuo titolo qui', style: { textAlign: 'center', padding: '20px 0' } },
          { id: '2', type: 'image', content: 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&q=80&w=600', style: { borderRadius: '12px' } },
          { id: '3', type: 'title', content: 'Sottotitolo della sezione', style: { textAlign: 'center', padding: '20px 0 10px', fontSize: '20px' } },
          { id: '4', type: 'text', content: 'Inizia a scrivere qui il tuo testo principale...', style: { textAlign: 'center', padding: '0 0 20px', color: '#666666' } },
          { id: '5', type: 'button', content: 'Scopri di più', style: { backgroundColor: '#0D6EFD', color: '#ffffff', padding: '12px 24px', borderRadius: '8px' } }
        ];
    }
  }, [templateId]);

  const initialSimple = templateId === 'simple' ? 
    "Gentile cliente,\\n\\nQuesta email avrà l'aspetto di un'email personale da inviare al tuo pubblico. Non sono presenti immagini o elementi grafici e non contiene formattazione. In questo modo, i lettori potranno concentrarsi sul messaggio email senza distrazioni.\\n\\nCordiali saluti,\\n<b>La tua azienda</b>\\n\\n<a href='#'>Annulla l'iscrizione</a>" : 
    '<p>Caro cliente,</p><p>Questo è un messaggio semplice.</p>';

  const [blocks, setBlocks] = useState<any[]>(initialBlocks);
  const [simpleHtml, setSimpleHtml] = useState(initialSimple);"""

content = content.replace(target_blocks_init, new_blocks_init)

with open('components/marketing/EmailEditorView.tsx', 'w') as f:
    f.write(content)

print("Editor blocks patched")
