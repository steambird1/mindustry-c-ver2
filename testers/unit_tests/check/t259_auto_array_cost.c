/*
`#pragma optimize(array)` lets the compiler compare layouts instead of taking
memory whenever it fits. This array is written four times and then read with a
runtime index, so the register layout is cheaper than a block/offset pair plus
one pointer walk per access.
*/
/* EXPECT: 7 7 7 7 7 7 */
/* EMIT-NOT: g:\.hot_block */
/* EMIT: set g:\.hot_0 7 */
/* An explicit `array("traditional")` request still wins over the cost model. */
/* EMIT: g:\.forced_block */
#pragma optimize(array)
auto device message1;
volatile int idx;
int hot[4];
int forced[4] = array("traditional");

void main() {
    hot[0] = 7; hot[1] = 7; hot[2] = 7; hot[3] = 7;
    forced[0] = 7; forced[1] = 7; forced[2] = 7; forced[3] = 7;
    idx = (int)(@time * 3.0) % 4;
    print(hot[idx]); print(hot[idx]); print(hot[idx]); print(hot[idx]);
    print(forced[idx]); print(forced[idx]);
    printflush(message1);
    stop();
}
