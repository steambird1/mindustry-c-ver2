/* EXPECT: 1234 1234 */
/* `sensor`'s property may be a VARIABLE, not only a literal `@name`: passing
   `content_t` into a function and sensing with it produces
   `sensor r dev g:.f:work.target`, where the property sits in a register. */
/* EMIT: sensor \S+ g:\.f:sense_of\.dev g:\.f:sense_of\.what */
// DEVICES: vault1=container
// SENSOR: vault1 @copper 1234
#pragma noinline
auto device message1;
auto device vault1;

int sense_of(device dev, content_t what) {
    return sensor(dev, what);
}

void main() {
    print(sense_of(vault1, @copper));
    content_t w = @copper;
    print(sense_of(vault1, w));
    printflush(message1); stop();
}
