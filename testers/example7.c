// Example 7:
// Specified army will automatically catch the combat
// (If the combat are gone, their first occurrence will be recorded)
auto device message1;
auto device message2;
auto device switch1;

const float hazardRadius = 50.0;
const float combatRadius = 5.0;
const float coreRadius = 10.0;

// Type of units to bind
const unit_t* bindings = {@flare};
const int* bindLimit = {20};
const int bindingsCount = 1;    // Maximum 10

const int serial = ((int)@thisX) * 1000 + ((int)@thisY);
int currentBinds[10];           // The number of current binding (might be displayed)

bool preFetch = true;
bool coreFound, combatFound;
int coreX, coreY, combatX, combatY;
device coreDevice, combatDevice;
device scannedCombat;

/*
Control flags:
1 - Force to execute enabled policy
2 - Enable 'policyReadyForEnemy' policy
4 - Enable 'policyDirectToCombat' policy
8 - Enable 'policyCoreProtection' policy
16 - Enable 'policySelfProtection' policy
*/
int controlFlags() {
    return 30;  // 2+4+8+16
}

bool terminate() {
    return !sensor(switch1, @enabled);
}

bool combatAvailable() {
    return scannedCombat == null || sensor(scannedCombat, @dead);
}

void output(device target, char info) {
    print(info);
    printflush(target);
}

// Policy: Ready for the enemy
bool policyReadyForEnemy() {
    
}

// Policy: Just move to the enemy
bool policyDirectToCombat() {

}

// Policy: Protect the core!
// Shoot at combats in order...
bool policyCoreProtection() {
    ucontrol("pathFind", coreX, coreY);
    
}

bool policySelfProtection() {
    int repairX, repairY;
    bool repairFound;
    device repairDevice;
    ulocate("building", "repair", false, (volatile int*)repairX, (volatile int*)repairY, (volatile bool*)repairFound, (volatile device*)repairDevice);
    if (repairFound) {
        ucontrol("pathFind", repairX, repairY);
    }
    return repairFound;
}

// Preprocess before executing instruction on every unit
void preprocess() {
    // If there are combats...
    if (combatAvailable()) {
        scannedCombat = uradar("enemy", "any", "any", "health", 0, 0); // Sorted by order
    }
}

// Every time it is called, it processes something.
void execute() {
    if (terminate()) {
        ucontrol("unbind");
        return;
    }
    if (preFetch) {
        // Prefetch core and combat information
        ulocate("building", "core", false, (volatile int*)coreX, (volatile int*)coreY, (volatile bool*)coreFound, (volatile device*)coreDevice);
        preFetch = false;
    }
    // Pre-locate must be executed
    ulocate("spawn", (volatile int*)combatX, (volatile int*)combatY, (volatile bool*)combatFound, (volatile device*)combatDevice);

    // Make executions according to situations
    preprocess();
    const int flags = controlFlags();
    
    if (flags & 1) {
        if (flags & 2) policyReadyForEnemy();
        if (flags & 4) policyDirectToCombat();
        if (flags & 8) policyCoreProtection();
    } else {
        //if (combatAvailable())
        const bool doSelfProtect = flags & 16 && sensor((device)@unit, @health) <= (float)sensor((device)@unit, @maxHealth) * 0.33;
        if (doSelfProtect) {
            if (policySelfProtection()) return;
        }
        const bool doCoreProtect = flags & 8 && sensor(coreDevice, @health) <= (float)sensor(coreDevice, @maxHealth) * 0.66;
        if (doCoreProtect) {
            if (policyCoreProtection()) return;
        }
    }
}

// This function will return when and only when bindings are completed
void bindUnits() {
    int i;
    bool working = true;
    for (i = 0; i < bindingsCount; i++) {
        // Record the number of binding (if bindLimit == -1 then no limit)
        const int bindRestriction = bindLimit[i];
        if (bindRestriction < 0) continue;
        int count = 0;
        device firstUnit = null;
        while (count < bindRestriction && (@unit == null || (device)@unit != firstUnit)) {
            if (terminate()) break;
            ubind(bindings[i]);
            if (sensor(firstUnit, @dead)) {
                firstUnit = null; count = 0; continue;
            }
            const device current = (device)@unit;
            if ((bool)sensor(current, @controlled) && ((int)sensor(current, @flag) != serial)) continue;
            ucontrol("flag", serial);
            execute();
            count++;
        }
        currentBinds[i] = count;
        if (terminate()) break;
    }
}

void main() {
    // It is recommended to use such loop to skip initialization
    if (bindingsCount > 10) {
        output(message1, "Too many bindings!");
        return;
    }
    while (true) {
        preprocess();
        bindUnits();
    }
}