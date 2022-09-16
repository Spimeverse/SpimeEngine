import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
//import "@babylonjs/loaders/glTF";

// import modules individually to help tree shaking
import { Engine } from "@babylonjs/core/Engines/engine"
import { Scene } from "@babylonjs/core"
// import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { Vector3,Color4,Color3 } from "@babylonjs/core/Maths"
import { HemisphericLight } from "@babylonjs/core/Lights"
import { GroundBuilder } from "@babylonjs/core/Meshes/Builders"
import { StandardMaterial } from "@babylonjs/core/Materials"
import { Texture } from "@babylonjs/core/Materials/Textures"
import { Mesh, VertexData, MeshBuilder } from "@babylonjs/core/Meshes"
// import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh"

import { ExtractSurface, CORNERS, Chunk,BORDERS } from "./Meshing";
import { SdfBox, SdfSphere, SdfUnion, SdfTorus, SignedDistanceField } from "./signedDistanceFields";
import { ChunkManager } from "./World"


const maxSparseSamples = 0;
const xSample = 0;
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

        const marker = MeshBuilder.CreateSphere("marker", {diameter:0.2}, scene);
        marker.position.x = -5 ;
        marker.position.y = 0;
        marker.position.z = 0;
        const markerMaterial = new StandardMaterial("markerMaterial", scene);
        markerMaterial.wireframe = true;
        markerMaterial.diffuseColor = new Color3(1,1,0);
        marker.material = markerMaterial;

        const box = MeshBuilder.CreateBox("box", {size:6}, scene);
        const boxMaterial = new StandardMaterial("boxMaterial", scene);
        box.position.x = 8;
        box.position.y = 5;
        box.position.z = 4;
        boxMaterial.diffuseColor = new Color3(1,0,0);
        boxMaterial.wireframe = true;
        box.material = boxMaterial;
        box.isVisible = true;

        //camera.setTarget(box.position.clone());

        const box2 = MeshBuilder.CreateBox("box2", {size:6}, scene);
        box2.position.x = 2;
        const boxMaterial2 = new StandardMaterial("boxMaterial", scene);
        boxMaterial2.diffuseColor = new Color3(1,0,0);
        boxMaterial2.wireframe = true;
        box2.material = boxMaterial2;
        box2.isVisible = false;

        //const field = new SdfBox(512,128,512)
        //const field = new SdfTorus(3,2);
        const field = new SdfSphere(5);
        const step = 1000;
        //field.rotation = new Vector3(Math.PI / 4,0,0);
        const fieldSphere = new SdfSphere(3);
        fieldSphere.setPosition(8,5,4);

        //const field = new SdfSphere(2);
        field.setPosition(0,0,0);

        const unionField = new SdfUnion([field,fieldSphere]);

        const chunkManager = new ChunkManager();

        //chunkManager.addField(fieldSphere);
        chunkManager.addField(field);

        /*
        const chunk1 = new Chunk();
        chunk1.setSize({x:8, y:8, z:8},1);
         chunk1.setOrigin({x:0,y:0,z:0});
 
        const chunk2 = new Chunk();
        chunk2.setSize({x:8, y:8, z:8},0.5);
        chunk2.setOrigin({x:8,y:0,z:0});
        //chunk2.subSample = 2;

        */

        for (const chunk of chunkManager.getChunks())
        {
            chunk.createMesh(scene);
        }

        /*
        //Create a custom mesh  
        const { customMesh, vertexData } = this._createCustomMesh(scene);
        // customMesh.position.x = 0.1;
        // customMesh.position.y = 0.1;
        // customMesh.position.z = 0.1;
        const { customMesh : customMesh2, vertexData : vertexData2 } = this._createCustomMesh(scene);
        const { customMesh : customMesh3, vertexData : vertexData3 } = this._createCustomMesh(scene);
        */

        let count = 0;
        for (const chunk of chunkManager.getChunks())
        {
            chunk.updateMesh(field);
            count++;
        }
        console.log("chunks count: " + count);

        /*
        scene.onBeforeAnimationsObservable.add((theScene) => {
            customMesh.position.y = tunePos;
            //if (positionDirty)
            //if (!field.position.equals(box.position))
            {
                positionDirty = false;
                const step = theScene.getStepId();
                //if (step % 50 == 0) 
                {
            
                    //Empty array to contain calculated values or normals added
                    const normals = new Array<number>();

                    field.setPosition(5 + Math.sin(step / 4000 * Math.PI * 2) * 6 ,4,4);
                    // field.position = new Vector3(objectPos / 1000,0,0);
                    field.copyPositionTo(box.position);
                    //field.position = new Vector3(1.2,0,0);
                    field.setPosition(box.position.x,box.position.y,box.position.z);

                    chunk1.setBorderSeams(BORDERS.xMax,1);
                    this._updateChunk(chunk1,unionField, vertexData, normals, customMesh);

                    //gui.positionLabel.text = `Position ${box.position.x.toFixed(3)}`;
                    chunk2.setBorderSeams(BORDERS.xMin,2);
                    this._updateChunk(chunk2,unionField, vertexData2, normals, customMesh2);

                }
            }
        });

        this._setupVoxMaterial(scene, customMesh, new Color3(0,1,0));
        this._setupVoxMaterial(scene, customMesh2, new Color3(1,1,0));
        this._setupVoxMaterial(scene, customMesh3, new Color3(1,1,1));
        */

        // hide/show the Inspector
        window.addEventListener("keydown", (ev) => {
            // Shift+Ctrl+Alt+I
            if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
                if (scene.debugLayer.isVisible()) {
                    scene.debugLayer.hide();
                } else {
                    scene.debugLayer.show();
                }
            }

            // if keycode is "W"
            if (ev.keyCode === 87) {
                // set all meshes to wireframe
                for (const chunk of chunkManager.getChunks()) {
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