/* MESSAGE: Only the outermost array dimension may use '\[\*\]' */
/* An inner [*] would decide a row stride the prototype cannot supply. */
void f(int n, int a[4][*]);
void f(int n, int a[4][n]) { }

void main() {
}
