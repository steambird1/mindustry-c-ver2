/* EXPECT: 16 4 5 */
/* The second half of typedef'd data pointer coverage (t40/t41 cover only the
   declaration and a first dereference): the alias builder's other paths, all
   with a DATA pointer rather than a function pointer.

     pp r = q;      -- an alias of an alias: the copy path, no pointer wrap
     bump(q);       -- the typedef'd pointer as a PARAMETER, written through
     &a[2]          -- an element of a local array, read back through p
     pa t = &a;     -- a pointer whose target is itself a typedef'd array

   The global-array shape (&arr[i] where arr is global) is deliberately absent:
   it traps at run time with or without a typedef, recorded in OPEN_WORK. */
typedef int *p;
typedef p pp;
typedef int arr[4];
typedef arr *pa;
auto device message1;
void bump(p q) { *q = *q + 1; }
void main() {
    int x = 5;
    p q = &x;
    pp r = q;
    bump(q);
    *r = *r + 10;
    print(*r);
    int a[4] = {2, 3, 4, 5};
    p s = &a[2];
    print(*s);
    pa t = &a;
    print(t[0][3]);
    printflush(message1); stop();
}
