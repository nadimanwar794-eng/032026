import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PedroEngine } from '../utils/engines/pedroEngine';

export type PedroMascotPose = 'idle' | 'look_left' | 'look_right' | 'wave' | 'spin' | 'pointing' | 'sleep' | 'reading' | 'toss_head' | 'headless_booster' | 'wink' | 'smile_wink' | 'naraj' | 'angry' | 'upset' | 'sad';

export type PedroColorScheme = 'classic' | 'cyber';

interface Pedro3DMascotProps {
  size?: number;
  pose?: PedroMascotPose;
  isSpeaking?: boolean;
  isPointing?: boolean;
  isDragging?: boolean;
  isMini?: boolean;
  isRotatable?: boolean;
  autoSpin360?: boolean;
  isBoosterActive?: boolean;
  headOnly?: boolean;
  isWinking?: boolean;
  isNaraj?: boolean;
  level?: number;
  colorScheme?: PedroColorScheme;
  className?: string;
  allowTilt?: boolean;
  allowZoom?: boolean;
  onClick?: () => void;
}

export const Pedro3DMascotComponent: React.FC<Pedro3DMascotProps> = ({
  size = 68,
  pose = 'idle',
  isSpeaking = false,
  isPointing = false,
  isDragging = false,
  isMini = false,
  isRotatable = true,
  autoSpin360 = false,
  isBoosterActive = false,
  headOnly = false,
  isWinking = false,
  isNaraj = false,
  level = 1,
  colorScheme = 'classic',
  className = '',
  allowTilt = false,
  allowZoom = false,
  onClick
}) => {
  const [hasWebGLError, setHasWebGLError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const pedroRef = useRef<THREE.Group | null>(null);
  const headGroupRef = useRef<THREE.Group | null>(null);
  const bodyGroupRef = useRef<THREE.Group | null>(null);
  const eyesGroupRef = useRef<THREE.Group | null>(null);
  const lEyeGroupRef = useRef<THREE.Group | null>(null);
  const rEyeGroupRef = useRef<THREE.Group | null>(null);
  const antennaGroupRef = useRef<THREE.Group | null>(null);
  const lArmRef = useRef<THREE.Mesh | null>(null);
  const rArmRef = useRef<THREE.Mesh | null>(null);
  const leg1Ref = useRef<THREE.Mesh | null>(null);
  const leg2Ref = useRef<THREE.Mesh | null>(null);
  const nozzle1Ref = useRef<THREE.Mesh | null>(null);
  const nozzle2Ref = useRef<THREE.Mesh | null>(null);
  const flame1Ref = useRef<THREE.Group | null>(null);
  const flame2Ref = useRef<THREE.Group | null>(null);
  const smileRef = useRef<THREE.Mesh | null>(null);
  const mouthGroupRef = useRef<THREE.Group | null>(null);
  const narajGroupRef = useRef<THREE.Group | null>(null);
  const bookGroupRef = useRef<THREE.Group | null>(null);
  const glassesGroupRef = useRef<THREE.Group | null>(null);
  const headphonesGroupRef = useRef<THREE.Group | null>(null);
  const crownGroupRef = useRef<THREE.Group | null>(null);
  const backBoosterGroupRef = useRef<THREE.Group | null>(null);
  const backFlame1Ref = useRef<THREE.Group | null>(null);
  const backFlame2Ref = useRef<THREE.Group | null>(null);
  const purpleMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const smileMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const whiteMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Performance-optimized dynamic state refs (prevents WebGL scene recreation)
  const isBoosterActiveRef = useRef<boolean>(isBoosterActive);
  const isSpeakingRef = useRef<boolean>(isSpeaking);
  const isPointingRef = useRef<boolean>(isPointing);
  const isDraggingRef = useRef<boolean>(isDragging);
  const isMiniRef = useRef<boolean>(isMini);
  const headOnlyRef = useRef<boolean>(headOnly);
  const isWinkingRef = useRef<boolean>(isWinking);
  const isNarajRef = useRef<boolean>(isNaraj);
  const poseRef = useRef<PedroMascotPose>(pose);
  const autoSpin360Ref = useRef<boolean>(autoSpin360);
  const levelRef = useRef<number>(level);
  const colorSchemeRef = useRef<PedroColorScheme>(colorScheme);
  const lastUserActivityRef = useRef<number>(0);

  useEffect(() => { isBoosterActiveRef.current = isBoosterActive; }, [isBoosterActive]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { isPointingRef.current = isPointing; }, [isPointing]);
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);
  useEffect(() => { isMiniRef.current = isMini; }, [isMini]);
  useEffect(() => { headOnlyRef.current = headOnly; }, [headOnly]);
  useEffect(() => { isWinkingRef.current = isWinking; }, [isWinking]);
  useEffect(() => { isNarajRef.current = isNaraj; }, [isNaraj]);
  useEffect(() => { poseRef.current = pose; }, [pose]);
  useEffect(() => {
    autoSpin360Ref.current = autoSpin360;
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoSpin360 || !isDraggingRef.current;
      controlsRef.current.autoRotateSpeed = autoSpin360 ? 2.8 : 0.85;
    }
  }, [autoSpin360]);
  useEffect(() => { levelRef.current = level; }, [level]);

  // Listen to Pedro penalty & naraj events across the app
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem('nst_current_user') || localStorage.getItem('nst_user');
      const uid = rawUser ? JSON.parse(rawUser)?.id : undefined;
      if (uid && PedroEngine.isPedroNaraj(uid)) {
        isNarajRef.current = true;
      }
    } catch {}

    const handleNaraj = (e: any) => {
      if (e?.detail) {
        isNarajRef.current = !!e.detail.isNaraj;
      }
    };
    window.addEventListener('nst-pedro-naraj', handleNaraj);
    window.addEventListener('nst-pedro-penalty-change', handleNaraj);
    return () => {
      window.removeEventListener('nst-pedro-naraj', handleNaraj);
      window.removeEventListener('nst-pedro-penalty-change', handleNaraj);
    };
  }, []);

  // Dynamically update materials when colorScheme changes without scene rebuild
  useEffect(() => {
    colorSchemeRef.current = colorScheme;
    if (purpleMatRef.current && smileMatRef.current && whiteMatRef.current) {
      if (colorScheme === 'cyber') {
        purpleMatRef.current.color.setHex(0x06b6d4); // Neon Cyan
        smileMatRef.current.color.setHex(0x0f766e);
        whiteMatRef.current.color.setHex(0xf0fdf4);
      } else {
        purpleMatRef.current.color.setHex(0x8f7fd5); // Cosmic Purple
        smileMatRef.current.color.setHex(0x4a3d7a);
        whiteMatRef.current.color.setHex(0xffffff);
      }
    }
  }, [colorScheme]);

  // Track user interaction with dashboard to throttle auto-emotes during active reading/scrolling
  useEffect(() => {
    const handleActivity = () => {
      lastUserActivityRef.current = performance.now();
    };
    window.addEventListener('scroll', handleActivity, { passive: true });
    window.addEventListener('wheel', handleActivity, { passive: true });
    window.addEventListener('touchmove', handleActivity, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('wheel', handleActivity);
      window.removeEventListener('touchmove', handleActivity);
    };
  }, []);

  // Sync pointing & speaking poses dynamically to 3D meshes
  useEffect(() => {
    if (rArmRef.current) {
      if (isPointing || pose === 'pointing') {
        rArmRef.current.position.set(0.55, 0.42, 0.35);
        rArmRef.current.rotation.set(0.9, 0, 0.5);
      } else if (pose === 'wave') {
        rArmRef.current.position.set(0.55, 0.48, 0.1);
        rArmRef.current.rotation.set(0, 0, 1.2);
      } else {
        rArmRef.current.position.set(0.55, 0.28, 0.18);
        rArmRef.current.rotation.set(0, 0, 0.3);
      }
    }
  }, [isPointing, pose]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoSpin360 || !isDragging;
      controlsRef.current.autoRotateSpeed = autoSpin360 ? 3.5 : 0.85;
    }
  }, [autoSpin360, isDragging]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check WebGL availability
    const checkWebGLSupport = (): boolean => {
      if (typeof window === 'undefined') return false;
      try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
      } catch {
        return false;
      }
    };

    if (!checkWebGLSupport()) {
      setHasWebGLError(true);
      return;
    }

    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let domEl: HTMLElement | null = null;
    let observer: IntersectionObserver | null = null;
    let handleVisibilityChange: (() => void) | null = null;
    let handleStartDrag: (() => void) | null = null;
    let handleEndDrag: (() => void) | null = null;

    try {
      const width = size;
      const height = size;

      // ── 1. THREE.JS SCENE SETUP ──
      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 50);
      if (headOnly) {
        camera.position.set(0, 1.20, 2.15); // Closer camera distance for a larger, prominent head ("mund bara dikhao")
      } else {
        camera.position.set(0, 0.62, 4.45);
      }

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      domEl = renderer.domElement;

      // ── 2. ORBIT CONTROLS (360° ROTATION) ──
      controls = new OrbitControls(camera, renderer.domElement);
      controlsRef.current = controls;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enableZoom = allowZoom;
      if (allowZoom) {
        controls.minDistance = 2.0;
        controls.maxDistance = 6.0;
      }
      controls.enablePan = false;
      if (allowTilt) {
        controls.minPolarAngle = Math.PI / 3.2;
        controls.maxPolarAngle = Math.PI / 1.7;
      } else {
        controls.minPolarAngle = Math.PI / 2;
        controls.maxPolarAngle = Math.PI / 2;
      }
      controls.autoRotate = autoSpin360 || !isDragging;
      controls.autoRotateSpeed = autoSpin360 ? 2.8 : 0.85;
      controls.target.set(0, headOnly ? 1.20 : 0.56, 0);

      // ── 3. LIGHTING ──
      const ambient = new THREE.AmbientLight(0xffffff, 1.3);
      scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(3, 4, 2);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xc9b6ff, 0.9);
    fillLight.position.set(-2, 2, -2);
    scene.add(fillLight);

    // ── 4. PEDRO 3D MESH GROUP HIERARCHY ──
    const pedro = new THREE.Group();
    pedro.position.set(0, -0.05, 0);
    scene.add(pedro);
    pedroRef.current = pedro;

    // High quality materials
    const isCyber = colorSchemeRef.current === 'cyber';
    const whiteMat = new THREE.MeshStandardMaterial({
      color: isCyber ? 0xf0fdf4 : 0xffffff,
      roughness: 0.28,
      metalness: 0.08
    });
    const purpleMat = new THREE.MeshStandardMaterial({
      color: isCyber ? 0x06b6d4 : 0x8f7fd5,
      roughness: 0.38,
      metalness: 0.12
    });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x0f0f1e, roughness: 0.1 });
    const smileMat = new THREE.MeshStandardMaterial({
      color: isCyber ? 0x0f766e : 0x4a3d7a,
      roughness: 0.3
    });
    purpleMatRef.current = purpleMat;
    smileMatRef.current = smileMat;
    whiteMatRef.current = whiteMat;

    // ── BODY GROUP ──
    const bodyGroup = new THREE.Group();
    bodyGroup.position.set(0, 0, 0);
    pedro.add(bodyGroup);
    bodyGroupRef.current = bodyGroup;

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.45, 4, 16), whiteMat);
    body.position.y = 0.18;
    bodyGroup.add(body);

    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 20), purpleMat);
    b1.position.set(0, 0.28, 0.33);
    b1.rotation.x = Math.PI / 2;
    bodyGroup.add(b1);

    const b2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.18, 4, 8), purpleMat);
    b2.position.set(0, -0.05, 0.31);
    b2.rotation.x = Math.PI / 2;
    bodyGroup.add(b2);

    // ── LEVEL 6 ACCESSORY: BACK BOOSTER JETPACK WITH FIRE ("Pichhe booster lag jayenge aag ke saath") ──
    const backBoosterGroup = new THREE.Group();
    backBoosterGroup.position.set(0, 0.18, -0.30);

    const boosterMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.25
    });
    const boosterGold = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.9,
      roughness: 0.2
    });

    const bChassis = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.38, 0.16), boosterMat);
    const bPlate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.02), boosterGold);
    bPlate.position.set(0, 0, -0.09);

    const lTube = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.38, 16), boosterMat);
    lTube.position.set(-0.30, 0, -0.04);
    const lNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.12, 16), boosterGold);
    lNozzle.position.set(-0.30, -0.22, -0.04);

    const rTube = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.38, 16), boosterMat);
    rTube.position.set(0.30, 0, -0.04);
    const rNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.12, 16), boosterGold);
    rNozzle.position.set(0.30, -0.22, -0.04);

    // Active rocket fire flames for back booster ("aag ke saath")
    const bFlameOuterMat = new THREE.MeshStandardMaterial({
      color: 0xff3b00,
      emissive: 0xff4500,
      emissiveIntensity: 3.5,
      transparent: true,
      opacity: 0.92
    });
    const bFlameInnerMat = new THREE.MeshStandardMaterial({
      color: 0xfff066,
      emissive: 0xffd700,
      emissiveIntensity: 4.5,
      transparent: true,
      opacity: 0.98
    });
    const bFlameGeo = new THREE.ConeGeometry(0.1, 0.48, 16);
    const bFlameInnerGeo = new THREE.ConeGeometry(0.055, 0.35, 12);

    const bkFlame1 = new THREE.Group();
    bkFlame1.position.set(-0.30, -0.32, -0.04);
    bkFlame1.rotation.x = Math.PI;
    bkFlame1.rotation.z = 0.06;
    bkFlame1.add(new THREE.Mesh(bFlameGeo, bFlameOuterMat));
    bkFlame1.add(new THREE.Mesh(bFlameInnerGeo, bFlameInnerMat));

    const bkFlame2 = new THREE.Group();
    bkFlame2.position.set(0.30, -0.32, -0.04);
    bkFlame2.rotation.x = Math.PI;
    bkFlame2.rotation.z = -0.06;
    bkFlame2.add(new THREE.Mesh(bFlameGeo, bFlameOuterMat));
    bkFlame2.add(new THREE.Mesh(bFlameInnerGeo, bFlameInnerMat));

    backBoosterGroup.add(bChassis, bPlate, lTube, lNozzle, rTube, rNozzle, bkFlame1, bkFlame2);
    backBoosterGroup.visible = (levelRef.current || 1) >= 6;
    bodyGroup.add(backBoosterGroup);
    backBoosterGroupRef.current = backBoosterGroup;
    backFlame1Ref.current = bkFlame1;
    backFlame2Ref.current = bkFlame2;

    // ── HEAD GROUP (For detachable head, giant head emote, etc.) ──
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.2, 0);
    pedro.add(headGroup);
    headGroupRef.current = headGroup;

    // Head base sphere
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.65, 32, 32), whiteMat);
    headGroup.add(head);

    // Top purple cap
    const topCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.41, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.3),
      purpleMat
    );
    topCap.position.y = 0.38;
    topCap.rotation.x = Math.PI;
    headGroup.add(topCap);

    // Ears
    const earGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const ear1 = new THREE.Mesh(earGeo, purpleMat);
    ear1.position.set(-0.68, 0, 0);
    ear1.scale.set(1, 1.4, 0.9);
    const ear2 = ear1.clone();
    ear2.position.set(0.68, 0, 0);
    headGroup.add(ear1, ear2);

    // Antenna Group (Rotates independently for propeller copter emote!)
    const antennaGroup = new THREE.Group();
    antennaGroup.position.set(0, 0.65, 0);
    headGroup.add(antennaGroup);
    antennaGroupRef.current = antennaGroup;

    const antennaStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 12), purpleMat);
    antennaStem.position.y = 0.2;
    antennaGroup.add(antennaStem);

    const antBall = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), purpleMat);
    antBall.position.y = 0.55;
    antennaGroup.add(antBall);

    // Eyes Group (Moves/springs independently for cartoon shock emote!)
    const eyesGroup = new THREE.Group();
    eyesGroup.position.set(0, 0, 0);
    headGroup.add(eyesGroup);
    eyesGroupRef.current = eyesGroup;

    const createEye = (x: number, isRightEye: boolean) => {
      const eyeSubGroup = new THREE.Group();
      // Position eyes slightly recessed into the face curvature so they never protrude outward ("Pedro ka aankh bahar na aayega")
      eyeSubGroup.position.set(x, -0.02, 0.44);

      // Flatter eye white that contours cleanly with the head surface
      const eyeWhite = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 24, 24),
        new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.25 })
      );
      eyeWhite.scale.set(1, 1, 0.42); // Flattens depth into face
      eyeWhite.position.set(0, 0, 0);

      // Embedded pupil
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 24), blackMat);
      pupil.scale.set(1, 1, 0.4);
      pupil.position.set(0, 0, 0.04);

      // Eye shine inside pupil
      const shine = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 })
      );
      shine.position.set(0.05, 0.06, 0.07);

      eyeSubGroup.add(eyeWhite, pupil, shine);
      eyesGroup.add(eyeSubGroup);

      if (isRightEye) {
        rEyeGroupRef.current = eyeSubGroup;
      } else {
        lEyeGroupRef.current = eyeSubGroup;
      }
    };
    createEye(-0.2, false);
    createEye(0.2, true);

    // ── EXPRESSIVE 3D MOUTH WITH TEETH & TONGUE ("Daant aur Muh") ──
    const mouthGroup = new THREE.Group();
    mouthGroup.position.set(0, -0.28, 0.58);
    headGroup.add(mouthGroup);
    mouthGroupRef.current = mouthGroup;

    // Outer smile lip contour
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.024, 10, 24, Math.PI),
      smileMat
    );
    smile.rotation.x = Math.PI;
    smile.rotation.z = Math.PI;
    mouthGroup.add(smile);
    smileRef.current = smile;

    // Dark mouth cavity
    const mouthCavityMat = new THREE.MeshStandardMaterial({
      color: 0x3b0764,
      roughness: 0.6,
      metalness: 0.1
    });
    const mouthCavity = new THREE.Mesh(
      new THREE.CylinderGeometry(0.125, 0.125, 0.02, 20, 1, false, 0, Math.PI),
      mouthCavityMat
    );
    mouthCavity.rotation.x = Math.PI / 2;
    mouthCavity.rotation.z = Math.PI;
    mouthCavity.position.set(0, 0.005, -0.015);
    mouthGroup.add(mouthCavity);

    // Pearly white cartoon teeth row ("Daant")
    const teethMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.1
    });
    const topTeethGroup = new THREE.Group();
    topTeethGroup.position.set(0, 0.028, 0.004);

    // 4 cute teeth chiclets with subtle gaps
    for (let i = -1.5; i <= 1.5; i++) {
      const tooth = new THREE.Mesh(
        new THREE.BoxGeometry(0.038, 0.042, 0.018),
        teethMat
      );
      tooth.position.set(i * 0.044, -0.01, 0);
      topTeethGroup.add(tooth);
    }
    mouthGroup.add(topTeethGroup);

    // Cute coral pink tongue
    const tongueMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.4
    });
    const tongue = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 16, 16),
      tongueMat
    );
    tongue.position.set(0, -0.048, 0.002);
    tongue.scale.set(1.35, 0.7, 0.8);
    mouthGroup.add(tongue);

    // ── 3D NARAJ ANGER/POUT MARK (Permanently Disabled for clean premium look) ──
    const narajGroup = new THREE.Group();
    narajGroup.visible = false;
    headGroup.add(narajGroup);
    narajGroupRef.current = narajGroup;

    // ── LEVEL 5 ACCESSORY: STYLISH 3D GLASSES ("Chasma pahnega") ──
    const glassesGroup = new THREE.Group();
    glassesGroup.position.set(0, -0.02, 0.69);

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0x78350f,
      emissiveIntensity: 0.35,
      metalness: 0.9,
      roughness: 0.2
    });
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.75,
      roughness: 0.1,
      metalness: 0.3
    });

    const leftRim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.032, 16, 32), frameMat);
    leftRim.position.set(-0.20, 0, 0.08);
    const leftLens = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.015, 24), lensMat);
    leftLens.rotation.x = Math.PI / 2;
    leftLens.position.set(-0.20, 0, 0.075);

    const rightRim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.032, 16, 32), frameMat);
    rightRim.position.set(0.20, 0, 0.08);
    const rightLens = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.015, 24), lensMat);
    rightLens.rotation.x = Math.PI / 2;
    rightLens.position.set(0.20, 0, 0.075);

    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.16, 8), frameMat);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.04, 0.08);

    const leftTemple = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.52, 8), frameMat);
    leftTemple.rotation.x = Math.PI / 2;
    leftTemple.rotation.y = -0.35;
    leftTemple.position.set(-0.42, 0.02, -0.16);

    const rightTemple = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.52, 8), frameMat);
    rightTemple.rotation.x = Math.PI / 2;
    rightTemple.rotation.y = 0.35;
    rightTemple.position.set(0.42, 0.02, -0.16);

    glassesGroup.add(leftRim, leftLens, rightRim, rightLens, bridge, leftTemple, rightTemple);
    glassesGroup.visible = (levelRef.current || 1) >= 5;
    headGroup.add(glassesGroup);
    glassesGroupRef.current = glassesGroup;

    // ── LEVEL 6 ACCESSORY: OVER-EAR DJ HEADPHONES ("Headphone pahnega") ──
    // Headband goes over the top of the head ("sar ke upar se"), resting on the crown
    const headphonesGroup = new THREE.Group();
    headphonesGroup.position.set(0, 0, 0);

    const hpBandMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b,
      metalness: 0.7,
      roughness: 0.3
    });
    const hpCushionMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8
    });
    const hpGlowMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.2
    });

    // Arch over the top/crown of the head from ear to ear (sar ke upar se)
    const hpBand = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.042, 14, 36, Math.PI), hpBandMat);
    hpBand.rotation.x = -0.12; // Slight tilt back to rest smoothly on the crown of the head
    hpBand.position.set(0, 0, 0);

    const hpCushionBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.705, 0.024, 10, 24, Math.PI * 0.55),
      hpCushionMat
    );
    hpCushionBand.rotation.z = Math.PI * 0.225; // Centered at top apex of the arch
    hpCushionBand.rotation.x = -0.12;
    hpCushionBand.position.set(0, 0, 0);

    const leftHpCup = new THREE.Group();
    leftHpCup.position.set(-0.71, 0, 0);
    const lCupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.09, 24), hpBandMat);
    lCupBody.rotation.z = Math.PI / 2;
    const lCupCushion = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.045, 12, 24), hpCushionMat);
    lCupCushion.rotation.y = Math.PI / 2;
    lCupCushion.position.set(0.04, 0, 0);
    const lCupGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 16), hpGlowMat);
    lCupGlow.rotation.z = Math.PI / 2;
    lCupGlow.position.set(-0.06, 0, 0);
    leftHpCup.add(lCupBody, lCupCushion, lCupGlow);

    const rightHpCup = new THREE.Group();
    rightHpCup.position.set(0.71, 0, 0);
    const rCupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.09, 24), hpBandMat);
    rCupBody.rotation.z = Math.PI / 2;
    const rCupCushion = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.045, 12, 24), hpCushionMat);
    rCupCushion.rotation.y = Math.PI / 2;
    rCupCushion.position.set(-0.04, 0, 0);
    const rCupGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 16), hpGlowMat);
    rCupGlow.rotation.z = Math.PI / 2;
    rCupGlow.position.set(0.06, 0, 0);
    rightHpCup.add(rCupBody, rCupCushion, rCupGlow);

    headphonesGroup.add(hpBand, hpCushionBand, leftHpCup, rightHpCup);
    headphonesGroup.visible = (levelRef.current || 1) >= 6;
    headGroup.add(headphonesGroup);
    headphonesGroupRef.current = headphonesGroup;

    // ── LEVEL 8 ACCESSORY: GOLDEN CHAMPION CROWN 👑 ──
    // Enlarged, majestic golden crown fitted snugly on Pedro's head dome ("crown bara banao aur sar pe fit hoga")
    const crownGroup = new THREE.Group();
    crownGroup.position.set(0, 0.48, 0);

    const crownGoldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xb45309,
      emissiveIntensity: 0.5,
      metalness: 0.9,
      roughness: 0.15,
    });
    const rubyMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 1.2,
      metalness: 0.4,
      roughness: 0.15,
    });
    const jewelEmeraldMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 1.0,
      metalness: 0.4,
      roughness: 0.15,
    });

    // Circlet base band: enlarged and thicker for grand fit over head dome
    const circlet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.50, 0.48, 0.14, 28, 1, false), 
      crownGoldMat
    );
    crownGroup.add(circlet);

    // Beaded lower rim for grand royal look
    const rimTorus = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.028, 14, 32),
      crownGoldMat
    );
    rimTorus.rotation.x = Math.PI / 2;
    rimTorus.position.y = -0.07;
    crownGroup.add(rimTorus);

    // 5 Majestic tall crown spikes with prominent jewels fitting around head
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const isFront = i === 0;
      const spikeHeight = isFront ? 0.32 : 0.25;
      const spikeRadius = isFront ? 0.10 : 0.08;

      const spike = new THREE.Mesh(new THREE.ConeGeometry(spikeRadius, spikeHeight, 8), crownGoldMat);
      spike.position.set(Math.sin(angle) * 0.48, 0.07 + spikeHeight / 2, Math.cos(angle) * 0.48);
      crownGroup.add(spike);

      const jewel = new THREE.Mesh(
        new THREE.SphereGeometry(isFront ? 0.065 : 0.05, 14, 14), 
        isFront || i % 2 === 0 ? rubyMat : jewelEmeraldMat
      );
      jewel.position.set(Math.sin(angle) * 0.48, 0.07 + spikeHeight + 0.03, Math.cos(angle) * 0.48);
      crownGroup.add(jewel);
    }

    crownGroup.visible = (levelRef.current || 1) >= 8;
    headGroup.add(crownGroup);
    crownGroupRef.current = crownGroup;

    // ── ARMS & LEGS ──
    const armGeo = new THREE.CapsuleGeometry(0.08, 0.32, 4, 8);
    const lArm = new THREE.Mesh(armGeo, whiteMat);
    lArm.position.set(-0.52, 0.22, 0);
    lArm.rotation.z = -0.2;

    const rArm = new THREE.Mesh(armGeo, whiteMat);
    rArm.position.set(0.55, 0.28, 0.18);
    rArm.rotation.z = 0.3;
    pedro.add(lArm, rArm);
    lArmRef.current = lArm;
    rArmRef.current = rArm;

    const legGeo = new THREE.CapsuleGeometry(0.12, 0.22, 4, 8);
    const leg1 = new THREE.Mesh(legGeo, whiteMat);
    leg1.position.set(-0.18, -0.55, 0);

    const leg2 = new THREE.Mesh(legGeo, whiteMat);
    leg2.position.set(0.18, -0.55, 0);
    pedro.add(leg1, leg2);
    leg1Ref.current = leg1;
    leg2Ref.current = leg2;

    // ── BOOSTER THRUSTER NOZZLES UNDER FEET ──
    const nozzleGeo = new THREE.CylinderGeometry(0.1, 0.14, 0.16, 16);
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.25
    });
    const nozzle1 = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle1.position.set(-0.18, -0.72, 0);

    const nozzle2 = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle2.position.set(0.18, -0.72, 0);
    pedro.add(nozzle1, nozzle2);
    nozzle1Ref.current = nozzle1;
    nozzle2Ref.current = nozzle2;

    // ── THRUSTER FLAME CONES ──
    const flameGeo = new THREE.ConeGeometry(0.12, 0.44, 16);
    const outerFlameMat = new THREE.MeshStandardMaterial({
      color: 0xff5500,
      emissive: 0xff7700,
      emissiveIntensity: 2.4,
      transparent: true,
      opacity: 0.88
    });
    const innerFlameGeo = new THREE.ConeGeometry(0.065, 0.32, 12);
    const innerFlameMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 3.2,
      transparent: true,
      opacity: 0.95
    });

    const flame1 = new THREE.Group();
    flame1.position.set(-0.18, -0.82, 0);
    flame1.rotation.x = Math.PI;
    flame1.add(new THREE.Mesh(flameGeo, outerFlameMat));
    flame1.add(new THREE.Mesh(innerFlameGeo, innerFlameMat));

    const flame2 = new THREE.Group();
    flame2.position.set(0.18, -0.82, 0);
    flame2.rotation.x = Math.PI;
    flame2.add(new THREE.Mesh(flameGeo, outerFlameMat));
    flame2.add(new THREE.Mesh(innerFlameGeo, innerFlameMat));

    pedro.add(flame1, flame2);
    flame1Ref.current = flame1;
    flame2Ref.current = flame2;

    // ── 3D STUDY BOOK ACCESSORY ("Book nikalega aur padhega" Emote & Level 7 Magic Book) ──
    const bookGroup = new THREE.Group();
    bookGroup.scale.set(0.001, 0.001, 0.001); // Hidden / tucked away initially
    bookGroup.position.set(0, 0.14, 0.44);

    const bookCoverMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb, // Deep NSTA academic royal blue
      roughness: 0.35,
      metalness: 0.18
    });
    const bookPageMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb, // Warm cream parchment
      roughness: 0.8
    });
    const bookGoldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.5,
      metalness: 0.85,
      roughness: 0.25
    });

    const pageGeo = new THREE.BoxGeometry(0.24, 0.32, 0.035);
    const leftP = new THREE.Mesh(pageGeo, bookPageMat);
    leftP.position.set(-0.11, 0, 0);
    leftP.rotation.y = 0.22;

    const leftC = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.015), bookCoverMat);
    leftC.position.set(-0.12, 0, -0.02);
    leftC.rotation.y = 0.22;

    const rightP = new THREE.Mesh(pageGeo, bookPageMat);
    rightP.position.set(0.11, 0, 0);
    rightP.rotation.y = -0.22;

    const rightC = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.015), bookCoverMat);
    rightC.position.set(0.12, 0, -0.02);
    rightC.rotation.y = -0.22;

    const bookSpine = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 12), bookGoldMat);
    bookSpine.position.set(0, 0, -0.02);

    const bookmarkRibbon = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.005), bookGoldMat);
    bookmarkRibbon.position.set(0.04, -0.16, 0.02);
    bookmarkRibbon.rotation.z = -0.12;

    // Golden "NSTA" embossed insignia badge on book cover
    const nstaPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.015, 16),
      bookGoldMat
    );
    nstaPlate.rotation.x = Math.PI / 2;
    nstaPlate.position.set(0.12, 0, 0.015);

    bookGroup.add(leftP, leftC, rightP, rightC, bookSpine, bookmarkRibbon, nstaPlate);
    pedro.add(bookGroup);
    bookGroupRef.current = bookGroup;

    // Stop auto-rotate on user manual drag
    const handleStartDrag = () => {
      controls.autoRotate = false;
    };
    const handleEndDrag = () => {
      setTimeout(() => {
        if (controlsRef.current) {
          controlsRef.current.autoRotate = true;
        }
      }, 2000);
    };

    domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', handleStartDrag);
    domEl.addEventListener('pointerup', handleEndDrag);
    domEl.addEventListener('touchstart', handleStartDrag);
    domEl.addEventListener('touchend', handleEndDrag);

    // ── 5. ANIMATION & THROTTLED EMOTES ENGINE ──
    let t = 0;
    let lastFrameTime = 0;
    let isVisible = typeof document !== 'undefined' ? !document.hidden : true;
    let isIntersecting = true;

    const handleVisibilityChange = () => {
      isVisible = typeof document !== 'undefined' ? !document.hidden : true;
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && container) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]) {
            isIntersecting = entries[0].isIntersecting;
          }
        },
        { threshold: 0.02 }
      );
      observer.observe(container);
    }

    const animate = () => {
      const now = performance.now();

      // 1. Off-screen or Hidden Tab Throttling (0% CPU/GPU overhead when hidden)
      if (!isVisible || !isIntersecting) {
        animFrameIdRef.current = requestAnimationFrame(animate);
        return;
      }

      // 2. Targeted Adaptive FPS Throttling:
      // - Mini mascot (header): 20 FPS (zero emote overhead)
      // - Booster active flight: 60 FPS (responsive aerodynamics)
      // - Normal idle: 35 FPS (silky floating, frees main thread & GPU for 120Hz study UI)
      const targetFps = isMiniRef.current ? 20 : isBoosterActiveRef.current ? 60 : 35;
      const frameInterval = 1000 / targetFps;
      const elapsed = now - lastFrameTime;

      if (elapsed < frameInterval) {
        animFrameIdRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTime = now - (elapsed % frameInterval);

      t += isMiniRef.current ? 0.015 : 0.025;
      const boosting = isBoosterActiveRef.current;
      const isPointing = isPointingRef.current;
      const isMini = isMiniRef.current;

      // ── IF BOOSTER ACTIVE (When traveling to explain features: "jab samjhega feature tab jaate time") ──
      if (boosting) {
        pedro.position.set(0, -0.05 + Math.sin(t * 8) * 0.04, 0);
        pedro.rotation.x = -0.28 + Math.sin(t * 8) * 0.06; // Aerodynamic forward rocket tilt
        pedro.rotation.y = Math.sin(t * 4) * 0.25; // Banking yaw
        pedro.rotation.z = 0;
        pedro.scale.set(1, 1, 1);

        // Reset head and body hierarchy to normal
        if (headGroupRef.current) {
          headGroupRef.current.position.set(0, 1.2, 0);
          headGroupRef.current.scale.set(1, 1, 1);
          headGroupRef.current.rotation.set(0, 0, 0);
        }
        if (bodyGroupRef.current) {
          bodyGroupRef.current.scale.set(1, 1, 1);
        }
        if (eyesGroupRef.current) {
          eyesGroupRef.current.position.set(0, 0, 0);
        }

        // Arms swept back like rocket wings
        if (lArmRef.current) {
          lArmRef.current.position.set(-0.48, 0.15, -0.15);
          lArmRef.current.rotation.set(-0.5, 0, -0.7 + Math.sin(t * 10) * 0.1);
        }
        if (rArmRef.current && !isPointing) {
          rArmRef.current.position.set(0.48, 0.15, -0.15);
          rArmRef.current.rotation.set(-0.5, 0, 0.7 - Math.sin(t * 10) * 0.1);
        }
        if (leg1Ref.current) {
          leg1Ref.current.position.set(-0.18, -0.55, 0);
          leg1Ref.current.rotation.set(0.32, 0, 0.06);
        }
        if (leg2Ref.current) {
          leg2Ref.current.position.set(0.18, -0.55, 0);
          leg2Ref.current.rotation.set(0.32, 0, -0.06);
        }

        // Keep thrusters directly under feet
        if (nozzle1Ref.current && leg1Ref.current) {
          nozzle1Ref.current.position.set(leg1Ref.current.position.x, leg1Ref.current.position.y - 0.17, leg1Ref.current.position.z);
        }
        if (nozzle2Ref.current && leg2Ref.current) {
          nozzle2Ref.current.position.set(leg2Ref.current.position.x, leg2Ref.current.position.y - 0.17, leg2Ref.current.position.z);
        }
        if (flame1Ref.current && leg1Ref.current) {
          flame1Ref.current.position.set(leg1Ref.current.position.x, leg1Ref.current.position.y - 0.27, leg1Ref.current.position.z);
          const fL = 2.4 + Math.random() * 0.7 + Math.sin(t * 30) * 0.4;
          flame1Ref.current.scale.set(1.5, fL, 1.5);
        }
        if (flame2Ref.current && leg2Ref.current) {
          flame2Ref.current.position.set(leg2Ref.current.position.x, leg2Ref.current.position.y - 0.27, leg2Ref.current.position.z);
          const fL = 2.4 + Math.random() * 0.7 + Math.sin(t * 30) * 0.4;
          flame2Ref.current.scale.set(1.5, fL, 1.5);
        }

        // Hide book during booster flight
        if (bookGroupRef.current) {
          bookGroupRef.current.scale.set(0.001, 0.001, 0.001);
        }

        controls.update();
        renderer.render(scene, camera);
        animFrameIdRef.current = requestAnimationFrame(animate);
        return;
      }

      // ── 6 AUTO-CYCLING FUNNY EMOTES ENGINE (THROTTLED & PACED) ──
      // Includes the requested "Book nikalega aur padhega" study emote!
      // In mini mode (header icon): disable heavy emotes completely
      // In normal mode: spaced out gracefully to 18-second cycles (4.2s emote, ~14s tranquil rest)
      const EMOTE_CYCLE = 18000;
      const EMOTE_PLAY_TIME = 4200;
      const emoteIndex = Math.floor(now / EMOTE_CYCLE) % 6;
      const timeInCycle = now % EMOTE_CYCLE;

      // Also throttle auto-emotes during active user interaction (scrolling/reading/typing in last 1.5s)
      const userActiveRecently = (now - lastUserActivityRef.current) < 1500;
      const isEmoteActive = !isMini && !userActiveRecently && timeInCycle < EMOTE_PLAY_TIME;

      // Base gentle floating
      pedro.position.y = -0.05 + Math.sin(t * 1.8) * 0.045;
      pedro.rotation.x = 0;
      const baseScale = (levelRef.current || 1) >= 4 ? 1.04 : 1.0;
      pedro.scale.set(baseScale, baseScale, baseScale);

      // Default ambient thrusters (idle shimmer)
      const idleFlameLen = 0.45 + Math.sin(t * 12) * 0.12;
      if (flame1Ref.current) flame1Ref.current.scale.set(0.7, idleFlameLen, 0.7);
      if (flame2Ref.current) flame2Ref.current.scale.set(0.7, idleFlameLen, 0.7);

      if (isEmoteActive) {
        const p = timeInCycle / EMOTE_PLAY_TIME; // 0.0 to 1.0
        if (emoteIndex !== 5 && bookGroupRef.current) {
          bookGroupRef.current.scale.set(0.001, 0.001, 0.001);
        }

        if (emoteIndex === 0) {
          // ── EMOTE 0: GIANT DETACHABLE HEAD BLOB (User's specific emote!) ──
          // "apna mundi aone haatho ukhar ke fekega aur ushka haath pair alag aur mundi ab bara ho jayega phir haath pair bara mundi me jur jayega"
          if (p < 0.22) {
            // Phase A: Hands reach up to neck/head to unhook
            const r = p / 0.22;
            if (lArmRef.current) {
              lArmRef.current.position.set(-0.52 + r * 0.08, 0.22 + r * 0.85, r * 0.18);
              lArmRef.current.rotation.set(0, 0, -0.2 - r * 0.7);
            }
            if (rArmRef.current && !isPointing) {
              rArmRef.current.position.set(0.55 - r * 0.08, 0.28 + r * 0.80, r * 0.18);
              rArmRef.current.rotation.set(0, 0, 0.3 + r * 0.7);
            }
            if (headGroupRef.current) {
              headGroupRef.current.rotation.z = Math.sin(r * Math.PI * 5) * 0.06;
            }
          } else if (p < 0.42) {
            // Phase B: Pops & tosses head into the air, body collapses/scales down
            const toss = (p - 0.22) / 0.20;
            if (headGroupRef.current) {
              headGroupRef.current.position.set(0, 1.2 + toss * 0.35, toss * 0.08);
              headGroupRef.current.rotation.x = toss * 0.2;
            }
            if (lArmRef.current) {
              lArmRef.current.position.set(-0.46, 1.07 + (1 - toss) * 0.2, 0.15);
            }
            if (rArmRef.current && !isPointing) {
              rArmRef.current.position.set(0.46, 1.07 + (1 - toss) * 0.2, 0.15);
            }
            const bScale = Math.max(0.01, 1 - toss * 1.5);
            if (bodyGroupRef.current) {
              bodyGroupRef.current.scale.set(bScale, bScale, bScale);
            }
          } else if (p < 0.78) {
            // Phase C: HEAD GROWS GIGANTIC! Arms and legs attach directly to the giant head!
            const giantP = (p - 0.42) / 0.36;
            const peakScale = 1.0 + Math.sin(giantP * Math.PI) * 0.38; // Proportional giant head that stays within view!
            if (headGroupRef.current) {
              headGroupRef.current.scale.set(peakScale, peakScale, peakScale);
              headGroupRef.current.position.set(0, 0.40 - (peakScale - 1.0) * 0.15, 0);
              headGroupRef.current.rotation.z = Math.sin(t * 9) * 0.18; // Happy giant head wobble
            }
            if (bodyGroupRef.current) {
              bodyGroupRef.current.scale.set(0.01, 0.01, 0.01);
            }
            // Arms attached directly to giant head sides
            const armAttachX = 0.72 * peakScale;
            const armWave = Math.sin(t * 14) * 0.35;
            if (lArmRef.current) {
              lArmRef.current.position.set(-armAttachX, 0.45 + armWave * 0.1, 0.1);
              lArmRef.current.rotation.set(0, 0, -0.6 + armWave);
            }
            if (rArmRef.current && !isPointing) {
              rArmRef.current.position.set(armAttachX, 0.45 - armWave * 0.1, 0.1);
              rArmRef.current.rotation.set(0, 0, 0.6 - armWave);
            }
            // Legs attached directly under giant head
            const legY = 0.45 - 0.65 * peakScale;
            if (leg1Ref.current) {
              leg1Ref.current.position.set(-0.25 * peakScale, legY, 0);
              leg1Ref.current.rotation.set(Math.sin(t * 12) * 0.3, 0, 0);
            }
            if (leg2Ref.current) {
              leg2Ref.current.position.set(0.25 * peakScale, legY, 0);
              leg2Ref.current.rotation.set(-Math.sin(t * 12) * 0.3, 0, 0);
            }
            if (smileRef.current) {
              smileRef.current.scale.set(1.4, 1.4, 1);
            }
          } else {
            // Phase D: Snap Reassembly back to normal Pedro!
            const reassemble = (p - 0.78) / 0.22;
            const ease = reassemble * reassemble * (3 - 2 * reassemble);
            if (headGroupRef.current) {
              const curS = 1.0 + (1 - ease) * 0.3;
              headGroupRef.current.scale.set(curS, curS, curS);
              headGroupRef.current.position.set(0, THREE.MathUtils.lerp(0.40, 1.2, ease), 0);
              headGroupRef.current.rotation.z = THREE.MathUtils.lerp(headGroupRef.current.rotation.z, 0, ease);
            }
            if (bodyGroupRef.current) {
              bodyGroupRef.current.scale.set(ease, ease, ease);
            }
            if (lArmRef.current) {
              lArmRef.current.position.set(THREE.MathUtils.lerp(-1.0, -0.52, ease), THREE.MathUtils.lerp(0.45, 0.22, ease), 0);
              lArmRef.current.rotation.set(0, 0, THREE.MathUtils.lerp(-0.6, -0.2, ease));
            }
            if (rArmRef.current && !isPointing) {
              rArmRef.current.position.set(THREE.MathUtils.lerp(1.0, 0.55, ease), THREE.MathUtils.lerp(0.45, 0.28, ease), 0.18);
              rArmRef.current.rotation.set(0, 0, THREE.MathUtils.lerp(0.6, 0.3, ease));
            }
            if (leg1Ref.current) {
              leg1Ref.current.position.set(THREE.MathUtils.lerp(-0.35, -0.18, ease), THREE.MathUtils.lerp(-0.75, -0.55, ease), 0);
              leg1Ref.current.rotation.set(0, 0, 0);
            }
            if (leg2Ref.current) {
              leg2Ref.current.position.set(THREE.MathUtils.lerp(0.35, 0.18, ease), THREE.MathUtils.lerp(-0.75, -0.55, ease), 0);
              leg2Ref.current.rotation.set(0, 0, 0);
            }
          }
        } else if (emoteIndex === 1) {
          // ── EMOTE 1: HELICOPTER PROPELLER ANTENNA FLIGHT ──
          if (antennaGroupRef.current) {
            antennaGroupRef.current.rotation.y += 1.4; // High-speed helicopter propeller blur
          }
          const liftP = Math.sin(p * Math.PI);
          pedro.position.y = -0.05 + liftP * 0.44 + Math.sin(t * 18) * 0.03;
          if (lArmRef.current) {
            lArmRef.current.rotation.set(0, 0, -1.2 + Math.sin(t * 12) * 0.35);
          }
          if (rArmRef.current && !isPointing) {
            rArmRef.current.rotation.set(0, 0, 1.2 + Math.cos(t * 12) * 0.35);
          }
          if (leg1Ref.current) {
            leg1Ref.current.rotation.set(Math.sin(t * 8) * 0.35, 0, 0.12);
          }
          if (leg2Ref.current) {
            leg2Ref.current.rotation.set(-Math.sin(t * 8) * 0.35, 0, -0.12);
          }
          if (headGroupRef.current) {
            headGroupRef.current.rotation.z = Math.sin(t * 6) * 0.1;
          }
        } else if (emoteIndex === 2) {
          // ── EMOTE 2: EXCITED SPARKLE & JOYFUL NOD (Eyes stay safely fitted inside face, no pop-out!) ──
          if (p < 0.2) {
            if (eyesGroupRef.current) {
              eyesGroupRef.current.position.set(0, 0, 0);
              eyesGroupRef.current.scale.set(1, 1, 1);
            }
          } else if (p < 0.7) {
            const joyP = (p - 0.2) / 0.5;
            const eyeJoyScale = 1 + 0.15 * Math.sin(joyP * Math.PI);
            if (eyesGroupRef.current) {
              eyesGroupRef.current.position.set(0, 0, 0); // Strictly at z=0 (inside head), never popping out!
              eyesGroupRef.current.scale.set(eyeJoyScale, eyeJoyScale, 1);
            }
            if (smileRef.current) {
              smileRef.current.scale.set(1.35, 1.35, 1);
              smileRef.current.position.y = 0.90;
            }
            if (headGroupRef.current) {
              headGroupRef.current.rotation.z = Math.sin(t * 12) * 0.08;
            }
            // Joyful hands cheering
            if (lArmRef.current) {
              lArmRef.current.position.set(-0.46, 0.65, 0.15);
              lArmRef.current.rotation.set(-0.4, 0.2, -0.3);
            }
            if (rArmRef.current && !isPointing) {
              rArmRef.current.position.set(0.46, 0.65, 0.15);
              rArmRef.current.rotation.set(-0.4, -0.2, 0.3);
            }
          } else {
            if (eyesGroupRef.current) {
              eyesGroupRef.current.position.set(0, 0, 0);
              eyesGroupRef.current.scale.set(1, 1, 1);
            }
            if (smileRef.current) {
              smileRef.current.scale.set(1, 1, 1);
              smileRef.current.position.y = 0.92;
            }
          }
        } else if (emoteIndex === 3) {
          // ── EMOTE 3: BREAKDANCE HEADSPIN (720° Spin) ──
          if (p < 0.15) {
            pedro.position.y = -0.15;
          } else if (p < 0.75) {
            const spinP = (p - 0.15) / 0.6;
            pedro.rotation.z = Math.PI; // Inverted upside down resting on top cap/antenna
            pedro.position.y = 1.28 + Math.sin(spinP * Math.PI) * 0.08;
            pedro.rotation.y = spinP * Math.PI * 4; // 720° spin
            if (leg1Ref.current) {
              leg1Ref.current.rotation.set(Math.sin(t * 12) * 0.3, 0, 0.75);
            }
            if (leg2Ref.current) {
              leg2Ref.current.rotation.set(-Math.sin(t * 12) * 0.3, 0, -0.75);
            }
            if (lArmRef.current) lArmRef.current.rotation.set(0, 0, 0.8);
            if (rArmRef.current && !isPointing) rArmRef.current.rotation.set(0, 0, -0.8);
          } else {
            const land = (p - 0.75) / 0.25;
            pedro.rotation.z = (1 - land) * Math.PI;
            pedro.position.y = THREE.MathUtils.lerp(1.28, -0.05, land);
            if (rArmRef.current && !isPointing) {
              rArmRef.current.rotation.set(0, 0, 1.2); // Victory pose!
            }
          }
        } else if (emoteIndex === 4) {
          // ── EMOTE 4: SNEEZEFLIP & ROCKET HICCUP ──
          if (p < 0.32) {
            const windup = p / 0.32;
            pedro.scale.set(1.0 + windup * 0.2, 1.0 - windup * 0.25, 1.0 + windup * 0.2);
            if (headGroupRef.current) {
              headGroupRef.current.rotation.x = -windup * 0.35;
              headGroupRef.current.position.y = 1.2 - windup * 0.15;
            }
          } else if (p < 0.70) {
            // Sneeze recoil triggers backflip + booster puff
            const flipP = (p - 0.32) / 0.38;
            pedro.scale.set(1, 1, 1);
            pedro.rotation.x = -flipP * Math.PI * 2; // 360° backflip!
            pedro.position.y = -0.05 + Math.sin(flipP * Math.PI) * 0.78;
            const flameBlast = Math.sin(flipP * Math.PI) * 2.8;
            if (flame1Ref.current) flame1Ref.current.scale.set(1.4, flameBlast, 1.4);
            if (flame2Ref.current) flame2Ref.current.scale.set(1.4, flameBlast, 1.4);
          } else {
            const recover = (p - 0.70) / 0.3;
            pedro.rotation.x = 0;
            pedro.position.y = -0.05;
            if (headGroupRef.current) {
              headGroupRef.current.rotation.set(0, Math.sin(recover * Math.PI * 4) * 0.25, 0);
              headGroupRef.current.position.set(0, 1.2, 0);
            }
          }
        } else if (emoteIndex === 5 || poseRef.current === 'reading') {
          // ── EMOTE 5: "BOOK NIKALEGA AUR PADHEGA" (Study Book Reading Emote!) ──
          // "Book nikalega aur padhega ye bhi ek emote dalo"
          if (p < 0.22) {
            // Phase A: Reaches behind into backpack/pocket to pull out the book
            const pull = p / 0.22;
            if (lArmRef.current) {
              lArmRef.current.position.set(-0.52, 0.22 - pull * 0.25, -pull * 0.35);
              lArmRef.current.rotation.set(-pull * 0.9, 0, -0.4);
            }
            if (rArmRef.current && !isPointing) {
              rArmRef.current.position.set(0.55, 0.28 - pull * 0.25, -pull * 0.35);
              rArmRef.current.rotation.set(-pull * 0.9, 0, 0.4);
            }
            if (headGroupRef.current) {
              headGroupRef.current.rotation.set(0.08, Math.sin(pull * Math.PI) * 0.25, 0);
            }
            if (bookGroupRef.current) {
              bookGroupRef.current.scale.set(0.001, 0.001, 0.001);
            }
          } else if (p < 0.38) {
            // Phase B: Brings book forward! Book pops open & expands smoothly in front of him
            const present = (p - 0.22) / 0.16;
            const easePresent = Math.sin(present * Math.PI * 0.5);
            const popScale = Math.min(1.0, easePresent * 1.15);
            if (bookGroupRef.current) {
              bookGroupRef.current.scale.set(popScale, popScale, popScale);
              bookGroupRef.current.position.set(0, THREE.MathUtils.lerp(0.02, 0.16, easePresent), THREE.MathUtils.lerp(0.2, 0.46, easePresent));
              bookGroupRef.current.rotation.set(-0.28, 0, 0);
            }
            // Hands transition to hold the left and right sides of the book
            if (lArmRef.current) {
              lArmRef.current.position.set(-0.38, 0.16, 0.42);
              lArmRef.current.rotation.set(-0.35, 0.25, 0.45);
            }
            if (rArmRef.current && !isPointing) {
              rArmRef.current.position.set(0.38, 0.16, 0.42);
              rArmRef.current.rotation.set(-0.35, -0.25, -0.45);
            }
            if (headGroupRef.current) {
              headGroupRef.current.rotation.set(0.2, 0, 0);
            }
          } else if (p < 0.80) {
            // Phase C: READING INTENTLY! Head tilts down, eyes sweep left-to-right scanning lines,
            // head nods with understanding ("Aha! Samajh gaya!"), antenna twirls with brainpower
            const readP = (p - 0.38) / 0.42;
            const eyeScan = Math.sin(readP * Math.PI * 9) * 0.04;
            const nod = 0.22 + Math.sin(readP * Math.PI * 12) * 0.04;
            if (headGroupRef.current) {
              headGroupRef.current.rotation.set(nod, eyeScan * 0.6, 0);
            }
            if (eyesGroupRef.current) {
              eyesGroupRef.current.position.set(eyeScan, 0, 0);
            }
            if (bookGroupRef.current) {
              bookGroupRef.current.scale.set(1, 1, 1);
              bookGroupRef.current.position.set(0, 0.16 + Math.sin(t * 6) * 0.015, 0.46);
              bookGroupRef.current.rotation.set(-0.28 + Math.sin(t * 5) * 0.025, eyeScan * 0.25, 0);
            }
            // Left hand holds left page firmly
            if (lArmRef.current) {
              lArmRef.current.position.set(-0.36, 0.16, 0.43);
              lArmRef.current.rotation.set(-0.35, 0.22, 0.45);
            }
            // Right hand does subtle page-turn / bookmark adjustments
            if (rArmRef.current && !isPointing) {
              const turnPage = Math.sin(readP * Math.PI * 6) > 0.65 ? 0.05 : 0;
              rArmRef.current.position.set(0.36 - turnPage, 0.16 + turnPage * 0.5, 0.43 + turnPage);
              rArmRef.current.rotation.set(-0.35, -0.22, -0.45);
            }
            // Antenna sparkles / turns like active learning processor
            if (antennaGroupRef.current) {
              antennaGroupRef.current.rotation.y = Math.sin(t * 14) * 0.45;
            }
            if (smileRef.current) {
              smileRef.current.scale.set(1.15, 0.9, 1);
            }
          } else {
            // Phase D: Snaps book closed, victory/satisfied smile, and tucks it away back in bag
            const closeP = (p - 0.80) / 0.20;
            const shrink = Math.max(0.001, (1 - closeP * 1.3));
            if (bookGroupRef.current) {
              bookGroupRef.current.scale.set(shrink, shrink, shrink);
              bookGroupRef.current.position.set(0, 0.16 - closeP * 0.25, 0.46 - closeP * 0.35);
            }
            if (headGroupRef.current) {
              headGroupRef.current.rotation.set(THREE.MathUtils.lerp(0.22, 0, closeP), 0, 0);
            }
            if (eyesGroupRef.current) {
              eyesGroupRef.current.position.set(0, 0, 0);
            }
            if (smileRef.current) {
              smileRef.current.scale.set(1.35, 1.25, 1); // Big proud study smile!
            }
            if (lArmRef.current) {
              lArmRef.current.position.set(THREE.MathUtils.lerp(-0.36, -0.52, closeP), THREE.MathUtils.lerp(0.16, 0.22, closeP), 0);
              lArmRef.current.rotation.set(0, 0, -0.2);
            }
            if (rArmRef.current && !isPointing) {
              // Cheerful thumbs-up wave acknowledging study completion!
              rArmRef.current.position.set(THREE.MathUtils.lerp(0.36, 0.55, closeP), THREE.MathUtils.lerp(0.16, 0.45, closeP), THREE.MathUtils.lerp(0.43, 0.2, closeP));
              rArmRef.current.rotation.set(0, 0, THREE.MathUtils.lerp(-0.45, 0.95, closeP));
            }
          }
        }
      } else {
        // ── REST / IDLE TRANQUIL SWAY BETWEEN EMOTES ──
        if (bookGroupRef.current) {
          bookGroupRef.current.scale.set(0.001, 0.001, 0.001);
        }
        if (headGroupRef.current) {
          headGroupRef.current.position.set(0, 1.2, 0);
          headGroupRef.current.scale.set(1, 1, 1);
          headGroupRef.current.rotation.set(0, 0, 0);
        }
        if (bodyGroupRef.current) {
          bodyGroupRef.current.scale.set(1, 1, 1);
        }
        if (eyesGroupRef.current) {
          eyesGroupRef.current.position.set(0, 0, 0);
        }
        if (antennaGroupRef.current) {
          antennaGroupRef.current.rotation.y = 0;
        }
        if (smileRef.current) {
          smileRef.current.scale.set(1, 1, 1);
          smileRef.current.position.y = 0.92;
        }

        const gentle = Math.sin(t * 3.2);
        if (lArmRef.current) {
          lArmRef.current.position.set(-0.52, 0.22, 0);
          lArmRef.current.rotation.set(gentle * 0.1, 0, -0.22 + gentle * 0.18);
        }
        if (rArmRef.current && !isPointing) {
          rArmRef.current.position.set(0.55, 0.28, 0.18);
          rArmRef.current.rotation.set(-gentle * 0.1, 0, 0.28 + gentle * 0.2);
        }
        if (leg1Ref.current) {
          leg1Ref.current.position.set(-0.18, -0.55, 0);
          leg1Ref.current.rotation.set(Math.sin(t * 2.8) * 0.12, 0, 0);
        }
        if (leg2Ref.current) {
          leg2Ref.current.position.set(0.18, -0.55, 0);
          leg2Ref.current.rotation.set(-Math.sin(t * 2.8) * 0.12, 0, 0);
        }
        pedro.rotation.y = (t * 0.35) % (Math.PI * 2);
      }

      // Sync nozzles and flames to feet
      if (leg1Ref.current) {
        if (nozzle1Ref.current) nozzle1Ref.current.position.set(leg1Ref.current.position.x, leg1Ref.current.position.y - 0.17, leg1Ref.current.position.z);
        if (flame1Ref.current) flame1Ref.current.position.set(leg1Ref.current.position.x, leg1Ref.current.position.y - 0.27, leg1Ref.current.position.z);
      }
      if (leg2Ref.current) {
        if (nozzle2Ref.current) nozzle2Ref.current.position.set(leg2Ref.current.position.x, leg2Ref.current.position.y - 0.17, leg2Ref.current.position.z);
        if (flame2Ref.current) flame2Ref.current.position.set(leg2Ref.current.position.x, leg2Ref.current.position.y - 0.27, leg2Ref.current.position.z);
      }

      // ── MOUTH ANIMATION & NARAJ ("MUH LATKA KE") EXPRESSIONS ──
      const curPose = poseRef.current;
      // Pedro always maintains cheerful, friendly posture (no sulking or grumpy mouth)
      // Mouth animation with Teeth ("Daant") & Tongue ("Muh")
      if (mouthGroupRef.current) {
        if (isSpeakingRef.current) {
          // Speaking animation revealing teeth and pink tongue moving dynamically
          mouthGroupRef.current.rotation.z = 0;
          mouthGroupRef.current.position.set(0, -0.28, 0.58);
          mouthGroupRef.current.scale.set(1 + Math.sin(t * 8) * 0.18, 1 + Math.sin(t * 8) * 0.42, 1);
        } else {
          // Cheerful friendly smile with pearly white teeth visible
          mouthGroupRef.current.rotation.z = 0;
          mouthGroupRef.current.position.set(0, -0.28, 0.58);
          mouthGroupRef.current.scale.set(1, 1, 1);
        }
      }

      if (lEyeGroupRef.current && lEyeGroupRef.current.rotation.z !== 0) lEyeGroupRef.current.rotation.z = 0;
      if (rEyeGroupRef.current && rEyeGroupRef.current.rotation.z !== 0) rEyeGroupRef.current.rotation.z = 0;

      // ── SPECIAL POSE OVERRIDES ('sleep', 'toss_head', 'headless_booster') ──
      if (curPose === 'sleep') {
        // Sleep pose: tranquil gentle breathing, closed eyelids, head tilted comfortably, thrusters off
        const sleepBreathe = Math.sin(t * 1.5) * 0.02;
        pedro.position.y = -0.05 + sleepBreathe;
        pedro.rotation.x = 0.08;
        pedro.rotation.z = 0.08;
        if (headGroupRef.current) {
          headGroupRef.current.position.set(0, 1.18, 0);
          headGroupRef.current.scale.set(1, 1, 1);
          headGroupRef.current.rotation.set(0.15, 0, 0.12);
        }
        if (bodyGroupRef.current) bodyGroupRef.current.scale.set(1, 1, 1);
        if (eyesGroupRef.current) {
          // Closed peaceful eyelids
          eyesGroupRef.current.position.set(0, -0.05, 0);
          eyesGroupRef.current.scale.set(1, 0.15, 1);
        }
        if (smileRef.current) {
          smileRef.current.scale.set(0.75, 0.35, 1);
        }
        if (lArmRef.current) {
          lArmRef.current.position.set(-0.48, 0.12, 0.1);
          lArmRef.current.rotation.set(0.2, 0, -0.1);
        }
        if (rArmRef.current) {
          rArmRef.current.position.set(0.48, 0.12, 0.1);
          rArmRef.current.rotation.set(0.2, 0, 0.1);
        }
        if (flame1Ref.current) flame1Ref.current.scale.set(0.001, 0.001, 0.001);
        if (flame2Ref.current) flame2Ref.current.scale.set(0.001, 0.001, 0.001);
        if (bookGroupRef.current) bookGroupRef.current.scale.set(0.001, 0.001, 0.001);
      } else if (curPose === 'toss_head') {
        // Pedro unhooks his head with both hands and tosses it up towards top bar!
        const tossT = (t * 2.8) % Math.PI;
        const tossH = Math.sin(tossT);
        if (headGroupRef.current) {
          headGroupRef.current.position.set(0, 1.2 + tossH * 1.6, 0.15);
          headGroupRef.current.rotation.x = tossH * 0.45;
          headGroupRef.current.scale.set(1, 1, 1);
        }
        if (lArmRef.current) {
          lArmRef.current.position.set(-0.46, 1.15, 0.2);
          lArmRef.current.rotation.set(-0.6, 0, -0.4);
        }
        if (rArmRef.current) {
          rArmRef.current.position.set(0.46, 1.15, 0.2);
          rArmRef.current.rotation.set(-0.6, 0, 0.4);
        }
        if (flame1Ref.current) flame1Ref.current.scale.set(0.001, 0.001, 0.001);
        if (flame2Ref.current) flame2Ref.current.scale.set(0.001, 0.001, 0.001);
        if (bookGroupRef.current) bookGroupRef.current.scale.set(0.001, 0.001, 0.001);
      } else if (curPose === 'headless_booster') {
        // Body with head detached, maximum booster flame blast flying upward!
        pedro.rotation.x = -0.55; // Steep upward rocket tilt
        pedro.position.y = -0.05 + Math.sin(t * 18) * 0.04;
        if (headGroupRef.current) {
          headGroupRef.current.scale.set(0.001, 0.001, 0.001); // Head detached
        }
        if (bodyGroupRef.current) bodyGroupRef.current.scale.set(1, 1, 1);
        if (lArmRef.current) {
          lArmRef.current.position.set(-0.48, 0.15, -0.15);
          lArmRef.current.rotation.set(-0.5, 0, -0.7);
        }
        if (rArmRef.current) {
          rArmRef.current.position.set(0.48, 0.15, -0.15);
          rArmRef.current.rotation.set(-0.5, 0, 0.7);
        }
        const flameL = 3.2 + Math.random() * 0.6;
        if (flame1Ref.current) flame1Ref.current.scale.set(2.0, flameL, 2.0);
        if (flame2Ref.current) flame2Ref.current.scale.set(2.0, flameL, 2.0);
        if (bookGroupRef.current) bookGroupRef.current.scale.set(0.001, 0.001, 0.001);
      } else if (curPose === 'wink' || curPose === 'smile_wink' || isWinkingRef.current) {
        // Pedro smiles broadly and playfully winks ("aur dekh ke smile karefa aankh matkayega")
        if (headGroupRef.current) {
          headGroupRef.current.position.set(0, 1.2, 0);
          headGroupRef.current.rotation.set(Math.sin(t * 3) * 0.08, Math.sin(t * 2) * 0.12, Math.sin(t * 3.5) * 0.12);
        }
        if (antennaGroupRef.current) {
          antennaGroupRef.current.rotation.z = Math.sin(t * 14) * 0.28;
        }
        // Right eye cute cartoon wink
        if (rEyeGroupRef.current) {
          rEyeGroupRef.current.scale.set(1.05, 0.08, 1);
        }
        // Left eye wide sparkling pupil
        if (lEyeGroupRef.current) {
          lEyeGroupRef.current.scale.set(1.22, 1.22, 1.22);
        }
        // Beaming happy smile
        if (smileRef.current) {
          smileRef.current.scale.set(1.4, 1.4, 1.4);
        }
        if (bookGroupRef.current) bookGroupRef.current.scale.set(0.001, 0.001, 0.001);
      }

      // ── 5. VISUAL EVOLUTION BY LEVEL (LEVELS 1 - 8) ──
      const effectiveLvl = levelRef.current || 1;

      // Head-only display when specifically requested (e.g., small sleep icon in top bar)
      if (headOnlyRef.current) {
        if (bodyGroupRef.current) bodyGroupRef.current.visible = false;
        if (lArmRef.current) lArmRef.current.visible = false;
        if (rArmRef.current) rArmRef.current.visible = false;
        if (leg1Ref.current) leg1Ref.current.visible = false;
        if (leg2Ref.current) leg2Ref.current.visible = false;
        if (nozzle1Ref.current) nozzle1Ref.current.visible = false;
        if (nozzle2Ref.current) nozzle2Ref.current.visible = false;
        if (flame1Ref.current) flame1Ref.current.visible = false;
        if (flame2Ref.current) flame2Ref.current.visible = false;
        if (bookGroupRef.current) bookGroupRef.current.visible = false;
        if (backBoosterGroupRef.current) backBoosterGroupRef.current.visible = false;
        if (headGroupRef.current && curPose !== 'toss_head') {
          headGroupRef.current.visible = true;
          headGroupRef.current.position.set(0, 1.20, 0); // centered for head-only look at camera target
        }
      } else {
        // Normal friendly full mascot body (never a scary severed head)
        if (bodyGroupRef.current && curPose !== 'toss_head' && curPose !== 'headless_booster') {
          bodyGroupRef.current.visible = true;
        }
        if (lArmRef.current && curPose !== 'headless_booster') {
          lArmRef.current.visible = true;
        }
        if (rArmRef.current && curPose !== 'headless_booster') {
          rArmRef.current.visible = true;
        }
        if (headGroupRef.current && curPose !== 'toss_head') {
          headGroupRef.current.visible = true;
          if (!isEmoteActive || emoteIndex !== 0) {
            headGroupRef.current.position.set(0, 1.2, 0);
          }
        }

        // Mascot legs & thruster boots
        if (leg1Ref.current) leg1Ref.current.visible = true;
        if (leg2Ref.current) leg2Ref.current.visible = true;
        if (nozzle1Ref.current) nozzle1Ref.current.visible = true;
        if (nozzle2Ref.current) nozzle2Ref.current.visible = true;
        if (flame1Ref.current) flame1Ref.current.visible = isBoosterActiveRef.current;
        if (flame2Ref.current) flame2Ref.current.visible = isBoosterActiveRef.current;

        // Level 6+: Back booster with fire ("level 6 headphone pahnega aur booster lag jayenge pichhe aag ke saath")
        if (backBoosterGroupRef.current) {
          backBoosterGroupRef.current.visible = effectiveLvl >= 6;
        }
      }

      // Level 5+: Stylish glasses ("level 5 chasma pahnega")
      if (glassesGroupRef.current) {
        glassesGroupRef.current.visible = effectiveLvl >= 5;
      }

      // Level 6+: DJ Headphones ("level 6 headphone pahnega")
      if (headphonesGroupRef.current) {
        headphonesGroupRef.current.visible = effectiveLvl >= 6;
      }

      // Level 8: Golden Champion Crown 👑 ("sar pe fit hoga aur phir normal ho jayega")
      if (crownGroupRef.current) {
        crownGroupRef.current.visible = effectiveLvl >= 8;
        if (effectiveLvl >= 8) {
          // Fits directly on head dome snugly in its normal resting position
          crownGroupRef.current.position.set(0, 0.48, 0);
          crownGroupRef.current.rotation.set(0, 0, 0);
        }
      }

      // Dynamic fire flame flicker on back booster for Level 6+ (Supercharged on Level 8 Overdrive)
      if (effectiveLvl >= 6 && backFlame1Ref.current && backFlame2Ref.current) {
        const isSuper = effectiveLvl >= 8;
        const bPulse = (isSuper ? 1.4 : 1.0) + Math.sin(t * (isSuper ? 28 : 22)) * (isSuper ? 0.42 : 0.28);
        const flameWidth = isSuper ? 1.3 : 1.0;
        backFlame1Ref.current.scale.set(flameWidth, bPulse, flameWidth);
        backFlame2Ref.current.scale.set(flameWidth, bPulse, flameWidth);
      }

      // Level 7+: NSTA Magic Book with vanish & reappear ("level 7 nsta ka book lega haath me aur gayab karega")
      if (effectiveLvl >= 7 && bookGroupRef.current && !isBoosterActiveRef.current && !headOnlyRef.current && effectiveLvl >= 2) {
        // 6.5-second magical cycle
        const magicCycle = (now % 6500) / 6500; // 0 to 1
        // 0.0 to 0.58: Book held proudly in hand (scale = 1.0)
        // 0.58 to 0.68: Book spins & shrinks into thin air! (scale 1.0 -> 0)
        // 0.68 to 0.82: Completely vanished / gayab! (scale = 0.001)
        // 0.82 to 0.92: Magically pops back with sparkle bounce! (scale 0 -> 1.15 -> 1.0)
        let bookScale = 1.0;
        let bookRotZ = -0.15;
        if (magicCycle >= 0.58 && magicCycle < 0.68) {
          const vanishP = (magicCycle - 0.58) / 0.10;
          bookScale = Math.max(0.001, 1.0 - vanishP);
          bookRotZ = -0.15 + vanishP * Math.PI * 2;
        } else if (magicCycle >= 0.68 && magicCycle < 0.82) {
          bookScale = 0.001; // Gayab!
        } else if (magicCycle >= 0.82 && magicCycle < 0.92) {
          const popP = (magicCycle - 0.82) / 0.10;
          bookScale = Math.min(1.0, popP * 1.18);
          bookRotZ = -0.15 + (1.0 - popP) * Math.PI;
        }
        bookGroupRef.current.scale.set(bookScale, bookScale, bookScale);
        bookGroupRef.current.position.set(-0.35, 0.22, 0.32);
        bookGroupRef.current.rotation.set(0.3, 0.4, bookRotZ);
        bookGroupRef.current.visible = true;

        // Position left arm to hold the book
        if (lArmRef.current && !isEmoteActive) {
          lArmRef.current.position.set(-0.48, 0.26, 0.22);
          lArmRef.current.rotation.set(0.65, 0, -0.35);
        }
      } else if (effectiveLvl < 7 && !isEmoteActive && bookGroupRef.current) {
        bookGroupRef.current.scale.set(0.001, 0.001, 0.001);
        bookGroupRef.current.visible = false;
      }

      controls.update();
      renderer.render(scene, camera);
      animFrameIdRef.current = requestAnimationFrame(animate);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    // ── 6. CLEANUP ──
    return () => {
      try {
        if (animFrameIdRef.current) {
          cancelAnimationFrame(animFrameIdRef.current);
        }
        if (typeof document !== 'undefined' && handleVisibilityChange) {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
        if (observer) {
          observer.disconnect();
        }
        if (domEl) {
          if (handleStartDrag) {
            domEl.removeEventListener('pointerdown', handleStartDrag);
            domEl.removeEventListener('touchstart', handleStartDrag);
          }
          if (handleEndDrag) {
            domEl.removeEventListener('pointerup', handleEndDrag);
            domEl.removeEventListener('touchend', handleEndDrag);
          }
        }
        if (controls) {
          try { controls.dispose(); } catch {}
        }
        if (renderer) {
          try { renderer.dispose(); } catch {}
        }
        if (domEl && container && container.contains(domEl)) {
          container.removeChild(domEl);
        }
      } catch (cleanErr) {
        console.warn('[Pedro3DMascot] Cleanup warning:', cleanErr);
      }
    };
    } catch (err) {
      console.warn('[Pedro3DMascot] WebGL initialization failed, switching to 2D fallback:', err);
      setHasWebGLError(true);
    }
  }, [size]);

  if (hasWebGLError) {
    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
        }}
        className={`relative select-none flex items-center justify-center ${className}`}
        onClick={onClick}
        title="Pedro Mascot"
      >
        <div className="w-full h-full rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 flex flex-col items-center justify-center p-1 border border-indigo-500/30 shadow-sm relative overflow-hidden group">
          {/* Animated 2D Mascot */}
          <div className="relative flex flex-col items-center">
            {/* Antenna */}
            <div className="w-0.5 h-2 bg-indigo-400 relative flex items-center justify-center">
              <div className="absolute -top-1 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <div className="absolute -top-1 w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400" />
            </div>
            {/* Robot Head */}
            <div className="w-7 h-6 rounded-lg bg-gradient-to-b from-indigo-600 to-slate-900 flex items-center justify-center gap-1 border border-indigo-400/40 shadow-inner px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee] animate-pulse" />
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee] animate-pulse" />
            </div>
            {/* Robot Smile */}
            <div className="w-3.5 h-0.5 rounded-full bg-cyan-300 mt-0.5" />
          </div>
          {isSpeaking && (
            <span className="absolute -bottom-1 text-[8px] font-black text-amber-500 animate-bounce">💬</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        cursor: isRotatable ? 'grab' : 'default',
        touchAction: 'none'
      }}
      className={`relative select-none flex items-center justify-center ${className}`}
      onClick={onClick}
      title="Pedro 3D Mascot (Rocket Booster & 360° Rotate)"
    />
  );
};

// Memoize Pedro3DMascot to prevent unnecessary re-renders when parent state updates
export const Pedro3DMascot = React.memo(Pedro3DMascotComponent, (prev, next) => {
  return (
    prev.size === next.size &&
    prev.pose === next.pose &&
    prev.isSpeaking === next.isSpeaking &&
    prev.isPointing === next.isPointing &&
    prev.isDragging === next.isDragging &&
    prev.isMini === next.isMini &&
    prev.isRotatable === next.isRotatable &&
    prev.autoSpin360 === next.autoSpin360 &&
    prev.isBoosterActive === next.isBoosterActive &&
    prev.headOnly === next.headOnly &&
    prev.isNaraj === next.isNaraj &&
    prev.level === next.level &&
    prev.colorScheme === next.colorScheme &&
    prev.className === next.className
  );
});
