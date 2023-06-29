import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
//import "@babylonjs/loaders/glTF";

// import modules individually to help tree shaking
import { Engine } from "@babylonjs/core/Engines/engine"
import { Scene } from "@babylonjs/core"
import { UniversalCamera } from "@babylonjs/core";
import { WebXRCamera } from "@babylonjs/core";
import { Vector3,Color3 } from "@babylonjs/core/Maths"
import { HemisphericLight } from "@babylonjs/core/Lights"
import { GroundBuilder } from "@babylonjs/core/Meshes/Builders"
import { StandardMaterial } from "@babylonjs/core/Materials"
import { MeshBuilder } from "@babylonjs/core/Meshes"
import { FreeCameraKeyboardMoveInput } from "@babylonjs/core/Cameras/Inputs/freeCameraKeyboardMoveInput"

import { debugLabels,debugPointSize,debugPoints } from "./Meshing";
import { MakeSdfTerrain, MakeSdfSphere } from "./signedDistanceFields";
import { ChunkManager } from "./World"

import { Animation } from "@babylonjs/core/Animations/animation";

import { systemSettings } from "./SystemSettings";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: it's an image
//import grassTextureUrl from "../assets/grass.jpg";

class App {
    engine: Engine;
    canvas: HTMLCanvasElement;

    constructor() {
        // create the canvas html element and attach it to the webpage
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;


        // initialize babylon scene and engine
        this.engine = new Engine(this.canvas, true, {
            deterministicLockstep: true,
            lockstepMaxSteps: 4,
        });
    }

