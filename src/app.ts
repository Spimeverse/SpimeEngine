//import "@babylonjs/core/Debug/debugLayer";
//import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";
import { Engine, Scene, TransformNode, ArcRotateCamera, Vector3, 
    HemisphericLight, GroundBuilder,StandardMaterial,
    Texture, Mesh, VertexData, Color4,MeshBuilder, Color3, AbstractMesh } from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle, StackPanel, TextBlock, Slider, Container } from "@babylonjs/gui";
import { SmartMesher, smartSamples, ExtractSurface, Mesher, SampleDimensions, SdfSampler, fullSamples,sparseSamples } from "./Meshing";
import { SdfBox, SdfSphere, SdfTorus } from "./signedDistanceFields";


const maxSparseSamples = 0;
const xSample = 0;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: it's an image    
import grassTextureUrl from "../assets/grass.jpg";

class App {
    engine: Engine;
    canvas: HTMLCanvasElement;
    advancedTexture: AdvancedDynamicTexture | undefined;
    mesh1Label: TextBlock | undefined;

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
        const field = new SdfSphere(0.7);
        field.position.set(0,1,0);
        const dims = new SampleDimensions().set(4,16,-2,-2,-2);
        const fieldArray = new Float32Array(dims.samples);

        //Create a custom mesh  
        const { customMesh, vertexData } = this._createCustomMesh(scene);
        const { customMesh : customMesh2, vertexData : vertexData2 } = this._createCustomMesh(scene);
        const { customMesh : customMesh3, vertexData : vertexData3 } = this._createCustomMesh(scene);

                        
        // GUI
        const plane = MeshBuilder.CreatePlane("plane", {size:10});
        plane.position.y = 1.5;
        plane.billboardMode = Mesh.BILLBOARDMODE_Y;

        this.advancedTexture = AdvancedDynamicTexture.CreateForMesh(plane)

        const guiPanel = new StackPanel();
        guiPanel.isVertical = false;
        this.advancedTexture.addControl(guiPanel);

        const mesh1gui = this._createGuiRect(guiPanel);
        const mesh2gui = this._createGuiRect(guiPanel);
        const mesh3gui = this._createGuiRect(guiPanel);
        const summaryGui = this._createGuiRect(guiPanel);

        const runningTotal: number[] = [];
        scene.onBeforeAnimationsObservable.add((theScene) => {
            const step = theScene.getStepId();
            //if (step % 50 == 0) 
            {
        
                //Empty array to contain calculated values or normals added
                const normals = new Array<number>();

                field.position = new Vector3(Math.sin(step / 4000 * Math.PI * 2) * 3 ,0,1);
                //field.position = new Vector3(1.2,1,1);

                dims.set(4,16,-2,-2,-2);
                let startTime = performance.now();
                let standardTime = 0;
                if (SdfSampler(field,dims,fieldArray)) {
                    mesher.set(fieldArray,dims);
                    mesher.extractSurface(
                        vertexData.positions as number[],
                        vertexData.indices as number[]);
                    standardTime = performance.now() - startTime;
             
                    //Calculations of normals added
                    VertexData.ComputeNormals(vertexData.positions, vertexData.indices, normals);
            
                    vertexData.normals = normals;
            
                    //Apply vertexData to custom mesh
                    vertexData.applyToMesh(customMesh,false);
                }

                field.position = new Vector3(field.position.x,field.position.y,0);
                dims.set(4,16,-2,-2,-2);

                startTime = performance.now();
                let extracted = ExtractSurface(
                    fieldArray, dims,field,
                    vertexData2.positions as number[],
                    vertexData2.indices as number[]);
                let sparseTime = performance.now() - startTime;

                if (extracted) {
            
                    //Calculations of normals added
                    VertexData.ComputeNormals(vertexData2.positions, vertexData2.indices, normals);
            
                    vertexData2.normals = normals;
            
                    //Apply vertexData to custom mesh
                    vertexData2.applyToMesh(customMesh2);
                }

                field.position = new Vector3(field.position.x,field.position.y,-1);
                dims.set(4,16,-2,-2,-2);

                // smart mesher
                startTime = performance.now();
                extracted = SmartMesher(
                    fieldArray, dims,field,
                    vertexData3.positions as number[],
                    vertexData3.indices as number[]);
                let smartTime = performance.now() - startTime;

                if (extracted) {
            
                    //Calculations of normals added
                    VertexData.ComputeNormals(vertexData3.positions, vertexData3.indices, normals);
            
                    vertexData3.normals = normals;
            
                    //Apply vertexData to custom mesh
                    vertexData3.applyToMesh(customMesh3);
                }

                runningTotal[0] += standardTime;
                runningTotal[1] += sparseTime;
                runningTotal[2] += smartTime;
                if (step % 20 == 0) {
                    standardTime = runningTotal[0] / 20;
                    sparseTime = runningTotal[1] / 20;
                    smartTime = runningTotal[2] / 20;

                    runningTotal[0] = runningTotal[1] = runningTotal[2] = 0;

                    mesh1gui.label.text = 'Full ' + fullSamples;
                    mesh1gui.samplesSlider.value = fullSamples;
                    mesh1gui.timelabel.text = 'Time ' + standardTime.toFixed(3);
                    mesh1gui.timeSlider.value = standardTime;

                    mesh2gui.label.text = 'Sparse ' + sparseSamples;
                    mesh2gui.samplesSlider.value = sparseSamples;
                    mesh2gui.timelabel.text = 'Time ' + sparseTime.toFixed(3);
                    mesh2gui.timeSlider.value = sparseTime;
                    
                    mesh3gui.label.text = 'Smart ' + smartSamples;
                    mesh3gui.samplesSlider.value = smartSamples;
                    mesh3gui.timelabel.text = 'Time ' + smartTime.toFixed(3);
                    mesh3gui.timeSlider.value = smartTime;

                    summaryGui.label.text = 'pos ' + field.position.x.toFixed(3);
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

        
        const voxelsMaterial3 = new StandardMaterial("voxelMaterial3", scene);
        voxelsMaterial3.wireframe = true;
        voxelsMaterial3.diffuseColor = new Color3(1,1,0.5);
        customMesh3.material = voxelsMaterial3;
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

        const timelabel = new TextBlock();
        timelabel.text = "processing time";
        timelabel.fontSize = "14px";
        timelabel.paddingTop = "2px";
        timelabel.height = "18px";
        panel.addControl(timelabel);
        
        const timeSlider = new Slider();
        timeSlider.color = "Blue";
        timeSlider.displayThumb = false;
        timeSlider.minimum = 0;
        timeSlider.maximum = 2.5;
        timeSlider.value = 0;
        timeSlider.height = "20px";
        panel.addControl(timeSlider);

        return {label,samplesSlider,timelabel,timeSlider};
    }
}


const app = new App();
app.setup().then(() => {
    // Begin
});