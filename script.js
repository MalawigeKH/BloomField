import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ---------- GAME STATE ----------
let coins = 200;
let seeds = 5;
let stones = 0;
let stonePrice = 25;
let isRaining = false;
let rainParticles = null;
let activeButterflies = [];
let activeCrow = null;

let isAiming = false;
let originalCameraPos = null;
let originalCameraTarget = null;
let selectedQuantity = 1;

// Flower Types
const FLOWER_TYPES = [
    { name: "Rose", baseValue: 18, icon: "🌹", color: 0xff4d6d, petalColor: 0xff6b8a, centerColor: 0xffdd88, shape: "rose", growTime: 45 },
    { name: "Tulip", baseValue: 14, icon: "🌷", color: 0xff7b54, petalColor: 0xff9b74, centerColor: 0xffcc88, shape: "tulip", growTime: 40 },
    { name: "Daisy", baseValue: 12, icon: "🌸", color: 0xfff0c0, petalColor: 0xfff5cc, centerColor: 0xffcc55, shape: "daisy", growTime: 35 },
    { name: "Lily", baseValue: 22, icon: "💮", color: 0xdda0dd, petalColor: 0xeebbee, centerColor: 0xffdd99, shape: "lily", growTime: 50 },
    { name: "Sunflower", baseValue: 25, icon: "🌻", color: 0xffcc33, petalColor: 0xffdd66, centerColor: 0xcc8844, shape: "sunflower", growTime: 55 },
    { name: "Lavender", baseValue: 16, icon: "💜", color: 0x9b77b0, petalColor: 0xb89ad0, centerColor: 0xeeccee, shape: "lavender", growTime: 42 },
    { name: "Orchid", baseValue: 28, icon: "🪷", color: 0xff69b4, petalColor: 0xff88cc, centerColor: 0xffaadd, shape: "orchid", growTime: 60 }
];

const RARE_FLOWER = { name: "✨ Starflower ✨", baseValue: 100, icon: "🌟", color: 0xff66ff, petalColor: 0xffaaff, centerColor: 0xffddff, shape: "star", growTime: 75, rare: true };

// --- 3D Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 10, 28);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.left = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.zoomSpeed = 1.0;
controls.rotateSpeed = 0.8;
controls.maxPolarAngle = Math.PI / 2.3;
controls.minPolarAngle = Math.PI / 4;
controls.minDistance = 12;
controls.maxDistance = 40;
controls.target.set(0, 2, 0);

// --- CLOUDS - moving around the land ---
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
let clouds = [];

function createSkyCloud() {
    const size = 0.7 + Math.random() * 1.1;
    const group = new THREE.Group();
    const p1 = new THREE.Mesh(new THREE.SphereGeometry(size * 0.8, 7, 7), cloudMat);
    const p2 = new THREE.Mesh(new THREE.SphereGeometry(size * 0.6, 7, 7), cloudMat);
    p2.position.set(0.7 * size, -0.2 * size, 0.4 * size);
    const p3 = new THREE.Mesh(new THREE.SphereGeometry(size * 0.6, 7, 7), cloudMat);
    p3.position.set(-0.6 * size, -0.2 * size, 0.3 * size);
    group.add(p1, p2, p3);
    
    const radius = 40 + Math.random() * 60;
    const angle = Math.random() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    group.position.set(x, 9 + Math.random() * 6, z);
    group.scale.set(1.2, 0.8, 1);
    group.userData = { speedX: (Math.random() - 0.5) * 0.008, speedZ: (Math.random() - 0.5) * 0.008 };
    scene.add(group);
    clouds.push(group);
}

// Initialize clouds
for (let i = 0; i < 35; i++) {
    createSkyCloud();
}

function updateClouds() {
    const HORIZON_Y = 6.5;  // Below this = over land area
    
    for (let i = clouds.length - 1; i >= 0; i--) {
        const cloud = clouds[i];
        
        // Move cloud
        cloud.position.x += cloud.userData.speedX;
        cloud.position.z += cloud.userData.speedZ;
        
        // Check if cloud drifted over land (low Y) or too far
        const isOverLand = cloud.position.y < HORIZON_Y;
        const isTooFar = Math.abs(cloud.position.x) > 110 || Math.abs(cloud.position.z) > 110;
        
        if (isOverLand || isTooFar) {
            // Remove cloud (it went over land or too far)
            scene.remove(cloud);
            clouds.splice(i, 1);
            // Create a new cloud in the sky
            createSkyCloud();
        }
    }
}

// --- Ground ---
const groundMat = new THREE.MeshStandardMaterial({ color: 0x6aab4a, roughness: 0.8 });
const roundLand = new THREE.Mesh(new THREE.CircleGeometry(60, 48), groundMat);
roundLand.rotation.x = -Math.PI / 2;
roundLand.position.y = -0.15;
roundLand.receiveShadow = true;
scene.add(roundLand);

// --- Grass ---
const grassMatSmall = new THREE.MeshStandardMaterial({ color: 0x5a9e3a });
for (let i = 0; i < 3000; i++) {
    const rad = Math.random() * 58;
    const ang = Math.random() * Math.PI * 2;
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.14, 3), grassMatSmall);
    grass.position.set(Math.cos(ang) * rad, -0.12, Math.sin(ang) * rad);
    grass.castShadow = true;
    scene.add(grass);
}

// --- Lighting ---
const ambient = new THREE.AmbientLight(0x7a9a7a);
scene.add(ambient);
const sunLight = new THREE.DirectionalLight(0xfff5e0, 1.0);
sunLight.position.set(15, 22, 8);
sunLight.castShadow = true;
scene.add(sunLight);
const fillLight = new THREE.PointLight(0x88aaff, 0.4);
fillLight.position.set(0, 6, 0);
scene.add(fillLight);

// --- Particles ---
const particleCount = 1500;
const particleGeo = new THREE.BufferGeometry();
const particlePositions = [];
for (let i = 0; i < particleCount; i++) {
    const rad = Math.random() * 56;
    const ang = Math.random() * Math.PI * 2;
    particlePositions.push(Math.cos(ang) * rad, Math.random() * 4, Math.sin(ang) * rad);
}
particleGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(particlePositions), 3));
const particles = new THREE.Points(particleGeo, new THREE.PointsMaterial({ color: 0xffccaa, size: 0.06, transparent: true, opacity: 0.4 }));
scene.add(particles);

