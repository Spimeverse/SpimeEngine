import { Scene, StandardMaterial } from "@babylonjs/core"
import { Nullable } from "@babylonjs/core";
import { Color3, Color4, Vector3 } from "@babylonjs/core/Maths";
import { Mesh, VertexData, MeshBuilder } from "@babylonjs/core/Meshes"
import { AxisAlignedBoxBound } from "..";
import { SignedDistanceField } from "..";
import { Bounds } from "..";
import { IhasBounds } from "..";
import { ExtractSurface } from "..";

const voxelPosition = new Vector3();
    

enum CORNERS {
    leftBottomFront = 0,
    rightBottomFront = 1,
    leftTopFront = 2, 
    rightTopFront = 3,
    leftBottomBack = 4,
    rightBottomBack = 5,
    leftTopBack = 6, 
    rightTopBack = 7
}

const BORDERS = {
     xMin : 0b000001,
     xMax : 0b000010,
     yMin : 0b000100,
     yMax : 0b001000,
     zMin : 0b010000,
     zMax : 0b100000
}

interface XYZ { x: number; y: number; z: number}
interface XY { x: number; y: number;}

const normals = new Array<number>();
const seamExtra = 3;
const seamExtraDouble = seamExtra * 2;

/**
 * Make working with a 1 dimensional array work like a 3d array
 * by working out the index in the 1d array
 * Doesn't actually reference the array itself
 */
class Chunk implements IhasBounds {
        /**
     * the extent of the chunk in world coordinate space
     */
    private _worldSize = new Vector3();
    /**
     * the number of voxels in the chunk along each axis
     */
    private _voxelRange = new Vector3();

    /**
     * stride use to convert 1 dimensional array index to 3 dimensional array
     * e.g. index = x + y*stride.x + z*stride.y
     */
    private _stride = new Vector3();
    /**
     * number of distance samples in the chunk
     */
    private _numSamples = 0;
    private _maxSamples = 0;

    /**
     * origin of the chunk in world coordinate space
     */
    private _position = new Vector3();
    /**
     * the size of one voxel in the chunk in world coordinate space
     */
    private _voxelSize = 0;
    private _halfVoxel = 0;

    /**
     * bit flags indicating which borders need to be down sampled
     */
    private _borderSeams = 0;
    /**
     * how many voxels deep the border is eg 2 if the bordering chunk is half the scale of this chunk
     */
    private _borderScale = 1;

    //private _overlap = 1;

    private _vertexData = new VertexData();

    private _chunkMesh: Nullable<Mesh> = null;
    private _newChunkMesh: Nullable<Mesh> = null;
    private _markedForRemoval = false;

    //  X   X   X   X
    //    c   c   c 
    //  X   X   X   X
    //    c   c   c
    //  X   X   X   X
    //    c   c   c
    //  X   X   X   X
    //
    // one more voxel needed to cover overlap with next chunk
    // so points = subdivisions + 2;
    
    copyPositionTo(destination: Vector3) {
        destination.copyFrom(this._position);
    }

    copyWorldSizeTo(destination: Vector3) {
        destination.copyFrom(this._worldSize);
    }

    copyVoxelRangeTo(destination: Vector3) {
        destination.copyFrom(this._voxelRange);
    }

    getNumSamples(): number {
        return this._numSamples;
    }

    getVoxelSize(): number {
        return this._voxelSize;
    }

    getBorderScale(): number {
        return this._borderScale;
    }

    getBorderSeams(): number {
        return this._borderSeams;
    }

    isAtSamePositionAs(newChunk: Chunk): boolean {
        return this._position.equals(newChunk._position);
    }

    markForRemoval() {
        this._markedForRemoval = true;
    }

    isMarkedForRemoval() {
        return this._markedForRemoval;
    }

    currentBounds: AxisAlignedBoxBound;

    constructor () {
        this._maxSamples = 0;
        this.currentBounds = new AxisAlignedBoxBound(0,0,0,0,0,0);
    }

