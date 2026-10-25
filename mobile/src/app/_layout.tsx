import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { initData } from '@/perpa';
import { C } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    initData().then(() => { setReady(true); SplashScreen.hideAsync(); });
  }, []);
  if (!ready) return null;
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerTintColor: C.ink, headerShadowVisible: false, headerStyle: { backgroundColor: C.ground }, contentStyle: { backgroundColor: C.ground }, headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="list/new" options={{ title: 'Yeni liste', presentation: 'modal' }} />
        <Stack.Screen name="list/[id]" options={{ title: 'Liste' }} />
        <Stack.Screen name="route/[id]" options={{ title: 'Rota' }} />
        <Stack.Screen name="navigate/[id]" options={{ title: 'Navigasyon' }} />
        <Stack.Screen name="ar/[id]" options={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }} />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="qr" options={{ title: 'QR okut', presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="q/[code]" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
