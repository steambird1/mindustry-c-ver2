/* MESSAGE: compound literal of element type 'float' */
/* The compound literal's element type has to match the declared array. */
auto device message1;

int s[3] = (float[3]){1, 2, 3};

void main() {
    print(s[0]);
    printflush(message1);
    stop();
}
