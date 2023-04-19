import { TestSdfShapes,TestSdfTransforms } from "./signedDistanceFields";
import { TestMesher,TestChunkDimensions } from "./Meshing";
import { TestAxisAlignedBoxBounds, TestChunkManager, TestSparseOctTree, TestSphereBoxBounds } from "./World";
import { TestLinkedList } from "./Collection";
import { TestComponentPool, TestComponentSystem } from "./EntityComponentSystem";


TestSdfShapes();
TestSdfTransforms();
TestMesher();
TestChunkDimensions();
TestAxisAlignedBoxBounds();
TestSparseOctTree();
TestSphereBoxBounds();
TestChunkManager();
TestLinkedList();
TestComponentPool();
TestComponentSystem();