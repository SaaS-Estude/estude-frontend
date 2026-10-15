export type CalendarEvent = {
  type: 'ASSIGNMENT_DEADLINE' | 'EXAM';
  sourceId: string;
  title: string;
  startAt: string;
  endAt: string | null;
  dueAt: string | null;
  availableFrom: string | null;
  subject: { id: string; name: string };
  schoolClass: { id: string; name: string; code: string };
  status: string;
  sourceUrl: string;
  hasPersonalSchedule?: boolean;
  canStart?: boolean;
  canSubmit?: boolean;
  canResume?: boolean;
  historyOnly?: boolean;
};

export type CalendarResponse = {
  from: string;
  to: string;
  timeZone: string;
  serverNow: string;
  events: CalendarEvent[];
};
