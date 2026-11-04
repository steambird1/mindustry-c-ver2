/*
The recommended remote form: name the target and layout in remote(). No local
array storage or element symbols are created for the reader binding.
*/
/* EXPECT: 7 7 */
/* EMIT: set g:\.r__rdev @this */
/* EMIT-NOT: g:\.r_0 */
auto device message1;

extern int u[2] = array("embedded_divided", {0, 0});
remote int r[2] = remote(@this, "g:.u", "embedded_divided");

void main() {
    r[1] = 7;
    print(r[1]);
    print(u[1]);
    printflush(message1);
    stop();
}
