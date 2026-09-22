/* EXPECT: 1 3 */
/* A remote array named by STRING that names a variable of THIS program: the
   local declaration has to stay alive, otherwise its elements are never
   initialised and every read comes back as 0. */
auto device message1;
int u[4] = array("embedded_lookup_item", {1, 2, 3, 4});
remote int ru[4] = remote(@this, "g:.u", "embedded_lookup_item");
void main() {
    int i = 2;
    print(ru[0]);
    print(ru[i]);
    printflush(message1);
}
