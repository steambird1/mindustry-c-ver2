/* A slice is a handle -- one cell with the helper entry points and the length
   inside it. A pointer parameter would read that cell as a block/offset
   pair. */
/* MESSAGE: A slice is a handle, not an address */
void use(int *p) {
    print(p[0]);
}

void main() {
    int a[6] = {1, 2, 3, 4, 5, 6};
    use(slice(a, 1, 3));
}
