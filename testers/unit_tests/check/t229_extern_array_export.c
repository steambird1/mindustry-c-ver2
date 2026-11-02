/*
An extern array exports the representation it actually has: a memory array
exports its block/pos pair, a register array exports its element names, and a
runtime handle exports nothing (it has no stable external element names).
*/
/* EXPECT: 2 5 8 */
/* EMIT: draw triangle g:\.mem_block g:\.mem_pos */
/* EMIT-NOT: g:\.mem_0 */
/* EMIT: set g:\.emb_2 6 */
/* EMIT: draw triangle .*g:\.emb_0 g:\.emb_1 g:\.emb_2 */
/* EMIT-NOT: draw triangle .*g:\.emb_block */
/* EMIT-NOT: g:\.handle_0 */
auto device message1;

extern int mem[3] = {1, 2, 3};
extern int emb[3] = array("embedded_divided", {4, 5, 6});
extern int handle[];
int concrete[3] = {7, 8, 9};

void main() {
	handle = concrete;
	print(mem[1]);
	print(emb[1]);
	print(handle[1]);
	printflush(message1);
	stop();
}
