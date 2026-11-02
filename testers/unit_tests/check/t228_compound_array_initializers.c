/*
A compound literal used as an array declaration initializer initialises the
declared array's own storage. The cast is not an alias: fixed and open arrays,
extern arrays, multi-dimensional aggregates and pointer elements all use the
ordinary list-initializer path.
*/
/* EXPECT: 7 8 9 1 2 3 4 5 6 5 6 10 20 7 3 */
struct P { int x; int y; };

int fixed[3] = (int[]){7, 8, 9};
int open[] = (int[]){1, 2, 3};
extern int ext[3] = (int[]){4, 5, 6};

struct P grid[2][2] =
	(struct P[2][2]){{{1, 2}, {3, 4}}, {{5, 6}, {7, 8}}};

int x = 10;
int y = 20;
int *ptrs[2][2] = (int *[2][2]){{&x, &y}, {&y, &x}};

int designated[] = (int[]){[2] = 7};

auto device message1;

void main() {
	print(fixed[0]);
	print(fixed[1]);
	print(fixed[2]);

	print(open[0]);
	print(open[1]);
	print(open[2]);

	print(ext[0]);
	print(ext[1]);
	print(ext[2]);

	print(grid[1][0].x);
	print(grid[1][0].y);

	print(*ptrs[0][0]);
	print(*ptrs[1][0]);

	print(designated[2]);
	print(sizeof(designated));

	printflush(message1);
	stop();
}
