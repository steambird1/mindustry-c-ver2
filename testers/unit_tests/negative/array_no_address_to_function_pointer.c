/* Must fail: `reg` is held in registers, so it has no address and cannot become
   a pointer. It can still be handed over as a HANDLE (see
   `check/t115_fp_handle_array.c`), but this pointer's parameter is an ordinary
   array, which asks for an address -- so there is nothing to pass. */
auto device message1;
int reg[4] = array("embedded_divided", {0, 0, 0, 0});
typedef void (*cb)(int s[4]);
void fill(int s[4]) { s[1] = 5; }
void main() { cb p = fill; p(reg); printflush(message1); }
