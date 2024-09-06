import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const ThreeDView = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
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
    // const camera = new THREE.PerspectiveCamera(
    //   75,
    //   window.innerWidth / window.innerHeight,
    //   0.1,
    //   1000
    // );

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth / 1.5, window.innerHeight / 1.5);
    mountRef.current.appendChild(renderer.domElement);

    const sphereGeometry = new THREE.SphereGeometry(4);
    //const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff69b4 });

    const vertexShader = [
      "precision highp float;",

      "uniform mat4 modelViewMatrix;",
      "uniform mat4 projectionMatrix;",
      "uniform mat4 normalMatrix;",
      "attribute vec2 uv;",
      "attribute vec3 position;",
      "attribute vec3 offset;",
      "attribute vec3 normal;",
      "varying vec2 vUv;",
      "varying vec3 vNormal;",
      "varying vec3 vPosition;",

      "void main() {",

      "vNormal = normal;",
      "vPosition = position;",
      "vUv = uv;",
      "gl_Position = projectionMatrix * modelViewMatrix * vec4( offset + position, 1.0 );",
      "}",
    ].join("\n");

    const fragmentShader = [
      "precision highp float;",
      "varying vec3 vNormal;",
      "varying vec2 vUv;",
      "varying vec3 vPosition;",
      "uniform vec3 cameraPosition;",
      "void main() {",
      "",
      " gl_FragColor = vec4(normalize(vNormal), 1.0);",
      "",
      "}",
    ].join("\n");
    const sphereMaterial = new THREE.RawShaderMaterial({
      uniforms: {},
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      side: THREE.DoubleSide,
      transparent: false,
    });

    // const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    // scene.add(sphere);

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
    }

    // camera.position.z = 35;
    // camera.position.y = 5;

    // function animate() {
    //   sphere.rotation.x += 0.01;
    //   sphere.rotation.y += 0.01;

    //   renderer.render(scene, camera);
    // }
    // renderer.setAnimationLoop(animate);

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      10000
    );

    const controls = new OrbitControls(camera, renderer.domElement);

    //controls.update() must be called after any manual changes to the camera's transform
    camera.position.set(0, 20, 100);
    controls.update();

    function animate() {
      requestAnimationFrame(animate);

      // required if controls.enableDamping or controls.autoRotate are set to true
      controls.update();

      renderer.render(scene, camera);
    }
    renderer.setAnimationLoop(animate);

    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.keys = {
      LEFT: "ArrowLeft", //left arrow
      UP: "ArrowUp", // up arrow
      RIGHT: "ArrowRight", // right arrow
      BOTTOM: "ArrowDown", // down arrow
    };
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    //Cleaning ref (otherwise it's causing double rendering of scene)
    return () => {
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
