import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Calendar, X } from 'lucide-react-native';
import { FilterPeriod, DateRange, getPeriodLabel } from '../lib/dateFilters';

const FILTER_OPTIONS: { key: FilterPeriod; label: string }[] = [
  { key: 'all', label: 'All Time' },
  { key: 'thisweek', label: 'This Week' },
  { key: 'lastweek', label: 'Last Week' },
  { key: 'thismonth', label: 'This Month' },
  { key: 'lastmonth', label: 'Last Month' },
  { key: 'ytd', label: 'Year to Date' },
  { key: 'custom', label: 'Custom' },
];

interface DateFilterBarProps {
  selectedPeriod: FilterPeriod;
  onPeriodSelect: (period: FilterPeriod) => void;
  customRange?: DateRange;
}

export default function DateFilterBar({
  selectedPeriod,
  onPeriodSelect,
  customRange,
}: DateFilterBarProps) {
  return (
    <View>
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
              onPress={() => onPeriodSelect(option.key)}
              activeOpacity={0.7}
            >
              {option.key === 'custom' && (
                <Calendar color={isActive ? '#fff' : '#9ca3af'} size={12} />
              )}
              <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                {option.key === 'custom' && selectedPeriod === 'custom' && customRange
                  ? `${customRange.startDate.slice(5)} — ${customRange.endDate.slice(5)}`
                  : option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selectedPeriod !== 'all' && (
        <View style={styles.activeFilterRow}>
          <Text style={styles.activeFilterLabel}>
            Showing: {getPeriodLabel(selectedPeriod, customRange)}
          </Text>
          <TouchableOpacity
            onPress={() => onPeriodSelect('all')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X color="#9ca3af" size={16} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