// --- Garden Manager ---
const garden = {
    seedlings: [], buds: [], blooms: [], wildFlowers: [],
    occupied: new Set(),
    
    getRandomEmptySpot() {
        for (let tries = 0; tries < 150; tries++) {
            const rad = Math.random() * 54;
            const ang = Math.random() * Math.PI * 2;
            const x = Math.cos(ang) * rad;
            const z = Math.sin(ang) * rad;
            let conflict = false;
            for (let key of this.occupied) {
                const [ox, oz] = key.split(',');
                if (Math.hypot(parseFloat(ox) - x, parseFloat(oz) - z) < 1.2) { conflict = true; break; }
            }
            if (!conflict) return new THREE.Vector3(x, 0, z);
        }
        return null;
    },
    
    addSeedling(pos) {
        const s = new Seedling(pos, scene);
        this.seedlings.push(s);
        this.occupied.add(`${pos.x},${pos.z}`);
    },
    
    removeFlower(flower, fromBlooms = true) {
        const idx = fromBlooms ? this.blooms.indexOf(flower) : this.wildFlowers.indexOf(flower);
        if (idx !== -1) {
            if (fromBlooms) this.blooms.splice(idx, 1);
            else this.wildFlowers.splice(idx, 1);
        }
        this.occupied.delete(`${flower.position.x},${flower.position.z}`);
        flower.remove();
    }
};

// --- Seedling and Bud Classes ---
class Seedling {
    constructor(position, scene) {
        this.position = position.clone();
        this.scene = scene;
        this.growthProgress = 0;
        this.growTime = 35;
        this.lastUpdate = Date.now();
        const dotMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B });
        this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), dotMat);
        this.mesh.position.copy(this.position);
        this.mesh.position.y = -0.04;
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
    }
    updateGrowth() {
        const now = Date.now();
        let delta = Math.min(1, (now - this.lastUpdate) / 1000);
        this.lastUpdate = now;
        let speedMultiplier = isRaining ? 5.0 : 0.2;
        const increment = (delta / this.growTime) * 100 * speedMultiplier;
        this.growthProgress += increment;
        return this.growthProgress >= 100;
    }
    remove() { if (this.mesh) this.scene.remove(this.mesh); }
}

class Bud {
    constructor(flowerType, position, scene) {
        this.type = flowerType;
        this.position = position.clone();
        this.scene = scene;
        this.growthProgress = 0;
        this.growTime = this.type.growTime;
        this.lastUpdate = Date.now();
        const group = new THREE.Group();
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x6aab4a });
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.55, 5), stemMat);
        stem.position.y = 0.2;
        group.add(stem);
        const budMat = new THREE.MeshStandardMaterial({ color: this.type.color, emissive: 0x336633 });
        const bud = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), budMat);
        bud.position.y = 0.55;
        group.add(bud);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x5a9e3e });
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;
            const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 4), leafMat);
            leaf.position.set(Math.cos(angle) * 0.16, 0.45, Math.sin(angle) * 0.16);
            leaf.rotation.z = angle;
            group.add(leaf);
        }
        group.position.copy(this.position);
        this.meshGroup = group;
        this.scene.add(group);
    }
    updateGrowth() {
        const now = Date.now();
        let delta = Math.min(1, (now - this.lastUpdate) / 1000);
        this.lastUpdate = now;
        let speedMultiplier = isRaining ? 4.0 : 0.2;
        const increment = (delta / this.growTime) * 100 * speedMultiplier;
        this.growthProgress += increment;
        return this.growthProgress >= 100;
    }
    remove() { if (this.meshGroup) this.scene.remove(this.meshGroup); }
}

// --- Blooming Flower with Glow ---
class BloomingFlower {
    constructor(flowerType, position, scene, isFromRareButterfly = false) {
        this.type = { ...flowerType };
        this.position = position.clone();
        this.scene = scene;
        this.meshGroup = null;
        this.glowLight = null;
        this.enhanced = isFromRareButterfly;
        this.enhancedByRareButterfly = false;
        this.value = isFromRareButterfly ? this.type.baseValue * 2 : this.type.baseValue;
        this.type.value = this.value;
        this.createBloomMesh();
        if (this.type.rare || this.enhanced) this.addGlow();
    }
    
    enhanceValue() {
        if (!this.enhancedByRareButterfly) {
            this.enhancedByRareButterfly = true;
            this.enhanced = true;
            this.value = this.type.baseValue * 2;
            this.type.value = this.value;
            this.addGlow();
        }
    }
    
    addGlowEffect() { this.addGlow(); }
    
    addGlow() {
        if (this.glowLight) return;
        this.glowLight = new THREE.PointLight(0xffaa44, 0.9, 5);
        this.glowLight.position.copy(this.position);
        this.glowLight.position.y += 0.6;
        this.scene.add(this.glowLight);
        this.glowIntensity = 0.9;
        this.glowDirection = 0.02;
    }
    
    updateGlow() {
        if (this.glowLight) {
            this.glowIntensity += this.glowDirection;
            if (this.glowIntensity >= 1.3) this.glowDirection = -0.02;
            if (this.glowIntensity <= 0.5) this.glowDirection = 0.02;
            this.glowLight.intensity = this.glowIntensity;
        }
    }
    
