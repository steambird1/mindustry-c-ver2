/* MESSAGE: has length 5, but its compound literal has length 3 */
/* A compound literal used as an initializer must describe the same array. */
auto device message1;

int s[5] = (int[3]){1, 2, 3};

void main() {
    print(s[0]);
    printflush(message1);
    stop();
}
