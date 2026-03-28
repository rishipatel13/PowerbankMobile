import { Tabs } from 'expo-router';
import { LayoutGrid, Server, Settings } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#1f2937' },
        headerTintColor: '#fff',
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: '#1f2937',
          borderTopColor: '#374151',
        },
        tabBarActiveTintColor: '#60a5fa',
        tabBarInactiveTintColor: '#9ca3af',
        lazy: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="machines"
        options={{
          title: 'Machines',
          tabBarIcon: ({ color, size }) => <Server color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
