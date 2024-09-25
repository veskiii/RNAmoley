import React, { useEffect, useState, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import clsx from "clsx";

type ThreeViewProps = {
  sequence: string;
  SELECTED: number[];
  setSELECTED: React.Dispatch<React.SetStateAction<number[]>>;
};

const ThreeView: React.FC<ThreeViewProps> = ({
  sequence,
  SELECTED,
  setSELECTED,
}) => {
  //const [SELECTED, setSELECTED] = useState<number[]>([]);
  const [rotate, setRotate] = useState<boolean>(true);
  const objects: THREE.Object3D[] = [];
  const [labels, setLabels] = useState<
    { id: number; position: THREE.Vector3 }[]
  >([]);
  let objectMap: Map<number, THREE.Object3D> | null = null;
  //const container = document.getElementById("container") as HTMLElement;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const coords: [number, number, number][] = [
    [0, 0, 0],
    [1, 1, -1],
    [1.2, 1.2, 1.2],
    [1.5, -2.2, 0.3],
    [-1, 0.2, -0.9],
  ];

  useEffect(() => {
    let camera: THREE.PerspectiveCamera,
      scene: THREE.Scene,
      raycaster: THREE.Raycaster,
      renderer: THREE.WebGLRenderer,
      controls: OrbitControls;
    let INTERSECTED: THREE.Object3D | null = null;
    let theta = 0;

    const radius = 5;

    const init = () => {
      camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.1,
        100
      );
      camera.position.set(0, 20, 10);

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf0f0f0);

      const light = new THREE.DirectionalLight(0xffffff, 3);
      light.position.set(1, 1, 1).normalize();
      scene.add(light);

      const geometry = new THREE.SphereGeometry();
      const Distance = 5;

      const tempLabels: { id: number; position: THREE.Vector3 }[] = [];

      coords.forEach((coord, index) => {
        const object = new THREE.Mesh(
          geometry,
          new THREE.MeshLambertMaterial({ color: 0x000ff0 })
        );
        object.position.set(
          Distance * coord[0],
          Distance * coord[1],
          Distance * coord[2]
        );
        (object as any).isGraphElement = true;
        (object as any).customId = index + 1;
        scene.add(object);

        tempLabels.push({ id: index + 1, position: object.position.clone() });
      });
      setLabels(tempLabels);

      objectMap = new Map(
        scene.children.map((obj) => [(obj as any).customId, obj])
      );

      raycaster = new THREE.Raycaster();

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth / 1.4, window.innerHeight / 1.3);
      renderer.setAnimationLoop(animate);
      // document.body.appendChild(renderer.domElement);
      if (containerRef.current)
        containerRef.current.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.update();
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
      document.addEventListener("mousedown", onCtrlClick);
      document.addEventListener("keydown", CkeydownHandler);
      window.addEventListener("resize", onWindowResize);
    };

    const onWindowResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const CkeydownHandler = (event: KeyboardEvent) => {
      if (event.key === "c") {
        camera.position.set(0, 20, 10);
        controls.update();
      }
    };

    const onCtrlClick = (event: MouseEvent) => {
      if (event.ctrlKey && event.button === 0) {
        event.preventDefault();

        const pointer = new THREE.Vector2();

        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x =
          ((event.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
        pointer.y =
          -((event.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;

        // pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        // pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(scene.children, false);

        if (intersects.length > 0) {
          const clickedObject = intersects[0].object as any;

          if (clickedObject.isGraphElement) {
            setSELECTED((prevSelected) => {
              const isSelected = prevSelected.includes(clickedObject.customId);
              if (isSelected) {
                clickedObject.material.color.set(0x0000ff); //blue
                return prevSelected.filter(
                  (id) => id !== clickedObject.customId
                );
              } else {
                clickedObject.material.color.set(0x00ff00); //green
                return [...prevSelected, clickedObject.customId];
              }
            });
          }
        } else {
          setSELECTED((prevSelected) => {
            prevSelected.forEach((id) => {
              const obj = objectMap?.get(id);
              if (obj) (obj as any).material.color.set(0x0000ff); //blue
            });
            return [];
          });
        }
      }
    };

    const rotating = () => {
      if (rotate) {
        const time = Date.now() * 0.0004;
        scene.rotation.x = time;
        scene.rotation.y = time * 0.7;
      } else {
        scene.rotation.x = 0;
        scene.rotation.y = 0;
      }
    };

    const animate = () => {
      rotating();
      renderScene();
      controls.update();
    };

    const renderScene = () => {
      renderer.render(scene, camera);
    };

    init();

    return () => {
      if (containerRef.current)
        containerRef.current.removeChild(renderer.domElement);
      document.removeEventListener("mousedown", onCtrlClick);
      document.removeEventListener("keydown", CkeydownHandler);
      window.removeEventListener("resize", onWindowResize);
    };
  }, [rotate, setSELECTED]);

  useEffect(() => {
    console.log("Updated SELECTED:", SELECTED);
    SELECTED.forEach((id) => {
      const obj = objectMap?.get(id);
      if (obj) (obj as any).material.color.set(0x00ff00);
    });
  }, [SELECTED]);

  return (
    <div className="absolute bottom-0 h-[90%] flex-grow w-full rounded-b-lg bg-slate-600">
      {/* <div className="text-xl items-center text-justify font-semibold overflow-x-scroll pb-2 break-words drop-shadow-xl">
        {sequence.split("").map((nt, index) => (
          <span
            className={clsx(SELECTED.includes(index + 1) ? "text-red-500" : "")}
            key={index}
          >
            {nt}
          </span>
        ))}
      </div> */}
      <div id="container" ref={containerRef}></div>
    </div>
  );
};

export default ThreeView;
