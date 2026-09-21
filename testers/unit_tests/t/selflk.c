auto device message1;
extern int u[4] = array("embedded_lookup_item", {1, 2, 3, 4});
remote int ru[4] = remote(@this, "g:.u", "embedded_lookup_item");
void main() {
    int i = 2;
    print(ru[0]);
    print(ru[i]);
    printflush(message1);
}
