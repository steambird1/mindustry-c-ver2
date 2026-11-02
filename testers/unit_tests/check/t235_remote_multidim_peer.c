/*
The owner processor publishes a multidimensional register array. The remote
side may declare the same shape (nested indexing) or an explicit flat view.
*/
// PEER: processor1=peers/t235.peer.c
/* EXPECT: 2 6 6 6 */
auto device processor1;
auto device message1;

remote int shaped[2][3] = remote(processor1, u, "embedded_divided");
remote int flat[6] = remote(processor1, u, "embedded_divided");

void main() {
	print(lenof(shaped));
	print(shaped[1][2]);
	print(lenof(flat));
	print(flat[5]);
	printflush(message1);
	stop();
}
