int a[3] = {1,2,3};

void main() {
   extern int **w = &a; print((*w)[2]);
}