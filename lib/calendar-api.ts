import { authenticatedRequest } from '@/lib/auth-api';
import type { CalendarResponse } from '@/types/calendar';

export const calendarService = {
  month(from: string, to: string): Promise<CalendarResponse> {
    const query = new URLSearchParams({ from, to });
    return authenticatedRequest(`/student/calendar?${query}`);
  },
};
