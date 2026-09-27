const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add to props
content = content.replace(
  'onAddContact: (accountId: string) => void;',
  'onAddContact: (accountId: string) => void;\n  onAddCustomer?: (accountId: string) => void;'
);

// Add button
const target = `{linkedCustomer && (
                  <Section title="Cliente">
                    <LinkRow
                      title={CUSTOMER_STATUS_LABELS[linkedCustomer.status]}
                      subtitle={\`Cliente dal \${formatDate(linkedCustomer.customerSince)}\`}
                      onClick={() => onOpen({ kind: 'customer', record: linkedCustomer })}
                    />
                  </Section>
                )}`;
const replacement = `{linkedCustomer ? (
                  <Section title="Cliente">
                    <LinkRow
                      title={CUSTOMER_STATUS_LABELS[linkedCustomer.status]}
                      subtitle={\`Cliente dal \${formatDate(linkedCustomer.customerSince)}\`}
                      onClick={() => onOpen({ kind: 'customer', record: linkedCustomer })}
                    />
                  </Section>
                ) : onAddCustomer ? (
                  <Section title="Cliente">
                    <button
                      type="button"
                      onClick={() => onAddCustomer(account.id)}
                      className="w-full rounded-xl border border-dashed border-[#2A2A2A] bg-transparent px-3 py-3 text-sm text-[#858585] hover:border-[#5A5A5A] hover:text-white transition-colors flex items-center justify-center gap-2"
                    >
                      <Star size={14} />
                      Trasforma in Cliente
                    </button>
                  </Section>
                ) : null}`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content, 'utf8');
