import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const ThreeDView = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const spheresRef = useRef<THREE.Mesh[]>([]);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const coords = [
    [0, 0, 0],
    [1, 1, -1],
    [1.2, 1.2, 1.2],
    [1.5, -2.2, 0.3],
    [-1, 0.2, -0.9],
  ];

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth / 1.5, window.innerHeight / 1.5);
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    const sphereGeometry = new THREE.SphereGeometry(4);

    let sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

    //temp variable to see distances better
    var Distance = 5;

    //initial offset so does not start in middle.
    //var xOffset = -80;

    for (var i = 0; i < coords.length; i++) {
      var sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.position.x = Distance * coords[i][0];
      sphere.position.y = Distance * coords[i][1];
      sphere.position.z = Distance * coords[i][2];
      scene.add(sphere);
      spheresRef.current.push(sphere);
    }

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      10000
    );

    const controls = new OrbitControls(camera, renderer.domElement);

    //controls.update() must be called after any manual changes to the camera's transform
    camera.position.set(0, 20, 100);
    cameraRef.current = camera;
    controls.update();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function onPointerMove(event: PointerEvent) {
      // calculate pointer position in normalized device coordinates
      // (-1 to +1) for both components
      event.preventDefault();
      if (rendererRef.current) {
        const rect = rendererRef.current.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      }
    }

    function animate() {
      requestAnimationFrame(animate);

      scene.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
          child.material.color.set(0xffffff); // Zmieniamy na domyślny kolor, np. biały
        }
      });

      // update the picking ray with the camera and pointer position
      raycaster.setFromCamera(pointer, camera);

      // calculate objects intersecting the picking ray
      const intersects = raycaster.intersectObjects(spheresRef.current, true);
      for (let i = 0; i < intersects.length; i++) {
        const intersectedObject = intersects[i].object;

        // Check if the object is a Mesh before trying to access the material
        if (intersectedObject instanceof THREE.Mesh) {
          intersectedObject.material.color.set(0xff0000); // Change color to red
        }
      }

      // required if controls.enableDamping or controls.autoRotate are set to true
      controls.update();

      renderer.render(scene, camera);
    }
    //renderer.setAnimationLoop(animate);
    animate();

    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };

    //Reset camera position on key down "c"
    const CkeydownHandler = (e: KeyboardEvent) => {
      if (e.key === "c" && cameraRef.current) {
        cameraRef.current.position.set(0, 20, 100);
        controls.update();
      }
    };
    document.addEventListener("keydown", CkeydownHandler);
    window.addEventListener("pointermove", onPointerMove);

    //Cleaning ref (otherwise it's causing double rendering of scene)
    return () => {
      document.removeEventListener("keydown", CkeydownHandler);
      window.removeEventListener("pointermove", onPointerMove);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.setAnimationLoop(null);
    };
  }, []);

  return (
    <div className="absolute bottom-0 h-[90%] flex-grow w-full rounded-b-lg bg-slate-600">
      <div
        className={` text-xl items-center text-justify font-semibold overflow-x-scroll pb-2 break-words drop-shadow-xl`}
      >
        {/* {sequence.split("").map((nt, index) => (
                <span
                  className={clsx(
                    selectedNts.includes(index + 1) ? "text-red-500" : ""
                  )}
                  key={index}
                >
                  {nt}
                </span>
              ))} */}
        <span>Sequence</span>
      </div>
      <div
        ref={mountRef}
        className="rounded-lg border-black border-solid border-2 bg-gray-100 m-2"
        style={{ width: "100%", height: "90%" }}
      />
    </div>
  );
};
export default ThreeDView;
