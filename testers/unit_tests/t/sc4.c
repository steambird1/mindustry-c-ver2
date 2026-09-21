auto device message1;
int a, b;
void main() {
    a = 1; b = 0;
    if (a && b) { print(1); } else { print(0); }
    if (a || b) { print(2); } else { print(3); }
    printflush(message1); stop();
}
