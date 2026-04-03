import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, DollarSign, TrendingUp, Calendar, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatPercentage } from '../../lib/calculations';
import {
  FilterPeriod,
  DateRange,
  getDateRangeForPeriod,
  toISORange,
  getWeekBoundaries,
  getPeriodLabel,
} from '../../lib/dateFilters';
import type { Database } from '../../lib/database.types';

type Location = Database['public']['Tables']['locations']['Row'];

interface LocationStats {
  name: string;
  totalRevenue: number;
  venuePayout: number;
  myProfit: number;
  roi: number;
  totalRentals: number;
  averageRevenuePerRental: number;
  revenueAfterFees: number;
  salesTax: number;
  distributable: number;
  projectedAnnualProfit: number;
  projectedAnnualTotal: number;
}

const FILTER_OPTIONS: { key: FilterPeriod; label: string }[] = [
  { key: 'all', label: 'All Time' },
  { key: 'thisweek', label: 'This Week' },
  { key: 'lastweek', label: 'Last Week' },
  { key: 'thismonth', label: 'This Month' },
  { key: 'lastmonth', label: 'Last Month' },
  { key: 'ytd', label: 'Year to Date' },
  { key: 'custom', label: 'Custom' },
];

export default function DashboardScreen() {
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedPeriod, setSelectedPeriod] = useState<FilterPeriod>('all');
  const [customRange, setCustomRange] = useState<DateRange>({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [tempStart, setTempStart] = useState('');
  const [tempEnd, setTempEnd] = useState('');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      const resolved = getDateRangeForPeriod(selectedPeriod, customRange);
      const iso = resolved ? toISORange(resolved) : null;
      const weekBounds = getWeekBoundaries();

      const [locationsRes, statsRes] = await Promise.all([
        supabase.from('locations').select('*').order('name'),
        supabase.functions.invoke('dashboard-stats', {
          body: {
            time_period: iso ? 'custom' : 'all',
            ...(iso ? { start_date: iso.startISO, end_date: iso.endISO } : {}),
            this_week_start: weekBounds.thisWeekStartISO,
            last_week_start: weekBounds.lastWeekStartISO,
          },
        }),
      ]);

      if (locationsRes.error) throw locationsRes.error;
      if (statsRes.error) throw new Error(String(statsRes.error));

      setLocations(locationsRes.data);
      setStats(statsRes.data);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod, customRange]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchData();

    const debouncedRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchData(true), 500);
    };

    const channel = supabase
      .channel('db-changes-mobile')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rentals' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, debouncedRefresh)
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Extract stats from edge function response
  const activeLocations = stats?.global?.activeLocations ?? 0;
  const totalProfit = stats?.global?.totalProfit ?? 0;
  const totalRevenue = (stats?.locations ?? []).reduce(
    (sum: number, s: LocationStats) => sum + s.totalRevenue, 0
  );
  const totalRentals = (stats?.locations ?? []).reduce((sum: number, s: LocationStats) => sum + s.totalRentals, 0);
  const projectedAnnualProfit = stats?.global?.projectedAnnualProfit ?? 0;
  const projectedAnnualTotal = stats?.global?.projectedAnnualTotal ?? 0;
  const globalROI = stats?.global?.globalROI ?? 0;
  const thisWeekProfit = stats?.global?.thisWeekProfit ?? 0;
  const lastWeekProfit = stats?.global?.lastWeekProfit ?? 0;

  // Build location stats lookup
  const locationStatsMap = new Map<string, LocationStats>();
  if (stats?.locations) {
    stats.locations.forEach((loc: LocationStats) => locationStatsMap.set(loc.name, loc));
  }

  const handlePeriodSelect = useCallback((period: FilterPeriod) => {
    if (period === 'custom') {
      setTempStart(customRange.startDate);
      setTempEnd(customRange.endDate);
      setShowCustomModal(true);
    } else {
      setSelectedPeriod(period);
    }
  }, [customRange]);

  const handleCustomApply = useCallback(() => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(tempStart) || !dateRegex.test(tempEnd)) {
      Alert.alert('Invalid Date', 'Please enter dates in YYYY-MM-DD format.');
      return;
    }
    if (isNaN(new Date(tempStart).getTime()) || isNaN(new Date(tempEnd).getTime())) {
      Alert.alert('Invalid Date', 'Please enter dates in YYYY-MM-DD format.');
      return;
    }
    if (new Date(tempStart) > new Date(tempEnd)) {
      Alert.alert('Invalid Date', 'Start date must be before or equal to end date.');
      return;
    }
    setCustomRange({ startDate: tempStart, endDate: tempEnd });
    setSelectedPeriod('custom');
    setShowCustomModal(false);
  }, [tempStart, tempEnd]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#60a5fa" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error && !loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData()} activeOpacity={0.7}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#60a5fa" />}
    >
      {/* Time Period Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
        {FILTER_OPTIONS.map((option) => {
          const isActive = selectedPeriod === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => handlePeriodSelect(option.key)}
              activeOpacity={0.7}
            >
              {option.key === 'custom' && <Calendar color={isActive ? '#fff' : '#9ca3af'} size={12} />}
              <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                {option.key === 'custom' && selectedPeriod === 'custom'
                  ? `${customRange.startDate.slice(5)} — ${customRange.endDate.slice(5)}`
                  : option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Active filter label */}
      {selectedPeriod !== 'all' && (
        <View style={styles.activeFilterRow}>
          <Text style={styles.activeFilterLabel}>
            Showing: {getPeriodLabel(selectedPeriod, customRange)}
          </Text>
          <TouchableOpacity onPress={() => setSelectedPeriod('all')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X color="#9ca3af" size={16} />
          </TouchableOpacity>
        </View>
      )}

      {/* Pulse View - Summary Cards */}
      <View style={styles.cardRow}>
        <View style={styles.statCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Active Locations</Text>
            <MapPin color="#60a5fa" size={18} />
          </View>
          <Text style={styles.cardValue}>{activeLocations}</Text>
          <Text style={styles.cardSub}>{totalRentals} rentals</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Total Profit</Text>
            <DollarSign color="#34d399" size={18} />
          </View>
          <Text style={styles.cardValue}>{formatCurrency(totalProfit)}</Text>
          <Text style={styles.cardSub}>Rev: {formatCurrency(totalRevenue)}</Text>
        </View>
      </View>

      <View style={styles.cardRow}>
        <View style={styles.statCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Projected</Text>
            <Calendar color="#a78bfa" size={18} />
          </View>
          <Text style={styles.cardValue}>{formatCurrency(projectedAnnualProfit)}</Text>
          <Text style={styles.cardSub}>
            Total est. <Text style={{ color: '#fff' }}>{formatCurrency(projectedAnnualTotal)}</Text>
          </Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Global ROI</Text>
            <TrendingUp color="#fbbf24" size={18} />
          </View>
          <Text style={styles.cardValue}>{formatPercentage(globalROI)}</Text>
          <Text style={styles.cardSub}>All-time performance</Text>
        </View>
      </View>

      {/* Weekly Profit */}
      {(thisWeekProfit > 0 || lastWeekProfit > 0) && (
        <View style={[styles.statCard, { marginBottom: 12 }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Weekly Profit</Text>
            <TrendingUp color="#60a5fa" size={18} />
          </View>
          <Text style={styles.cardValue}>{formatCurrency(thisWeekProfit)}</Text>
          <Text style={styles.cardSub}>Last week: {formatCurrency(lastWeekProfit)}</Text>
        </View>
      )}

      {/* Venue Tiles */}
      <Text style={styles.sectionTitle}>Locations</Text>
      {locations.map((location) => {
        const locStats = locationStatsMap.get(location.name);
        const rentalCount = locStats?.totalRentals ?? 0;
        const revenue = locStats?.totalRevenue ?? 0;
        const avg = locStats?.averageRevenuePerRental ?? 0;
        const profit = locStats?.myProfit ?? 0;
        const roi = locStats?.roi ?? 0;
        const projected = locStats?.projectedAnnualProfit ?? 0;

        return (
          <TouchableOpacity
            key={location.name}
            style={styles.venueCard}
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/venue-detail', params: { name: location.name } })}
          >
            <View style={styles.venueBody}>
              {/* Left side */}
              <View style={styles.venueLeftCol}>
                <View style={styles.venueNameRow}>
                  <View style={[styles.venueStatusDot, { backgroundColor: location.machine_status === 'online' ? '#22c55e' : location.machine_status === 'offline' ? '#ef4444' : location.station_id ? '#6b7280' : '#ef4444' }]} />
                  <Text style={styles.venueNameText} numberOfLines={2}>{location.name}</Text>
                </View>
                <Text style={styles.venueLocation} numberOfLines={1}>
                  {location.city ? `${location.city}, ${location.state}` : location.state}
                </Text>
                <Text style={styles.venueSplit}>
                  {formatPercentage(location.venue_split)} split
                </Text>
              </View>
              {/* Right side */}
              <View style={styles.venueRightCol}>
                <View style={styles.venueStatsRow}>
                  <View style={styles.venueStatCell}>
                    <Text style={styles.venueStatLabel}>Rentals</Text>
                    <Text style={styles.venueStatValue}>{rentalCount}</Text>
                  </View>
                  <View style={styles.venueStatCell}>
                    <Text style={styles.venueStatLabel}>Revenue</Text>
                    <Text style={styles.venueStatValue}>{formatCurrency(revenue)}</Text>
                  </View>
                  <View style={styles.venueStatCell}>
                    <Text style={styles.venueStatLabel}>Avg</Text>
                    <Text style={styles.venueStatValue}>{formatCurrency(avg)}</Text>
                  </View>
                </View>
                <View style={styles.venueStatsRow}>
                  <View style={styles.venueStatCell}>
                    <Text style={styles.venueStatLabel}>Profit</Text>
                    <Text style={[styles.venueStatValue, { color: '#34d399' }]}>{formatCurrency(profit)}</Text>
                  </View>
                  <View style={styles.venueStatCell}>
                    <Text style={styles.venueStatLabel}>ROI</Text>
                    <Text style={[styles.venueStatValue, { color: '#fbbf24' }]}>{formatPercentage(roi)}</Text>
                  </View>
                  <View style={styles.venueStatCell}>
                    <Text style={styles.venueStatLabel}>Projected</Text>
                    <Text style={[styles.venueStatValue, { color: '#a78bfa' }]}>{formatCurrency(projected)}</Text>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Custom Date Range Modal */}
      <Modal visible={showCustomModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Custom Date Range</Text>
              <TouchableOpacity onPress={() => setShowCustomModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X color="#9ca3af" size={22} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Start Date</Text>
            <TextInput
              style={styles.modalInput}
              value={tempStart}
              onChangeText={setTempStart}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#6b7280"
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            />

            <Text style={styles.modalLabel}>End Date</Text>
            <TextInput
              style={styles.modalInput}
              value={tempEnd}
              onChangeText={setTempEnd}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#6b7280"
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCustomModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={handleCustomApply}
                activeOpacity={0.8}
              >
                <Text style={styles.modalApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 12,
    fontSize: 14,
  },
  errorCard: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center' as const,
    gap: 10,
  },
  errorTitle: { color: '#f87171', fontSize: 18, fontWeight: '700' as const },
  errorMessage: { color: '#9ca3af', fontSize: 13, textAlign: 'center' as const },
  retryBtn: {
    marginTop: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
  },
  retryBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' as const },

  // Filter Pills
  filterScroll: {
    marginBottom: 8,
    marginHorizontal: -16,
  },
  filterContainer: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  filterPillActive: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
  },
  filterPillText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#fff',
  },
  activeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(37,99,235,0.12)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  activeFilterLabel: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '500',
  },

  // Cards
  cardRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '500',
  },
  cardValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  cardSub: {
    color: '#6b7280',
    fontSize: 11,
    marginTop: 4,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 12,
  },
  venueCard: {
    backgroundColor: '#1f2937',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 10,
    overflow: 'hidden',
  },
  venueBody: {
    flexDirection: 'row',
    padding: 14,
  },
  venueLeftCol: {
    width: '33%',
    justifyContent: 'center',
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: '#374151',
  },
  venueNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  venueStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  venueNameText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    lineHeight: 18,
  },
  venueLocation: {
    color: '#9ca3af',
    fontSize: 11,
    marginBottom: 3,
    marginLeft: 14,
  },
  venueSplit: {
    color: '#6b7280',
    fontSize: 11,
    marginLeft: 14,
  },
  venueRightCol: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: 'center',
    gap: 8,
  },
  venueStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  venueStatCell: {
    flex: 1,
    alignItems: 'center',
  },
  venueStatLabel: {
    color: '#6b7280',
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  venueStatValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Custom Date Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalLabel: {
    color: '#d1d5db',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#4b5563',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: 14,
  },
  modalApplyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  modalApplyText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
