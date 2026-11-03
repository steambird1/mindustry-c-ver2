/*
A lookup handle must use the lookup table, not select the whole name list.
The helper is three instructions: lookup + sensor + read/write.
*/
/* EXPECT: 7 7 */
/* EMIT: lookup item .* __arridx */
/* EMIT: sensor .* @name */
/* EMIT-NOT: select __arrret equal __arridx */
#pragma noinline
auto device message1;

int r[8] = array("embedded_lookup_item");

void fill(int s[]) {
    s[3] = 7;
    print(s[3]);
}

void main() {
    fill(r);
    print(r[3]);
    printflush(message1);
    stop();
}
