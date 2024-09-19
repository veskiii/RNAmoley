import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import clsx from "clsx";

const ThreeView = ({sequence}) => {
    //const sequence = "AGCAA";
    //var SELECTED = []; 
    const [SELECTED, setSELECTED] = useState([]);
    const [SELECTEDID, setSELECTEDID] = useState([]);

    const coords = [
        [0, 0, 0],
        [1, 1, -1],
        [1.2, 1.2, 1.2],
        [1.5, -2.2, 0.3],
        [-1, 0.2, -0.9],
    ];

    useEffect(() => {

        let stats;
        let camera, scene, raycaster, renderer, controls;
        let INTERSECTED;
        //SELECTED = []; 
        let theta = 0;
        const pointer = new THREE.Vector2();
        const radius = 5;
        let objectMap = null;

        const init = () => {
            camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
            
            //potrzebne do sterowania kamerą
            camera.position.set(0, 20, 10);

            scene = new THREE.Scene();
            scene.background = new THREE.Color(0xf0f0f0);

            const light = new THREE.DirectionalLight(0xffffff, 3);
            light.position.set(1, 1, 1).normalize();
            scene.add(light);

            const geometry = new THREE.SphereGeometry();

            const Distance = 5;


                coords.forEach((coord, index) => {
                    const object = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: 0x000ff0 }));
                    object.position.set(Distance * coord[0], Distance * coord[1], Distance * coord[2]);
                    object.isGraphElement = true;
                    object.customId = index + 1;
                    // object.rotation.x = Math.random() * 2 * Math.PI;
                    // object.rotation.y = Math.random() * 2 * Math.PI;
                    // object.rotation.z = Math.random() * 2 * Math.PI;

                    // object.scale.x = Math.random() + 0.5;
                    // object.scale.y = Math.random() + 0.5;
                    // object.scale.z = Math.random() + 0.5;

                    scene.add(object);
                });
                objectMap = new Map(scene.children.map(obj => [obj.customId, obj]));

            raycaster = new THREE.Raycaster();

            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setAnimationLoop(animate);
            document.body.appendChild(renderer.domElement);

            // Inicjalizujemy OrbitControls dopiero po utworzeniu renderer
            controls = new OrbitControls(camera, renderer.domElement);
            controls.update();
            // Ustawienia przycisków myszki
            controls.mouseButtons = {
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.PAN,
            };

            stats = new Stats();
            document.body.appendChild(stats.dom);

            //document.addEventListener('mousemove', onPointerMove);
            document.addEventListener("mousedown", onCtrlClick);
            document.addEventListener("keydown", CkeydownHandler);
            window.addEventListener('resize', onWindowResize);
        };

        const onWindowResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };

            //Reset camera position on key down "c"
    const CkeydownHandler = (event) => {
        if (event.key === "c") {
          camera.position.set(0, 20, 10);
          controls.update();
        }
      };
      
      const onCtrlClick = (event) => {
        if (event.ctrlKey && event.button === 0) {
            event.preventDefault();
    
            pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
            pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
            raycaster.setFromCamera(pointer, camera);
            const intersects = raycaster.intersectObjects(scene.children, false);
    
            if (intersects.length > 0) {
                const clickedObject = intersects[0].object;
    
                if (clickedObject.isGraphElement) {
                    setSELECTED((prevSelected) => {
                        const isSelected = prevSelected.includes(clickedObject.customId);
                        if (isSelected) {
                            // Deselecting: Reset color to blue
                            clickedObject.material.color.set(0x0000ff); 
                            console.log('Deselecting');
                            return prevSelected.filter((id) => id !== clickedObject.customId);
                        } else {
                            // Selecting: Change color to green
                            clickedObject.material.color.set(0x00ff00); 
                            console.log('Selecting');
                            return [...prevSelected, clickedObject.customId];
                        }
                    });
                }
            } else {
                // Deselecting all
                setSELECTED((prevSelected) => {
                    prevSelected.forEach((id) => {
                        const obj = objectMap.get(id); 
                        if (obj) obj.material.color.set(0x0000ff);
                        console.log('Deselecting all');
                    });
                    return [];
                });
            }
        }
    };
    


        const animate = () => {

            //self rotating model
            // const time = Date.now() * 0.0004;

            // scene.rotation.x = time;
            // scene.rotation.y = time * 0.7;

            renderScene();
            stats.update();
            controls.update();
        };

        const renderScene = () => {
            theta += 0.1;

            camera.lookAt(scene.position);

            camera.updateMatrixWorld();

            raycaster.setFromCamera(pointer, camera);
            const intersects = raycaster.intersectObjects(scene.children, false);

            //Coloring last selected object on different color
            // if (intersects.length > 0) {
            //     if (INTERSECTED !== intersects[0].object) {
            //         if (INTERSECTED) INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex);

            //         INTERSECTED = intersects[0].object;

            //         INTERSECTED.currentHex = INTERSECTED.material.emissive.getHex();
            //         INTERSECTED.material.emissive.setHex(0xff0000);
            //     }
            // } else {
            //     if (INTERSECTED) INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex);
            //     INTERSECTED = null;
            // }

            renderer.render(scene, camera);
        };

        init();

        return () => {
            document.body.removeChild(renderer.domElement);
            document.body.removeChild(stats.dom);
            document.removeEventListener('mousedown', onCtrlClick);
            document.removeEventListener('keydown', CkeydownHandler);
            window.removeEventListener('resize', onWindowResize);
        };
    }, []);

    return (
        <div className="absolute bottom-0 h-[90%] flex-grow w-full rounded-b-lg bg-slate-600">
            <div className={` text-xl items-center text-justify font-semibold overflow-x-scroll pb-2 break-words drop-shadow-xl`}>
            {sequence.split("").map((nt, index) => (
                    <span
                    className={clsx(
                        SELECTED.includes(index + 1) ? "text-red-500" : ""
                    )}
                    key={index}
                    >
                    {nt}
                    </span>
                ))} 
            </div>
            <div id="container"></div>
        </div>
    );
};

export default ThreeView;
