import { NativeTabs } from 'expo-router/native-tabs';

import { C } from '@/theme';

export default function AppTabs() {
  return (
    <NativeTabs backgroundColor="#FFFFFF" labelStyle={{ selected: { color: C.ink } }} tintColor={C.brand}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Ana sayfa</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="lists">
        <NativeTabs.Trigger.Label>Listelerim</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet" md="list" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Label>Harita</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} md="map" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
