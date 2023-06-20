import { Vector3,Scene } from "@babylonjs/core";
import { AxisAlignedBoxBound, Bounds } from "./Bounds";
import { SignedDistanceField, SdfUnionFromSparseSet, sdfPool, Chunk, BORDERS } from "..";
import { SparseOctTree } from "."
import { LinkedList, LinkedListNode } from "../Collection/LinkedList";
import { systemSettings } from "../SystemSettings";
import { StateMachineBuilder, StateMachine, StateHandler } from '..';
import { ResourcePool } from '..';
import { SparseSet } from '../Collection/SparseSet';

const chunkBounds = new AxisAlignedBoxBound(0, 0, 0, 0, 0, 0);
const worldSize = 16384;
const halfWorld = worldSize / 2;
const nearbyChunks = new SparseSet(1000);
let maxUpdatesPerFrame = 10000;
const connectedBounds = new AxisAlignedBoxBound();
const DEFAULT_POOL_SIZE = 1000;

let logTime = 0;
let lastLogTime = 0;

function LogChunkQueueLength(length: number) {
    if (systemSettings.showChunkQueueLength && logTime > lastLogTime + 1000) {
        console.log((logTime / 1000).toLocaleString(), "chunk queue length", length);
        lastLogTime = logTime;
    }
}

const CHUNK_STATES = {
    new: 0,
    remove:0,
    showMesh: 0,
    updateMesh: 0,
    rescale: 0
}

class ChunkManager {
    private _viewOrigin: Vector3 = new Vector3();
    private _newOrigin: Vector3 = new Vector3();
    private _worldBounds: AxisAlignedBoxBound;
    private _chunkTree: SparseOctTree<Chunk>;
    private _fieldTree: SparseOctTree<SignedDistanceField>;
    private _chunkFields = new SparseSet(DEFAULT_POOL_SIZE);
    private _chunkSdf = new SdfUnionFromSparseSet(this._chunkFields);
    private _dirtyChunks = new SparseSet(DEFAULT_POOL_SIZE);
    private _rescaleChunks = new SparseSet(DEFAULT_POOL_SIZE);
    private _changedFields = new SparseSet(DEFAULT_POOL_SIZE);
    private _viewOriginUpdates: Vector3[] = [];
    private _meshUpdatesInProgress = false;
    private _chunkPool = new ResourcePool<Chunk>(() => new Chunk(), (chunk) => chunk.reset(),DEFAULT_POOL_SIZE);
    private _stateBuilder = new StateMachineBuilder<Chunk>(this._chunkPool);
    private _stateMachine: StateMachine<Chunk>;
    private _scene: Scene | null = null;

    constructor() {
        this._worldBounds = new AxisAlignedBoxBound(-halfWorld,-halfWorld,-halfWorld,halfWorld,halfWorld,halfWorld)
        this._chunkTree = new SparseOctTree<Chunk>(this._worldBounds, 32, 4);
        this._fieldTree = new SparseOctTree<SignedDistanceField>(this._worldBounds, 32, 4);
        let scale = worldSize;
        // view origin updates are used to track when chunks need to be rescaled
        // we need to track the view origin at different scales
        // so we can detect when the view origin has moved more than half a chunk
        // at that scale
        while (scale >= 1) {
            this._viewOriginUpdates.push(new Vector3());
            scale /= 2;
        }
        this._stateMachine = this._setupStateMachine();
     }

