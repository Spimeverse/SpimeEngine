import { TestSdfShapes,TestSdfTransforms } from "./signedDistanceFields";
import { TestMesher,TestChunkDimensions } from "./Meshing";
import { TestAxisAlignedBoxBounds, TestChunkManager, TestSparseOctTree, TestSphereBoxBounds } from "./World";
import { TestLinkedList, TestResourcePool } from "./Collection";
import { TestStateMachine } from "./StateMachine";


TestSdfShapes();
TestSdfTransforms();
TestMesher();
TestChunkDimensions();
TestAxisAlignedBoxBounds();
TestSparseOctTree();
TestSphereBoxBounds();
TestChunkManager();
TestLinkedList();
TestResourcePool();
TestStateMachine();