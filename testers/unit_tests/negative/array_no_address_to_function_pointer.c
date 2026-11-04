/* MESSAGE: Array 'reg' has no address, so it cannot be han */
/* CODE: E_GENERATION */
/* STAGE: codegen */
/* LINE: 9 */
auto device message1;
int reg[4] = array("embedded_divided", {0, 0, 0, 0});
typedef void (*cb)(int s[4]);
void fill(int s[4]) { s[1] = 5; }
void main() { cb p = fill; p(reg); printflush(message1); }