    private _setupStateMachine() {
        const stateBuilder = this._stateBuilder;

        // CHUNK_STATES.new = stateBuilder.registerState("new chunk");
        CHUNK_STATES.remove = stateBuilder.registerState("remove chunk");
        CHUNK_STATES.showMesh = stateBuilder.registerState("display mesh");
        CHUNK_STATES.updateMesh = stateBuilder.registerState("update mesh");
        CHUNK_STATES.rescale = stateBuilder.registerState("rescale");

        // const newChunkHandler = stateBuilder.registerHandler(CHUNK_STATES.new)
        //     .setName("new chunk")
        //     .onEntry(this._onNewChunks.bind(this));
        
        const rescaleHandler = stateBuilder.registerHandler(CHUNK_STATES.rescale)
            .setName("rescale")
            .onEntry(this._onRescaleChunks.bind(this));
        
        const updateMeshHandler = stateBuilder.registerHandler(CHUNK_STATES.updateMesh)
            .setName("update mesh")
            .onTick(this._onUpdateMeshes.bind(this));
        
        const showMeshHandler = stateBuilder.registerHandler(CHUNK_STATES.showMesh)
            .setName("show mesh")
            .onTick(this._onShowMesh.bind(this));
        
        const removeChunkHandler = stateBuilder.registerHandler(CHUNK_STATES.remove)
            .setName("remove chunk")
            .onTick(this._onRemoveChunks.bind(this));
        
        stateBuilder.registerPipeline(
            //newChunkHandler,
            rescaleHandler,
            updateMeshHandler,
            showMeshHandler,
            removeChunkHandler
        )

        return stateBuilder.create();
    }

    setViewOrigin(origin: Vector3) {
        this._newOrigin.copyFrom(origin);
        // if there are no chunks, we need to set the view origin
        // to it's initial value
        if (this._chunkTree.rootNode.totalItems === 0) {
            this._viewOrigin.copyFrom(origin);
            for (let i = 0; i < this._viewOriginUpdates.length; i++) {
                this._viewOriginUpdates[i].copyFrom(origin);
            }
        }
    }

    addField(field: SignedDistanceField) {
        // TODO add and update field could be one function?
        // do we need to do anything with the field tree at this point?
        this._createChunksForBounds(field.currentBounds, -halfWorld, -halfWorld, -halfWorld, halfWorld, halfWorld, halfWorld);
        this._fieldTree.insert(field);
        this._changedFields.add(field.poolId);
    }

    updateField(field: SignedDistanceField) {
        this._changedFields.add(field.poolId);
    }

    private _processFieldChanges() {
        const changedFieldIds = this._changedFields.allIndex();
        const usedCount = this._changedFields.usedCount;
        for (let i=0; i<usedCount; i++) {
            const field = sdfPool.getItem(changedFieldIds[i]);
            field?.commitUpdate();
        }
        for (let i=0; i<changedFieldIds.length; i++) {
            const field = sdfPool.getItem(changedFieldIds[i]);
            if (!field) continue;
            // mark any existing chunks within the fields current bounds as dirty
            this._chunkTree.getItemsInSphere(field.currentBounds, this._dirtyChunks);
            // ensure all chunks within the fields current bounds are created and updated
            this._createChunksForBounds(field.currentBounds, -halfWorld, -halfWorld, -halfWorld, halfWorld, halfWorld, halfWorld);

            // move the field to it's new position and new bounds
            this._fieldTree.update(field, field.newBounds);

            // ensure all chunks within the fields new bounds are created and updated
            this._createChunksForBounds(field.currentBounds, -halfWorld, -halfWorld, -halfWorld, halfWorld, halfWorld, halfWorld);
            // ensure any existing chunks within the fields new bounds are marked as dirty
            this._chunkTree.getItemsInSphere(field.currentBounds, this._dirtyChunks);
        }
        this._changedFields.clear();
    }
    
