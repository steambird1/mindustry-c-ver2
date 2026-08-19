
void work(int *p) {
(*p) = (*p) + 10;
}

void main() {
    int u;
work(&u);
}