/* MESSAGE: Pointer 'p' needs a real address \('x' is static\) */
/* NOMEM */
/* No memory block is linked, and this pointer needs a real address.

   The declaration starts with `static`, which is why it is here: such a
   declaration is not parsed as a type, so the parser builds a plain
   `Declarator` node instead of a `VariableDeclarator`. The two carry the same
   name and initializer, so the name pointer analysis has to read both -- when
   it read only the first, nothing here was ever noticed and the program was
   accepted with a `getlink` of a block that no code had assigned. */
static int x = 3;
static int *p = &x;
void main() {
    (*p) = 5;
}
