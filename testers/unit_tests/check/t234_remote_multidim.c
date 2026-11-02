/*
Multidimensional remote arrays use the same flat element names as local
register arrays. The declaration keeps its shape; nested subscripts lower to
the flat index, and a flat open declaration is a one-dimensional view.
*/
/* EXPECT: 2 6 2 6 6 5 */
/* EMIT: draw triangle .*g:\.u_0 g:\.u_1 g:\.u_2 g:\.u_3 g:\.u_4 g:\.u_5 */
auto device message1;

extern int u[2][3] =
	array("embedded_divided", {1, 2, 3, 4, 5, 6});

remote int shaped[2][3] = remote(@this, u);
remote int flat[] = remote(@this, u);

void main() {
	print(lenof(shaped));
	print(shaped[1][2]);
	print(shaped[0][1]);
	print(lenof(flat));
	print(flat[5]);
	print(flat[4]);
	printflush(message1);
	stop();
}
