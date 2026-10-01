const fs = require('fs');
const filePath = 'lib/googleCalendar.ts';
let content = fs.readFileSync(filePath, 'utf8');

// We can make fetchCalendarEvents return an error object if 401
content = content.replace(
  /if \(!res\.ok\) \{\n\s*throw new Error\('Failed to fetch events'\);\n\s*\}/g,
  `if (!res.ok) {
      if (res.status === 401) {
        return { error: 'unauthorized' };
      }
      throw new Error('Failed to fetch events: ' + res.status);
    }`
);

content = content.replace(
  /const data = await res\.json\(\);\n\s*return data\.items \|\| \[\];\n\s*\} catch \(error\) \{\n\s*console\.error\('Error fetching calendar events:', error\);\n\s*return \[\];\n\s*\}/g,
  `const data = await res.json();
    return { items: data.items || [] };
  } catch (error) {
    // console.error('Error fetching calendar events:', error); // silenced console spam
    return { items: [] };
  }`
);

fs.writeFileSync(filePath, content);
