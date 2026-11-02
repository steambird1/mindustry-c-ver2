/* MESSAGE: needs single-cell elements */
/*
Bitfield members share a storage cell; the flat per-member register names of
embedded_divided cannot represent them. The automatic choice is memory.
*/
auto device message1;

struct Bits { int a:3; int b:4; };

struct Bits a[1] = array("embedded_divided", {{3, 5}});

void main() {
	print(a[0].a);
	printflush(message1);
	stop();
}
