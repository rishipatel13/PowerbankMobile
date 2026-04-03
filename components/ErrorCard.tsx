import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

interface ErrorCardProps {
  message: string;
  onRetry: () => void;
  stationId?: string;
}

export default function ErrorCard({ message, onRetry, stationId }: ErrorCardProps) {
  return (
    <View style={styles.card}>
      <AlertTriangle color="#f87171" size={36} />
      <Text style={styles.title}>Failed to Load</Text>
      <Text style={styles.message}>{message}</Text>
      {stationId != null && (
        <Text style={styles.station}>Station: {stationId}</Text>
      )}
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.7}>
        <Text style={styles.retryBtnText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: '#f87171',
    fontSize: 18,
    fontWeight: '700',
  },
  message: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
  },
  station: {
    color: '#6b7280',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  retryBtn: {
    marginTop: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
