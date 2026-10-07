/* KNOWN-GAP: never finishes: main is `while (true) { foo(); print(sid); }` by design --
   a real processor runs forever too.
*/
int sid = 0;

void foo() {
    sid++;
}

void main() {
    while (true) {
        foo(); print(sid);
    }
}
