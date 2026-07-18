"use client";

/* ============================================================================
   A genuine WebGL 3D printed-circuit board (Three.js).

   Real geometry, real lights, real shadows, real depth — an FR-4 substrate with
   a copper ground pour, routed traces, an SoC with lead-frame pins, tantalum &
   electrolytic caps, SMD parts, a pin header, and a status LED. Bright emissive
   parts bloom. Signal pulses travel along the copper. Drag to orbit; it idles
   into a slow auto-spin. Rendered on its own dark stage so it looks the same in
   every site theme. Lazy-loaded — Three only downloads when this scrolls in.
   ========================================================================== */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

function readAccent(): { accent: THREE.Color; accent2: THREE.Color } {
  const css = getComputedStyle(document.documentElement);
  const parse = (v: string, fallback: string) => {
    const s = v.trim() || fallback;
    try { return new THREE.Color(s); } catch { return new THREE.Color(fallback); }
  };
  return {
    accent: parse(css.getPropertyValue("--accent"), "#6d5efc"),
    accent2: parse(css.getPropertyValue("--accent-2"), "#22d3ee"),
  };
}

export default function PcbScene() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      return; // no WebGL — the parent shows a static fallback
    }

    const { accent, accent2 } = readAccent();

    const width = host.clientWidth || 560;
    const height = host.clientHeight || 460;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.8);

    renderer.setPixelRatio(DPR);
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "pan-y";
    renderer.domElement.style.cursor = "grab";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#080b11");
    // soft radial vignette floor colour
    scene.fog = new THREE.Fog("#080b11", 18, 34);

    // real image-based lighting → believable metal/plastic reflections
    let pmrem: THREE.PMREMGenerator | null = null;
    try {
      pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    } catch { pmrem = null; }

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 6.6, 10.5);
    camera.lookAt(0, 0, 0);

    /* ---- lighting ---- */
    const amb = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(amb);

    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(6, 12, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 40;
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    key.shadow.bias = -0.0004;
    scene.add(key);

    const rim = new THREE.PointLight(accent.getHex(), 60, 30, 2);
    rim.position.set(-7, 4, -6);
    scene.add(rim);

    const fill = new THREE.PointLight(accent2.getHex(), 32, 30, 2);
    fill.position.set(7, 3, 6);
    scene.add(fill);

    /* ---- the board group (everything rotates together) ---- */
    const board = new THREE.Group();
    scene.add(board);

    const BW = 9; // board width
    const BD = 6.6; // board depth
    const BH = 0.34; // board thickness

    // FR-4 substrate
    const fr4 = new THREE.Mesh(
      new THREE.BoxGeometry(BW, BH, BD),
      new THREE.MeshStandardMaterial({ color: new THREE.Color("#0c3b2e").multiplyScalar(1.0), roughness: 0.72, metalness: 0.15 })
    );
    fr4.castShadow = true;
    fr4.receiveShadow = true;
    board.add(fr4);

    // copper ground pour (very subtly emissive so bloom kisses the edges)
    const pour = new THREE.Mesh(
      new THREE.BoxGeometry(BW - 0.5, 0.02, BD - 0.5),
      new THREE.MeshStandardMaterial({ color: accent.clone().multiplyScalar(0.25), roughness: 0.35, metalness: 0.9, emissive: accent.clone().multiplyScalar(0.12) })
    );
    pour.position.y = BH / 2 + 0.005;
    board.add(pour);

    const top = BH / 2 + 0.02; // working surface height

    /* ---- helpers ---- */
    const disposables: (THREE.BufferGeometry | THREE.Material)[] = [];
    const track = <T extends THREE.BufferGeometry | THREE.Material>(x: T): T => { disposables.push(x); return x; };

    const copperMat = track(new THREE.MeshStandardMaterial({ color: new THREE.Color("#caa24a"), roughness: 0.3, metalness: 1, emissive: new THREE.Color("#3a2c08"), emissiveIntensity: 0.6 }));
    const goldMat = track(new THREE.MeshStandardMaterial({ color: new THREE.Color("#ffcf6a"), roughness: 0.25, metalness: 1, emissive: new THREE.Color("#5a3f10"), emissiveIntensity: 0.5 }));
    const darkMat = track(new THREE.MeshStandardMaterial({ color: new THREE.Color("#15181d"), roughness: 0.55, metalness: 0.4 }));
    const silverMat = track(new THREE.MeshStandardMaterial({ color: new THREE.Color("#c9ccce"), roughness: 0.3, metalness: 1 }));

    // trace = thin copper strip laid on the surface between two points
    const traceGeoCache: THREE.BoxGeometry[] = [];
    function addTrace(x1: number, z1: number, x2: number, z2: number, w = 0.09) {
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const geo = track(new THREE.BoxGeometry(len, 0.03, w));
      traceGeoCache.push(geo);
      const m = new THREE.Mesh(geo, copperMat);
      m.position.set((x1 + x2) / 2, top, (z1 + z2) / 2);
      m.rotation.y = -Math.atan2(dz, dx);
      board.add(m);
    }
    // route = a polyline of traces; returns its points for signal travel
    function addRoute(points: [number, number][], w?: number) {
      for (let i = 0; i < points.length - 1; i++) addTrace(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], w);
      // solder pad dots at vertices
      for (const [x, z] of points) {
        const pad = new THREE.Mesh(track(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16)), goldMat);
        pad.position.set(x, top, z);
        board.add(pad);
      }
      return points.map(([x, z]) => new THREE.Vector3(x, top + 0.04, z));
    }

    const routes: THREE.Vector3[][] = [];
    routes.push(addRoute([[-3.4, -2.2], [-1.2, -2.2], [-1.2, -0.5]]));
    routes.push(addRoute([[1.2, -0.5], [1.2, -2.4], [3.6, -2.4]]));
    routes.push(addRoute([[-1.2, 0.5], [-1.2, 2.3], [-3.6, 2.3]]));
    routes.push(addRoute([[1.2, 0.6], [2.9, 0.6], [2.9, 2.3]]));
    routes.push(addRoute([[0, 1.1], [0, 2.7]]));
    routes.push(addRoute([[-3.2, 0], [-1.4, 0]], 0.07));
    routes.push(addRoute([[3.2, -0.4], [3.2, 1.2]], 0.07));

    /* ---- components ---- */
    // SoC (main chip)
    const chip = new THREE.Group();
    const chipBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.34, 2.1), darkMat);
    chipBody.castShadow = true;
    chip.add(chipBody);
    // bevel/top plate
    const chipTop = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 1.9), track(new THREE.MeshStandardMaterial({ color: new THREE.Color("#1d2228"), roughness: 0.4, metalness: 0.5 })));
    chipTop.position.y = 0.19;
    chip.add(chipTop);
    // pin-1 dot
    const dot = new THREE.Mesh(track(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 12)), track(new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.4 })));
    dot.position.set(-0.75, 0.21, -0.75);
    chip.add(dot);
    // lead-frame pins on all four sides
    const pinGeo = track(new THREE.BoxGeometry(0.12, 0.05, 0.26));
    for (let s = 0; s < 4; s++) {
      for (let i = -3; i <= 3; i++) {
        const pin = new THREE.Mesh(pinGeo, silverMat);
        const off = i * 0.28;
        if (s === 0) pin.position.set(off, -0.02, 1.15);
        else if (s === 1) { pin.position.set(off, -0.02, -1.15); }
        else if (s === 2) { pin.position.set(1.15, -0.02, off); pin.rotation.y = Math.PI / 2; }
        else { pin.position.set(-1.15, -0.02, off); pin.rotation.y = Math.PI / 2; }
        chip.add(pin);
      }
    }
    chip.position.set(0, top + 0.17, 0);
    board.add(chip);

    // electrolytic cap (cylinder)
    const cap = new THREE.Group();
    const capBody = new THREE.Mesh(track(new THREE.CylinderGeometry(0.45, 0.45, 1.0, 28)), track(new THREE.MeshStandardMaterial({ color: new THREE.Color("#20262e"), roughness: 0.35, metalness: 0.7 })));
    capBody.castShadow = true;
    const capTop = new THREE.Mesh(track(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 28)), track(new THREE.MeshStandardMaterial({ color: new THREE.Color("#3a4450"), roughness: 0.3, metalness: 0.85 })));
    capTop.position.y = 0.5;
    cap.add(capBody, capTop);
    cap.position.set(-3.4, top + 0.5, 1.9);
    board.add(cap);

    // tantalum caps (small yellow-ish boxes)
    const tantMat = track(new THREE.MeshStandardMaterial({ color: new THREE.Color("#caa23b"), roughness: 0.5, metalness: 0.3 }));
    for (const [x, z] of [[2.6, -0.6], [2.6, -1.3]] as [number, number][]) {
      const t = new THREE.Mesh(track(new THREE.BoxGeometry(0.7, 0.32, 0.42)), tantMat);
      t.position.set(x, top + 0.16, z);
      t.castShadow = true;
      board.add(t);
    }

    // SMD resistors (tiny dark blocks with silver ends)
    for (const [x, z, ry] of [[-2.6, -0.9, 0], [-2.6, -1.4, 0], [3.4, 0.3, Math.PI / 2]] as [number, number, number][]) {
      const r = new THREE.Mesh(track(new THREE.BoxGeometry(0.42, 0.14, 0.2)), darkMat);
      r.position.set(x, top + 0.07, z);
      r.rotation.y = ry;
      board.add(r);
    }

    // pin header (row of gold posts in a black base)
    const header = new THREE.Group();
    const hbase = new THREE.Mesh(track(new THREE.BoxGeometry(2.6, 0.2, 0.5)), track(new THREE.MeshStandardMaterial({ color: new THREE.Color("#0a0c0e"), roughness: 0.6 })));
    header.add(hbase);
    for (let i = 0; i < 8; i++) {
      const post = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, 0.5, 0.12)), goldMat);
      post.position.set(-1.15 + i * 0.33, 0.32, 0);
      header.add(post);
    }
    header.position.set(0, top + 0.1, 2.7);
    board.add(header);

    // status LED (bright, pulsing)
    const ledMat = track(new THREE.MeshStandardMaterial({ color: accent2, emissive: accent2, emissiveIntensity: 3 }));
    const led = new THREE.Mesh(track(new THREE.BoxGeometry(0.32, 0.22, 0.5)), ledMat);
    led.position.set(3.6, top + 0.11, 2.3);
    board.add(led);
    const ledGlow = new THREE.PointLight(accent2.getHex(), 8, 6, 2);
    ledGlow.position.copy(led.position);
    board.add(ledGlow);

    // metal-can crystal oscillator (reflective, catches the environment)
    const xtal = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.28, 0.7, 6, 16)),
      track(new THREE.MeshStandardMaterial({ color: new THREE.Color("#b8c0c8"), roughness: 0.18, metalness: 1 }))
    );
    xtal.rotation.z = Math.PI / 2;
    xtal.position.set(-2.8, top + 0.28, -1.7);
    xtal.castShadow = true;
    board.add(xtal);

    // a smaller secondary QFN chip
    const chip2 = new THREE.Mesh(track(new THREE.BoxGeometry(1.1, 0.26, 1.1)), darkMat);
    chip2.position.set(-3.1, top + 0.13, 0.4);
    chip2.castShadow = true;
    board.add(chip2);
    for (let i = -2; i <= 2; i++) {
      for (const sgn of [-1, 1]) {
        const pin = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.04, 0.16)), silverMat);
        pin.position.set(-3.1 + i * 0.2, top + 0.02, 0.4 + sgn * 0.62);
        board.add(pin);
      }
    }

    // mounting holes (plated) at the corners
    for (const [x, z] of [[-BW / 2 + 0.55, -BD / 2 + 0.55], [BW / 2 - 0.55, -BD / 2 + 0.55], [-BW / 2 + 0.55, BD / 2 - 0.55], [BW / 2 - 0.55, BD / 2 - 0.55]] as [number, number][]) {
      const ring = new THREE.Mesh(track(new THREE.TorusGeometry(0.22, 0.07, 10, 20)), goldMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, top, z);
      board.add(ring);
      const hole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.15, 0.15, BH + 0.1, 16)), track(new THREE.MeshStandardMaterial({ color: new THREE.Color("#05070a"), roughness: 0.9 })));
      hole.position.set(x, BH / 2, z);
      board.add(hole);
    }

    // a couple of extra SMD caps near the SoC for density
    for (const [x, z] of [[-1.0, -1.6], [1.0, 1.5], [0.6, -1.7]] as [number, number][]) {
      const c = new THREE.Mesh(track(new THREE.BoxGeometry(0.3, 0.16, 0.5)), track(new THREE.MeshStandardMaterial({ color: new THREE.Color("#2a3038"), roughness: 0.4, metalness: 0.5 })));
      c.position.set(x, top + 0.08, z);
      c.castShadow = true;
      board.add(c);
    }

    /* ---- traveling signal pulses on the copper ---- */
    const pulseMat = track(new THREE.MeshBasicMaterial({ color: accent2 }));
    type Pulse = { mesh: THREE.Mesh; route: THREE.Vector3[]; t: number; speed: number };
    const pulses: Pulse[] = [];
    routes.forEach((route, i) => {
      if (route.length < 2) return;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), pulseMat);
      board.add(mesh);
      pulses.push({ mesh, route, t: (i / routes.length), speed: 0.16 + (i % 3) * 0.05 });
    });
    function moveAlong(route: THREE.Vector3[], t: number, out: THREE.Vector3) {
      const total = route.length - 1;
      const p = t * total;
      const i = Math.min(Math.floor(p), total - 1);
      const f = p - i;
      out.lerpVectors(route[i], route[i + 1], f);
    }

    // resting pose — a tasteful three-quarter view
    board.rotation.x = -0.62;
    board.rotation.y = -0.5;

    /* ---- bloom composer ---- */
    let composer: EffectComposer | null = null;
    let useComposer = true;
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.7, 0.7, 0.82);
      composer.addPass(bloom);
      composer.setPixelRatio(DPR);
      composer.setSize(width, height);
    } catch {
      useComposer = false;
      composer = null;
    }

    /* ---- interaction: drag to orbit + idle auto-spin ---- */
    let dragging = false;
    let lastX = 0, lastY = 0;
    let velY = 0, velX = 0;
    let idleTime = 0;
    const targetRestX = -0.62;

    const onDown = (e: PointerEvent) => {
      dragging = true; idleTime = 0; lastX = e.clientX; lastY = e.clientY;
      renderer.domElement.style.cursor = "grabbing";
      renderer.domElement.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      velY = dx * 0.006;
      velX = dy * 0.006;
      board.rotation.y += velY;
      board.rotation.x = THREE.MathUtils.clamp(board.rotation.x + velX, -1.35, 0.15);
    };
    const onUp = (e: PointerEvent) => {
      dragging = false; idleTime = 0;
      renderer.domElement.style.cursor = "grab";
      renderer.domElement.releasePointerCapture?.(e.pointerId);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    /* ---- resize ---- */
    const ro = new ResizeObserver(() => {
      const w = host.clientWidth || width;
      const h = host.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer?.setSize(w, h);
    });
    ro.observe(host);

    /* ---- render loop (throttled + pauses when tab hidden) ---- */
    const clock = new THREE.Clock();
    let raf = 0;
    let running = true;
    const tmp = new THREE.Vector3();

    // cinematic intro: ease the camera in from a wider, lower angle
    const camStart = new THREE.Vector3(0.5, 3.0, 15.5);
    const camEnd = new THREE.Vector3(0, 6.6, 10.5);
    let intro = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!running) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const el = clock.elapsedTime;

      if (intro < 1) {
        intro = Math.min(1, intro + dt / 1.7);
        const e = 1 - Math.pow(1 - intro, 3);
        camera.position.lerpVectors(camStart, camEnd, e);
        camera.lookAt(0, 0.3, 0);
      }

      // inertia + idle auto-rotate
      if (!dragging) {
        idleTime += dt;
        board.rotation.y += velY;
        board.rotation.x += velX;
        velY *= 0.94;
        velX *= 0.94;
        if (idleTime > 1.4) {
          board.rotation.y += 0.0035;
          board.rotation.x += (targetRestX - board.rotation.x) * 0.02;
        }
      }

      // LED pulse
      const pulse = 1.6 + Math.sin(el * 3.2) * 1.5;
      ledMat.emissiveIntensity = Math.max(0.4, pulse);
      ledGlow.intensity = 4 + Math.max(0, Math.sin(el * 3.2)) * 7;

      // traveling signals
      for (const p of pulses) {
        p.t += dt * p.speed;
        if (p.t > 1) p.t -= 1;
        moveAlong(p.route, p.t, tmp);
        p.mesh.position.copy(tmp);
      }

      if (useComposer && composer) composer.render();
      else renderer.render(scene, camera);
    };
    loop();

    const onVis = () => { running = document.visibilityState === "visible"; if (running) clock.getDelta(); };
    document.addEventListener("visibilitychange", onVis);

    /* ---- teardown ---- */
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      for (const d of disposables) d.dispose();
      composer?.dispose?.();
      pmrem?.dispose?.();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className="absolute inset-0" aria-hidden />;
}
