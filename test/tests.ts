import { TestSdfShapes,TestSdfTransforms } from "./signedDistanceFields";
import { TestMesher,TestChunkDimensions } from "./Meshing";
import { TestOctBounds,TestSparseOctTree } from "./World";


TestSdfShapes();
TestSdfTransforms();
TestMesher();
TestChunkDimensions();
TestOctBounds();
TestSparseOctTree();