    createBloomMesh() {
        const group = new THREE.Group();
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x6aab4a });
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.65, 5), stemMat);
        stem.position.y = 0.2;
        group.add(stem);
        const petalMat = new THREE.MeshStandardMaterial({ color: this.type.petalColor, emissive: (this.type.rare || this.enhanced) ? 0xffaa44 : 0x442200, emissiveIntensity: (this.type.rare || this.enhanced) ? 0.5 : 0.05 });
        
        if (this.type.shape === "rose") {
            for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const petal = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), petalMat);
                const rad = 0.35 * (layer === 0 ? 0.9 : 1.1);
                petal.position.set(Math.cos(angle) * rad, 0.58 + layer * 0.05, Math.sin(angle) * rad);
                petal.scale.set(0.7, 0.5, 0.4);
                group.add(petal);
            }
            const center = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffdd88 }));
            center.position.y = 0.62;
            group.add(center);
        } else if (this.type.shape === "tulip") {
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const petal = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 8), petalMat);
                petal.position.set(Math.cos(angle) * 0.28, 0.65, Math.sin(angle) * 0.28);
                petal.rotation.x = 0.3;
                group.add(petal);
            }
        } else if (this.type.shape === "daisy") {
            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * Math.PI * 2;
                const petal = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.35), petalMat);
                petal.position.set(Math.cos(angle) * 0.45, 0.6, Math.sin(angle) * 0.45);
                petal.rotation.z = angle;
                group.add(petal);
            }
            const center = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffdd88 }));
            center.position.y = 0.6;
            group.add(center);
        } else if (this.type.shape === "lily") {
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const petal = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 8), petalMat);
                petal.position.set(Math.cos(angle) * 0.35, 0.68, Math.sin(angle) * 0.35);
                petal.rotation.x = 0.4;
                group.add(petal);
            }
        } else if (this.type.shape === "sunflower") {
            for (let i = 0; i < 16; i++) {
                const angle = (i / 16) * Math.PI * 2;
                const petal = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 6), petalMat);
                petal.position.set(Math.cos(angle) * 0.55, 0.62, Math.sin(angle) * 0.55);
                petal.rotation.z = angle;
                group.add(petal);
            }
        } else if (this.type.shape === "lavender") {
            for (let h = 0; h < 5; h++) for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                const smallFlower = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), petalMat);
                smallFlower.position.set(Math.cos(angle) * 0.12, 0.5 + h * 0.12, Math.sin(angle) * 0.12);
                group.add(smallFlower);
            }
        } else if (this.type.shape === "orchid") {
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                const petal = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), petalMat);
                petal.position.set(Math.cos(angle) * 0.32, 0.65, Math.sin(angle) * 0.28);
                group.add(petal);
            }
        } else if (this.type.shape === "star") {
            for (let i = 0; i < 10; i++) {
                const angle = (i / 10) * Math.PI * 2;
                const petal = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.65, 5), petalMat);
                petal.position.set(Math.cos(angle) * 0.48, 0.68, Math.sin(angle) * 0.48);
                petal.rotation.z = angle;
                group.add(petal);
            }
            const starCenter = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffdd99, emissive: 0xffaa88, emissiveIntensity: 0.5 }));
            starCenter.position.y = 0.68;
            group.add(starCenter);
        }
        const leafMatGreen = new THREE.MeshStandardMaterial({ color: 0x5a9e3e });
        const leaf1 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 4), leafMatGreen);
        leaf1.position.set(0.2, 0.3, 0);
        leaf1.rotation.z = 0.8;
        group.add(leaf1);
        const leaf2 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 4), leafMatGreen);
        leaf2.position.set(-0.2, 0.3, 0);
        leaf2.rotation.z = -0.8;
        group.add(leaf2);
        group.position.copy(this.position);
        this.meshGroup = group;
        this.scene.add(group);
    }
    
    harvest() { const val = this.value; this.remove(); return val; }
    remove() {
        if (this.meshGroup) this.scene.remove(this.meshGroup);
        if (this.glowLight) this.scene.remove(this.glowLight);
    }
}

// --- Magic Butterfly with Glow (10% rare) ---
class MagicButterfly {
    constructor(scene, gardenRef, onComplete, isRare = false) {
        this.scene = scene;
        this.garden = gardenRef;
        this.onComplete = onComplete;
        this.isRare = isRare;
        this.duplicationsLeft = 3;
        this.mesh = null;
        this.glowLight = null;
        this.state = "findingFlower";
        this.sourceFlower = null;
        this.targetPosition = null;
        this.circleAngle = 0;
        this.circleRadius = 1.8;
        this.circleHeight = 3.5;
        this.circleCenter = null;
        this.circleTime = 0;
        this.speed = 0.022;
        this.wingColor = isRare ? 0xffaa44 : [0xff69b4, 0xffcc33, 0x66ccff, 0xaa66ff][Math.floor(Math.random() * 4)];
        this.position = new THREE.Vector3((Math.random() - 0.5) * 40, 2.5, (Math.random() - 0.5) * 40);
        this.createMesh();
        if (isRare) this.addGlow();
        this.findRandomFlower();
        if (isRare) showMessage(`✨🌟 RARE GLOWING BUTTERFLY appears! It will enhance flowers! ✨🌟`);
    }
    
    addGlow() {
        this.glowLight = new THREE.PointLight(0xffaa44, 0.9, 6);
        this.glowLight.position.copy(this.position);
        this.scene.add(this.glowLight);
        this.glowIntensity = 0.9;
        this.glowDirection = 0.02;
    }
    
    updateGlow() {
        if (this.glowLight) {
            this.glowIntensity += this.glowDirection;
            if (this.glowIntensity >= 1.3) this.glowDirection = -0.02;
            if (this.glowIntensity <= 0.6) this.glowDirection = 0.02;
            this.glowLight.intensity = this.glowIntensity;
        }
    }
    
