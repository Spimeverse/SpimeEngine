import { TestSdfShapes,TestSdfTransforms } from "./signedDistanceFields";
import { TestMesher,TestChunkDimensions } from "./Meshing";
import { TestAxisAlignedBoxBounds,TestSparseOctTree, TestSphereBoxBounds } from "./World";


TestSdfShapes();
TestSdfTransforms();
TestMesher();
TestChunkDimensions();
TestAxisAlignedBoxBounds();
TestSparseOctTree();
TestSphereBoxBounds();