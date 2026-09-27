const fs = require('fs');
const path = 'lib/crm/followupService.ts';
let content = fs.readFileSync(path, 'utf8');

const target = `export async function deleteFollowup(ctx: CrmContextRef, id: string) {
  await deleteRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'followup.deleted', 'followup', id);
}`;

const replacement = `export async function archiveFollowup(ctx: CrmContextRef, id: string) {
  await archiveRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'followup.archived', 'followup', id);
}

export async function deleteFollowup(ctx: CrmContextRef, id: string) {
  await deleteRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'followup.deleted', 'followup', id);
}`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
}

// Update FollowupView
content = content.replace(
  "export type FollowupView = 'today' | 'overdue' | 'week' | 'unplanned' | 'done' | 'all';",
  "export type FollowupView = 'today' | 'overdue' | 'week' | 'unplanned' | 'done' | 'all' | 'archived';"
);

// Update labels
content = content.replace(
  "all: 'Tutti',",
  "all: 'Tutti',\n  archived: 'Archiviati',"
);

// Update applyFollowupFilters
const oldFilters = `  return followups.filter(followup => {
    if (!filters.includeArchived && followup.archived) return false;
    if (!matchesView(followup, filters.view)) return false;
    if (filters.assigneeUids.length > 0 && !filters.assigneeUids.includes(followup.assigneeUid)) return false;
    if (filters.types.length > 0 && !filters.types.includes(followup.type)) return false;
    if (filters.priorities.length > 0 && !filters.priorities.includes(followup.priority)) return false;
    if (needle && ![followup.title, followup.notes].join(' ').toLowerCase().includes(needle)) return false;
    return true;
  });`;

const newFilters = `  return followups.filter(followup => {
    if (filters.view === 'archived') {
      if (!followup.archived) return false;
    } else {
      if (followup.archived) return false;
      if (!matchesView(followup, filters.view)) return false;
    }
    if (filters.assigneeUids.length > 0 && !filters.assigneeUids.includes(followup.assigneeUid)) return false;
    if (filters.types.length > 0 && !filters.types.includes(followup.type)) return false;
    if (filters.priorities.length > 0 && !filters.priorities.includes(followup.priority)) return false;
    if (needle && ![followup.title, followup.notes].join(' ').toLowerCase().includes(needle)) return false;
    return true;
  });`;

content = content.replace(oldFilters, newFilters);

// Update countViews
const oldCountViews = `export function countViews(followups: CrmFollowup[], includeArchived = false): Record<FollowupView, number> {
  const live = followups.filter(f => includeArchived || !f.archived);
  const views: FollowupView[] = ['today', 'overdue', 'week', 'unplanned', 'done', 'all'];

  return views.reduce((acc, view) => {
    acc[view] = live.filter(followup => matchesView(followup, view)).length;
    return acc;
  }, {} as Record<FollowupView, number>);
}`;

const newCountViews = `export function countViews(followups: CrmFollowup[]): Record<FollowupView, number> {
  const views: FollowupView[] = ['today', 'overdue', 'week', 'unplanned', 'done', 'all', 'archived'];

  return views.reduce((acc, view) => {
    acc[view] = followups.filter(followup => {
      if (view === 'archived') return followup.archived;
      if (followup.archived) return false;
      return matchesView(followup, view);
    }).length;
    return acc;
  }, {} as Record<FollowupView, number>);
}`;

content = content.replace(oldCountViews, newCountViews);

fs.writeFileSync(path, content);
