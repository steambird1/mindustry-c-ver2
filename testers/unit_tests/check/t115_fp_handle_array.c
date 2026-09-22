/* EXPECT: 5 7 9 */
/* Arrays that have NO address, handed to a function pointer. Such an array
   cannot become a pointer, so it travels as a HANDLE: two words holding the
   entry points of its get / set helpers. The parameter is written `remote int
   s[4]`, which is what says it arrives that way.

   Both kinds are handed to the SAME function through the SAME pointer:
     - `reg` is an array held in registers;
     - `rs` is a remote array, whose elements live in another processor. */
auto device message1;
int reg[4] = array("embedded_divided", {0, 0, 0, 0});
extern int r[4] = array("embedded_divided");
remote int rs[4] = remote(@this, "g:.r", "embedded_divided");
typedef void (*cbr)(remote int s[4]);
void fill(remote int s[4]) { s[1] = 5; s[2] = 7; s[3] = 9; }
void main() {
    cbr p = fill;
    p(reg);
    p(rs);
    print(reg[1]); print(rs[2]); print(rs[3]);
    printflush(message1); stop();
}
