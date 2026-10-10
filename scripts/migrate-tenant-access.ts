/**
 * Migrazione degli accessi per le regole per azienda (vedi lib/server/tenantMigration.ts).
 *
 *   npx tsx scripts/migrate-tenant-access.ts            # mostra cosa farebbe, non scrive
 *   npx tsx scripts/migrate-tenant-access.ts --apply    # esegue il piano
 *
 * Variabili:
 *   FIREBASE_PROJECT_ID   progetto (obbligatoria)
 * Credenziali: Application Default Credentials (`gcloud auth application-default
 * login`, oppure GOOGLE_APPLICATION_CREDENTIALS) di un account con accesso al
 * progetto.
 *
 * Gli ID sono abbreviati a 6 caratteri; niente nomi né email nell'output.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { applyTenantMigration, planTenantMigration } from '../lib/server/tenantMigration';

const short = (id: string) => id.split('_').map(part => part.slice(0, 6)).join('_');

async function main() {
  const apply = process.argv.includes('--apply');
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Imposta FIREBASE_PROJECT_ID.');

  const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId }));
  const plan = await planTenantMigration(db as any);

  console.log(`Progetto ${projectId}\n`);
  console.log(`Accessi da scrivere con ID fisso: ${plan.grantWrites.length}`);
  for (const write of plan.grantWrites) {
    const from = write.from.length ? `da ${write.from.length} (${write.from.map(short).join(', ')})` : 'nuovo, membro dell\'organizzazione';
    console.log(`  ${short(write.id)}  ${write.data.resourceType}  ${write.data.role}  ${from}`);
  }
  console.log(`Accessi da cancellare (confluiti sopra): ${plan.grantDeletes.length}`);
  console.log(`Organizzazioni a cui completare memberUids: ${plan.memberUids.map(org => `${short(org.orgId)} (+${org.add.length})`).join(', ') || 'nessuna'}`);
  console.log(`Workspace da creare: ${plan.workspaces.map(ws => short(ws.id)).join(', ') || 'nessuno'}`);
  if (plan.invalidGrants.length) {
    console.log(`Accessi illeggibili, lasciati come sono: ${plan.invalidGrants.map(grant => `${short(grant.id)} (${grant.reason})`).join(', ')}`);
  }

  const { review } = plan;
  console.log('\nDa decidere a mano (lo script non li cambia):');
  console.log(`  Progetti senza workspace valido: ${review.projectsWithoutWorkspace.map(p => `${short(p.projectId)} → ${p.workspaceId ? short(p.workspaceId) : 'nessuno'}`).join(', ') || 'nessuno'}`);
  console.log(`  Task con workspace diverso dal progetto: ${review.tasksWithOtherWorkspace.length}`);
  console.log(`  Accessi di chi non è più membro: ${review.grantsOfNonMembers.map(g => short(g.grantId)).join(', ') || 'nessuno'}`);
  const orphans = Object.entries(review.orphans).map(([name, ids]) => `${name} ${ids.length}`).join(', ');
  console.log(`  Documenti di progetti cancellati: ${orphans || 'nessuno'}`);

  if (!apply) {
    console.log('\nNessuna scrittura: rilancia con --apply per eseguire il piano.');
    return;
  }
  const result = await applyTenantMigration(db as any, plan, (...values) => FieldValue.arrayUnion(...values));
  console.log(`\nFatto: ${JSON.stringify(result)}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
