// Web'de yerel sekmeler yok: expo-router'ın JS sekmeleri
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { C } from '@/theme';

export default function AppTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: C.brand, tabBarInactiveTintColor: C.muted }}>
      <Tabs.Screen name="index" options={{ title: 'Ana sayfa', tabBarIcon: ({ color }) => <MaterialCommunityIcons name="home" size={24} color={color as string} /> }} />
      <Tabs.Screen name="lists" options={{ title: 'Listelerim', tabBarIcon: ({ color }) => <MaterialCommunityIcons name="format-list-bulleted" size={24} color={color as string} /> }} />
      <Tabs.Screen name="map" options={{ title: 'Harita', tabBarIcon: ({ color }) => <MaterialCommunityIcons name="map" size={24} color={color as string} /> }} />
    </Tabs>
  );
}
