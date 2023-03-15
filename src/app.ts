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

        const camera = new UniversalCamera("UniversalCamera", new Vector3(1.758889783162618, 12.66466572326106, 10.458229236820639), scene);
        camera.setTarget(new Vector3(-1.616065077189712, 11.149576961797608, 14.846219134963595));

        camera.speed = 0.08;
    
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

        chunkManager.addField(fieldSphere);
        //chunkManager.addField(field);
        chunkManager.addField(fieldTorus);
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
                console.log(`
        const camera = new UniversalCamera("UniversalCamera", new Vector3(${camera.position.x}, ${camera.position.y}, ${camera.position.z}), scene);
        camera.setTarget(new Vector3(${camera.target.x}, ${camera.target.y}, ${camera.target.z}));`
                )
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