    /**
     * set the size of this chunk
     * @param size size of the chunk in world coordinate space
     * @param voxelSize size of a voxel in the chunk in world units
     */
    setSize(size: XYZ, voxelSize: number) {
        // one more point needed than each voxel
        // e.g. 4 point, = 3 voxels
        // points marked 'x' and voxels marked 'c'
        //  X   X   X   X
        //    c   c   c 
        //  X   X   X   X
        //    c   c   c
        //  X   X   X   X
        //    c   c   c
        //  X   X   X   X
        //
        // one more voxel needed to cover overlap with next chunk
        // so points = subdivisions + 2;
        CopyXyz(size, this._worldSize)
        this._voxelSize = voxelSize;
        this._halfVoxel = voxelSize / 2;
        
        this._updateOverlap();
    }

    private _updateOverlap() {
        this._voxelRange.x = (this._worldSize.x / this._voxelSize) + 1;
        this._voxelRange.y = (this._worldSize.y / this._voxelSize) + 1;
        this._voxelRange.z = (this._worldSize.z / this._voxelSize) + 1;
        this._stride.x = this._voxelRange.x + seamExtraDouble;
        this._stride.y = this._stride.x * (this._voxelRange.y + seamExtraDouble);
        this._numSamples = this._stride.y * (this._voxelRange.z + seamExtraDouble);
        if (this._numSamples > 65536)
            throw "chunk resolution exceeds 65536. aborting";
    }

    /**
     * set which borders need to generate a seam 
     * at a lower resolution than the current chunk
     * higher resolution chunks always down sample to 
     * lower resolution never the other way around
     * @param seams bit flags indicating which borders need to be down samples
     * @param borderScale how many voxels deep the border is eg 2 if the bordering chunk is half the scale of this chunk
     */
    setBorderSeams(seams: number,borderScale: number) {
        this._borderSeams = seams;
        this._borderScale = borderScale;
    }

    resetBorders() {
        this.setBorderSeams(0, 1);
        this._updateOverlap();
    }


    /**
     * 
     * @param origin of the chunk in world coordinates
     */
    setPosition(origin: XYZ) {
        CopyXyz(origin,this._position);
    }

    voxelIndexToVoxelPosition(voxelIndex: number, voxelPosition: XYZ) {
        let index = voxelIndex;
        voxelPosition.x = (voxelIndex % this._stride.x);
        index -= voxelPosition.x;
        voxelPosition.y = ((index % this._stride.y) / this._stride.x);
        index -= voxelPosition.y * this._stride.x;
        voxelPosition.z = (index / this._stride.y);
        voxelPosition.x -= seamExtra;
        voxelPosition.y -= seamExtra;
        voxelPosition.z -= seamExtra;
        // if (voxelPosition.x < -seamExtra || voxelPosition.y < -seamExtra || voxelPosition.z < -seamExtra)
        //     debugger;
        // if (voxelPosition.x > this._voxelRange.x + seamExtra ||
        //     voxelPosition.y > this._voxelRange.y + seamExtra ||
        //     voxelPosition.z > this._voxelRange.z + seamExtra)
        //     debugger;
    }
    
    indexToWorldSpace(index: number, samplePoint: XYZ) {
        this.voxelIndexToVoxelPosition(index,voxelPosition);
        this.voxelSpaceToWorldSpace(voxelPosition, samplePoint);
    }

    // get the index of array at this coordinate
    voxelIndex(x: number, y: number, z: number): number {
        x += seamExtra;
        y += seamExtra;
        z += seamExtra;
        return x + (y * this._stride.x) + (z * this._stride.y);
    }
    
    voxelSpaceToWorldSpace(voxel: XYZ, samplePoint: XYZ, borderSize = 1) {
        // if (voxel.x < -seamExtra || voxel.y < -seamExtra || voxel.z < -seamExtra)
        //     debugger;
        // if (voxel.x > this._voxelRange.x + seamExtra ||
        //     voxel.y > this._voxelRange.y + seamExtra ||
        //     voxel.z > this._voxelRange.z + seamExtra)
        //     debugger;
        
        const offset = (this._voxelSize * borderSize) * 0.5; 
        samplePoint.x = this._position.x + (voxel.x * this._voxelSize) - offset;
        samplePoint.y = this._position.y + (voxel.y * this._voxelSize) - offset;
        samplePoint.z = this._position.z + (voxel.z * this._voxelSize) - offset;
    }

