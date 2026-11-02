/*
Registry-struct arrays with richer shapes: enum members, nested structs that
contain enums, and typedef'd enums. Constant and dynamic subscripts,
member writes and whole-element assignment all work.
*/
/* EXPECT: 1 4 2 3 4 2 3 1 5 5 7 */
enum Color { RED, GREEN, BLUE };
enum Size { SMALL = 4, LARGE };
typedef enum { LOW = 6, HIGH } Level;

struct Point { int x; int y; };
struct Tagged { enum Color c; struct Point at; };
struct Inner { enum Color c; int n; };
struct Outer { struct Inner in; enum Size s; Level level; };

struct Tagged tags[2] = array("embedded_divided",
	{{GREEN, {1, 2}}, {BLUE, {3, 4}}});
struct Outer outers[1] = array("embedded_divided",
	{{{GREEN, 5}, LARGE, HIGH}});

auto device message1;

void readAt(int i) {
	print(tags[i].c);
	print(tags[i].at.x);
	print(tags[i].at.y);
}

void main() {
	print(tags[0].c);
	print(tags[1].at.y);
	readAt(1);

	tags[0] = tags[1];
	print(tags[0].c);
	print(tags[0].at.x);

	print(outers[0].in.c);
	print(outers[0].in.n);
	print(outers[0].s);
	print(outers[0].level);

	printflush(message1);
	stop();
}
