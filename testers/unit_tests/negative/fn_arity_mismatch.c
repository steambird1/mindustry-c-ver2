/* Must fail: a call is measured against the parameter list of the one
   function its name resolves to, and that measurement has to be reached in BOTH
   directions.

   The asymmetry was not a design choice. The count was checked after the
   arguments had been walked, and the walk reads the expected type of the
   argument at the same index -- so too FEW arguments was reported ("expects 2
   arguments, but 1 were provided") and too MANY ran off the end of the
   parameter list and threw `Cannot read properties of undefined (reading
   'type')` instead. A compiler that dies is not a compiler that refused.

   Both directions are asked for here because either one alone would pass
   against the broken behaviour: a check that only ever compared the count for
   equality and nothing else would satisfy the first message while still
   crashing on the second. The two calls use the same function, so the only
   thing that differs between them is the count.

   The arguments are literals on purpose. The extra argument of the too-many
   call is still walked, with no expected type to walk it against, and a
   literal cannot be the thing that reports the mistake instead. */
int add(int a, int b) { return a + b; }
void main() {
    add(1, 2, 3);
    add(1);
}
/* MESSAGE: Function 'add' expects 2 arguments, but 3 were provided */
/* MESSAGE: Function 'add' expects 2 arguments, but 1 were provided */