    toggleWireframe() {
        if (this._chunkMesh == null) return;
        if (this._chunkMesh.material == null) return;
        this._chunkMesh.material.wireframe = !this._chunkMesh?.material?.wireframe;
    }

    updateMesh(field: SignedDistanceField): boolean {
        //Create a vertexData object
        this._vertexData.positions = [];
        this._vertexData.indices = [];
        
        const extracted = ExtractSurface(
            this,
            field,
            this._vertexData.positions as number[],
            this._vertexData.indices as number[])

        if (extracted) {
            this._newChunkMesh = new Mesh("custom");

            this._newChunkMesh.name = this.toString();
            const material = new StandardMaterial("meshMaterial");
            material.diffuseColor.set(0, 0, 0);

            material.wireframe = false;
            material.backFaceCulling = true;
            this._newChunkMesh.material = material;

            //Calculations of normals added
            VertexData.ComputeNormals(this._vertexData.positions, this._vertexData.indices, normals)

            this._vertexData.normals = normals

            //Apply vertexData to custom mesh
            this._vertexData.applyToMesh(this._newChunkMesh, false)

            // edge rendering has to be turned on after the mesh is created
            this._newChunkMesh.enableEdgesRendering(Math.PI * 1.1);
            this._newChunkMesh.edgesWidth = this._voxelSize * 15;
            const edgeColor = new Color3(0, 1, 1);
            Color3.HSVtoRGBToRef(Math.random() * 360, 0.5 + Math.random() / 2, 1, edgeColor);
            this._newChunkMesh.edgesColor = new Color4(edgeColor.r, edgeColor.g , edgeColor.b, 1);

            this._newChunkMesh.isVisible = false;

        }
        return extracted;
    }

    swapMeshes(scene: Scene, showChunkBounds: boolean) {
        if (this._chunkMesh) {
            this._chunkMesh.isVisible = false;
            scene.removeMesh(this._chunkMesh);
            this._chunkMesh.dispose();
            this._chunkMesh = null;
        }
        if (this._newChunkMesh) {
            if (this._markedForRemoval) {
                scene.removeMesh(this._newChunkMesh);
                this._newChunkMesh.dispose();
                this._newChunkMesh = null;
            }
            else {
                this._newChunkMesh.isVisible = true;
                scene.addMesh(this._newChunkMesh);
                this._chunkMesh = this._newChunkMesh;
                this._newChunkMesh = null;

                // if (showChunkBounds) {
                //     const chunkBounds = MeshBuilder.CreateBox("Chunk Bounds" + this.toString(), { size: this._worldSize.x }, scene);
                //     const boundsMaterial = new StandardMaterial("boundsMaterial", scene);
                //     chunkBounds.position.copyFrom(this._position);
                //     chunkBounds.position.addInPlace(this._worldSize.scale(0.5));
                //     boundsMaterial.diffuseColor = new Color3(1, 1, 1);
                //     boundsMaterial.emissiveColor = new Color3(1, 1, 1);
                //     boundsMaterial.wireframe = true;
                //     chunkBounds.material = boundsMaterial;
                //     chunkBounds.isVisible = true;
                // }
            }
        }
    }

    updateCurrentBounds() {
        const aabb = this.currentBounds as AxisAlignedBoxBound;
        aabb.set(
            this._position.x,
            this._position.y,
            this._position.z, 
            this._position.x + this._worldSize.x,
            this._position.y + this._worldSize.y,
            this._position.z + this._worldSize.z);
    }

