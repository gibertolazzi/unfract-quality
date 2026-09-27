const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/ContactFormModal.tsx';
let content = fs.readFileSync(path, 'utf8');

// Update ContactFormValues interface
content = content.replace(
  'phone: string;',
  'phone: string;\n  address: string;\n  city: string;\n  postalCode: string;\n  country: string;'
);

// Update initial state
content = content.replace(
  'phone: contact?.phone || \'\',',
  'phone: contact?.phone || \'\',\n    address: contact?.address || \'\',\n    city: contact?.city || \'\',\n    postalCode: contact?.postalCode || \'\',\n    country: contact?.country || \'\','
);

// Update UI
const addressFields = `          <Field label="Indirizzo (via e numero)">
            <input value={values.address} onChange={e => set({ address: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Città">
            <input value={values.city} onChange={e => set({ city: e.target.value })} className={inputClass} />
          </Field>
          <Field label="CAP">
            <input value={values.postalCode} onChange={e => set({ postalCode: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Nazione">
            <input value={values.country} onChange={e => set({ country: e.target.value })} className={inputClass} />
          </Field>`;

content = content.replace(
  '<Field label="Ruolo">',
  addressFields + '\n\n          <Field label="Ruolo">'
);

fs.writeFileSync(path, content, 'utf8');
