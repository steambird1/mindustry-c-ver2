/*
Shared block neighbours use program-level stable ids, kept in registers so the
four reserved cells of each block and the local link-id chain stay unchanged.
bank1 is stable id 1, bank2 is stable id 2.
*/
/* EMIT: set __mc_prevstable_0 0 */
/* EMIT: set __mc_nextstable_0 2 */
/* EMIT: set __mc_prevstable_1 1 */
/* EMIT: set __mc_nextstable_1 0 */
auto device message1;

void main() {
    print(1);
    printflush(message1);
    stop();
}
