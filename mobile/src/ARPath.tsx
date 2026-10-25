// Kamera görüntüsü üstünde yere çizilmiş yol: rota boyunca zemine yatık oklar ve hedef işareti (three.js, expo-gl).
// Telefonun duruşu: yön = pusula + kalibrasyon (guide.ts), eğim = DeviceMotion β. Konum = rota üzerinde s metre.
// ARCore değil: oklar yürüyüş tahminine göre durur; QR okutunca tahmin sıfırlanır.
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import * as THREE from 'three';

import * as G from './guide';

export type Pose = { compass: number; beta: number }; // derece, radyan
type Props = {
  walk: G.WalkPhase;
  s: number;
  calib: number;
  pose: React.RefObject<Pose>;
  target: { x: number; z: number } | null; // varış noktası (son yürüyüşte)
  onFail?: () => void;                        // GL açılamazsa: ekran düz oka döner
};

const EYE = 1.4, AHEAD = 36, STEP = 1.6;

function chevron(): THREE.BufferGeometry {
  // zeminde, +z yönünü gösteren ok başı (0,6 m)
  const sh = new THREE.Shape();
  sh.moveTo(0, 0.42); sh.lineTo(0.42, -0.08); sh.lineTo(0.24, -0.2); sh.lineTo(0, 0.08); sh.lineTo(-0.24, -0.2); sh.lineTo(-0.42, -0.08); sh.closePath();
  const g = new THREE.ShapeGeometry(sh);
  g.rotateX(Math.PI / 2); // şekil düzlemi -> zemin; şeklin +y'si -> +z
  return g;
}

export function ARPath({ walk, s, calib, pose, target, onFail }: Props) {
  const st = useRef({ s, walk, calib, target });
  useEffect(() => { st.current = { s, walk, calib, target }; }, [s, walk, calib, target]);
  const raf = useRef<number | null>(null);
  useEffect(() => () => { if (raf.current != null) cancelAnimationFrame(raf.current); }, []);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    try { start(gl); } catch (e) { console.warn('ARPath', e); onFail?.(); }
  };

  // three 0.162: expo-gl bağlamı WebGL 1 gibi görünüyor, sonraki sürümler WebGL 2 istiyor
  const start = (gl: ExpoWebGLRenderingContext) => {
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const canvas = { width: w, height: h, style: {}, clientHeight: h, addEventListener: () => {}, removeEventListener: () => {} };
    const renderer = new THREE.WebGLRenderer({ canvas: canvas as unknown as HTMLCanvasElement, context: gl as unknown as WebGLRenderingContext, alpha: true, antialias: true });
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x9fb8c8, 8, AHEAD);
    const camera = new THREE.PerspectiveCamera(62, w / h, 0.1, 80);
    camera.rotation.order = 'YXZ';

    const N = Math.ceil(AHEAD / STEP) + 2;
    const mat = new THREE.MeshBasicMaterial({ color: 0x3fd8ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, fog: true });
    const arrows = new THREE.InstancedMesh(chevron(), mat, N);
    arrows.frustumCulled = false;
    scene.add(arrows);

    // hedef işareti: yerde halka + dikey çubuk
    const pin = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 32), new THREE.MeshBasicMaterial({ color: 0xff7a2f, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 12), new THREE.MeshBasicMaterial({ color: 0xff7a2f }));
    pole.position.y = 1.1;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), new THREE.MeshBasicMaterial({ color: 0xff7a2f }));
    head.position.y = 2.3;
    pin.add(ring, pole, head);
    scene.add(pin);

    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1);
    const frame = (t: number) => {
      const { s: sNow, walk: wk, calib: c, target: tg } = st.current;
      const p = pose.current;
      // kamera: rota üzerindeki noktada göz hizasında
      const me = G.pointAt(wk, sNow);
      camera.position.set(me.x, EYE, me.z);
      const hCam = -(p.compass * Math.PI / 180 + c);       // modelde kameranın baktığı başlık
      camera.rotation.y = hCam + Math.PI;                  // three kamerası -z'ye bakar
      camera.rotation.x = Math.max(-1.2, Math.min(0.6, p.beta - Math.PI / 2)); // dik tutunca ufka bakar
      camera.rotation.z = 0;
      // oklar: önümüzdeki yol boyunca, hafifçe akan
      const flow = (t / 1000 * 1.2) % STEP;
      let k = 0;
      for (let d = 1.2 + flow; d < AHEAD && k < N; d += STEP) {
        if (sNow + d > wk.length - 0.5) break;
        const a = G.pointAt(wk, sNow + d);
        q.setFromAxisAngle(up, a.h);
        m.compose(new THREE.Vector3(a.x, 0.02, a.z), q, sc);
        arrows.setMatrixAt(k++, m);
      }
      arrows.count = k;
      arrows.instanceMatrix.needsUpdate = true;
      pin.visible = !!tg;
      if (tg) { pin.position.set(tg.x, 0, tg.z); head.position.y = 2.3 + Math.sin(t / 300) * 0.08; }
      renderer.render(scene, camera);
      gl.endFrameEXP();
      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
  };

  return <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} pointerEvents="none" />;
}
