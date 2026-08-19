auto device reconstructor1;
auto device unloader1;

void main() {
    const long metg = (long)sensor(reconstructor1, @metaglass);
    const long tit = (long)sensor(reconstructor1, @titanium);

    if (metg < 45) {
        control("enabled", unloader1, true);
        control("configure", unloader1, @metaglass);
    } else if (tit < 85) {
        control("enabled", unloader1, true);
        control("configure", unloader1, @titanium);
    } else {
        control("enabled", unloader1, false);
    }
    wait(3);
}