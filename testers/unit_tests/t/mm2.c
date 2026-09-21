auto device message1;
int *p;
void main() {
    p = (int*)memsp(0, 4);
    (*p) = 77;
    print(*p);
    printflush(message1); stop();
}
