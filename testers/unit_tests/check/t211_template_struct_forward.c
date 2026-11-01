/*
Forward declarations also work when the later definition is a template struct
(`auto` member). A value or typedef may use the completed type; a pointer type
itself is just two words and can be declared before completion.
*/
/* EXPECT: 7 3 8 4 2 */
auto device message1;

struct P;
struct P *unusedPointer;
typedef struct Q Q;

struct P { auto int *m; int x; };
struct Q { auto int *m; int y; };

void main() {
	int a = 7;
	struct P p;
	p.m = &a;
	p.x = 3;
	print(*(p.m));
	print(p.x);

	int b = 8;
	Q q;
	q.m = &b;
	q.y = 4;
	print(*(q.m));
	print(q.y);

	print(sizeof(unusedPointer));

	printflush(message1);
	stop();
}