    createMesh() {
        const group = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x553322, emissive: this.isRare ? 0xffaa44 : 0x442200, emissiveIntensity: this.isRare ? 0.3 : 0 });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.28, 6), bodyMat);
        body.rotation.x = 0.3;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), bodyMat);
        head.position.set(0, 0.12, 0.12);
        group.add(head);
        const wingMat = new THREE.MeshStandardMaterial({ color: this.wingColor, emissive: this.isRare ? 0xffaa44 : this.wingColor, emissiveIntensity: this.isRare ? 0.35 : 0.2, transparent: true, opacity: 0.85 });
        this.leftWingUp = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.45, 12), wingMat);
        this.leftWingUp.rotation.z = -0.6;
        this.leftWingUp.position.set(-0.28, 0.05, 0);
        group.add(this.leftWingUp);
        this.rightWingUp = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.45, 12), wingMat);
        this.rightWingUp.rotation.z = 0.6;
        this.rightWingUp.position.set(0.28, 0.05, 0);
        group.add(this.rightWingUp);
        this.leftWingLow = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 10), wingMat);
        this.leftWingLow.rotation.z = -0.4;
        this.leftWingLow.position.set(-0.22, -0.08, 0.05);
        group.add(this.leftWingLow);
        this.rightWingLow = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 10), wingMat);
        this.rightWingLow.rotation.z = 0.4;
        this.rightWingLow.position.set(0.22, -0.08, 0.05);
        group.add(this.rightWingLow);
        const antMat = new THREE.MeshStandardMaterial({ color: 0x553322 });
        const ant1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 4), antMat);
        ant1.position.set(-0.06, 0.2, 0.15);
        ant1.rotation.z = -0.3;
        group.add(ant1);
        const ant2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 4), antMat);
        ant2.position.set(0.06, 0.2, 0.15);
        ant2.rotation.z = 0.3;
        group.add(ant2);
        this.mesh = group;
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
        this.wingFlap = Math.random() * Math.PI * 2;
    }
    
    findRandomFlower() {
        const allFlowers = [...this.garden.blooms, ...this.garden.wildFlowers];
        if (allFlowers.length === 0) { this.destroy(); return false; }
        this.sourceFlower = allFlowers[Math.floor(Math.random() * allFlowers.length)];
        this.targetPosition = this.sourceFlower.position.clone();
        this.targetPosition.y += 0.7;
        this.state = "flyingToFlower";
        return true;
    }
    
    findEmptySpot() {
        const emptySpot = this.garden.getRandomEmptySpot();
        if (!emptySpot) return false;
        this.targetPosition = emptySpot.clone();
        this.targetPosition.y += 0.6;
        this.circleCenter = this.targetPosition.clone();
        this.circleAngle = Math.random() * Math.PI * 2;
        this.circleTime = 0;
        this.state = "circling";
        return true;
    }
    
    update() {
        if (this.state === "destroyed") return;
        if (this.state === "findingFlower") { if (!this.findRandomFlower()) return; }
        if (this.state === "flyingToFlower") {
            const dx = this.targetPosition.x - this.mesh.position.x;
            const dz = this.targetPosition.z - this.mesh.position.z;
            const dy = this.targetPosition.y - this.mesh.position.y;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (dist < 0.3) {
                if (this.isRare && this.sourceFlower && !this.sourceFlower.enhancedByRareButterfly) {
                    this.sourceFlower.enhanceValue();
                    this.sourceFlower.addGlowEffect();
                    showMessage(`✨ Rare butterfly enhanced a ${this.sourceFlower.type.name}! Value doubled! ✨`);
                }
                if (!this.findEmptySpot()) { this.destroy(); return; }
            } else {
                this.mesh.position.x += dx * this.speed;
                this.mesh.position.z += dz * this.speed;
                this.mesh.position.y += dy * this.speed;
                const angle = Math.atan2(dx, dz);
                this.mesh.rotation.y = angle;
            }
        }
        else if (this.state === "circling") {
            this.circleTime += 0.02;
            this.circleAngle += 0.025;
            const circleX = Math.cos(this.circleAngle) * this.circleRadius;
            const circleZ = Math.sin(this.circleAngle) * this.circleRadius;
            const circleY = Math.sin(this.circleAngle * 1.5) * 0.6;
            const targetX = this.circleCenter.x + circleX;
            const targetZ = this.circleCenter.z + circleZ;
            const targetY = this.circleCenter.y + this.circleHeight + circleY;
            this.mesh.position.x += (targetX - this.mesh.position.x) * 0.05;
            this.mesh.position.z += (targetZ - this.mesh.position.z) * 0.05;
            this.mesh.position.y += (targetY - this.mesh.position.y) * 0.05;
            this.mesh.rotation.y = this.circleAngle;
            if (this.circleTime > 3.0) this.state = "landing";
        }
        else if (this.state === "landing") {
            const dx = this.circleCenter.x - this.mesh.position.x;
            const dz = this.circleCenter.z - this.mesh.position.z;
            const dy = (this.circleCenter.y + 0.3) - this.mesh.position.y;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (dist < 0.2) this.createDuplicateFlower();
            else {
                this.mesh.position.x += dx * 0.06;
                this.mesh.position.z += dz * 0.06;
                this.mesh.position.y += dy * 0.06;
                const angle = Math.atan2(dx, dz);
                this.mesh.rotation.y = angle;
            }
        }
        this.wingFlap += 0.06;
        const flap = Math.sin(this.wingFlap) * 0.45;
        if (this.leftWingUp) this.leftWingUp.rotation.z = -0.5 + flap * 0.35;
        if (this.rightWingUp) this.rightWingUp.rotation.z = 0.5 - flap * 0.35;
        if (this.leftWingLow) this.leftWingLow.rotation.z = -0.3 + flap * 0.25;
        if (this.rightWingLow) this.rightWingLow.rotation.z = 0.3 - flap * 0.25;
        this.mesh.position.y += Math.sin(this.wingFlap * 1.5) * 0.002;
        if (this.glowLight) { this.glowLight.position.copy(this.mesh.position); this.glowLight.position.y += 0.2; this.updateGlow(); }
    }
    
    createDuplicateFlower() {
        if (!this.sourceFlower || !this.sourceFlower.meshGroup) { this.destroy(); return; }
        let newFlower;
        if (this.isRare) {
            newFlower = new BloomingFlower(this.sourceFlower.type, this.circleCenter, this.scene, true);
            newFlower.enhanceValue();
            newFlower.addGlowEffect();
            showMessage(`✨🌟 Rare butterfly created a glowing ${newFlower.type.name}! Worth ${newFlower.value}💰! 🌟✨`);
        } else {
            newFlower = new BloomingFlower(this.sourceFlower.type, this.circleCenter, this.scene, false);
        }
        this.garden.blooms.push(newFlower);
        this.garden.occupied.add(`${this.circleCenter.x},${this.circleCenter.z}`);
        this.duplicationsLeft--;
        this.addSparkleEffect();
        updateUI();
        if (this.duplicationsLeft <= 0) { this.destroy(); if (this.onComplete) this.onComplete(); }
        else { this.findRandomFlower(); }
    }
    
    addSparkleEffect() {
        const sparkleMat = new THREE.PointsMaterial({ color: 0xffaa66, size: 0.08 });
        const positions = [];
        for (let i = 0; i < 35; i++) positions.push((Math.random() - 0.5) * 1.2, Math.random() * 1.2, (Math.random() - 0.5) * 1.2);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        const sparkles = new THREE.Points(geometry, sparkleMat);
        sparkles.position.copy(this.circleCenter);
        sparkles.position.y += 0.5;
        this.scene.add(sparkles);
        setTimeout(() => this.scene.remove(sparkles), 600);
    }
    
    destroy() {
        if (this.mesh) this.scene.remove(this.mesh);
        if (this.glowLight) this.scene.remove(this.glowLight);
        this.state = "destroyed";
        const index = activeButterflies.indexOf(this);
        if (index !== -1) activeButterflies.splice(index, 1);
        updateUI();
    }
}

