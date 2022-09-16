import { Scene, StandardMaterial } from "@babylonjs/core"
import { Nullable } from "@babylonjs/core";
import { Color3, Vector3 } from "@babylonjs/core/Maths";
import { Mesh, VertexData } from "@babylonjs/core/Meshes"
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

/**
 * Make working with a 1 dimensional array work like a 3d array
 * by working out the index in the 1d array
 * Doesn't actually reference the array itself
 */
class Chunk implements IhasBounds {


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
    
    copyOriginTo(destination: Vector3) {
        destination.copyFrom(this._origin);
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
        return this._origin.equals(newChunk._origin);
    }

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
    private _origin = new Vector3();
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

    private _vertexData = new VertexData();

    private _chunkMesh: Nullable<Mesh> = null;
        
    currentBounds: Bounds;

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
        CopyXyz(size,this._worldSize)
        this._voxelSize = voxelSize;
        this._halfVoxel = voxelSize / 2;
 
        this._origin.x -= voxelSize / 2;
        this._origin.y -= voxelSize / 2;
        this._origin.z -= voxelSize / 2;
        
        this._updateOverlap(1);
    }

    private _updateOverlap(overlap: number) {
        this._voxelRange.x = (this._worldSize.x / this._voxelSize) + overlap;
        this._voxelRange.y = (this._worldSize.y / this._voxelSize) + overlap;
        this._voxelRange.z = (this._worldSize.z / this._voxelSize) + overlap;
        this._stride.x = this._voxelRange.x + 1;
        this._stride.y = this._stride.x * (this._voxelRange.y + 1);
        this._numSamples = this._stride.y * (this._voxelRange.z + 1);
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

    /**
     * 
     * @param origin of the chunk in world coordinates
     */
    setOrigin(origin: XYZ) {
        CopyXyz(origin,this._origin);
    }

    voxelIndexToVoxelPosition(voxelIndex: number, voxelPosition: XYZ) {
        let index = voxelIndex;
        voxelPosition.x = voxelIndex % this._stride.x;
        index -= voxelPosition.x;
        voxelPosition.y = (index % this._stride.y) / this._stride.x;
        index -= voxelPosition.y * this._stride.x;
        voxelPosition.z = index / this._stride.y;
    }
    
    indexToWorldSpace(index: number, samplePoint: XYZ) {
        this.voxelIndexToVoxelPosition(index,voxelPosition);
        this.voxelSpaceToWorldSpace(voxelPosition, samplePoint);
    }

    // get the index of array at this coordinate
    voxelIndex(x: number, y: number, z: number): number {
        return x + (y * this._stride.x) + (z * this._stride.y);
    }
    
    voxelSpaceToWorldSpace(voxel: XYZ, samplePoint: XYZ) {
        samplePoint.x = this._origin.x + (voxel.x * this._voxelSize);
        samplePoint.y = this._origin.y + (voxel.y * this._voxelSize);
        samplePoint.z = this._origin.z + (voxel.z * this._voxelSize);
    }

    createMesh(scene: Scene) {
        this._chunkMesh = new Mesh("custom", scene);
        const material = new StandardMaterial("meshMaterial", scene);
        material.diffuseColor = new Color3(1, 0, 0);
        Color3.HSVtoRGBToRef(Math.random() * 360, 0.5 + Math.random() / 2, 1, material.diffuseColor);
        material.emissiveColor.copyFrom(material.diffuseColor);
        material.emissiveColor.scale(0.5);
        material.wireframe = true;
        material.backFaceCulling = false;
        this._chunkMesh.material = material;
        //Create a vertexData object
        this._vertexData.positions = [];
        this._vertexData.indices = [];
    }

    toggleWireframe() {
        if (this._chunkMesh == null) return;
        if (this._chunkMesh.material == null) return;
        this._chunkMesh.material.wireframe = !this._chunkMesh?.material?.wireframe;
    }

    updateMesh(field: SignedDistanceField) {
        if (this._chunkMesh == null) return;
        
        this._chunkMesh.name = "chunk at " + this._origin.x + " " + this._origin.y + " " + this._origin.z + " " + this._worldSize.x + " " + this._worldSize.y + " " + this._worldSize.z + " " + this._voxelSize;
        const extracted = ExtractSurface(
            this,
            field,
            this._vertexData.positions as number[],
            this._vertexData.indices as number[])

        if (extracted) {

            //Calculations of normals added
            VertexData.ComputeNormals(this._vertexData.positions, this._vertexData.indices, normals)

            this._vertexData.normals = normals

            //Apply vertexData to custom mesh
            this._vertexData.applyToMesh(this._chunkMesh, false)

            this._chunkMesh.isVisible = true
        }
        else
            this._chunkMesh.isVisible = false;
    }

    updateCurrentBounds() {
        const aabb = this.currentBounds as AxisAlignedBoxBound;
        aabb.set(
            this._origin.x,
            this._origin.y,
            this._origin.z, 
            this._origin.x + this._worldSize.x,
            this._origin.y + this._worldSize.y,
            this._origin.z + this._worldSize.z);
    }

    updateSharedBorders(newChunk: Chunk) {
        if (this._voxelSize == newChunk._voxelSize)
            return;
        let largerChunk: Chunk;
        let smallerChunk: Chunk;

        if (this._voxelSize < newChunk._voxelSize)
        {
            smallerChunk = this;
            largerChunk = newChunk;
        }
        else
        {
            largerChunk = this;
            smallerChunk = newChunk;
        }
        const borderScale = largerChunk._voxelSize / smallerChunk._voxelSize;
        smallerChunk._borderScale = borderScale;

        largerChunk._borderScale = 1;
        const smallerBounds = smallerChunk.currentBounds as AxisAlignedBoxBound;
        const largerBounds = largerChunk.currentBounds as AxisAlignedBoxBound;
        if (smallerBounds.maxX == largerBounds.minX)
        {
            smallerChunk._borderSeams |= BORDERS.xMax;
            largerChunk._borderSeams |= BORDERS.xMin;
        }
        if (smallerBounds.minX == largerBounds.maxX)
        {
            smallerChunk._borderSeams |= BORDERS.xMin;
            largerChunk._borderSeams |= BORDERS.xMax;
        }
        if (smallerBounds.maxY == largerBounds.minY)
        {
            smallerChunk._borderSeams |= BORDERS.yMax;
            largerChunk._borderSeams |= BORDERS.yMin;
        }
        if (smallerBounds.minY == largerBounds.maxY)
        {
            smallerChunk._borderSeams |= BORDERS.yMin;
            largerChunk._borderSeams |= BORDERS.yMax;
        }
        if (smallerBounds.maxZ == largerBounds.minZ)
        {
            smallerChunk._borderSeams |= BORDERS.zMax;
            largerChunk._borderSeams |= BORDERS.zMin;
        }
        if (smallerBounds.minZ == largerBounds.maxZ)
        {
            smallerChunk._borderSeams |= BORDERS.zMin;
            largerChunk._borderSeams |= BORDERS.zMax;
        }
    }

    // toString
    toString() {
        return `Origin: ${this._origin.x},${this._origin.y},${this._origin.z} Size: ${this._worldSize.x},${this._worldSize.y},${this._worldSize.z} VoxelSize: ${this._voxelSize}`;
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

