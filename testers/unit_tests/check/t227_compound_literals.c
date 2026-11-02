/*
C99 compound literals: scalar values, register and memory aggregates,
designated initializers, arrays and addressable objects.
*/
/* EXPECT: 3 3 7 1 2 0 7 2 5 6 8 9 7 8 5 6 4 7 2 3 8 9 7 6 */
struct P { int x; int y; };
struct Q { int a[3]; int x; };

struct P gp = (struct P){8,9};
struct P *gpp = &(struct P){7,6};

int addp(struct P p) { return p.x + p.y; }
int second(int *p) { return p[1]; }

auto device message1;

void main() {
	print((int){3});
	print((int)({3}));
	print((int){7.9});

	print((struct P){1,2}.x);
	print((struct P){1,2}.y);

	print(((struct P){.y=7}).x);
	print(((struct P){.y=7}).y);

	print(((struct Q){{1,2,3},5}).a[1]);
	print(((struct Q){{1,2,3},5}).x);

	print((int[]){4,5,6}[2]);
	print((int[3]){7,8,9}[1]);
	print((int[]){[2]=9}[2]);

	print(addp((struct P){3,4}));
	print(second((int[]){7,8,9}));

	struct P *p = &(struct P){5,6};
	print(p->x);
	print(p->y);
	p->y = 4;
	print(p->y);

	int *q = &(int){7};
	print(*q);

	print(sizeof((struct P){1,2}));
	print(sizeof((int[3]){1,2,3}));

	print(gp.x);
	print(gp.y);
	print(gpp->x);
	print(gpp->y);

	printflush(message1);
	stop();
}
