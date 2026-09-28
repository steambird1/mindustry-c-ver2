/* EXPECT: 5 7 */
/* A handle is ONE register now: get / set / lenof / sizeof are packed into
   12-bit fields. A function pointer carries arguments in fixed `__param_N`
   slots, so what travels has to be a single value -- that is the whole reason
   for packing it.

   `lenof(s)` is the interesting one: a parameter's type carries no length, so
   it used to fold to 0. It now comes out of the handle at run time. */
/* EMIT: op or g:\S+ g:\S+ \d+ */
/* EMIT-NOT: set g:\S+_set ___arrset */
#pragma noinline
auto device message1;
void test(remote int s[]) {
    print(lenof(s));
    s[1] = 7;
    print(s[1]);
}
extern int r[5] = array("embedded_divided");
remote int rs[] = remote(@this, r);
void main() { test(rs); printflush(message1); stop(); }
