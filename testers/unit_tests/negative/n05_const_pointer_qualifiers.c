/* MESSAGE: Const variable 'q' must be initialized or be an automatically-linked d */
/* The three must NOT collapse into one rendering: `const int *` is a pointer
   to a constant int, `int *const` is a constant pointer to a plain int, and
   `const int *const` is both. A qualifier belongs to the level it sits on. */
void main() {
    const int *p;
    int *const q;
    const int *const r;
    print(1);
}