    async setup(): Promise<void> {
        const scene = new Scene(this.engine);

   const camera = new UniversalCamera("UniversalCamera", new Vector3(-3.962005819285092, 14.72372714362647, -42.68172032429846), scene);
        camera.setTarget(new Vector3(-14.817822850946555, 6.935841478744608, -15.867777884122031));
        // const camera = new UniversalCamera("UniversalCamera", new Vector3(-7.812461480122939, 14.056310881753795, -11.719851124427887), scene);
        // camera.setTarget(new Vector3(5.488554215972839, 3.2248212781719108, 12.841279555492335));

        camera.speed = 0.15;

        const serializedAnimations = JSON.parse(`{"animations":[{"name":"Cam pos","property":"position","framePerSecond":20,"dataType":1,"loopBehavior":2,"blendingSpeed":0.01,"keys":[{"frame":0,"values":[-2.8217949121787824,9.501053222397646,-28.27,[0,0,0],[0,0,0]]},{"frame":129.21995743172116,"values":[0.8527955366178549,11.692062928401029,-13.843473583201243,[-0.06155180388584942,-0.0036429561538406097,0.21937598776534395],[-0.06155180388584942,-0.0036429561538406097,0.21937598776534395]]},{"frame":297.2223927120956,"values":[-16.301708346773143,8.760765204861066,16.403518169650695,[-0.022056328838331633,-0.0013979831494550484,0.009165545290436245],[-0.022056328838331633,-0.0013979831494550484,0.009165545290436245]]},{"frame":299.7436442682032,"values":[-16.349656983197097,8.758994395014197,16.415109837412473,[-0.01595209092782805,0,-0.0031404693645491998],[0.013631925844310422,-0.0006740162009732571,-0.0031404742411068926]]},{"frame":432.94589620149475,"values":[12.148107358349497,9.091097974605935,21.12755694160433,[0.05013419294102299,0.003025587790556905,-0.21598667454605458],[0.05013419294102299,0.003025587790556905,-0.21598667454605458]]},{"frame":603.0017032707535,"values":[-2.82,9.506869799372636,-28.15,[0.0446143361455839,0.002466135300141024,-0.0021022206112283064]]}],"ranges":[]},{"name":"cam target","property":"target","framePerSecond":20,"dataType":1,"loopBehavior":2,"blendingSpeed":0.01,"keys":[{"frame":0,"values":[-20.685020928684036,5.944684231179481,-4.485705746283372,[0,0,0],[0,0,0]]},{"frame":129.21995743172116,"values":[-5.180320651830292,7.948138521880864,-2.98818130254878,[0.03632983261995387,-0.008284038602870619,0.009190434826888975],[0.03632983261995387,-0.008284038602870619,0.009190434826888975]]},{"frame":297.2223927120956,"values":[-1.923797962732456,6.218489003567818,35.02,[0.016416429787903173,-0.019796543802244673,0.011180446446101963],[0.016416429787903173,-0.019796543802244673,0.011180446446101963]]},{"frame":432.94589620149475,"values":[28.245593115939684,9.054696334592894,35.26339765727455,[-0.0939243596565713,0.002301700014770213,-0.19343467862478309],[-0.0939243596565713,0.002301700014770213,-0.19343467862478309]]},{"frame":603.0017032707535,"values":[-20.69,5.94,-4.49,[0,0,0],[0,0,0]]}],"ranges":[]}]}`)
            .animations;
                   
        // declare an array to store our animations
        const cameraAnimations: Animation[] = [];
        for (const serializedAnimation of serializedAnimations) {
            cameraAnimations.push(Animation.Parse(serializedAnimation));
        }
        
        camera.animations = cameraAnimations;
    
        // This targets the camera to scene origin
        //camera.setTarget(new Vector3(12.947,-4.533,7.477));
    
        // This attaches the camera to the canvas
        camera.attachControl(this.canvas, true);
        const keyboardInput = camera.inputs.attached.keyboard as FreeCameraKeyboardMoveInput;
        keyboardInput.keysUp.push(87); // w
        keyboardInput.keysDown.push(83); // s
        keyboardInput.keysLeft.push(65); // a
        keyboardInput.keysRight.push(68); // d

        // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
        const light = new HemisphericLight("light", new Vector3(0, 0, 0), scene);
    
        // Default intensity is 1. Let's dim the light a small amount
        light.intensity = 1;

        // const gui = this._createStatsGui(camera);
    
        // Our built-in 'ground' shape.
        const ground = GroundBuilder.CreateGround(
            "ground",
            { width: 40, height: 40 },
            scene
        );
        ground.position.y = 0;
        ground.isVisible = false;
    
        // Load a texture to be used as the ground material
        const groundMaterial = new StandardMaterial("ground material", scene);
        groundMaterial.wireframe = false;
        //groundMaterial.diffuseTexture = new Texture(grassTextureUrl, scene);
    
        ground.material = groundMaterial;

        const xrHelper = await scene.createDefaultXRExperienceAsync({
            floorMeshes: [ground]
        });

        xrHelper.baseExperience.onInitialXRPoseSetObservable.add((xrCamera, xrPose) => {
            xrCamera.position.y = 14;
            });

        const marker = MeshBuilder.CreateSphere("marker", { diameter: 0.1 }, scene);
        marker.position.x = 0;
        marker.position.y = 12;
        marker.position.z = 0;
        const markerMaterial = new StandardMaterial("markerMaterial", scene);
        markerMaterial.wireframe = false;
        markerMaterial.diffuseColor = new Color3(1, 1, 0);
        markerMaterial.emissiveColor = new Color3(1, 1, 0);
        marker.material = markerMaterial;

        const voxelMaterial = new StandardMaterial("voxelMaterial", scene);
        voxelMaterial.wireframe = true;
        voxelMaterial.diffuseColor = new Color3(1, 0, 0);
        voxelMaterial.emissiveColor = new Color3(1, 0, 0);

        const box = MeshBuilder.CreateBox("box", { size: 0.5 }, scene);
        const boxMaterial = new StandardMaterial("boxMaterial", scene);
        box.position.set(5.830, 6.129, 5.287);
        boxMaterial.diffuseColor = new Color3(1, 0.8, 0);
        boxMaterial.wireframe = true;
        box.material = boxMaterial;
        box.isVisible = true;


        const box2 = MeshBuilder.CreateBox("box2", { size: 0.025 }, scene);
        box2.position.set(-1.867, 10.100, 22.120)
        const boxMaterial2 = new StandardMaterial("boxMaterial2", scene);
        boxMaterial2.diffuseColor = new Color3(1, 1, 0);
        boxMaterial2.wireframe = true;
        box2.material = boxMaterial2;

        const fieldBig = MakeSdfTerrain(5, 50);
        fieldBig.setPosition(5, 0, 5);
        const fieldTorus = MakeSdfSphere(0.7);
        fieldTorus.setPosition(0, 0, -10);
        const field = MakeSdfSphere(1);
        //field.rotation = new Vector3(Math.PI / 4,0,0);
        const fieldSphere = MakeSdfSphere(1);
        fieldSphere.setPosition(0, -5, 0);

        //const field = new SdfSphere(2);
        field.setPosition(0, 0, 0);

        // const unionField = new SdfUnion([field,fieldSphere]);

        const chunkManager = new ChunkManager();

        const cameraFront = new Vector3();
        const previousCameraFront = new Vector3();
        const previousViewOrigin = new Vector3();
        const viewOrigin = new Vector3();
        const cameraDelta = new Vector3();
        const idealOrigin = new Vector3();

        cameraFront.copyFrom(marker.position);
        chunkManager.setViewOrigin(cameraFront);

        // chunkManager.addField(fieldSphere);
        // chunkManager.addField(field);
        // chunkManager.addField(fieldTorus);
        chunkManager.addField(fieldBig);

        let addedSamples = false;


        scene.onBeforeAnimationsObservable.add(() => {
            const offsetPosition = box.position.clone();
            offsetPosition.y -= 1;
            if (!fieldSphere.positionEquals(offsetPosition)) {
                fieldSphere.setPosition(offsetPosition.x, offsetPosition.y, offsetPosition.z);
                chunkManager.updateField(fieldSphere);
            }

            offsetPosition.copyFrom(box2.position);
            offsetPosition.y -= 1;
            if (!fieldTorus.positionEquals(offsetPosition)) {
                fieldTorus.setPosition(offsetPosition.x, offsetPosition.y, offsetPosition.z);
                chunkManager.updateField(fieldTorus);
            }


            previousCameraFront.copyFrom(cameraFront);
            cameraFront.copyFrom(camera.getFrontPosition(3));
            const deltaTime = scene.deltaTime;
            if (!deltaTime) {
                if (systemSettings.initializeOriginToCamera) {
                    viewOrigin.copyFrom(cameraFront);
                    chunkManager.setViewOrigin(viewOrigin);
                }
            }
            else
            {

                // set viewOrigin to where the camera will be in the future
                // taking acceleration into account
        
                cameraDelta.copyFrom(cameraFront).subtractInPlace(previousCameraFront).scaleInPlace(deltaTime * 4);
                
                idealOrigin.copyFrom(cameraFront).addInPlace(cameraDelta);        
                Vector3.LerpToRef(viewOrigin, idealOrigin, 0.1, viewOrigin);
            }

            if (!previousViewOrigin.equals(viewOrigin)) {
                previousViewOrigin.copyFrom(viewOrigin);

                if (systemSettings.updateViewOrigin) {
                    chunkManager.setViewOrigin(viewOrigin);
                    marker.position.copyFrom(viewOrigin);
                }
            }

            // keep a running total of the time spent in the chunk manager
            // so we can display it in the stats
            const now = performance.now();
            chunkManager.updateChangedMeshes(scene,deltaTime);
            systemSettings.debugCounters.chunkTimer += performance.now() - now;

            if (!addedSamples && debugPoints.length > 0) {
                addedSamples = true;
                let index = 0;
                for (const point of debugPoints) {
                    const debugMarker = MeshBuilder.CreateBox("NormalSample", { size: debugPointSize[index] }, scene);
                    debugMarker.position.x = point.x + debugPointSize[index] / 2;
                    debugMarker.position.y = point.y + debugPointSize[index] / 2;
                    debugMarker.position.z = point.z + debugPointSize[index] / 2;
                    debugMarker.name = debugLabels[index++]
                    if (debugMarker.name.startsWith("voxelCenter"))
                        debugMarker.material = markerMaterial;
                    if (debugMarker.name.startsWith("voxelBounds"))
                        debugMarker.material = voxelMaterial;
                    if (debugMarker.name.startsWith("samp seam"))
                        debugMarker.material = boxMaterial2;
                }

            }

        });


        // hide/show the Inspector
        window.addEventListener("keydown", (ev) => {
            // Shift+Ctrl+Alt+I
            if (ev.key === "i") {
                if (scene.debugLayer.isVisible()) {
                    scene.debugLayer.hide();
                } else {
                    scene.debugLayer.show();
                }
            }

            // if keycode is "W"
            // if (ev.key === "w") {
            //     // set all meshes to wireframe
            //     const allChunks = new Set<Chunk>();
            //     chunkManager.getChunks(allChunks);
            //     for (const chunk of allChunks) {
            //         chunk.toggleWireframe();
            //     }
            // }

            if (ev.key === "o") {
                scene.beginAnimation(camera, 0, 0, false);
            }

            if (ev.key === "g") {
                camera.position.set(-5.562, 12.563, -8.214);
            }

            // if keycode  is "P"
            if (ev.key === "p") {
                scene.beginAnimation(camera, 0, 600, false);
            }

            if (ev.key === "m") {
                const options = { minimumFractionDigits: 0, maximumFractionDigits: 2 };
                for (const property in systemSettings.debugCounters) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const value = (systemSettings.debugCounters as any)[property];
                    console.log(`${property}: ${value.toLocaleString(undefined, options)}`);
                }
                console.log(`
        const camera = new UniversalCamera("UniversalCamera", new Vector3(${camera.position.x}, ${camera.position.y}, ${camera.position.z}), scene);
        camera.setTarget(new Vector3(${camera.target.x}, ${camera.target.y}, ${camera.target.z}));`
                )
            }
        });

        // run the main render loop
        this.engine.runRenderLoop(() => {
            scene.render();
        });
    }
}


const app = new App();
app.setup().then(() => {
    // Begin
});

export {app};