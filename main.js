import * as THREE from 'three';
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import gsap from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/index.js";

import { Octree } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/math/Octree.js";
import { Capsule } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/math/Capsule.js";
import * as BufferGeometryUtils from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js";


// -------------------- BASIC SETUP --------------------

const popup = document.querySelector('.popup');

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);


// -------------------- LIGHTING --------------------

const ambient = new THREE.AmbientLight(0xffe0b2, 0.7);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffb74d, 2);
sun.position.set(-30, 30, -30);
sun.castShadow = true;

sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100;
sun.shadow.camera.bottom = -100;
sun.shadow.mapSize.set(3000, 3000);
sun.shadow.bias = -0.001;
sun.shadow.normalBias = 0.09;

scene.add(sun);
scene.add(sun.target);


// -------------------- GLOBAL STATE --------------------

let character = null;
let chickens = [];
let clickableObjects = [];

let worldOctree = new Octree();

const playerCollider = new Capsule(
  new THREE.Vector3(),
  new THREE.Vector3(0, 1, 0),
  0.5
);


// -------------------- POPUP DATA --------------------

const popupContent = [
  {
    name: 'skills_board',
    title: 'About me',
    discription: "I am Akash D P, a frontend developer and 3D artist with hands-on expertise in HTML, CSS, JavaScript, Blender, and Three.js. I specialize in crafting visually compelling web experiences that sit at the intersection of design and technology, bringing three-dimensional depth and interactivity to the modern web. I am currently focused on frontend development while actively expanding my skill set toward full-stack web development, with a long-term vision of building end-to-end digital products. My approach to development is driven by a desire to push creative and technical boundaries — a philosophy reflected in my personal tagline: redefine what's possible. \n Beyond my professional pursuits, I maintain a disciplined interest in freestyle wrestling and judo, disciplines that sharpen my work ethic and problem-solving mindset. I document my creative journey through my YouTube channel, @cielostatics, and share updates on Instagram at @akash_dp7.",
    link: 'none'
  },
  {
    name: 'github_board',
    title: 'Github',
    discription: "My work lives at github.com/akashdpcali-cloud — a space where my projects, experiments, and ongoing builds come together. From frontend interfaces and interactive Three.js experiences to the projects I am building as I grow toward full-stack development, my repositories reflect both where I am and where I am headed.\n Every commit is a step forward. Feel free to explore, fork, or reach out if something sparks a collaboration.",
    link: 'https://github.com/akashdpcali-cloud'
  },
  {
    name: 'linkedin_board',
    title: 'LinkedIn',
    discription: "I am always open to connecting with fellow developers, creators, and curious minds. Find me on LinkedIn at akashdpcali — where I share my professional journey, from frontend development and 3D work to my growth toward becoming a full-stack developer. Whether you are looking to collaborate, exchange ideas, or simply keep up with what I am building, let's connect and grow together.",
    link: 'https://www.linkedin.com/in/akashdpcali/'
  }
];

const targetNames = ["github_board", "linkedin_board", "skills_board"];


// -------------------- MODEL LOADING --------------------

const loader = new GLTFLoader();

loader.load("./portfolio.glb", (gltf) => {

  const model = gltf.scene;
  let geometries = [];

  model.traverse((child) => {

    // Collect collision geometry
    if (child.name === "walls") {
      child.updateWorldMatrix(true, true);

      child.traverse((obj) => {
        if (obj.isMesh && obj.geometry.attributes.position.count < 50000) {
          const geo = obj.geometry.clone();
          geo.applyMatrix4(obj.matrixWorld);
          geometries.push(geo);
        }
      });

      child.visible = false;
    }

    // Shadows
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }

    // Character
    if (child.name === "char") {
      character = child;

      playerCollider.start.set(...character.position.toArray());
      playerCollider.end.set(
        character.position.x,
        character.position.y + 2,
        character.position.z
      );
    }

    // Clickables
    if (targetNames.includes(child.name)) {
      clickableObjects.push(child);
    }

    // Chickens
    if (child.name === "black_chicken" || child.name === "white_chicken") {
      child.userData.isJumping = false;
      chickens.push(child);
    }
  });

  // Build octree
  if (geometries.length > 0) {
    const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
    const tempMesh = new THREE.Mesh(merged);

    worldOctree.fromGraphNode(tempMesh);
  }

  scene.add(model);
});