    private _createChunksForBounds(bounds: Bounds, minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
        const voxels = 16;  //Math.max(8,1 << 31 - Math.clz32(32 - (chunkDist / 2)));
        
        // fast rejection, compare chunk bounds to bounds
        chunkBounds.set(minX, minY, minZ, maxX, maxY, maxZ);
        if (!chunkBounds.overlaps(bounds)) {
            // sdf does not overlap chunk bounds so skip it
            return;
        }

        const chunkExtent = chunkBounds.extent;

        // note chunkDist will be negative if origin is inside the chunk
        const chunkDist = chunkBounds.distanceTo(this._viewOrigin);

        const targetSize = this._targetChunkSizeForDistance(chunkDist);
        
        const halfExtent = (maxX - minX) / 2;
        const viewPointInChunk = chunkDist < 0;
        // use larger chunks further away
        if ((viewPointInChunk && halfExtent > 1) || chunkExtent > targetSize) {
            // subdivide chunk bounds until it is smaller than the target scale
            const middleX = minX + halfExtent;
            const middleY = minY + halfExtent;
            const middleZ = minZ + halfExtent;
            this._createChunksForBounds(bounds,
                minX,       minY,      minZ,
                middleX,    middleY,   middleZ);
            this._createChunksForBounds(bounds,
                middleX,    minY,       minZ,
                maxX,       middleY,    middleZ);
            this._createChunksForBounds(bounds,
                minX,       middleY,    minZ,
                middleX,    maxY,       middleZ);
            this._createChunksForBounds(bounds,
                middleX,    middleY,    minZ,
                maxX,       maxY,       middleZ);
            this._createChunksForBounds(bounds,
                minX,       minY,       middleZ,
                middleX,    middleY,    maxZ);
            this._createChunksForBounds(bounds,
                middleX,    minY,       middleZ,
                maxX,       middleY,    maxZ);
            this._createChunksForBounds(bounds,
                minX,       middleY,    middleZ,
                middleX,    maxY,       maxZ);
            this._createChunksForBounds(bounds,
                middleX,    middleY,    middleZ,
                maxX,       maxY,       maxZ);
        }
        else {
            // chunk bounds is smaller than the target scale, so create this chunk
            systemSettings.debugCounters.chunksCreated++;
            
            const extent = chunkBounds.extent;
            // use fewer voxels per chunk further away
            const stateMachine = this._stateMachine;
            const newChunkId = this._stateMachine.newId()
            const newChunk = this._stateMachine.getItem(newChunkId);
            if (newChunk != null) {
                newChunk.setPosition({ x: chunkBounds.minX, y: chunkBounds.minY, z: chunkBounds.minZ });
                newChunk.setSize({ x: extent, y: extent, z: extent }, extent / voxels);
            
                newChunk.updateCurrentBounds();

                nearbyChunks.clear();

                this._chunkTree.getItemsInBox(chunkBounds, nearbyChunks);
                const stateMachine = this._stateMachine;
                const nearbyChunksIds = nearbyChunks.allIndex();
                const usedCount = nearbyChunks.usedCount;
                for (let i=0; i<usedCount; i++) {
                    const nearChunk = this._chunkPool.getItem(nearbyChunksIds[i]);
                    if (!nearChunk)
                        continue;
                    if (nearChunk.currentBounds.extent == newChunk.currentBounds.extent &&
                        nearChunk.isAtSamePositionAs(newChunk) &&
                        !stateMachine.isInState(nearChunk.poolId, CHUNK_STATES.remove)) {
                        systemSettings.debugCounters.chunksSkipped++;

                        stateMachine.releaseId(newChunkId);
                        return;
                    }
                    else {
                        let markForRemoval = false;
                        if (nearChunk.currentBounds.overlapAABB(newChunk.currentBounds)) {
                            markForRemoval = true;
                            stateMachine.addState(nearChunk.poolId, CHUNK_STATES.remove);
                        }
                    }

                }

                this._chunkTree.insert(newChunk);
                stateMachine.addState(newChunkId, CHUNK_STATES.updateMesh);
            }
 
        }
    }

    private _targetChunkSizeForDistance(chunkDist: number) {
        const scalingFactor = 0.50741;
        const targetSize = Math.max(chunkDist * scalingFactor, 5);
        return targetSize;
    }

    private static _viewDelta = new Vector3();
    private static _viewDeltaBounds = new AxisAlignedBoxBound(0, 0, 0, 0, 0, 0);

