import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login';

    if (!user && !inAuthGroup) {
      router.replace('/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 200,
        }}
      >
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="venue-detail"
          options={{
            headerShown: true,
            title: 'Venue Detail',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: '#1f2937' },
            headerTintColor: '#fff',
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="machine-detail"
          options={{
            headerShown: true,
            title: 'Machine Detail',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: '#1f2937' },
            headerTintColor: '#fff',
            headerShadowVisible: false,
          }}
        />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
