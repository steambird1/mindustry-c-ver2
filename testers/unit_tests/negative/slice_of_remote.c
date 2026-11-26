/* A remote array's elements live in registers of ANOTHER processor, and a
   handle packs helper entry points of THIS one. Slicing one would produce a
   handle that means nothing over there. */
/* MESSAGE: Cannot slice 'r': it is remote */
remote int r[2][3] = remote(@this, mirror);
extern int mirror[2][3];

void main() {
    int b[] = r[1];
    print(b[0]);
}