    updateSharedBorders(newChunk: Chunk) {
        
        if (this._voxelSize == newChunk._voxelSize)
            return;

        let largerChunk: Chunk;
        let smallerChunk: Chunk;

        if (this._voxelSize < newChunk._voxelSize)
        {
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            smallerChunk = this;
            largerChunk = newChunk;
        }
        else
        {
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            largerChunk = this;
            smallerChunk = newChunk;
        }


        
        const smallerBounds = smallerChunk.currentBounds as AxisAlignedBoxBound;
        const largerBounds = largerChunk.currentBounds as AxisAlignedBoxBound;

        let sharedFace = false;

        // shared border on the x axis
        if (largerBounds.minX == smallerBounds.maxX &&
            largerBounds.minY < smallerBounds.maxY && largerBounds.maxY > smallerBounds.minY &&
            largerBounds.minZ < smallerBounds.maxZ && largerBounds.maxZ > smallerBounds.minZ)
        {
            largerChunk._borderSeams |= BORDERS.xMin;
            smallerChunk._borderSeams |= BORDERS.xMax;
            sharedFace = true;
        }
        if (largerBounds.maxX == smallerBounds.minX &&
            largerBounds.minY < smallerBounds.maxY && largerBounds.maxY > smallerBounds.minY &&
            largerBounds.minZ < smallerBounds.maxZ && largerBounds.maxZ > smallerBounds.minZ)
        {
            largerChunk._borderSeams |= BORDERS.xMax;
            smallerChunk._borderSeams |= BORDERS.xMin;
            sharedFace = true;
        }

        // shared border on the y axis
        if (largerBounds.minY == smallerBounds.maxY &&
            largerBounds.minX < smallerBounds.maxX && largerBounds.maxX > smallerBounds.minX &&
            largerBounds.minZ < smallerBounds.maxZ && largerBounds.maxZ > smallerBounds.minZ)
        {
            largerChunk._borderSeams |= BORDERS.yMin;
            smallerChunk._borderSeams |= BORDERS.yMax;
            sharedFace = true;
        }
        if (largerBounds.maxY == smallerBounds.minY &&
            largerBounds.minX < smallerBounds.maxX && largerBounds.maxX > smallerBounds.minX &&
            largerBounds.minZ < smallerBounds.maxZ && largerBounds.maxZ > smallerBounds.minZ)
        {
            largerChunk._borderSeams |= BORDERS.yMax;
            smallerChunk._borderSeams |= BORDERS.yMin;
            sharedFace = true;
        }

        // shared border on the z axis
        if (largerBounds.minZ == smallerBounds.maxZ &&
            largerBounds.minX < smallerBounds.maxX && largerBounds.maxX > smallerBounds.minX &&
            largerBounds.minY < smallerBounds.maxY && largerBounds.maxY > smallerBounds.minY)
        {
            largerChunk._borderSeams |= BORDERS.zMin;
            smallerChunk._borderSeams |= BORDERS.zMax;
            sharedFace = true;
        }
        if (largerBounds.maxZ == smallerBounds.minZ &&
            largerBounds.minX < smallerBounds.maxX && largerBounds.maxX > smallerBounds.minX &&
            largerBounds.minY < smallerBounds.maxY && largerBounds.maxY > smallerBounds.minY)
        {
            largerChunk._borderSeams |= BORDERS.zMax;
            smallerChunk._borderSeams |= BORDERS.zMin;
            sharedFace = true;
        }

        if (sharedFace) {
            const borderScale = largerChunk._voxelSize / smallerChunk._voxelSize;
            smallerChunk._borderScale = borderScale;
         }
    }

    toString() {
        return `Origin: ${this._position.x},${this._position.y},${this._position.z} Size: ${this._worldSize.x},${this._worldSize.y},${this._worldSize.z} VoxelSize: ${this._voxelSize}`;
    }
}


function CopyXyz (src: XYZ, dest: XYZ) {
    dest.x = src.x;
    dest.y = src.y;
    dest.z = src.z;
}

function CopyXy (src: XY, dest: XY) {
    dest.x = src.x;
    dest.y = src.y;
}

export {Chunk, CORNERS,BORDERS, XYZ,XY,CopyXyz,CopyXy}