// -------------------- CAMERA --------------------

camera.position.set(20.85, 16.78, -55.45);


// -------------------- CHARACTER MOVEMENT --------------------

const moveDistance = 3.5;
let isJumping = false;

function shortestRotation(current, target) {
  let diff = target - current;
  diff = ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;
  return current + diff;
}

function jumpTo(target, rotationY) {

  if (!character || isJumping) return;

  const nextX = target.x ?? character.position.x;
  const nextZ = target.z ?? character.position.z;

  const delta = new THREE.Vector3(
    nextX - character.position.x,
    0,
    nextZ - character.position.z
  );

  playerCollider.start.set(...character.position.toArray());
  playerCollider.end.set(
    character.position.x,
    character.position.y + 2,
    character.position.z
  );

  playerCollider.translate(delta);
  const result = worldOctree.capsuleIntersect(playerCollider);
  playerCollider.translate(delta.negate());

  if (result) return;

  isJumping = true;

  const startY = character.position.y;

  const tl = gsap.timeline({
    onComplete: () => isJumping = false
  });

  tl.to(character.position, { y: startY + 1, duration: 0.2 })
    .to(character.position, {
      x: nextX,
      z: nextZ,
      duration: 0.2
    }, "<")
    .to(character.position, {
      y: startY,
      duration: 0.2,
      ease: "bounce.out"
    });

  if (rotationY !== undefined) {
    gsap.to(character.rotation, {
      y: shortestRotation(character.rotation.y, rotationY),
      duration: 0.2
    });
  }
}


// -------------------- INPUT --------------------

window.addEventListener("keydown", (e) => {

  if (!character) return;

  switch (e.key.toLowerCase()) {
    case "w":
    case "W":
    case "arrowup":
      jumpTo({ z: character.position.z + moveDistance }, 0);
      break;

    case "s":
    case "S":
    case "arrowdown":
      jumpTo({ z: character.position.z - moveDistance }, Math.PI);
      break;

    case "a":
    case "A":
    case "arrowleft":
      jumpTo({ x: character.position.x + moveDistance }, -Math.PI / 2);
      break;

    case "d":
    case "D":
    case "arrowright":
      jumpTo({ x: character.position.x - moveDistance }, Math.PI / 2);
      break;
  }
});


// -------------------- INTERACTION --------------------

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener("click", (event) => {

  const rect = renderer.domElement.getBoundingClientRect();

  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(
    [...clickableObjects, ...chickens],
    true
  );

  if (!intersects.length) return;

  let current = intersects[0].object;

  while (current && current.type !== "Scene") {

    if (chickens.includes(current)) {
      chickenJump(current);
      return;
    }

    if (targetNames.includes(current.name)) break;

    current = current.parent;
  }

  const data = popupContent.find(i => i.name === current?.name);
  if (!data) return;

  popup.innerHTML = `
    <div class="header">
      <div class="title">${data.title}</div>
      <button class="close">Close</button>
    </div>
    <div class="content">
      <div>${data.discription}</div>
      ${data.link !== 'none'
        ? `<a href="${data.link}" target="_blank"><button>Open link</button></a>`
        : ''}
    </div>
  `;

  popup.classList.add("add");

  popup.querySelector('.close')?.addEventListener("click", () => {
    popup.classList.remove("add");
  });
});


// -------------------- CHICKEN ANIMATION --------------------

function chickenJump(chicken) {
  if (!chicken || chicken.userData.isJumping) return;

  chicken.userData.isJumping = true;

  const startY = chicken.position.y;

  gsap.timeline({
    onComplete: () => chicken.userData.isJumping = false
  })
    .to(chicken.position, { y: startY + 3, duration: 0.5 })
    .to(chicken.position, { y: startY, duration: 0.5 });
}


// -------------------- ANIMATION LOOP --------------------

function animate() {
  requestAnimationFrame(animate);

  if (character) {
    const offset = new THREE.Vector3(10, 20, -10);
    const camPos = character.position.clone().add(offset);

    camera.position.lerp(camPos, 0.1);
    camera.lookAt(
      character.position.x,
      character.position.y + 2,
      character.position.z
    );
  }

  renderer.render(scene, camera);
}

animate();


// -------------------- RESIZE --------------------

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});