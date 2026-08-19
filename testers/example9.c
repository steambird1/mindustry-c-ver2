// Example 9: Scan for all inefficient buildings
// (Only check factories. Display their icons on the display)

auto device message1;
auto device display1;
const content_t scanner = @flare;
const float allowedRadius = 4.5;
const float spawnHazard = 20, turretHazard = 15;
const int scanThreshold = 50, triggerThreshold = 10, thoroughThreshold = 8;
const int scanStep = 16;                                 // Scanner's step (giant step)
const int minScanStep = 2;                              // Scanner's step (small step)
const int defaultSize = 6;                              // Default on-screen indicator
const float timeOut = 1500.0, initialTimeOut = 24000.0;

device singleBound = null;
device _disposal;
pdlist_t scanned = pdcreate(60);
int sid = 0, scannedSid = 0;                                        // Scanned building
long mapWidth, mapHeight, displayWidth, displayHeight;
long scannedX = 0, scannedY = 0, lastSafeX = 0, lastSafeY = 0;
long scanTermX = 0, currStepX = scanStep, currStepY = scanStep;
// int repairX, repairY;
// bool repairFound = false;
bool isScanning = true, isInitial = true, initialMove = true;
int lastScanPass = 0, curXStep = scanStep;
int thoroughSkip = 0;
float zoomX = 1, zoomY = 1;

struct coord {
    float x; float y;
};

coord translate(float x, float y) {
    coord result;
    result.x = x * zoomX;
    result.y = y * zoomY;
    return result;
}

// This does not return 0
long sgn(long x) {
    return x > 0 ? 1 : -1;
}

// Unused now
float power(float x) {
    return x*x;
}

float distance(float x1, float y1, float x2, float y2) {
    return sqrt(power(x2-x1)+power(y2-y1));
}

void ensureAlive() {
    if (singleBound == null || (volatile bool)sensor(singleBound, @dead)) {
        print("Contact lost! rebinding...");
        printflush(message1);
        ubind(scanner);
        singleBound = (device)@unit;
        initialMove = true;
    }
    ubind((volatile content_t)singleBound);
    //print("Bound:",singleBound);
    //printflush(message1);
}

bool isApproaching(int x, int y, float r) {
    bool state;
    ucontrol("within", x, y, r, (volatile bool*)state);
    return state;
}

int tryEntering(int x, int y) {
    int myX, myY, trigger = 0;
    bool myFound;
    const float startTime = (float)@time;
    const float threshold = initialMove ? initialTimeOut : timeOut;
    initialMove = false;
    while (!isApproaching(x, y, allowedRadius)) {
        ucontrol("move", x, y);
        print("Attempt to move to (",x,",",y,")...");
        printflush(message1);
        ensureAlive();
        if (((float)@time) - startTime > threshold) {
            print("Timed out!");
            printflush(message1);
            //wait(0.1);
            return 0;
        }
        int combatX = -1000, combatY = -1000, turretX = -1000, turretY = -1000;
        bool combatFound, turretFound;
        ulocate("spawn", (volatile int*)combatX, (volatile int*)combatY, (volatile bool*)combatFound, (volatile device*)_disposal);
        ulocate("building", "turret", true, (volatile int*)turretX, (volatile int*)turretY, (volatile bool*)turretFound, (volatile device*)_disposal);
        if ((combatFound && isApproaching(combatX, combatY, spawnHazard)) || (turretFound && isApproaching(turretX, turretY, turretHazard))) {
            initialMove = true; // Known the reason
        }
    }
    device current;
    ulocate("building", "factory", false, (volatile int*)myX, (volatile int*)myY, (volatile bool*)myFound, (volatile device*)current);
    if (current != null && (!((volatile bool)sensor(current, @dead)))) {
        int i;
        bool flag = true;
        for (i = 0; i < sid; i++) {
            if ((device)pdread(scanned, i) == current) {
                flag = false; break;
            }
        }
        if (flag) {
            pdwrite(scanned, sid, current);
            sid++;
            return 2;
        }
    }
    return 1;
}

void geo() {
    coord translation;
    ensureAlive();
    /*
    if (!repairFound) {
        ulocate("building", "repair", false, (volatile int*)repairX, (volatile int*)repairY, (volatile bool*)repairFound, (volatile device*)_disposal);
        if (repairFound) {
            lastSafeX = repairX;
            lastSafeY = repairY;
        }
    }
        */
    //print("Scanning ",scannedX,",",scannedY);
    //printflush(message1);
    const int result = tryEntering(scannedX, scannedY);
    print("Entering result:",result);
    printflush(message1);
    //initialMove = (result == 0);
    if (result == 2) {
        currStepY = minScanStep;
        currStepX = sgn(curXStep) * minScanStep;
        thoroughSkip = 0;
        wait(0.1);
    } else {
        thoroughSkip++;
        if (thoroughSkip > thoroughThreshold) {
            thoroughSkip = 0;
            currStepX = sgn(curXStep) * scanStep;
        }
    }
    if (isInitial) {
        if (result == 1) {
            draw("color", 0, 100, 0, 255);
        } else if (result == 2) {
            draw("color", 0, 0, 100, 255);
        } else {
            draw("color", 100, 0, 0, 255);
        }
        translation = translate(scannedX, scannedY);
        draw("rect", translation.x, translation.y, zoomX * scanStep, zoomY * scanStep);
        drawflush(display1);
    }
    /*
    if (result && (!repairFound)) {
        lastSafeX = scannedX;
        lastSafeY = scannedY;
    }
        */
}

void execute() {
    coord translation;
    if (lastScanPass > scanThreshold) {
        isScanning = true;
        initialMove = true;
        lastScanPass = 0;
        scannedX = 0; scannedY = 0; sid = 0;
        curXStep = scanStep; currStepX = scanStep; currStepY = scanStep;
    }
    if (isScanning) {
        geo();
        scannedX += currStepX;
        const bool flag = (scannedX >= mapWidth) || (scannedX <= 0);
        if (flag) {
            scannedY += currStepY;
            currStepY = scanStep;
            scannedX = min(scannedX, mapWidth);
            scannedX = max(scannedX, 0);
            curXStep = -curXStep;
            currStepX = sgn(curXStep) * abs(currStepX);
        }
        if (scannedY >= mapHeight) {
            isScanning = false;
            isInitial = false;
            scannedSid = sid;
        }
    } else {
        lastScanPass++;
    }
    if (!isInitial) {
        draw("clear", 0, 0, 0);
        int i;
        for (i = 0; i < scannedSid; i++) {
            const device cur = pdread(scanned, i);
            if ((!((volatile bool)sensor(cur, @dead))) && ((float)sensor(cur, @efficiency) < 0.5)) {
                translation = translate((float)sensor(cur, @x), (float)sensor(cur, @y));
                draw("image", translation.x, translation.y, (volatile content_t)sensor(cur, @type), defaultSize, 0);
            }
        }
        drawflush(display1);
    }
}

void main() {
    draw("clear", 0, 0, 0);
    drawflush(display1);
    mapWidth = (long)@mapw;
    mapHeight = (long)@maph;
    displayWidth = (long)sensor(display1, @displayWidth);
    displayHeight = (long)sensor(display1, @displayHeight);
    zoomX = 1.0 / mapWidth * displayWidth;
    zoomY = 1.0 / mapHeight * displayHeight;
    while (true) {
        execute();
    }
}