/* MESSAGE: 'fptr' is a function pointer type, and its signature names a struct wi */
/* Must fail: a function POINTER type names a template struct in its signature.
   What travels through such a pointer is a line number, so the function behind
   it cannot be told which instantiation to use. */
struct tmpl { auto int *p; };
typedef void(*fptr)(struct tmpl);
void main() { }
