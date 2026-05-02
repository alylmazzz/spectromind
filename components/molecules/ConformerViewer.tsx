'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import for Three.js (client-side only)
let THREE: any = null;
if (typeof window !== 'undefined') {
  THREE = require('three');
}

export interface Conformer {
  id: number;
  energy: number;
  weight: number;
  coordinates: Array<{
    atomIndex: number;
    element: string;
    x: number;
    y: number;
    z: number;
  }>;
}

interface ConformerViewerProps {
  conformers: Conformer[];
  selectedConformer?: number;
  onConformerSelect?: (id: number) => void;
  height?: number;
  showEnergy?: boolean;
  showWeight?: boolean;
}

/**
 * 3D Conformer Viewer Component
 * 
 * Displays 3D molecular conformers using Three.js
 */
export default function ConformerViewer({
  conformers,
  selectedConformer = 0,
  onConformerSelect,
  height = 400,
  showEnergy = true,
  showWeight = true
}: ConformerViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Color map for elements
  const elementColors: Record<string, number> = {
    'H': 0xffffff,
    'C': 0x909090,
    'N': 0x3050f8,
    'O': 0xff0d0d,
    'S': 0xffff30,
    'P': 0xff8000,
    'F': 0x90e050,
    'Cl': 0x1ff01f,
    'Br': 0xa62929,
    'I': 0x940094
  };

  // Atom radius map
  const elementRadii: Record<string, number> = {
    'H': 0.3,
    'C': 0.7,
    'N': 0.65,
    'O': 0.6,
    'S': 1.0,
    'P': 1.0,
    'F': 0.5,
    'Cl': 1.0,
    'Br': 1.15,
    'I': 1.4
  };

  useEffect(() => {
    if (!containerRef.current || conformers.length === 0 || !THREE) return;

    // Initialize Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / height,
      0.1,
      1000
    );
    camera.position.set(0, 0, 10);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, height);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    setIsInitialized(true);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [height, conformers.length]);

  useEffect(() => {
    if (!isInitialized || !sceneRef.current || conformers.length === 0) return;

    // Clear previous molecules
    const objectsToRemove: THREE.Object3D[] = [];
    sceneRef.current.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        objectsToRemove.push(object);
      }
    });
    objectsToRemove.forEach(obj => sceneRef.current?.remove(obj));

    // Get selected conformer
    const conformer = conformers[selectedConformer] || conformers[0];
    if (!conformer) return;

    // Center coordinates
    const coords = conformer.coordinates;
    const center = { x: 0, y: 0, z: 0 };
    coords.forEach(c => {
      center.x += c.x;
      center.y += c.y;
      center.z += c.z;
    });
    center.x /= coords.length;
    center.y /= coords.length;
    center.z /= coords.length;

    // Create atoms (spheres)
    coords.forEach(coord => {
      const color = elementColors[coord.element] || 0x808080;
      const radius = elementRadii[coord.element] || 0.5;

      const geometry = new THREE.SphereGeometry(radius, 16, 16);
      const material = new THREE.MeshPhongMaterial({ color });
      const sphere = new THREE.Mesh(geometry, material);

      sphere.position.set(
        coord.x - center.x,
        coord.y - center.y,
        coord.z - center.z
      );

      sceneRef.current?.add(sphere);
    });

    // Create bonds (lines) - simplified: connect atoms within 2.0 Å
    const bondGeometry = new THREE.BufferGeometry();
    const bondPositions: number[] = [];

    for (let i = 0; i < coords.length; i++) {
      for (let j = i + 1; j < coords.length; j++) {
        const dx = coords[i].x - coords[j].x;
        const dy = coords[i].y - coords[j].y;
        const dz = coords[i].z - coords[j].z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance < 2.0) {
          // Bond found
          bondPositions.push(
            coords[i].x - center.x, coords[i].y - center.y, coords[i].z - center.z,
            coords[j].x - center.x, coords[j].y - center.y, coords[j].z - center.z
          );
        }
      }
    }

    if (bondPositions.length > 0) {
      bondGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bondPositions, 3));
      const bondMaterial = new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 2 });
      const bonds = new THREE.LineSegments(bondGeometry, bondMaterial);
      sceneRef.current?.add(bonds);
    }

    // Animation loop
    let angle = 0;
    const animate = () => {
      angle += 0.01;
      if (cameraRef.current) {
        cameraRef.current.position.x = Math.sin(angle) * 10;
        cameraRef.current.position.z = Math.cos(angle) * 10;
        cameraRef.current.lookAt(0, 0, 0);
      }
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

  }, [isInitialized, selectedConformer, conformers]);

  const selected = conformers[selectedConformer] || conformers[0];

  return (
    <div className="w-full">
      {/* Conformer Selector */}
      {conformers.length > 1 && (
        <div className="mb-4 p-2 bg-gray-100 rounded">
          <label className="block text-sm font-medium mb-2">
            Select Conformer ({conformers.length} total):
          </label>
          <select
            value={selectedConformer}
            onChange={(e) => onConformerSelect?.(parseInt(e.target.value))}
            className="w-full p-2 border rounded"
          >
            {conformers.map((conf, idx) => (
              <option key={conf.id} value={idx}>
                Conformer {conf.id} - Energy: {conf.energy.toFixed(2)} kcal/mol
                {showWeight && ` - Weight: ${(conf.weight * 100).toFixed(1)}%`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 3D Viewer */}
      <div
        ref={containerRef}
        style={{ height: `${height}px`, width: '100%' }}
        className="border rounded"
      />

      {/* Conformer Info */}
      {selected && (
        <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
          <div className="grid grid-cols-2 gap-2">
            {showEnergy && (
              <div>
                <span className="font-semibold">Energy:</span> {selected.energy.toFixed(4)} kcal/mol
              </div>
            )}
            {showWeight && (
              <div>
                <span className="font-semibold">Weight:</span> {(selected.weight * 100).toFixed(2)}%
              </div>
            )}
            <div>
              <span className="font-semibold">Atoms:</span> {selected.coordinates.length}
            </div>
            <div>
              <span className="font-semibold">ID:</span> {selected.id}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

