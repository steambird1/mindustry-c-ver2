/* MESSAGE: cannot be applied to 'struct P' */
/* sizeof needs a complete definition, not a forward declaration. */
auto device message1;
struct P;
void main() {
    print(sizeof(struct P));
    printflush(message1);
    stop();
}
