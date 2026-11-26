/* A read-only handle must not be handed to a parameter that can write:
   that would launder the constness away. */
/* MESSAGE: Cannot pass read-only */
void use(int s[]) {
    s[0] = 1;
}

void main() {
    int a[3] = {1, 2, 3};
    const int h[] = a;
    use(h);
}
