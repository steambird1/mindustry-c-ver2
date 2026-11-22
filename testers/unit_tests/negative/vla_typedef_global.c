/* MESSAGE: Variable length arrays are not supported: the size of 'Row' must be a co */
/* A VLA typedef needs a function scope so its hidden bound has an owner. */
int n = 4;
typedef int Row[n];

void main() {
}
