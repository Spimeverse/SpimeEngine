import { Chunk } from "./Meshing/Chunk";

/* BaseLine view origin
totalSamples: 1,925,504
app.ts:273 chunksCreated: 3,223
app.ts:273 chunksSkipped: 1,341
app.ts:273 dirtyChunks: 2,069
app.ts:273 emptyChunks: 1,738
app.ts:273 chunkTimer: 4,699.5
*/

/* Selective chunk creation
totalSamples: 1,727,505
app.ts:276 chunksCreated: 5,782
app.ts:276 chunksSkipped: 3,704
app.ts:276 dirtyChunks: 2,264
app.ts:276 emptyChunks: 1,935
app.ts:276 chunkTimer: 5,310.7
*/

/* with connected chunks
totalSamples: 1,711,140
app.ts:273 chunksCreated: 227,255
app.ts:273 chunksSkipped: 219,480
app.ts:273 dirtyChunks: 6,843
app.ts:273 emptyChunks: 6,133
app.ts:273 chunkTimer: 7,412.2
*/

/* selective chunk creation
totalSamples: 1,976,129
app.ts:273 chunksCreated: 4,667
app.ts:273 chunksSkipped: 1,870
app.ts:273 dirtyChunks: 2,977
app.ts:273 emptyChunks: 2,288
app.ts:273 chunkTimer: 4,922.7
*/



class SystemSettings {
    initializeOriginToCamera = true;
    updateViewOrigin = true;

    debugChunks = false;
    showChunkBounds = false;
    showVoxelVertex = false;
    showVoxelBounds = false;
    showChunkQueueLength = true;
    logDetails = true;
    logStateHandler = true;

    debugCounters = {
        totalSamples: 0,
        chunksCreated: 0,
        chunksSkipped: 0,
        dirtyChunks: 0,
        emptyChunks: 0,
        updatedChunks: 0,
        chunkTimer: 0,
    }

    showVoxelRange = {
        x1: 16,
        x2: 20,
        y1: 0,
        y2: 20,
        z1: 0,
        z2: 20
    }

    targetChunks = [
        "Origin: 4,4,4 Size: 4,4,4 VoxelSize: 0.25"
    ];

    debugOnChunk(chunk: Chunk) {
        if (this.debugChunks && this.isTargetChunk(chunk)) {
            // log the calling method from the call stack
            let caller = "";
            const stack = new Error().stack;
            if (stack) {
                caller = stack.split("\n")[2];
            }
            console.log("debugOnChunk", );
            console.log(caller + "\ndebugOnChunk", chunk.toStringWithID());
            return true;
        } else {
            return false;
        }
    }

    isTargetChunk(chunk: Chunk) {
        const chunkID = chunk.toString();
        return this.targetChunks.indexOf(chunkID) != -1;
    }
}

const systemSettings = new SystemSettings();

export { systemSettings }