import React, { useEffect, useState, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

interface Atom {
  serial: number;
  name: string;
  altLoc: string;
  resName: string;
  chainID: string;
  resSeq: number;
  iCode: string;
  x: number;
  y: number;
  z: number;
  occupancy: number;
  tempFactor: number;
  element: string;
  charge: string;
}

type ThreeViewProps = {
  sequence: string;
  SELECTED: number[];
  setSELECTED: React.Dispatch<React.SetStateAction<number[]>>;
  atoms: Atom[];
};

const ThreeView: React.FC<ThreeViewProps> = ({
  sequence,
  SELECTED,
  setSELECTED,
  atoms,
}) => {
  const [rotate, setRotate] = useState<boolean>(true);
  const objects: THREE.Object3D[] = [];
  const [labels, setLabels] = useState<
    { id: number; position: THREE.Vector3 }[]
  >([]);
  const objectMap = useRef<Map<number, THREE.Object3D>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);

  // const coords: [number, number, number][] = [
  //   [0, 0, 0],
  //   [1, 1, -1],
  //   [1.2, 1.2, 1.2],
  //   [1.5, -2.2, 0.3],
  //   [-1, 0.2, -0.9],
  //   [2.4, -0.3, 1.8],
  //   [-2.5, 1.1, 0.9],
  //   [0.7, -1.8, -0.7],
  //   [-1.5, -0.5, 1.7],
  //   [0.3, 2.1, -1.6],
  //   [-1.9, 0.4, -2.3],
  //   [2.1, -0.6, 0.6],
  //   [1.9, 1.5, -0.3],
  //   [-0.8, -2.1, 1.5],
  //   [2.5, 0.7, -1.2],
  //   [-1.4, -0.9, 2.3],
  //   [1.1, -2.4, 0.8],
  //   [0.9, 2.3, -0.5],
  //   [-2.2, 1.8, 0.4],
  //   [1.6, -1.5, -2.1],
  //   [0.5, 0.9, 1.7],
  //   [-1.8, 2.2, -0.4],
  //   [2.0, -0.7, 1.9],
  //   [-0.2, -2.0, -1.4],
  // ];

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
        45,
        window.innerWidth / window.innerHeight,
        1,
        1000
      );
      camera.position.set(0, 20, 10);

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0xffffff);

      //zapewnia lepsze doświetlenie
      scene.add(new THREE.AmbientLight(0xffffff, 1));

      const light = new THREE.DirectionalLight(0xffffff, 3);
      light.position.set(1, 1, 1).normalize();

      scene.add(light);

      const geometry = new THREE.SphereGeometry();
      // const Distance = 5;

      const tempLabels: { id: number; position: THREE.Vector3 }[] = [];

      let index = 0;
      atoms.forEach((atom) => {
        const c_atom = /^C1/;
        if (c_atom.test(atom.name)) {
          const object = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0x38bdf8 })
          );
          object.position.set(atom.x, atom.y, atom.z);
          (object as any).isGraphElement = true;
          (object as any).customId = index;
          scene.add(object);
          objectMap.current.set(index, object);

          tempLabels.push({ id: index, position: object.position.clone() });
          index++;
        }
      });
      setLabels(tempLabels);

      raycaster = new THREE.Raycaster();

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth / 1.2, window.innerHeight);
      renderer.setAnimationLoop(animate);
      if (containerRef.current)
        containerRef.current.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.update();
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
      document.addEventListener("mousedown", onClick);
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

    const onClick = (event: MouseEvent) => {
      if (event.button === 0) {
        event.preventDefault();

        const pointer = new THREE.Vector2();

        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x =
          ((event.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
        pointer.y =
          -((event.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;

        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(scene.children, false);

        if (intersects.length > 0) {
          const clickedObject = intersects[0].object as any;

          if (clickedObject.isGraphElement) {
            setSELECTED((prevSelected) => {
              const isSelected = prevSelected.includes(clickedObject.customId);
              if (isSelected) {
                clickedObject.material.color.set(0x38bdf8); //blue
                return prevSelected.filter(
                  (id) => id !== clickedObject.customId
                );
              } else {
                clickedObject.material.color.set(0xf97386); //pink
                console.log(clickedObject.customId);
                return [...prevSelected, clickedObject.customId];
              }
            });
          }
        }
        //Jeśli kliknie się na pusta przestrzeń to sie odznacza
        // else {
        //   setSELECTED((prevSelected) => {
        //     prevSelected.forEach((id) => {
        //       const obj = objectMap?.get(id);
        //       if (obj) (obj as any).material.color.set(0x38bdf8); //blue
        //     });
        //     return [];
        //   });
        // }
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
      //rotating();
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
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", CkeydownHandler);
      window.removeEventListener("resize", onWindowResize);
    };
  }, [rotate, setSELECTED]);

  useEffect(() => {
    console.log("Updated SELECTED:", SELECTED);
    objectMap.current.forEach((object, id) => {
      if (SELECTED.includes(id)) {
        (object as any).material.color.set(0xf97386);
      } else {
        (object as any).material.color.set(0x38bdf8);
      }
    });
  }, [SELECTED]);

  return (
    <div className="h-full w-full">
      <div id="container" ref={containerRef}></div>
    </div>
  );
};

export default ThreeView;
