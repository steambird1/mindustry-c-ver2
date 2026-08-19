const content_t scanner = @dagger;
const pdlist_t scanned = pdcreate(60);
int sid = 0;
device singleBound;

void ensureAlive() {
    if (singleBound == null || (volatile bool)sensor(singleBound, @dead)) {
        //print("Contact lost! rebinding...");
        //printflush(message1);
        ubind(scanner);
        singleBound = (device)@unit;
    }
    ubind((volatile content_t)singleBound);
    //print("Bound:",singleBound);
    //printflush(message1);
}

void main() {
    int i;
    while (true) {
        ensureAlive();
        int myX, myY;
        bool myFound;
        device current;
        ulocate("building", "factory", false, (volatile int*)myX, (volatile int*)myY, (volatile bool*)myFound, (volatile device*)current);
        if (myFound) {
            for (i = 0; i < sid; i++) {
                if ((device)pdread(scanned, i) == current) {
                    myFound = false;
                    break;
                }
            }
            if (myFound) {
                pdwrite(scanned, sid++, current);
            }
        }
    }
}