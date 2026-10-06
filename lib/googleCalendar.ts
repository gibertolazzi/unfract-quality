export async function fetchCalendarEvents(accessToken: string, timeMin: Date, timeMax: Date) {
  try {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.append('timeMin', timeMin.toISOString());
    url.searchParams.append('timeMax', timeMax.toISOString());
    url.searchParams.append('singleEvents', 'true');
    url.searchParams.append('orderBy', 'startTime');

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        return { error: 'unauthorized' };
      }
      throw new Error('Failed to fetch events: ' + res.status);
    }

    const data = await res.json();
    return { items: data.items || [] };
  } catch (error) {
    // console.error('Error fetching calendar events:', error); // silenced console spam
    return { items: [] };
  }
}

export async function searchCalendarEvents(accessToken: string, query: string) {
  try {
    // Search a broad window: from 30 days ago to 60 days ahead
    const now = new Date();
    const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const timeMax = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.append('timeMin', timeMin.toISOString());
    url.searchParams.append('timeMax', timeMax.toISOString());
    url.searchParams.append('q', query);
    url.searchParams.append('singleEvents', 'true');
    url.searchParams.append('orderBy', 'startTime');
    url.searchParams.append('maxResults', '10');

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        console.warn('Google Calendar token expired or invalid (401/403).');
        return [];
      }
      throw new Error(`Failed to search events: ${res.status}`);
    }

    const data = await res.json();
    return data.items || [];
  } catch (error: any) {
    // Only warn to avoid console clutter if token is simply expired
    if (error.message?.includes('401') || error.message?.includes('403')) {
      console.warn('Calendar search skipped (token expired).');
    } else {
      console.warn('Error searching calendar events:', error.message);
    }
    return [];
  }
}
