void main() {
    device reactor;
    int i = 0;
    while (true) {
        i = 0;
        while (true) {
            reactor = getlink(i);
            if (reactor == null) {
                break;
            }
            const float cf = (float) sensor(reactor, @cyrofluid);
            const float heat = (float) sensor(reactor, @heat);
            const float health = (float) sensor(reactor, @health);
            const bool work = !(health < 700 || heat > 0 || cf <= 25);
            control("enabled", reactor, work);
            i++;
        }
    }
}