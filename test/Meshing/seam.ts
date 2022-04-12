import { Chunk, ExtractSeam } from "../";

export function TestSeam() 
{  

describe('Generate Seams', () => {

    it('Seam range is where chunks of same size meet', () => {
        const chunk1 = new Chunk(4,16);

        const chunk2 = new Chunk(4,8);

        const seamRange = new Float32Array(6);

        chunk1.setOrigin(0,0,0);
        chunk2.setOrigin(4,0,0);
        Chunk.seamRange(chunk1, chunk2, seamRange);
        expect([... seamRange]).toEqual([4, 4, 0, 4, 0, 4 ]);

        chunk1.setOrigin(4,0,0);
        chunk2.setOrigin(0,0,0);
        Chunk.seamRange(chunk1, chunk2, seamRange);
        expect([... seamRange]).toEqual([4, 4, 0, 4, 0, 4 ]);

        chunk1.setOrigin(0,0,0);
        chunk2.setOrigin(0,4,0);
        Chunk.seamRange(chunk1, chunk2, seamRange);
        expect([... seamRange]).toEqual([0, 4, 4, 4, 0, 4 ]);
        
        chunk1.setOrigin(0,4,0);
        chunk2.setOrigin(0,0,0);
        Chunk.seamRange(chunk1, chunk2, seamRange);
        expect([... seamRange]).toEqual([0, 4, 4, 4, 0, 4 ]);
                
        chunk1.setOrigin(0,0,0);
        chunk2.setOrigin(0,0,4);
        Chunk.seamRange(chunk1, chunk2, seamRange);
        expect([... seamRange]).toEqual([0, 4, 0, 4, 4, 4 ]);
                        
        chunk1.setOrigin(0,0,0);
        chunk2.setOrigin(0,0,4);
        Chunk.seamRange(chunk1, chunk2, seamRange);
        expect([... seamRange]).toEqual([0, 4, 0, 4, 4, 4 ]);
    });

    it('Seam range is where chunks of different size meet', () => {
        const chunk1 = new Chunk(8,16);

        const chunk2 = new Chunk(4,8);

        const seamRange = new Float32Array(6);

        chunk1.setOrigin(0,0,0);
        chunk2.setOrigin(8,0,0);
        Chunk.seamRange(chunk1, chunk2, seamRange);
        expect([... seamRange]).toEqual([8, 8, 0, 4, 0, 4 ]);

        chunk1.setOrigin(4,0,0);
        chunk2.setOrigin(0,0,0);
        Chunk.seamRange(chunk1, chunk2, seamRange);
        expect([... seamRange]).toEqual([4, 4, 0, 4, 0, 4 ]);

        chunk1.setOrigin(0,0,0);
        chunk2.setOrigin(0,8,0);
        Chunk.seamRange(chunk1, chunk2, seamRange);
        expect([... seamRange]).toEqual([0, 4, 8, 8, 0, 4 ]);
        
        chunk1.setOrigin(0,4,0);
        chunk2.setOrigin(0,0,0);
        Chunk.seamRange(chunk1, chunk2, seamRange);
        expect([... seamRange]).toEqual([0, 4, 4, 4, 0, 4 ]);
                
        chunk1.setOrigin(0,0,0);
        chunk2.setOrigin(0,0,8);
        Chunk.seamRange(chunk1, chunk2, seamRange);
        expect([... seamRange]).toEqual([0, 4, 0, 4, 8, 8 ]);
                        
        chunk1.setOrigin(0,0,4);
        chunk2.setOrigin(0,0,0);
        Chunk.seamRange(chunk1, chunk2, seamRange);
        expect([... seamRange]).toEqual([0, 4, 0, 4, 4, 4 ]);
    });
});

}
