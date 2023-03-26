import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
//import "@babylonjs/loaders/glTF";

// import modules individually to help tree shaking
import { Engine } from "@babylonjs/core/Engines/engine"
import { Scene } from "@babylonjs/core"
// import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { UniversalCamera } from "@babylonjs/core";
import { Vector3,Color4,Color3, Matrix } from "@babylonjs/core/Maths"
import { HemisphericLight } from "@babylonjs/core/Lights"
import { GroundBuilder } from "@babylonjs/core/Meshes/Builders"
import { ScaleBlock, StandardMaterial } from "@babylonjs/core/Materials"
import { Texture } from "@babylonjs/core/Materials/Textures"
import { Mesh, VertexData, MeshBuilder } from "@babylonjs/core/Meshes"
import { FreeCameraKeyboardMoveInput } from "@babylonjs/core/Cameras/Inputs/freeCameraKeyboardMoveInput"
// import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh"

import { ExtractSurface, CORNERS, Chunk,BORDERS,sampledPoints,sampledLabels } from "./Meshing";
import { SdfTerrain, SdfBox, SdfSphere, SdfUnion, SdfTorus, SignedDistanceField } from "./signedDistanceFields";
import { ChunkManager } from "./World"

import { Animation } from "@babylonjs/core/Animations/animation";

import { totalTime, totalSamples,totalSampleTime } from "./Meshing";

const maxSparseSamples = 0;
const xSample = 0;
const fieldPosition = new Vector3();
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: it's an image
//import grassTextureUrl from "../assets/grass.jpg";

let showChunkBounds = false;

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


        // This creates and positions a free camera (non-mesh)
        // const camera = new ArcRotateCamera(
        //     "camera",
        //     -2.3053, //-Math.PI / 4,
        //     1.0634, //Math.PI / 4,
        //     16.7337,
        //     new Vector3(17.194,13.131,27.050),
        //     scene
        // );
        // camera.fov = 0.4264;
        // camera.wheelDeltaPercentage = 0.01;