// --- Giant Crow Class ---
class GiantCrow {
    constructor(scene, gardenRef) {
        this.scene = scene;
        this.garden = gardenRef;
        this.mesh = null;
        this.state = "descending";
        this.targetFlower = null;
        this.position = new THREE.Vector3((Math.random() - 0.5) * 40, 18, (Math.random() - 0.5) * 40);
        this.circleAngle = 0;
        this.circleRadius = 12;
        this.circleHeight = 15;
        this.circleTime = 0;
        this.attackTimer = 0;
        this.attackDuration = 3.5;
        this.createMesh();
        this.findRandomFlower();
        showMessage(`⚠️ A CROW appears! Click the stone button (🪨) to aim! ⚠️`);
        document.getElementById('crowWarning').style.display = 'flex';
    }
    
    createMesh() {
        const group = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 24), bodyMat);
        body.scale.set(1.1, 0.9, 1.3);
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), bodyMat);
        head.position.set(0, 0.45, 0.65);
        group.add(head);
        const beakMat = new THREE.MeshStandardMaterial({ color: 0xcc7722 });
        const beakTop = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 8), beakMat);
        beakTop.position.set(0, 0.38, 1.05);
        beakTop.rotation.x = 0.15;
        group.add(beakTop);
        const beakBottom = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 8), beakMat);
        beakBottom.position.set(0, 0.28, 1.0);
        beakBottom.rotation.x = -0.1;
        group.add(beakBottom);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0x440000 });
        const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), eyeMat);
        leftEye.position.set(-0.16, 0.55, 0.95);
        group.add(leftEye);
        const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), eyeMat);
        rightEye.position.set(0.16, 0.55, 0.95);
        group.add(rightEye);
        const pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), pupilMat);
        leftPupil.position.set(-0.16, 0.52, 1.02);
        group.add(leftPupil);
        const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), pupilMat);
        rightPupil.position.set(0.16, 0.52, 1.02);
        group.add(rightPupil);
        const wingMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
        this.leftWing = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.0, 12), wingMat);
        this.leftWing.position.set(-0.85, 0.05, 0);
        this.leftWing.rotation.z = 0.6;
        group.add(this.leftWing);
        this.rightWing = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.0, 12), wingMat);
        this.rightWing.position.set(0.85, 0.05, 0);
        this.rightWing.rotation.z = -0.6;
        group.add(this.rightWing);
        this.mesh = group;
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
        this.wingFlap = 0;
    }
    
    findRandomFlower() {
        const allFlowers = [...this.garden.blooms, ...this.garden.wildFlowers];
        if (allFlowers.length > 0) {
            this.targetFlower = allFlowers[Math.floor(Math.random() * allFlowers.length)];
        } else {
            this.targetFlower = null;
        }
    }
    
    update() {
        if (this.state === "destroyed") return;
        
        if (this.state === "descending") {
            if (!this.targetFlower || !this.targetFlower.meshGroup) {
                this.findRandomFlower();
                if (!this.targetFlower) {
                    this.state = "ascending";
                    return;
                }
            }
            const targetPos = this.targetFlower.position.clone();
            targetPos.y += 0.8;
            const dx = targetPos.x - this.mesh.position.x;
            const dz = targetPos.z - this.mesh.position.z;
            const dy = targetPos.y - this.mesh.position.y;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (dist < 0.8) {
                this.state = "attacking";
                this.attackTimer = 0;
            } else {
                this.mesh.position.x += dx * 0.02;
                this.mesh.position.z += dz * 0.02;
                this.mesh.position.y += dy * 0.02;
                const angle = Math.atan2(dx, dz);
                this.mesh.rotation.y = angle;
            }
        }
        else if (this.state === "attacking") {
            this.attackTimer += 0.016;
            if (this.attackTimer > this.attackDuration) {
                if (this.targetFlower && this.targetFlower.meshGroup) {
                    this.garden.removeFlower(this.targetFlower, this.garden.blooms.includes(this.targetFlower));
                    showMessage(`💀 Crow destroyed a flower! Use stone button! 💀`);
                    updateUI();
                }
                this.state = "ascending";
                this.circleAngle = Math.random() * Math.PI * 2;
                this.circleTime = 0;
            }
        }
        else if (this.state === "ascending") {
            const targetY = 16;
            const dy = targetY - this.mesh.position.y;
            if (Math.abs(dy) < 0.5) {
                this.state = "circling";
                this.circleTime = 0;
            } else {
                this.mesh.position.y += dy * 0.02;
            }
        }
        else if (this.state === "circling") {
            this.circleTime += 0.008;
            this.circleAngle += 0.015;
            const targetX = Math.sin(this.circleAngle) * this.circleRadius;
            const targetZ = Math.cos(this.circleAngle) * this.circleRadius;
            const targetY = this.circleHeight + Math.sin(this.circleAngle * 2) * 1.5;
            this.mesh.position.x += (targetX - this.mesh.position.x) * 0.025;
            this.mesh.position.z += (targetZ - this.mesh.position.z) * 0.025;
            this.mesh.position.y += (targetY - this.mesh.position.y) * 0.025;
            this.mesh.rotation.y = this.circleAngle;
            if (this.circleTime > 5) {
                this.findRandomFlower();
                if (this.targetFlower) {
                    this.state = "descending";
                } else {
                    this.circleTime = 0;
                }
            }
        }
        this.wingFlap += 0.06;
        const flap = Math.sin(this.wingFlap) * 0.5;
        if (this.leftWing) this.leftWing.rotation.z = 0.6 + flap * 0.4;
        if (this.rightWing) this.rightWing.rotation.z = -0.6 - flap * 0.4;
    }
    
    scareAway() {
        if (isAiming) finishAiming();
        this.destroy();
        showMessage(`🐦 Crow scared away! Garden is safe. 🐦`);
        document.getElementById('crowWarning').style.display = 'none';
    }
    
    destroy() {
        if (this.mesh) this.scene.remove(this.mesh);
        this.state = "destroyed";
        activeCrow = null;
    }
}

