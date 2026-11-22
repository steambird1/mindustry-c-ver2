/* MESSAGE: '\[\*\]' is only allowed in a function prototype, not in a definition */
/* C99 requires the definition to give the bound. */
void f(int a[*]) {
}

void main() {
}
