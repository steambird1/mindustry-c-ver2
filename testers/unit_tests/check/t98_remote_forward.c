/* EXPECT: 7 */
/* `remote int ru[] = remote(@this, u);` written BEFORE `u` is declared. The
   binding cannot be decided where it appears, so it is resolved once the whole
   program has been read -- and the array then gets a layout whose elements are
   really registers (never an automatically guessed lookup table). */
#pragma optimize(array)
auto device message1;
remote int ru[4] = remote(@this, u);
int u[4];
void main() {
    ru[2] = 7;
    print(u[2]);
    printflush(message1); stop();
}