const camera = new UniversalCamera("UniversalCamera", new Vector3(-2.81346387881024, 9.501053222402463, -29.703129205471587), scene);
        camera.setTarget(new Vector3(25.480399380589255, -0.33416390626756076, -29.241383565822954));

        camera.speed = 0.08;

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

        await scene.createDefaultXRExperienceAsync({
            floorMeshes: [ground]
        });

        const marker = MeshBuilder.CreateSphere("marker", {diameter:1}, scene);
        marker.position.x = 0;
        marker.position.y = 12;
        marker.position.z = 0;
        const markerMaterial = new StandardMaterial("markerMaterial", scene);
        markerMaterial.wireframe = false;
        markerMaterial.diffuseColor = new Color3(1,1,0);
        marker.material = markerMaterial;

        const box = MeshBuilder.CreateBox("box", {size:0.05}, scene);
        const boxMaterial = new StandardMaterial("boxMaterial", scene);
        box.position.set(-2.478,6.442,21.392);
        boxMaterial.diffuseColor = new Color3(1,0.8,0);
        boxMaterial.wireframe = true;
        box.material = boxMaterial;
        box.isVisible = true;


        const box2 = MeshBuilder.CreateBox("box2", {size:0.025}, scene);
        box2.position.set(-1.867,10.100,22.120)
        const boxMaterial2 = new StandardMaterial("boxMaterial2", scene);
        boxMaterial2.diffuseColor = new Color3(1,1,0);
        boxMaterial2.wireframe = true;
        box2.material = boxMaterial2;

        const fieldBig = new SdfTerrain(5,50);
        fieldBig.setPosition(5,0,5)
        const fieldTorus = new SdfSphere(0.7);
        fieldTorus.setPosition(0,0,-10);
        const field = new SdfSphere(10);
        const step = 1000;
        //field.rotation = new Vector3(Math.PI / 4,0,0);
        const fieldSphere = new SdfSphere(1);
        fieldSphere.setPosition(0,-5,0);

        //const field = new SdfSphere(2);
        field.setPosition(0,0,0);

        // const unionField = new SdfUnion([field,fieldSphere]);

        const chunkManager = new ChunkManager();
        const viewOrigin = new Vector3();
        viewOrigin.copyFrom(marker.position);
        chunkManager.setViewOrigin(viewOrigin);

        //chunkManager.addField(fieldSphere);
        //chunkManager.addField(field);
        //chunkManager.addField(fieldTorus);
        chunkManager.addField(fieldBig);

        let addedSamples = false;


        scene.onBeforeAnimationsObservable.add((theScene) => {
            const offsetPosition = box.position.clone();
            offsetPosition.y -= 1;
            if (!fieldSphere.positionEquals(offsetPosition))
            {
                fieldSphere.setPosition(offsetPosition.x, offsetPosition.y, offsetPosition.z);
                chunkManager.updateField(fieldSphere);
            }

            offsetPosition.copyFrom(box2.position);
            offsetPosition.y -= 1;
            if (!fieldTorus.positionEquals(offsetPosition))
            {
                fieldTorus.setPosition(offsetPosition.x, offsetPosition.y, offsetPosition.z);
                chunkManager.updateField(fieldTorus);
            }

            if (!camera.position.equals(viewOrigin)) {
                viewOrigin.copyFrom(camera.position);
                chunkManager.setViewOrigin(viewOrigin);

            }

            chunkManager.updateChangedMeshes(scene,showChunkBounds);

            if (!addedSamples && sampledPoints.length > 0)
            {
                addedSamples = true;
                let index = 0;
                for (const point of sampledPoints)
                {
                    const sampleMarker = MeshBuilder.CreateBox("NormalSample", {size:0.07}, scene);
                    sampleMarker.position.x = point.x;
                    sampleMarker.position.y = point.y;
                    sampleMarker.position.z = point.z;
                    sampleMarker.name = sampledLabels[index++]
                    if (sampleMarker.name.startsWith("samp norm"))
                        sampleMarker.material = markerMaterial;
                    if (sampleMarker.name.startsWith("samp center"))
                        sampleMarker.material = boxMaterial;
                    if (sampleMarker.name.startsWith("samp seam"))
                        sampleMarker.material = boxMaterial2;
                }

            }

        });


        // hide/show the Inspector
        window.addEventListener("keydown", (ev) => {
            // Shift+Ctrl+Alt+I
            if (ev.key === "i") {
                showChunkBounds = !showChunkBounds;
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

            // if keycode  is "P"
            if (ev.key === "p") {
                scene.beginAnimation(camera, 0, 600, false);
            }

            if (ev.key === "m") {
                console.log(`samples ${totalSamples} sample time ${totalSampleTime}ms`);
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

    // private _updateChunk(chunk: Chunk,field: SignedDistanceField, vertexData: VertexData, normals: number[], customMesh: Mesh) {
    //     const extracted = ExtractSurface(
    //         chunk,
    //         field,
    //         vertexData.positions as number[],
    //         vertexData.indices as number[])

    //     if (extracted) {

    //         //Calculations of normals added
    //         VertexData.ComputeNormals(vertexData.positions, vertexData.indices, normals)

    //         vertexData.normals = normals

    //         //Apply vertexData to custom mesh
    //         vertexData.applyToMesh(customMesh, false)

    //         customMesh.isVisible = true
    //     }
    //     else
    //         customMesh.isVisible = false;
    // }

    private _setupVoxMaterial(scene: Scene, customMesh: Mesh, color: Color3): void {
        const voxelMaterial = new StandardMaterial("voxelMaterial", scene)
        voxelMaterial.wireframe = true;
        voxelMaterial.diffuseColor = color;
        voxelMaterial.emissiveColor = color;
        customMesh.material = voxelMaterial
        customMesh.enableEdgesRendering(0);
        customMesh.edgesWidth = 4.0
        customMesh.edgesColor = new Color4(0, 0, 0, 1);
    }


    private _createCustomMesh(scene: Scene) {
        const customMesh = new Mesh("custom", scene);
        //Create a vertexData object
        const vertexData = new VertexData();
        vertexData.positions = [];
        vertexData.indices = [];
        return { customMesh, vertexData };
    }


}


const app = new App();
app.setup().then(() => {
    // Begin
});

export {app};