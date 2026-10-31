/* MESSAGE: Unknown type Missing */
/* A typedef struct still checks every member type. */
auto device message1;
typedef struct {
    Missing x;
} P;
void main() {
    P p;
    printflush(message1);
    stop();
}
