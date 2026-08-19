
extern int *a;
extern int **b;
extern int ***c;
void main() {
    b = &a; c = &b;
}