const fs = require('fs');
const filePath = 'components/calendar/CalendarBoard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `    const googleEvents = await fetchCalendarEvents(accessToken, timeMin, timeMax);
    
    const mappedEvents: CalendarEvent[] = googleEvents.map((e: any) => {`;

const newStr = `    const result = await fetchCalendarEvents(accessToken, timeMin, timeMax);
    
    if (result.error === 'unauthorized') {
      // Token is invalid/expired. Stop syncing Google events quietly.
      setIsSyncing(false);
      return;
    }
    
    const mappedEvents: CalendarEvent[] = (result.items || []).map((e: any) => {`;

content = content.replace(targetStr, newStr);

// Also need to handle searchCalendarEvents if it's used elsewhere, but let's check if CalendarBoard uses it
fs.writeFileSync(filePath, content);
