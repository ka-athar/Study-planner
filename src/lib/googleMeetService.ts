/**
 * Google Meet Integration Service
 * Provisions instant and scheduled Google Meet study rooms for collaborative study sessions.
 */

import { getOrRequestWorkspaceToken } from './googleAuthService';

export interface GoogleMeetRoom {
  meetingUri: string;
  meetingCode?: string;
  spaceName?: string;
  calendarEventId?: string;
  title: string;
  createdAt: string;
}

/**
 * Creates an instant Google Meet room space for live group study or peer focus.
 */
export async function createInstantMeetRoom(title: string = 'StudyOS Focus Room'): Promise<GoogleMeetRoom> {
  const token = await getOrRequestWorkspaceToken();

  // Try Google Meet REST API v2
  try {
    const meetResponse = await fetch('https://meet.googleapis.com/v2/spaces', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        config: {
          accessType: 'OPEN'
        }
      })
    });

    if (meetResponse.ok) {
      const data = await meetResponse.json();
      return {
        meetingUri: data.meetingUri || `https://meet.google.com/${data.meetingCode}`,
        meetingCode: data.meetingCode,
        spaceName: data.name,
        title,
        createdAt: new Date().toISOString()
      };
    }
  } catch (err) {
    console.warn('Direct Meet API space creation notice, using Calendar fallback:', err);
  }

  // Fallback / standard method: Create a 60-minute Google Calendar event with Hangouts Meet conferencing enabled
  const now = new Date();
  const endTime = new Date(now.getTime() + 60 * 60 * 1000);

  const calResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      summary: `📹 ${title}`,
      description: `Collaborative study room created via StudyOS on ${now.toLocaleString()}`,
      start: { dateTime: now.toISOString() },
      end: { dateTime: endTime.toISOString() },
      conferenceData: {
        createRequest: {
          requestId: `studyos-${Date.now()}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      }
    })
  });

  if (!calResponse.ok) {
    const errData = await calResponse.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Failed to create Google Meet session (${calResponse.status})`);
  }

  const calData = await calResponse.json();
  const meetUri = calData.hangoutLink || 
    calData.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri || 
    'https://meet.google.com/new';

  return {
    meetingUri: meetUri,
    calendarEventId: calData.id,
    title,
    createdAt: now.toISOString()
  };
}

/**
 * Creates a scheduled study session on Google Calendar with a Google Meet link.
 */
export async function scheduleMeetStudySession(
  title: string,
  startDateTime: string,
  durationMinutes: number,
  description?: string
): Promise<GoogleMeetRoom> {
  const token = await getOrRequestWorkspaceToken();
  const startDate = new Date(startDateTime);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const calResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      summary: `🎓 StudyOS: ${title}`,
      description: description || `Study session scheduled via StudyOS`,
      start: { dateTime: startDate.toISOString() },
      end: { dateTime: endDate.toISOString() },
      conferenceData: {
        createRequest: {
          requestId: `studyos-meet-${Date.now()}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      }
    })
  });

  if (!calResponse.ok) {
    const errData = await calResponse.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Failed to schedule Meet session (${calResponse.status})`);
  }

  const calData = await calResponse.json();
  const meetUri = calData.hangoutLink || 
    calData.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri || 
    'https://meet.google.com/new';

  return {
    meetingUri: meetUri,
    calendarEventId: calData.id,
    title,
    createdAt: startDate.toISOString()
  };
}
