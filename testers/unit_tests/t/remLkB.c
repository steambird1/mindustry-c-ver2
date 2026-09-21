auto device processor1;
auto device message1;
remote int ru[4] = remote(processor1, "g:.u", "embedded_lookup_item");
void main() {
    int i = 2;
    print(ru[0]);
    print(ru[i]);
    printflush(message1);
}
