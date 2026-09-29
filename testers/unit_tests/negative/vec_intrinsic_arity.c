/* Must fail: `veccpy` needs exactly two arguments, and it needs an ARRAY for
   each of them.

   The count is checked rather than left to the argument-delivery machinery
   because neither intrinsic is a function: there are no declared parameters for
   the arity to be compared against, so nothing else would notice. A `veccpy`
   with one argument would have had to guess which array it was given.

   The two "must be an array" refusals are one check, but they are asked for
   separately on each side: a check that only ever tested the first argument
   would still pass if the second stopped being examined, and then `veccpy(a, 3)`
   would compile and copy a constant. */
/* MESSAGE: 'vecalias' takes exactly 2 arguments, but 1 were */
/* MESSAGE: 'vecalias' takes exactly 2 arguments, but 3 were */
/* MESSAGE: 'veccpy' takes exactly 2 arguments, but 1 were */
/* MESSAGE: The first argument of veccpy must be an array, as in */
/* MESSAGE: The second argument of veccpy must be an array, as in */
/* MESSAGE: The second argument of vecalias must be an array, as in */
auto device message1;
int mem[4];
int a[];
void main() {
    a = mem;
    vecalias(&a);
    vecalias(&a, mem, mem);
    veccpy(mem);
    veccpy(3, mem);
    veccpy(mem, 3);
    vecalias(&a, 3);
}
