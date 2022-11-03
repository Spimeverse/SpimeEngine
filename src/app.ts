import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
//import "@babylonjs/loaders/glTF";

// import modules individually to help tree shaking
import { Engine } from "@babylonjs/core/Engines/engine"
import { Scene } from "@babylonjs/core"
// import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { Vector3,Color4,Color3, Matrix } from "@babylonjs/core/Maths"
import { HemisphericLight } from "@babylonjs/core/Lights"
import { GroundBuilder } from "@babylonjs/core/Meshes/Builders"
import { ScaleBlock, StandardMaterial } from "@babylonjs/core/Materials"
import { Texture } from "@babylonjs/core/Materials/Textures"
import { Mesh, VertexData, MeshBuilder } from "@babylonjs/core/Meshes"
// import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh"

import { ExtractSurface, CORNERS, Chunk,BORDERS } from "./Meshing";
import { SdfBox, SdfSphere, SdfUnion, SdfTorus, SignedDistanceField } from "./signedDistanceFields";
import { ChunkManager } from "./World"


const maxSparseSamples = 0;
const xSample = 0;
const fieldPosition = new Vector3();
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


        // This creates and positions a free camera (non-mesh)
        const camera = new ArcRotateCamera(
            "camera",
            -Math.PI / 4,
            Math.PI / 4,
            15,
            new Vector3(0, 0, 0),
            scene
        );
        
        camera.wheelDeltaPercentage = 0.01;
    
        // This targets the camera to scene origin
        camera.setTarget(Vector3.Zero());
    
        // This attaches the camera to the canvas
        camera.attachControl(this.canvas, true);    

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
        marker.position.x = 0 ;
        marker.position.y = 0;
        marker.position.z = 0;
        const markerMaterial = new StandardMaterial("markerMaterial", scene);
        markerMaterial.wireframe = true;
        markerMaterial.diffuseColor = new Color3(1,1,0);
        marker.material = markerMaterial;

        const box = MeshBuilder.CreateBox("box", {size:6}, scene);
        const boxMaterial = new StandardMaterial("boxMaterial", scene);
        box.position.x = -37.902;
        box.position.y = 3.181;
        box.position.z = 4.000;
        boxMaterial.diffuseColor = new Color3(1,0,0);
        boxMaterial.wireframe = true;
        box.material = boxMaterial;
        box.isVisible = true;

        camera.setTarget(marker.position.clone());

        const box2 = MeshBuilder.CreateBox("box2", {size:6}, scene);
        box2.position.x = -13.9;
        const boxMaterial2 = new StandardMaterial("boxMaterial", scene);
        boxMaterial2.diffuseColor = new Color3(1,0,0);
        boxMaterial2.wireframe = true;
        box2.material = boxMaterial2;

        const fieldBig = new SdfBox(10000,20,200)
        fieldBig.setPosition(-5000,-20,0)
        const fieldTorus = new SdfTorus(3, 2);
        fieldTorus.setPosition(0,0,-10);
        const field = new SdfSphere(10);
        const step = 1000;
        //field.rotation = new Vector3(Math.PI / 4,0,0);
        // const fieldSphere = new SdfSphere(10);
        // fieldSphere.setPosition(0,-5,0);

        //const field = new SdfSphere(2);
        field.setPosition(0,0,0);

        // const unionField = new SdfUnion([field,fieldSphere]);

        const chunkManager = new ChunkManager();
        chunkManager.setViewOrigin(new Vector3(0,0,0));

        //chunkManager.addField(fieldSphere);
        chunkManager.addField(field);
        chunkManager.addField(fieldTorus);
        //chunkManager.addField(fieldBig);

        /*
        const chunk1 = new Chunk();
        chunk1.setSize({x:8, y:8, z:8},1);
         chunk1.setOrigin({x:0,y:0,z:0});
 
        const chunk2 = new Chunk();
        chunk2.setSize({x:8, y:8, z:8},0.5);
        chunk2.setOrigin({x:8,y:0,z:0});
        //chunk2.subSample = 2;

        */


        /*
        //Create a custom mesh  
        const { customMesh, vertexData } = this._createCustomMesh(scene);
        // customMesh.position.x = 0.1;
        // customMesh.position.y = 0.1;
        // customMesh.position.z = 0.1;
        const { customMesh : customMesh2, vertexData : vertexData2 } = this._createCustomMesh(scene);
        const { customMesh : customMesh3, vertexData : vertexData3 } = this._createCustomMesh(scene);
        */

        // let count = 0;
        // const chunks = new Set<Chunk>();
        // chunkManager.getChunks(chunks);
        // for (const chunk of chunks)
        // {
        //     if (chunk.updateMesh(field,scene))
        //         count++;
        // }
        // console.log("chunks count: " + count);

        scene.onBeforeAnimationsObservable.add((theScene) => {
            field.copyPositionTo(fieldPosition)
            if (!fieldPosition.equals(box.position))
            {
                field.setPosition(box.position.x, box.position.y, box.position.z);
                chunkManager.updateField(field);
            }

            fieldTorus.copyPositionTo(fieldPosition)
            if (!fieldPosition.equals(box2.position))
            {
                fieldTorus.setPosition(box2.position.x, box2.position.y, box2.position.z);
                chunkManager.updateField(fieldTorus);
            }

            chunkManager.updateDirtyChunks(scene,box.position);
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
            if (ev.key === "w") {
                // set all meshes to wireframe
                const allChunks = new Set<Chunk>();
                chunkManager.getChunks(allChunks);
                for (const chunk of allChunks) {
                    chunk.toggleWireframe();
                }
            }
        });

        // run the main render loop
        this.engine.runRenderLoop(() => {
            scene.render();
        });
    }

    private _updateChunk(chunk: Chunk,field: SignedDistanceField, vertexData: VertexData, normals: number[], customMesh: Mesh) {
        const extracted = ExtractSurface(
            chunk,
            field,
            vertexData.positions as number[],
            vertexData.indices as number[])

        if (extracted) {

            //Calculations of normals added
            VertexData.ComputeNormals(vertexData.positions, vertexData.indices, normals)

            vertexData.normals = normals

            //Apply vertexData to custom mesh
            vertexData.applyToMesh(customMesh, false)

            customMesh.isVisible = true
        }
        else
            customMesh.isVisible = false;
    }

    // private _updateSeam(chunk: Chunk, field: SdfSphere, vertexData: VertexData, normals: number[], customMesh: Mesh) {
    //     chunk.sample(field)
    //     const extracted = ExtractSeam(
    //         chunk,
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
    //         customMesh.isVisible = true;
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