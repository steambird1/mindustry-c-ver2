/* MESSAGE: needs single-cell elements */
/*
A struct with an array member is several words. An embedded_divided array
names one register per element, so this layout is refused; the automatic
choice is the memory layout.
*/
auto device message1;

struct WithArray { int v[2]; int x; };

struct WithArray a[1] = array("embedded_divided", {{{4, 5}, 6}});

void main() {
	print(a[0].x);
	printflush(message1);
	stop();
}
