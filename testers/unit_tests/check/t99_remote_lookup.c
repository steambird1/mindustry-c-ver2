/* EXPECT: 7 */
/* A remote array named after a lookup table: the elements are called `copper`,
   `lead`, ... -- bare content names, so nothing has to be declared on the other
   side under those names. Writing one has to WRITE (a constant subscript used
   to hand back the value read, and the write then vanished). */
auto device message1;
remote int ru[4] = remote(@this, "g:.u", "embedded_lookup_item");
extern int u[4] = array("embedded_lookup_item", {1, 2, 3, 4});
void main() {
    ru[2] = 7;
    print(u[2]);
    printflush(message1); stop();
}