// --- Rain System ---
let rainSpawnInterval = null;

function createRain() {
    if (rainParticles) scene.remove(rainParticles);
    const rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(4000 * 3);
    for (let i = 0; i < 4000; i++) {
        const rad = Math.random() * 70;
        const ang = Math.random() * Math.PI * 2;
        rainPositions[i*3] = Math.cos(ang) * rad;
        rainPositions[i*3+1] = Math.random() * 25;
        rainPositions[i*3+2] = Math.sin(ang) * rad;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    rainParticles = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaaddff, size: 0.08, transparent: true, opacity: 0.6 }));
    scene.add(rainParticles);
    if (rainSpawnInterval) clearInterval(rainSpawnInterval);
    rainSpawnInterval = setInterval(() => {
        if (isRaining) {
            for (let i = 0; i < 2; i++) {
                const pos = garden.getRandomEmptySpot();
                if (pos) {
                    const isRare = Math.random() < 0.1;
                    const type = isRare ? RARE_FLOWER : FLOWER_TYPES[Math.floor(Math.random() * FLOWER_TYPES.length)];
                    const flower = new BloomingFlower(type, pos, scene, false);
                    garden.wildFlowers.push(flower);
                    garden.occupied.add(`${pos.x},${pos.z}`);
                    updateUI();
                }
            }
        }
    }, 4000);
}

function startRain() {
    if (isRaining) return;
    isRaining = true;
    createRain();
    scene.background.setHex(0x3a4a5a);
    sunLight.intensity = 0.35;
    document.getElementById('weatherIndicator').innerHTML = "🌧️ Raining!";
    setTimeout(() => {
        if (rainParticles) scene.remove(rainParticles);
        isRaining = false;
        scene.background.setHex(0x87CEEB);
        sunLight.intensity = 1.0;
        document.getElementById('weatherIndicator').innerHTML = "☀️ Sunny Day";
        if (rainSpawnInterval) { clearInterval(rainSpawnInterval); rainSpawnInterval = null; }
    }, 12000);
}

function scheduleRain() { setTimeout(() => { startRain(); scheduleRain(); }, 50000 + Math.random() * 60000); }

// --- Crow Spawner ---
function spawnCrow() {
    if (activeCrow === null && (garden.blooms.length + garden.wildFlowers.length) > 2) {
        activeCrow = new GiantCrow(scene, garden);
    }
}
setInterval(() => {
    if (activeCrow === null && (garden.blooms.length + garden.wildFlowers.length) > 2) {
        spawnCrow();
    }
}, 50000 + Math.random() * 30000);

// --- UI Update ---
function updateUI() {
    document.getElementById('coinAmount').innerText = Math.floor(coins);
    document.getElementById('seedCount').innerText = seeds;
    document.getElementById('seedlingCount').innerText = garden.seedlings.length;
    document.getElementById('budCount').innerText = garden.buds.length;
    document.getElementById('flowerCount').innerText = garden.blooms.length + garden.wildFlowers.length;
    document.getElementById('butterflyCount').innerText = activeButterflies.length;
    document.getElementById('stoneCount').innerText = stones;
    document.getElementById('stonePrice').innerText = stonePrice;
}

// --- Popup Functions ---
const popupOverlay = document.getElementById('popupOverlay');

function openBuyPopup() {
    selectedQuantity = 1;
    updateQuantityDisplay();
    popupOverlay.style.display = 'flex';
}

function closePopup() {
    popupOverlay.style.display = 'none';
}

function updateQuantityDisplay() {
    document.getElementById('quantityValue').innerText = selectedQuantity;
    document.getElementById('quantityAmount').innerText = selectedQuantity;
    document.getElementById('quantityPrice').innerText = selectedQuantity * 25;
}

function buyQuantity() {
    const cost = selectedQuantity * 25;
    if (coins >= cost) {
        coins -= cost;
        seeds += selectedQuantity;
        showMessage(`🌻 Bought ${selectedQuantity} seeds! Now ${seeds} seeds.`);
        updateUI();
        closePopup();
    } else {
        showMessage(`❌ Need ${cost}💰 for ${selectedQuantity} seeds!`);
    }
}

function buyMaxSeeds() {
    const maxSeeds = Math.floor(coins / 25);
    if (maxSeeds > 0) {
        const cost = maxSeeds * 25;
        coins -= cost;
        seeds += maxSeeds;
        showMessage(`🌻 Bought ${maxSeeds} seeds! Now ${seeds} seeds.`);
        updateUI();
        closePopup();
    } else {
        showMessage(`❌ Not enough coins to buy any seeds!`);
    }
}

// --- Stone Aiming System ---
const gunCrosshair = document.getElementById('gunCrosshair');
const gunCrosshairRing = document.getElementById('gunCrosshairRing');
const aimInstruction = document.getElementById('aimInstruction');

