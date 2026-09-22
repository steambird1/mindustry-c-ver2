/* EXPECT: 1234 */
/* `auto device cell2_id` is a building of its own, so its link index is found
   once at start-up. */
// LINKS: cell2_id=memory
// DEVICES: vault1=container
// SENSOR: vault1 @copper 1234
auto device message1;
auto device bank1;
auto device cell2_id;
auto device vault1;

const int writepos = 60;

void work(device dev, content_t target) {
    const int result = sensor(dev, target);
    int *writer = (int*)memsp(cell2_id, writepos);
    (*writer) = result;
}

void main() {
    work(vault1, @copper);
    print(*(memsp(cell2_id, writepos)));
    printflush(message1);
}
