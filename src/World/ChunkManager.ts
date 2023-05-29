import { Vector3,Scene } from "@babylonjs/core";
import { AxisAlignedBoxBound, Bounds } from "./Bounds";
import { SignedDistanceField, Chunk, BORDERS } from "..";
import { SparseOctTree } from "."
import { SdfUnion } from "..";
import { LinkedList, LinkedListNode } from "../Collection/LinkedList";
import { systemSettings } from "../SystemSettings";
import { StateMachineBuilder, StateMachine, StateHandler } from '..';
import { ResourcePool } from '..';

const chunkBounds = new AxisAlignedBoxBound(0, 0, 0, 0, 0, 0);
const worldSize = 16384;
const halfWorld = worldSize / 2;
const nearbyChunks = new Set<Chunk>();
let maxUpdatesPerFrame = 10000;
const connectedBounds = new AxisAlignedBoxBound();

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
    private _chunkFields = new Set<SignedDistanceField>();
    private _unionFields = new SdfUnion(this._chunkFields);
    private _dirtyChunks = new Set<Chunk>();
    private _rescaleChunks = new Set<Chunk>();
    private _changedFields = new Set<SignedDistanceField>();
    private _viewOriginUpdates: Vector3[] = [];
    private _meshUpdatesInProgress = false;
    private _chunkPool = new ResourcePool<Chunk>((id) => new Chunk(id), (chunk) => chunk.reset(),1000);
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
    
    getChunks(chunks: Set<Chunk>) {
        this._chunkTree.getItemsInBox(this._worldBounds, chunks);
    }

    addField(field: SignedDistanceField) {
        // TODO add and update field could be one function?
        // do we need to do anything with the field tree at this point?
        this._createChunksForBounds(field.currentBounds, -halfWorld, -halfWorld, -halfWorld, halfWorld, halfWorld, halfWorld);
        this._fieldTree.insert(field);
        this._changedFields.add(field);
    }

    updateField(field: SignedDistanceField) {
        this._changedFields.add(field);
    }

    private _processFieldChanges() {
        for (const field of this._changedFields) {
            field.commitUpdate();
        }
        for (const field of this._changedFields) {
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
        
        // if (systemSettings.logDetails) {
        //     if (minX <= -8 && maxX >= -8 &&
        //         minY <= 8 && maxY >= 8 &&
        //         minZ <= -32 && maxZ >= -32)
        //         debugger;
        // }
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
            const newChunkId = this._stateMachine.addItem()
            const newChunk = this._stateMachine.getItem(newChunkId);
            if (newChunk != null) {
                newChunk.setPosition({ x: chunkBounds.minX, y: chunkBounds.minY, z: chunkBounds.minZ });
                newChunk.setSize({ x: extent, y: extent, z: extent }, extent / voxels);
            
                newChunk.updateCurrentBounds();

                nearbyChunks.clear();

                const log = systemSettings.debugOnChunk(newChunk);
                if (log) {
                    debugger;
                    console.log("Chunk bounds ", chunkBounds.toString());
                    console.log("newChunk: " + newChunk.toStringWithID());
                }

                this._chunkTree.getItemsInBox(chunkBounds, nearbyChunks);
                const stateMachine = this._stateMachine;
                for (const nearChunk of nearbyChunks) {
                    if (nearChunk.currentBounds.extent == newChunk.currentBounds.extent &&
                        nearChunk.isAtSamePositionAs(newChunk) &&
                        !stateMachine.isInState(nearChunk.id, CHUNK_STATES.remove)) {
                        systemSettings.debugCounters.chunksSkipped++;
                        //---- Debug code to log when a chunk is skipped
                        // new chunk is same as existing chunk, so skip it
                        if (log) {
                            console.log("already exists: " + nearChunk.toStringWithID());
                        }
                        //---- End debug code
                        if (systemSettings.debugOnChunk(newChunk)) debugger;
                        stateMachine.releaseItem(newChunkId);
                        return;
                    }
                    else {
                        let markForRemoval = false;
                        if (nearChunk.currentBounds.contains(newChunk.currentBounds)) {
                            //---- Debug code to log when a chunk is a parent
                            if (!stateMachine.isInState(nearChunk.id, CHUNK_STATES.remove)) {
                                if (log) {
                                    console.log("remove parent: " + nearChunk.toStringWithID());
                                }
                                //---- End debug code
                                markForRemoval = true;
                            }
                        }
                        if (newChunk.currentBounds.contains(nearChunk.currentBounds)) {
                            //---- Debug code to log when a chunk is a child
                            if (!stateMachine.isInState(nearChunk.id, CHUNK_STATES.remove)) {
                                if (log) {
                                    console.log("remove child: " + nearChunk.toStringWithID());
                                }
                                //---- End debug code
                                markForRemoval = true;
                            }
                        }

                        // mark existing chunk for removal
                        if (markForRemoval) {
                            if (systemSettings.debugOnChunk(nearChunk)) debugger;
                            stateMachine.addState(nearChunk.id, CHUNK_STATES.remove);
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
            // console.log("old bounds", ChunkManager._viewDeltaBounds.toString(),
            //     "view origin", this._viewOrigin.toString(),
            //     "rescale chunks", this._rescaleChunks.size);

            ChunkManager._viewDeltaBounds.set(
                this._newOrigin.x - scale, this._newOrigin.y - scale, this._newOrigin.z - scale,
                this._newOrigin.x + scale, this._newOrigin.y + scale, this._newOrigin.z + scale);
            this._chunkTree.getItemsInBox(ChunkManager._viewDeltaBounds, this._rescaleChunks);
            // console.log("new bounds", ChunkManager._viewDeltaBounds.toString(),
            //     "new origin", this._newOrigin.toString(),
            //     "rescale chunks", this._rescaleChunks.size);

            this._viewOrigin.copyFrom(this._newOrigin);

            // examine chunks that have changed scale
            for (const chunk of this._rescaleChunks) {
                const chunkDist = chunk.currentBounds.distanceTo(this._viewOrigin);
                const targetSize = Math.max(this._targetChunkSizeForDistance(chunkDist), 3);
                // round target size down to nearest power of 2
                const targetScale = Math.pow(2, Math.floor(Math.log2(targetSize)));

                //console.log("rescale, ",chunk.currentBounds.extent != targetScale,"chunk, ", chunk.toString(), " extent, ", chunk.currentBounds.extent, " target scale, ", targetScale);
                if (chunk.currentBounds.extent != targetScale) {
                    this._stateMachine.addState(chunk.id, CHUNK_STATES.rescale);
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

            if (systemSettings.logDetails)
                console.log("rescale chunk", chunk.toStringWithID());

            // console.log("rescale chunk", chunk.toString(), chunk.currentBounds.extent, targetScale);
            const chunkNeighbours = this._checkBordersWithNeighbours(chunk);
            if (systemSettings.debugOnChunk(chunk)) debugger;
            this._stateMachine.addState(chunk.id, CHUNK_STATES.remove);
            // chunk.markForRemoval();
            // this._dirtyChunks.add(chunk);
            connectedBounds.copy(chunk.currentBounds);
            if (systemSettings.isTargetChunk(chunk)) {
                systemSettings.logDetails = true;
                console.log(`origin update bounds ${connectedBounds.toDetailedString()}`);
            }
            // there's an edge case where neighboring chunks might need to be created when a chunk is rescaled
            // so we expand the bounds by half a chunk if it's not already fully surrounded by chunks
            if (chunkNeighbours != BORDERS.fullySurrounded) {
                const offset = chunk.currentBounds.extent;
                if (!(chunkNeighbours & BORDERS.xMax)) {
                    connectedBounds.minX -= offset;
                    if (systemSettings.logDetails) {
                        console.log(`- X ${connectedBounds.toDetailedString()}`);
                    }
                }
                if (!(chunkNeighbours & BORDERS.xMin)) {
                    connectedBounds.maxX += offset;
                    if (systemSettings.logDetails) {
                        console.log(`+ X ${connectedBounds.toDetailedString()}`);
                    }
                }
                if (!(chunkNeighbours & BORDERS.yMax)) {
                    connectedBounds.minY -= offset;
                    if (systemSettings.logDetails) {
                        console.log(`- Y ${connectedBounds.toDetailedString()}`);
                    }
                }
                if (!(chunkNeighbours & BORDERS.yMin)) {
                    connectedBounds.maxY += offset;
                    if (systemSettings.logDetails) {
                        console.log(`+ Y ${connectedBounds.toDetailedString()}`);
                    }
                }
                if (!(chunkNeighbours & BORDERS.zMax)) {
                    connectedBounds.minZ -= offset;
                    if (systemSettings.logDetails) {
                        console.log(`- Z ${connectedBounds.toDetailedString()}`);
                    }
                }
                if (!(chunkNeighbours & BORDERS.zMin)) {
                    connectedBounds.maxZ += offset;
                    if (systemSettings.logDetails) {
                        console.log(`+ Z ${connectedBounds.toDetailedString()}`);
                    }
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

            if (systemSettings.debugOnChunk(chunk)) debugger;
            
            let emptyChunk = true;
            // check if we need to overlap with neighbours if they are at a different scale
            this._checkBordersWithNeighbours(chunk);
            // this is for updating the mesh when a field changes
            chunkFields.clear();
            this._fieldTree.getItemsInBox(chunk.currentBounds, chunkFields);
            if (chunkFields.size != 0) {
                emptyChunk = !chunk.updateMesh(this._unionFields);
                updates--;
            }

            stateMachine.removeState(chunk.id, CHUNK_STATES.updateMesh);
            if (emptyChunk) {
                systemSettings.debugCounters.emptyChunks++;
                if (systemSettings.debugOnChunk(chunk)) debugger;
                stateMachine.addState(chunk.id, CHUNK_STATES.remove);
            }
            else {
                stateMachine.addState(chunk.id, CHUNK_STATES.showMesh);
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

                if (systemSettings.debugOnChunk(chunk)) debugger;
                
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

                if (systemSettings.debugOnChunk(chunk)) debugger;

                chunk.removeMeshes(scene);

                chunkTree.remove(chunk);
                stateMachine.releaseItem(itemId);
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
        for (const nearChunk of nearbyChunks) {
            if (!stateMachine.isInState(nearChunk.id, CHUNK_STATES.remove)) {
                const originalSeams = nearChunk.getBorderSeams();
                neighbours |= chunk.updateSharedBorders(nearChunk);
                if (originalSeams != nearChunk.getBorderSeams()) {
                    stateMachine.addState(nearChunk.id, CHUNK_STATES.updateMesh);
                }
            }
        }
        return neighbours;
    }

}


export { ChunkManager };