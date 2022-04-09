//import "@babylonjs/core/Debug/debugLayer";
//import "@babylonjs/inspector";
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
import { Rectangle, StackPanel, TextBlock, Slider, Container } from "@babylonjs/gui/2D/controls";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D";

import { ExtractSurface, ExtractSeam, Chunk } from "./Meshing";
import { SdfBox, SdfSphere, SdfTorus } from "./signedDistanceFields";


const maxSparseSamples = 0;
const xSample = 0;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: it's an image    
//import grassTextureUrl from "../assets/grass.jpg";

class App {
    engine: Engine;
    canvas: HTMLCanvasElement;
    advancedTexture: AdvancedDynamicTexture | undefined;
    mesh1Label: TextBlock | undefined;
    panel1: { label: TextBlock; samplesSlider: Slider; timeLabel: TextBlock; timeSlider: Slider; } | null;

    constructor() {
        // create the canvas html element and attach it to the webpage
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement; 


        // initialize babylon scene and engine
        this.engine = new Engine(this.canvas, true, {
            deterministicLockstep: true,
            lockstepMaxSteps: 4,
          }); 
        this.panel1 = null;
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
        light.intensity = 1;

    
        // Our built-in 'ground' shape.
        const ground = GroundBuilder.CreateGround(
            "ground",
            { width: 20, height: 20 },
            scene
        );
    
        // Load a texture to be used as the ground material
        const groundMaterial = new StandardMaterial("ground material", scene);
        groundMaterial.wireframe = true;
        //groundMaterial.diffuseTexture = new Texture(grassTextureUrl, scene);
    
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
        boxMaterial2.diffuseColor = new Color3(1,1,0);
        boxMaterial2.wireframe = true;
        box2.material = boxMaterial2;

        //const field = new SdfBox(1,1,1)
        //const field = new SdfTorus(1,0.5);
        const step = 1000;
        //field.rotation = new Vector3(Math.PI / 4,0,0);
        const field = new SdfSphere(2);
        field.position.set(0,1,0);


        const chunk1 = new Chunk(4,16);
        chunk1.setOrigin(-2,-2,-2);

        const chunk2 = new Chunk(4,8);
        chunk2.setOrigin(2,-2,-2);

        //Create a custom mesh  
        const { customMesh, vertexData } = this._createCustomMesh(scene);
        const { customMesh : customMesh2, vertexData : vertexData2 } = this._createCustomMesh(scene);
        const { customMesh : customMesh3, vertexData : vertexData3 } = this._createCustomMesh(scene);

        scene.onBeforeAnimationsObservable.add((theScene) => {
            const step = theScene.getStepId();
            //if (step % 50 == 0) 
            {
        
                //Empty array to contain calculated values or normals added
                const normals = new Array<number>();

                field.position = new Vector3(2 + Math.sin(step / 4000 * Math.PI * 2) * 4 ,0,0);
                //field.position = new Vector3(1.2,1,1);

                this._updateChunk(chunk1, field, vertexData, normals, customMesh);
                this._updateChunk(chunk2, field, vertexData2, normals, customMesh2);
                this._updateSeam(chunk, chunk2, vertexData3, normals, customMesh3);

            }
        });

        this._setupVoxMaterial(scene, customMesh, new Color3(0,0,1));
        this._setupVoxMaterial(scene, customMesh2, new Color3(1,0,0));
        this._setupVoxMaterial(scene, customMesh3, new Color3(1,1,1));

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

    private _updateChunk(chunk: Chunk, field: SdfSphere, vertexData: VertexData, normals: number[], customMesh: Mesh) {
        chunk.sample(field)
        const extracted = ExtractSurface(
            chunk,
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
            customMesh.isVisible = true;
    }

    private _updateSeam(chunk: Chunk, field: SdfSphere, vertexData: VertexData, normals: number[], customMesh: Mesh) {
        chunk.sample(field)
        const extracted = ExtractSeam(
            chunk,
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
            customMesh.isVisible = true;
    }

    private _setupVoxMaterial(scene: Scene, customMesh: Mesh, color: Color3): void {
        const voxelMaterial = new StandardMaterial("voxelMaterial", scene)
        voxelMaterial.wireframe = true
        voxelMaterial.diffuseColor = color;
        customMesh.material = voxelMaterial
        //customMesh.enableEdgesRendering();
        customMesh.edgesWidth = 4.0
        customMesh.edgesColor = new Color4(color.r, color.g, color.b, 1);
    }

    private _createStatsGui() {
        // GUI
        const plane = MeshBuilder.CreatePlane("plane", {size:10});
        plane.position.y = 2;
        plane.billboardMode = Mesh.BILLBOARDMODE_Y;

        this.advancedTexture = AdvancedDynamicTexture.CreateForMesh(plane)

        const guiPanel = new StackPanel();
        guiPanel.isVertical = false;
        this.advancedTexture.addControl(guiPanel);

        this.panel1 = this._createGuiRect(guiPanel);
    }

    private _createCustomMesh(scene: Scene) {
        const customMesh = new Mesh("custom", scene);
        //Create a vertexData object
        const vertexData = new VertexData();
        vertexData.positions = [];
        vertexData.indices = [];
        return { customMesh, vertexData };
    }

    private _createGuiRect(parent: Container) {
        const guiContainer = new Rectangle();
        guiContainer.width = "120px";
        guiContainer.height = "80px";
        guiContainer.cornerRadius = 10;
        guiContainer.color = "Grey";
        guiContainer.thickness = 4;
        guiContainer.background = "White";
        parent.addControl(guiContainer);

        const panel = new StackPanel();
        guiContainer.addControl(panel);

        const label = new TextBlock();
        label.text = "";
        label.fontSize = "14px";
        label.paddingTop = "4px";
        label.height = "20px";
        panel.addControl(label);

        const samplesSlider = new Slider();
        samplesSlider.color = "Orange";
        samplesSlider.displayThumb = false;
        samplesSlider.minimum = 0;
        samplesSlider.maximum = 4100;
        samplesSlider.value = 0;
        samplesSlider.height = "20px";
        panel.addControl(samplesSlider);

        const timeLabel = new TextBlock();
        timeLabel.text = "processing time";
        timeLabel.fontSize = "14px";
        timeLabel.paddingTop = "2px";
        timeLabel.height = "18px";
        panel.addControl(timeLabel);
        
        const timeSlider = new Slider();
        timeSlider.color = "Blue";
        timeSlider.displayThumb = false;
        timeSlider.minimum = 0;
        timeSlider.maximum = 1.2;
        timeSlider.value = 0;
        timeSlider.height = "20px";
        panel.addControl(timeSlider);

        return {label,samplesSlider,timeLabel: timeLabel,timeSlider};
    }
}


const app = new App();
app.setup().then(() => {
    // Begin
});

export {app};