    private _checkIfViewOriginChangesChunkScales() {
        if (this._meshUpdatesInProgress)
            return;
        
        if (this._newOrigin.equalsWithEpsilon(this._viewOrigin, 0.0001))
            return;
        
        const viewDelta = ChunkManager._viewDelta;
        let scale = worldSize;
        let i = this._viewOriginUpdates.length - 1;
        while (scale >= 1) {
            // check if the view origin has moved more than half a chunk at this scale
            viewDelta.copyFrom(this._newOrigin);
            viewDelta.subtractInPlace(this._viewOriginUpdates[i]);
            if (viewDelta.length() > scale / 2) {
                this._viewOriginUpdates[i].copyFrom(this._newOrigin);
                break;
            }
            scale /= 2;
            i--;
        }
        // reset the view origin updates for scales smaller than the current scale
        while (i >= 0) {
            this._viewOriginUpdates[i].copyFrom(this._newOrigin);
            i--;
        }

        if (scale > 1) {
            this._rescaleChunks.clear();
            // get all chunks that are in range of the old and new view origins at the current scale
            ChunkManager._viewDeltaBounds.set(
                this._viewOrigin.x - scale, this._viewOrigin.y - scale, this._viewOrigin.z - scale,
                this._viewOrigin.x + scale, this._viewOrigin.y + scale, this._viewOrigin.z + scale);
            this._chunkTree.getItemsInBox(ChunkManager._viewDeltaBounds, this._rescaleChunks);

            ChunkManager._viewDeltaBounds.set(
                this._newOrigin.x - scale, this._newOrigin.y - scale, this._newOrigin.z - scale,
                this._newOrigin.x + scale, this._newOrigin.y + scale, this._newOrigin.z + scale);
            this._chunkTree.getItemsInBox(ChunkManager._viewDeltaBounds, this._rescaleChunks);

            this._viewOrigin.copyFrom(this._newOrigin);

            // examine chunks that have changed scale
            const rescaleChunksIds = this._rescaleChunks.allIndex();
            const usedCount = this._rescaleChunks.usedCount;
            for (let i=0; i<usedCount; i++) {
                const chunk = this._chunkPool.getItem(rescaleChunksIds[i]);
                if (!chunk)
                    continue;
                const chunkDist = chunk.currentBounds.distanceTo(this._viewOrigin);
                const targetSize = Math.max(this._targetChunkSizeForDistance(chunkDist), 3);
                // round target size down to nearest power of 2
                const targetScale = Math.pow(2, Math.floor(Math.log2(targetSize)));

                if (chunk.currentBounds.extent != targetScale) {
                    this._stateMachine.addState(chunk.poolId, CHUNK_STATES.rescale);
                }
            }
        }
    }
    
    updateChangedMeshes(scene: Scene, deltaTime: number) {
        if (deltaTime)
            logTime += deltaTime;
        
        if (!this._meshUpdatesInProgress) {
            this._checkIfViewOriginChangesChunkScales();

            this._processFieldChanges();

        } 

        this._scene = scene;
        if (logTime > 100) {
            this._stateMachine.logQueueLengths();
            logTime -= 100;
        }
        this._stateMachine.tick();
    }

    private _onRescaleChunks(stateMachine: StateMachine<Chunk>, allItems: Array<Chunk>, itemIds: Uint32Array, itemCount: number) {
        for (let i = 0; i < itemCount; i++) {
            const itemId = itemIds[i];
            const chunk = allItems[itemId];

            const chunkNeighbours = this._checkBordersWithNeighbours(chunk);
            this._stateMachine.addState(chunk.poolId, CHUNK_STATES.remove);
             connectedBounds.copy(chunk.currentBounds);

            // there's an edge case where neighboring chunks might need to be created when a chunk is rescaled
            // so we expand the bounds by half a chunk if it's not already fully surrounded by chunks
            if (chunkNeighbours != BORDERS.fullySurrounded) {
                const offset = chunk.currentBounds.extent;
                if (!(chunkNeighbours & BORDERS.xMax)) {
                    connectedBounds.minX -= offset;
                }
                if (!(chunkNeighbours & BORDERS.xMin)) {
                    connectedBounds.maxX += offset;
                }
                if (!(chunkNeighbours & BORDERS.yMax)) {
                    connectedBounds.minY -= offset;
                }
                if (!(chunkNeighbours & BORDERS.yMin)) {
                    connectedBounds.maxY += offset;
                }
                if (!(chunkNeighbours & BORDERS.zMax)) {
                    connectedBounds.minZ -= offset;
                }
                if (!(chunkNeighbours & BORDERS.zMin)) {
                    connectedBounds.maxZ += offset;
                }
            }

            this._createChunksForBounds(connectedBounds,
                -halfWorld, -halfWorld, -halfWorld, halfWorld, halfWorld, halfWorld);
            systemSettings.logDetails = false;
        }
    }

