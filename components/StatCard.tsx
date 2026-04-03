import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatCardProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueColor?: string;
  subtitle?: string;
}

export default function StatCard({ label, value, icon, valueColor, subtitle }: StatCardProps) {
  return (
    <View style={styles.card}>
      {icon && <View style={styles.iconRow}>{icon}</View>}
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
      {subtitle != null && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  iconRow: {
    marginBottom: 6,
  },
  label: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 6,
  },
  value: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 11,
    marginTop: 4,
  },
});
