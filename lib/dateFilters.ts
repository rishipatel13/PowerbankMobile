export type FilterPeriod = 'all' | 'ytd' | 'thismonth' | 'lastmonth' | 'thisweek' | 'lastweek' | 'last7days' | 'custom';

export interface DateRange {
  startDate: string;
  endDate: string;
}

/** Format a Date as YYYY-MM-DD in local time (not UTC) */
function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Get Monday of the current week (using Monday as week start) */
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const daysBack = day === 0 ? 6 : day - 1; // Sunday goes back 6, others go back day-1
  d.setDate(d.getDate() - daysBack);
  return d;
}

export function getYTDRange(): DateRange {
  const now = new Date();
  return {
    startDate: `${now.getFullYear()}-01-01`,
    endDate: formatLocalDate(now),
  };
}

export function getThisMonthRange(): DateRange {
  const now = new Date();
  return {
    startDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
    endDate: formatLocalDate(now),
  };
}

export function getLastMonthRange(): DateRange {
  const now = new Date();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0); // day 0 = last day of prev month
  return {
    startDate: formatLocalDate(startOfLastMonth),
    endDate: formatLocalDate(endOfLastMonth),
  };
}

export function getThisWeekRange(): DateRange {
  const now = new Date();
  const monday = getMondayOfWeek(now);
  return {
    startDate: formatLocalDate(monday),
    endDate: formatLocalDate(now),
  };
}

export function getLastWeekRange(): DateRange {
  const now = new Date();
  const thisMonday = getMondayOfWeek(now);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastSunday.getDate() + 6);
  return {
    startDate: formatLocalDate(lastMonday),
    endDate: formatLocalDate(lastSunday),
  };
}

export function getLast7DaysRange(): DateRange {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  return {
    startDate: formatLocalDate(sevenDaysAgo),
    endDate: formatLocalDate(now),
  };
}

export function getDateRangeForPeriod(
  period: FilterPeriod,
  customRange?: DateRange
): DateRange | null {
  switch (period) {
    case 'all':
      return null;
    case 'ytd':
      return getYTDRange();
    case 'thismonth':
      return getThisMonthRange();
    case 'lastmonth':
      return getLastMonthRange();
    case 'thisweek':
      return getThisWeekRange();
    case 'lastweek':
      return getLastWeekRange();
    case 'last7days':
      return getLast7DaysRange();
    case 'custom':
      return customRange || null;
    default:
      return null;
  }
}

export function isDateInRange(dateString: string, range: DateRange | null): boolean {
  if (!range) return true;

  const date = new Date(dateString);
  const [startYear, startMonth, startDay] = range.startDate.split('-').map(Number);
  const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);

  const [endYear, endMonth, endDay] = range.endDate.split('-').map(Number);
  const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

  return date >= start && date <= end;
}

/**
 * Convert a DateRange (YYYY-MM-DD strings) to full ISO timestamps
 * representing the user's local midnight boundaries.
 */
export function toISORange(range: DateRange): { startISO: string; endISO: string } {
  const [sy, sm, sd] = range.startDate.split('-').map(Number);
  const [ey, em, ed] = range.endDate.split('-').map(Number);
  return {
    startISO: new Date(sy, sm - 1, sd, 0, 0, 0, 0).toISOString(),
    endISO: new Date(ey, em - 1, ed, 23, 59, 59, 999).toISOString(),
  };
}

/**
 * Get this week and last week start boundaries (Monday 3pm local time),
 * returned as ISO strings for the Edge Function.
 */
export function getWeekBoundaries(): { thisWeekStartISO: string; lastWeekStartISO: string } {
  const now = new Date();
  const monday = getMondayOfWeek(now);
  monday.setHours(15, 0, 0, 0);
  // If we haven't reached Monday 3pm yet, the "week" hasn't started — use previous Monday
  if (now < monday) {
    monday.setDate(monday.getDate() - 7);
  }
  const thisWeekStart = new Date(monday);
  const lastWeekStart = new Date(monday);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  return {
    thisWeekStartISO: thisWeekStart.toISOString(),
    lastWeekStartISO: lastWeekStart.toISOString(),
  };
}

export function getPeriodLabel(period: FilterPeriod, customRange?: DateRange): string {
  switch (period) {
    case 'all':
      return 'All Time';
    case 'ytd':
      return 'Year to Date';
    case 'thismonth':
      return 'This Month';
    case 'lastmonth':
      return 'Last Month';
    case 'thisweek':
      return 'This Week';
    case 'lastweek':
      return 'Last Week';
    case 'last7days':
      return 'Last 7 Days';
    case 'custom':
      if (customRange) {
        return `${customRange.startDate} to ${customRange.endDate}`;
      }
      return 'Custom Range';
    default:
      return 'All Time';
  }
}
