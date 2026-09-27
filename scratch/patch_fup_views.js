const fs = require('fs');
const path = 'components/crm/followup/FollowupSection.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "const VIEWS: FollowupView[] = ['today', 'overdue', 'week', 'unplanned', 'done', 'all'];",
  "const VIEWS: FollowupView[] = ['today', 'overdue', 'week', 'unplanned', 'done', 'all', 'archived'];"
);

// We need to pass the updated countViews arguments
// Wait, countViews(followups) now no longer takes includeArchived.
// Let's check how countViews is called in FollowupSection.tsx.
content = content.replace(
  "const counts = useMemo(() => countViews(followups, filters.includeArchived), [followups, filters.includeArchived]);",
  "const counts = useMemo(() => countViews(followups), [followups]);"
);

fs.writeFileSync(path, content);
