import { useEffect, useState, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, DollarSign, TrendingUp, Calendar, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import {
  calculateRentalFinancials,
  getEffectiveAmount,
  formatCurrency,
  formatPercentage,
} from '../../lib/calculations';
import {
  FilterPeriod,
  DateRange,
  getDateRangeForPeriod,
  isDateInRange,
  getPeriodLabel,
} from '../../lib/dateFilters';
import type { Database } from '../../lib/database.types';

type Location = Database['public']['Tables']['locations']['Row'];
type Rental = Database['public']['Tables']['rentals']['Row'];

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
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter state
  const [selectedPeriod, setSelectedPeriod] = useState<FilterPeriod>('all');
  const [customRange, setCustomRange] = useState<DateRange>({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [tempStart, setTempStart] = useState('');
  const [tempEnd, setTempEnd] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [locationsRes, rentalsRes] = await Promise.all([
        supabase.from('locations').select('*').order('name'),
        supabase.from('rentals').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      ]);

      if (locationsRes.error) throw locationsRes.error;
      if (rentalsRes.error) throw rentalsRes.error;

      setLocations(locationsRes.data);
      setRentals(rentalsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('db-changes-mobile')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rentals' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Get date range for current filter
  const dateRange = useMemo(() => {
    return getDateRangeForPeriod(selectedPeriod, customRange);
  }, [selectedPeriod, customRange]);

  // Filter rentals by date
  const filteredRentals = useMemo(() => {
    if (!dateRange) return rentals;
    return rentals.filter((r) => isDateInRange(r.created_at, dateRange));
  }, [rentals, dateRange]);

  // Memoize all expensive financial calculations
  const stats = useMemo(() => {
    let totalProfit = 0;
    let totalRevenue = 0;
    let totalInvestment = 0;
    let projectedAnnualProfit = 0;
    let projectedAnnualTotal = 0;

    const locationStats = locations.map((location) => {
      const locationRentals = filteredRentals.filter(
        (r) => r.location_name === location.name && getEffectiveAmount(r) > 0
      );
      let locProfit = 0;
      let locVenuePayout = 0;
      let locRevenue = 0;

      locationRentals.forEach((rental) => {
        const financials = calculateRentalFinancials(getEffectiveAmount(rental), location, {
          isLost: rental.is_lost,
          dailyCapSnapshot: rental.daily_cap_snapshot,
        });
        locProfit += financials.myProfit;
        locVenuePayout += financials.venueCut;
        locRevenue += financials.gross;
      });

      totalProfit += locProfit;
      totalRevenue += locRevenue;
      totalInvestment += location.investment_cost / 100;

      const avg = locationRentals.length > 0 ? locRevenue / locationRentals.length : 0;
      const roi = location.investment_cost > 0 ? locProfit / (location.investment_cost / 100) : 0;

      let projected = 0;
      if (location.go_live_date) {
        const goLive = new Date(location.go_live_date + 'T00:00:00');
        const now = new Date();
        const daysLive = Math.max(1, Math.floor((now.getTime() - goLive.getTime()) / (1000 * 60 * 60 * 24)));
        const dailyProfit = locProfit / daysLive;
        const dailyTotal = (locProfit + locVenuePayout) / daysLive;
        projectedAnnualProfit += dailyProfit * 365;
        projectedAnnualTotal += dailyTotal * 365;
        projected = dailyProfit * 365;
      }

      return {
        location,
        rentals: locationRentals.length,
        revenue: locRevenue,
        avg,
        profit: locProfit,
        roi,
        projected,
      };
    });

    const globalROI = totalInvestment > 0 ? totalProfit / totalInvestment : 0;

    return {
      activeLocations: locations.length,
      totalProfit,
      totalRevenue,
      totalRentals: filteredRentals.filter((r) => getEffectiveAmount(r) > 0).length,
      projectedAnnualProfit,
      projectedAnnualTotal,
      globalROI,
      locationStats,
    };
  }, [locations, filteredRentals]);

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
          <Text style={styles.cardValue}>{stats.activeLocations}</Text>
          <Text style={styles.cardSub}>{stats.totalRentals} rentals</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Total Profit</Text>
            <DollarSign color="#34d399" size={18} />
          </View>
          <Text style={styles.cardValue}>{formatCurrency(stats.totalProfit)}</Text>
          <Text style={styles.cardSub}>Rev: {formatCurrency(stats.totalRevenue)}</Text>
        </View>
      </View>

      <View style={styles.cardRow}>
        <View style={styles.statCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Projected</Text>
            <Calendar color="#a78bfa" size={18} />
          </View>
          <Text style={styles.cardValue}>{formatCurrency(stats.projectedAnnualProfit)}</Text>
          <Text style={styles.cardSub}>
            Total est. <Text style={{ color: '#fff' }}>{formatCurrency(stats.projectedAnnualTotal)}</Text>
          </Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Global ROI</Text>
            <TrendingUp color="#fbbf24" size={18} />
          </View>
          <Text style={styles.cardValue}>{formatPercentage(stats.globalROI)}</Text>
          <Text style={styles.cardSub}>All-time performance</Text>
        </View>
      </View>

      {/* Venue Tiles */}
      <Text style={styles.sectionTitle}>Locations</Text>
      {stats.locationStats.map(({ location, rentals: rentalCount, revenue, avg, profit, roi, projected }) => (
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
                <View style={[styles.venueStatusDot, { backgroundColor: location.station_id ? '#22c55e' : '#ef4444' }]} />
                <Text style={styles.venueNameText} numberOfLines={2}>{location.name}</Text>
              </View>
              <Text style={styles.venueLocation} numberOfLines={1}>
                {location.city ? `${location.city}, ${location.state}` : location.state}
              </Text>
              <Text style={styles.venueSplit}>
                {(location.venue_split * 100).toFixed(0)}% split
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
      ))}

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
