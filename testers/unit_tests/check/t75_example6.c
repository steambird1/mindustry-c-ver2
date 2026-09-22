/* EXPECT: 1234 */

// Try transmitting warehouse demand, including the following information forward:

// LINKS: cell2_id=memory
// DEVICES: vault1=container
// SENSOR: vault1 @copper 1234
auto device cell2_id;  // Additional cell block, with "_id" to tell it from "the building" itself
auto device vault1;
auto device message1;

const int writepos = 60;

void work(device dev, content_t target) {
    const int result = sensor(dev, target);
    int *writer = (int*)memsp(cell2_id, writepos);
    (*writer) = result;
}

void main() {
    work(vault1, @copper);
    // Tester
    print(*(memsp(cell2_id, writepos)));
    printflush(message1);
}
