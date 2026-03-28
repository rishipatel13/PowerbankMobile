export type FilterPeriod = 'all' | 'ytd' | 'thismonth' | 'lastmonth' | 'thisweek' | 'lastweek' | 'last7days' | 'custom';

export interface DateRange {
    startDate: string;
    endDate: string;
}

export function getYTDRange(): DateRange {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    return {
        startDate: startOfYear.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
    };
}

export function getThisMonthRange(): DateRange {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
        startDate: startOfMonth.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
    };
}

export function getLastMonthRange(): DateRange {
    const now = new Date();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
        startDate: startOfLastMonth.toISOString().split('T')[0],
        endDate: endOfLastMonth.toISOString().split('T')[0],
    };
}

export function getThisWeekRange(): DateRange {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date();
    return {
        startDate: startOfWeek.toISOString().split('T')[0],
        endDate: endOfWeek.toISOString().split('T')[0],
    };
}

export function getLastWeekRange(): DateRange {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
    const startOfLastWeek = new Date(now.setDate(diff));
    const endOfLastWeek = new Date(now.setDate(diff + 6));
    return {
        startDate: startOfLastWeek.toISOString().split('T')[0],
        endDate: endOfLastWeek.toISOString().split('T')[0],
    };
}

export function getLast7DaysRange(): DateRange {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
        startDate: sevenDaysAgo.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
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
