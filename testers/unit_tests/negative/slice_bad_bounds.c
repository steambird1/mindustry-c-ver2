/* An empty or reversed range is a mistake in the program, not a run-time
   condition: the two bounds are written down. */
/* MESSAGE: 'slice': end 2 is before start 3 */
void main() {
    int a[6] = {1, 2, 3, 4, 5, 6};
    int b[] = slice(a, 3, 2);
    print(b[0]);
}
