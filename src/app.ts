import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";
import { Engine, Scene, ArcRotateCamera, Vector3, 
    HemisphericLight, GroundBuilder,StandardMaterial,
    Texture, Mesh, VertexData, Color4,MeshBuilder, Color3 } from "@babylonjs/core";
import { ExtractSurface, Mesher, SampleDimensions, SdfSampler, fullSamples,sparseSamples } from "./Meshing";
import { SdfBox, SdfSphere, SdfTorus } from "./signedDistanceFields";


let maxSparseSamples = 0;
let xSample = 0;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: it's an image    
import grassTextureUrl from "../assets/grass.jpg";

class App {
    engine: Engine;
    canvas: HTMLCanvasElement;
    dataDiv: HTMLDivElement;

    constructor() {
        // create the canvas html element and attach it to the webpage
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement; 
        this.dataDiv = document.getElementById("data") as HTMLDivElement;

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
            0,
            Math.PI / 3,
            10,
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
        light.intensity = 0.7;
    
        //experiment(scene);
    
        // Our built-in 'ground' shape.
        const ground = GroundBuilder.CreateGround(
            "ground",
            { width: 20, height: 20 },
            scene
        );
    
        // Load a texture to be used as the ground material
        const groundMaterial = new StandardMaterial("ground material", scene);
        groundMaterial.wireframe = true;
        groundMaterial.diffuseTexture = new Texture(grassTextureUrl, scene);
    
        ground.material = groundMaterial;

        await scene.createDefaultXRExperienceAsync({
            floorMeshes: [ground]
        });

        const box = MeshBuilder.CreateBox("box", {size:4}, scene);
        const boxMaterial = new StandardMaterial("boxMaterial", scene);
        boxMaterial.diffuseColor = new Color3(0,1,1);
        boxMaterial.wireframe = true;
        box.material = boxMaterial;

        const box2 = MeshBuilder.CreateBox("box2", {size:4}, scene);
        box2.position.x = 4;
        const boxMaterial2 = new StandardMaterial("boxMaterial", scene);
        boxMaterial2.diffuseColor = new Color3(1,0,0);
        boxMaterial2.wireframe = true;
        box2.material = boxMaterial2;
        

        // try a mesh
        const mesher = new Mesher();
        //const field = new SdfBox(1,1,1)
        //const field = new SdfTorus(1,0.5);
        const step = 1000;
        //field.rotation = new Vector3(Math.PI / 4,0,0);
        const field = new SdfSphere(1);
        field.position.set(0,1,0);
        const dims = new SampleDimensions().set(4,16,-2,-2,-2);
        const fieldArray = new Float32Array(dims.samples);

        //Create a custom mesh  
        const customMesh = new Mesh("custom",scene);
        //Create a vertexData object
        const vertexData = new VertexData();
        vertexData.positions = [];
        vertexData.indices = [];

        //Create a custom mesh  
        const customMesh2 = new Mesh("custom2",scene);
        //Create a vertexData object
        const vertexData2 = new VertexData();
        vertexData2.positions = [];
        vertexData2.indices = [];

        scene.onBeforeAnimationsObservable.add((theScene) => {
            const step = theScene.getStepId();
            //if (step % 50 == 0) 
            {
        
                //Empty array to contain calculated values or normals added
                const normals = new Array<number>();

                field.position = new Vector3(Math.sin(step / 5000 * Math.PI * 2) * 5 + 2,0,1);
                //field.position = new Vector3(2,1,1);

                dims.set(4,16,-2,-2,-2);
                if (SdfSampler(field,dims,fieldArray)) {
                    mesher.set(fieldArray,dims);
                    mesher.extractSurface(
                        vertexData.positions as number[],
                        vertexData.indices as number[]);
             
                    //Calculations of normals added
                    VertexData.ComputeNormals(vertexData.positions, vertexData.indices, normals);
            
                    vertexData.normals = normals;
            
                    //Apply vertexData to custom mesh
                    vertexData.applyToMesh(customMesh,false);
                }

                field.position = new Vector3(field.position.x,field.position.y,-1);
                dims.set(4,16,-2,-2,-2);
                const extracted = ExtractSurface(
                    fieldArray, dims,field,
                    vertexData2.positions as number[],
                    vertexData2.indices as number[]);
                if (extracted) {
            
                    //Calculations of normals added
                    VertexData.ComputeNormals(vertexData2.positions, vertexData2.indices, normals);
            
                    vertexData2.normals = normals;
            
                    //Apply vertexData to custom mesh
                    vertexData2.applyToMesh(customMesh2);
                }

                if (step % 30 == 0) {
                    if (sparseSamples > maxSparseSamples) {
                        maxSparseSamples = sparseSamples
                        xSample = field.position.x;
                    }
                    this.dataDiv.innerText = 'Full samples ' + fullSamples + ' Sparse Samples' + sparseSamples + ' X ' + field.position.x + 
                    'max Sparse' + maxSparseSamples + ' x sample' + xSample;
                }
            }
        });

        const voxelsMaterial = new StandardMaterial("voxelMaterial", scene);
        voxelsMaterial.wireframe = true;
        voxelsMaterial.diffuseColor = new Color3(0.5,1,1);
        customMesh.material = voxelsMaterial;
        //customMesh.enableEdgesRendering();
        customMesh.edgesWidth = 4.0;
        customMesh.edgesColor = new Color4(0, 0, 1, 1);

        const voxelsMaterial2 = new StandardMaterial("voxelMaterial2", scene);
        voxelsMaterial2.wireframe = true;
        voxelsMaterial2.diffuseColor = new Color3(1,0.5,0.5);
        customMesh2.material = voxelsMaterial2;
        //customMesh.enableEdgesRendering();
        customMesh.edgesWidth = 4.0;
        customMesh.edgesColor = new Color4(0, 0, 1, 1);


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