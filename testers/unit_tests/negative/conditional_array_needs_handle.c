/* A conditional array chooses its storage at run time, so it is a runtime
   handle VALUE. Assigning it into an ordinary array would need a run-time
   element copy; the supported destination is a handle cell. */
/* MESSAGE: A conditional array value can only be bound to a handle cell */
int a[2];
int b[2];
int c[2];

void main() {
    a = 1 ? b : c;
}