function startAiming() {
    if (!activeCrow) {
        showMessage(`🐦 No crow to aim at! Wait for one to appear.`);
        return;
    }
    if (stones === 0) {
        showMessage(`🪨 No stones! Buy one for ${stonePrice}💰`);
        return;
    }
    if (isAiming) return;
    
    originalCameraPos = camera.position.clone();
    originalCameraTarget = controls.target.clone();

    isAiming = true;
    gunCrosshair.style.display = 'block';
    gunCrosshairRing.style.display = 'block';
    aimInstruction.style.display = 'block';
    
    window.addEventListener('mousemove', updateCrosshair);
    window.addEventListener('touchmove', updateCrosshairTouch);
    
    showMessage(`🎯 AIM with mouse, then CLICK to shoot! 🎯`);
}

function updateCrosshair(e) {
    if (!isAiming) return;
    gunCrosshair.style.left = e.clientX + 'px';
    gunCrosshair.style.top = e.clientY + 'px';
    gunCrosshairRing.style.left = e.clientX + 'px';
    gunCrosshairRing.style.top = e.clientY + 'px';
}

function updateCrosshairTouch(e) {
    if (!isAiming) return;
    if (e.touches.length > 0) {
        gunCrosshair.style.left = e.touches[0].clientX + 'px';
        gunCrosshair.style.top = e.touches[0].clientY + 'px';
        gunCrosshairRing.style.left = e.touches[0].clientX + 'px';
        gunCrosshairRing.style.top = e.touches[0].clientY + 'px';
    }
}

function shootStone(e) {
    if (!isAiming) return;
    
    let clientX, clientY;
    if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    
    if (!activeCrow || !activeCrow.mesh) {
        finishAiming();
        showMessage(`🐦 Crow flew away!`);
        return;
    }
    
    const crowPos = activeCrow.mesh.position.clone();
    const vector = crowPos.project(camera);
    const crowScreenX = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const crowScreenY = (-vector.y * 0.5 + 0.5) * window.innerHeight;
    
    const dx = clientX - crowScreenX;
    const dy = clientY - crowScreenY;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    stones--;
    updateUI();
    
    createShootEffect(clientX, clientY);
    
    if (distance < 70) {
        if (activeCrow) activeCrow.scareAway();
        showMessage(`🎯 HIT! Crow scared away! 🎯`);
        createHitEffect(crowScreenX, crowScreenY);
    } else {
        showMessage(`🪨 MISSED! ${Math.round(distance)}px away. Buy another stone!`);
    }
    
    finishAiming();
}

function createShootEffect(x, y) {
    const flash = document.createElement('div');
    flash.innerHTML = '💥';
    flash.style.position = 'fixed';
    flash.style.left = x + 'px';
    flash.style.top = y + 'px';
    flash.style.fontSize = '30px';
    flash.style.transform = 'translate(-50%, -50%)';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '502';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 200);
    
    const stoneFly = document.createElement('div');
    stoneFly.innerHTML = '🪨';
    stoneFly.style.position = 'fixed';
    stoneFly.style.left = x + 'px';
    stoneFly.style.top = y + 'px';
    stoneFly.style.fontSize = '28px';
    stoneFly.style.transform = 'translate(-50%, -50%)';
    stoneFly.style.pointerEvents = 'none';
    stoneFly.style.zIndex = '502';
    stoneFly.style.transition = 'all 0.15s ease-out';
    document.body.appendChild(stoneFly);
    setTimeout(() => stoneFly.style.opacity = '0', 10);
    setTimeout(() => stoneFly.remove(), 200);
}

function createHitEffect(x, y) {
    const hit = document.createElement('div');
    hit.innerHTML = '💢';
    hit.style.position = 'fixed';
    hit.style.left = x + 'px';
    hit.style.top = y + 'px';
    hit.style.fontSize = '40px';
    hit.style.transform = 'translate(-50%, -50%)';
    hit.style.pointerEvents = 'none';
    hit.style.zIndex = '502';
    document.body.appendChild(hit);
    setTimeout(() => hit.remove(), 300);
}

function finishAiming() {
    isAiming = false;
    gunCrosshair.style.display = 'none';
    gunCrosshairRing.style.display = 'none';
    aimInstruction.style.display = 'none';
    
    if (originalCameraPos && originalCameraTarget) {
        camera.position.copy(originalCameraPos);
        controls.target.copy(originalCameraTarget);
        controls.update();
    }
    
    window.removeEventListener('mousemove', updateCrosshair);
    window.removeEventListener('touchmove', updateCrosshairTouch);
}

function onWindowClick(e) {
    if (isAiming) shootStone(e);
}

window.addEventListener('click', onWindowClick);

// --- Game Actions ---
function buyStone() {
    if (coins >= stonePrice) {
        coins -= stonePrice;
        stones++;
        stonePrice = Math.floor(stonePrice * 1.4);
        updateUI();
        showMessage(`🪨 Bought a stone! Click the stone button (🪨) to aim!`);
    } else {
        showMessage(`❌ Need ${stonePrice}💰 for a stone!`);
    }
}

function plantAllSeeds() {
    if (seeds === 0) { showMessage("❌ No seeds!"); return; }
    let planted = 0;
    const toPlant = seeds;
    for (let i = 0; i < toPlant; i++) {
        const pos = garden.getRandomEmptySpot();
        if (!pos) { showMessage("🌿 Garden full!"); break; }
        garden.addSeedling(pos);
        planted++;
    }
    seeds = 0;
    updateUI();
    showMessage(`🌱 Planted ${planted} seeds`);
}

function buyAndReleaseButterfly() {
    if (coins >= 80) {
        coins -= 80;
        updateUI();
        const isRare = Math.random() < 0.1;
        const butterfly = new MagicButterfly(scene, garden, () => { updateUI(); }, isRare);
        activeButterflies.push(butterfly);
        if (isRare) showMessage(`✨🌟 RARE GLOWING BUTTERFLY RELEASED! ✨🌟`);
        else showMessage(`🦋 Butterfly released`);
    } else { showMessage(`❌ Need 80💰`); }
}

function sellAllBlooms() {
    let total = 0;
    [...garden.blooms, ...garden.wildFlowers].forEach(f => { total += f.value; garden.removeFlower(f, garden.blooms.includes(f)); });
    coins += total;
    showMessage(`💐 Sold all blooms! +${total}💰`);
    updateUI();
}

