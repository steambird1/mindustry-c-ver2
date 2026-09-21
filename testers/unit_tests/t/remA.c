/* The exporting side: `extern int c` is this program's export. */
auto device message1;
extern int c;
void main() {
    print(1);
    printflush(message1);
}
