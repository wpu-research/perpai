// Derin link: perpai://q/<kod> — QR konumunu ayarla, ana sayfaya dön
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { resolveQR, toPlace, type QRPlace } from '@/perpa';
import { useStore } from '@/store';

export default function QRLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const setLocation = useStore(s => s.setLocation);
  const q = resolveQR(code) as QRPlace | null;
  useEffect(() => { if (q) setLocation(toPlace(q)); }, [q, setLocation]);
  return <Redirect href="/" />;
}