function findClickedFlower(px, py) {
    const mouse = new THREE.Vector2();
    mouse.x = (px / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(py / renderer.domElement.clientHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const allMeshes = [];
    const flowerMap = new Map();
    [...garden.blooms, ...garden.wildFlowers].forEach(f => {
        if (f.meshGroup) { allMeshes.push(f.meshGroup); flowerMap.set(f.meshGroup, f); }
    });
    const hits = raycaster.intersectObjects(allMeshes, true);
    if (hits.length) {
        let hit = hits[0].object;
        while (hit && !allMeshes.includes(hit)) hit = hit.parent;
        if (hit && flowerMap.has(hit)) return flowerMap.get(hit);
    }
    return null;
}

function handleFlowerClick(e) {
    if (isAiming) return;
    const clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
    const clientY = e.clientY ?? (e.touches ? e.touches[0].clientY : 0);
    const flower = findClickedFlower(clientX, clientY);
    if (flower) {
        const val = flower.harvest();
        garden.removeFlower(flower, garden.blooms.includes(flower));
        coins += val;
        showMessage(`💐 +${val}💰 ${flower.type.name}`);
        updateUI();
    }
}

let msgTimeout;
function showMessage(msg) {
    const msgDiv = document.getElementById('gameMessage');
    msgDiv.innerText = `✨ ${msg} ✨`;
    if (msgTimeout) clearTimeout(msgTimeout);
    msgTimeout = setTimeout(() => { msgDiv.innerText = ""; }, 2500);
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    particles.rotation.y += 0.002;
    updateClouds();
    for (let i = 0; i < activeButterflies.length; i++) activeButterflies[i].update();
    if (activeCrow) activeCrow.update();
    for (let flower of garden.blooms) if ((flower.type.rare || flower.enhanced) && flower.updateGlow) flower.updateGlow();
    for (let flower of garden.wildFlowers) if ((flower.type.rare || flower.enhanced) && flower.updateGlow) flower.updateGlow();
    if (rainParticles) {
        const posAttr = rainParticles.geometry.attributes.position.array;
        for (let i = 0; i < posAttr.length / 3; i++) { posAttr[i*3+1] -= 0.12; if (posAttr[i*3+1] < -1) posAttr[i*3+1] = 22; }
        rainParticles.geometry.attributes.position.needsUpdate = true;
    }
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}
animate();

// --- Growth Loop ---
setInterval(() => {
    let changed = false;
    for (let i = garden.seedlings.length-1; i >= 0; i--) {
        if (garden.seedlings[i].updateGrowth()) {
            const s = garden.seedlings[i];
            s.remove();
            garden.seedlings.splice(i,1);
            const isRare = Math.random() < 0.08;
            const type = isRare ? RARE_FLOWER : FLOWER_TYPES[Math.floor(Math.random() * FLOWER_TYPES.length)];
            const bud = new Bud(type, s.position, scene);
            garden.buds.push(bud);
            changed = true;
        }
    }
    for (let i = garden.buds.length-1; i >= 0; i--) {
        if (garden.buds[i].updateGrowth()) {
            const b = garden.buds[i];
            b.remove();
            garden.buds.splice(i,1);
            const bloom = new BloomingFlower(b.type, b.position, scene, false);
            garden.blooms.push(bloom);
            garden.occupied.add(`${b.position.x},${b.position.z}`);
            changed = true;
        }
    }
    if (changed) updateUI();
}, 500);

// --- Wild flower spawn ---
setInterval(() => {
    if (!isRaining && Math.random() < 0.22) {
        const pos = garden.getRandomEmptySpot();
        if (pos) {
            const isRare = Math.random() < 0.08;
            const type = isRare ? RARE_FLOWER : FLOWER_TYPES[Math.floor(Math.random() * FLOWER_TYPES.length)];
            const flower = new BloomingFlower(type, pos, scene, false);
            garden.wildFlowers.push(flower);
            garden.occupied.add(`${pos.x},${pos.z}`);
            updateUI();
        }
    }
}, 8000);

// --- Event Listeners ---
document.getElementById('buySeedBtn').addEventListener('click', openBuyPopup);
document.getElementById('minusQuantity').addEventListener('click', () => {
    if (selectedQuantity > 1) {
        selectedQuantity--;
        updateQuantityDisplay();
    }
});
document.getElementById('plusQuantity').addEventListener('click', () => {
    selectedQuantity++;
    updateQuantityDisplay();
});
document.getElementById('buyQuantityBtn').addEventListener('click', buyQuantity);
document.getElementById('buyMaxBtn').addEventListener('click', buyMaxSeeds);
document.getElementById('closePopupBtn').addEventListener('click', closePopup);
popupOverlay.addEventListener('click', (e) => { if (e.target === popupOverlay) closePopup(); });

document.getElementById('plantSeedBtn').addEventListener('click', plantAllSeeds);
document.getElementById('buyButterflyBtn').addEventListener('click', buyAndReleaseButterfly);
document.getElementById('buyStoneBtn').addEventListener('click', buyStone);
document.getElementById('sellAllBtn').addEventListener('click', sellAllBlooms);

const throwStoneBtn = document.getElementById('throwStoneBtn');
throwStoneBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    startAiming();
});

window.addEventListener('click', handleFlowerClick);
window.addEventListener('touchstart', (e) => { if (!e.target.closest('.shop-btn') && !e.target.closest('.stone-throw-btn') && !isAiming && !e.target.closest('.popup-overlay')) handleFlowerClick(e); });

const raycaster = new THREE.Raycaster();

// --- Initialize ---
for (let i = 0; i < 6; i++) {
    const pos = garden.getRandomEmptySpot();
    if (pos) {
        const type = FLOWER_TYPES[Math.floor(Math.random() * FLOWER_TYPES.length)];
        const flower = new BloomingFlower(type, pos, scene, false);
        garden.wildFlowers.push(flower);
        garden.occupied.add(`${pos.x},${pos.z}`);
    }
}

scheduleRain();
updateUI();
showMessage("🌸 Welcome! Buy stones, click the 🪨 button to aim, then click to shoot!");