    static debugUpdates = 2;

    private _onUpdateMeshes(stateMachine: StateMachine<Chunk>, allItems: Array<Chunk>, itemIds: Uint32Array, itemCount: number) {
        const chunkFields = this._chunkFields;
        if (itemCount > 0 && !this._meshUpdatesInProgress) {
            this._meshUpdatesInProgress = true;
        }
        LogChunkQueueLength(itemCount);

        let updates = maxUpdatesPerFrame;
        let i: number;
        for (i = 0; i < itemCount && updates > 0; i++) {
            const itemId = itemIds[i];
            const chunk = allItems[itemId];
            
            let emptyChunk = true;
            // check if we need to overlap with neighbours if they are at a different scale
            this._checkBordersWithNeighbours(chunk);
            // this is for updating the mesh when a field changes
            chunkFields.clear();
            this._fieldTree.getItemsInBox(chunk.currentBounds, chunkFields);
            if (chunkFields.usedCount != 0) {
                emptyChunk = !chunk.updateMesh(this._chunkSdf);
                updates--;
            }

            stateMachine.removeState(chunk.poolId, CHUNK_STATES.updateMesh);
            if (emptyChunk) {
                systemSettings.debugCounters.emptyChunks++;
                stateMachine.addState(chunk.poolId, CHUNK_STATES.remove);
            }
            else {
                stateMachine.addState(chunk.poolId, CHUNK_STATES.showMesh);
            }
        }

        maxUpdatesPerFrame = 1;

        if (i == itemCount) {
            this._meshUpdatesInProgress = false;
        }
    }

    private _onShowMesh(stateMachine: StateMachine<Chunk>, allItems: Array<Chunk>, itemIds: Uint32Array, itemCount: number) {
        if (this._meshUpdatesInProgress)
            return;
        const scene = this._scene;
        if (scene) {
            for (let i = 0; i < itemCount; i++) {
                const itemId = itemIds[i];
                const chunk = allItems[itemId];
                
                chunk.swapMeshes(scene);
                stateMachine.removeState(itemId, CHUNK_STATES.showMesh);
            }
        }
    }

    private _onRemoveChunks(stateMachine: StateMachine<Chunk>, allItems: Array<Chunk>, itemIds: Uint32Array, itemCount: number) {
        if (this._meshUpdatesInProgress)
            return;
        const chunkTree = this._chunkTree;
        const scene = this._scene;

        if (scene) {
            for (let i = 0; i < itemCount; i++) {
                const itemId = itemIds[i];
                const chunk = allItems[itemId];

                chunk.removeMeshes(scene);

                chunkTree.remove(chunk);
                stateMachine.releaseId(itemId);
            }
        }
    }

    private _checkBordersWithNeighbours(chunk: Chunk) {
        chunk.resetBorders();
        chunkBounds.copy(chunk.currentBounds);
        chunkBounds.expandByScalar(0.1);
        nearbyChunks.clear();
        this._chunkTree.getItemsInBox(chunkBounds, nearbyChunks);
        let neighbours = 0;
        const stateMachine = this._stateMachine;
        const nearbyChunksIds = nearbyChunks.allIndex();
        const usedCount = nearbyChunks.usedCount;
        for (let i = 0; i < usedCount; i++) {
            const nearChunk = this._chunkPool.getItem(nearbyChunksIds[i]);
            if (!nearChunk)
                continue;
            if (!stateMachine.isInState(nearChunk.poolId, CHUNK_STATES.remove)) {
                const originalSeams = nearChunk.getBorderSeams();
                neighbours |= chunk.updateSharedBorders(nearChunk);
                if (originalSeams != nearChunk.getBorderSeams()) {
                    stateMachine.addState(nearChunk.poolId, CHUNK_STATES.updateMesh);
                }
            }
        }
        return neighbours;
    }

    public getChunkPool() {
        return this._chunkPool;
    }
}


export { ChunkManager };