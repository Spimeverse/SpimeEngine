import { TestSdfShapes,TestSdfTransforms } from "./signedDistanceFields";
import { TestMesher,TestChunkDimensions } from "./Meshing";
import { TestAxisAlignedBoxBounds, TestChunkManager, TestSparseOctTree, TestSphereBoxBounds } from "./World";
import { TestLinkedList } from "./Collection";


TestSdfShapes();
TestSdfTransforms();
TestMesher();
TestChunkDimensions();
TestAxisAlignedBoxBounds();
TestSparseOctTree();
TestSphereBoxBounds();
TestChunkManager();
TestLinkedList();