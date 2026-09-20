import { simulate } from './runsim.mjs';
const cases = ['check/n1.c', 'check/n2.c', 'check/m1.c', 'check/m3.c', 'mem/r1.c', 'mem/r2.c', 'mem/r3.c', 'mem/r4.c', 'mem/m2.c'];
for (const size of [16, 24, 32, 64, 128]) {
    const out = [];
    for (const f of cases) {
        const r = await simulate(f, [{ name: 'bank1', size }, { name: 'bank2', size }]);
        out.push(`${f.split('/')[1]}=${r.trap ? 'TRAP' : JSON.stringify(r.output.trim().replace(/\n/g, ' '))}`);
    }
    console.log(`size=${String(size).padStart(3)}: ${out.join('  ')}`);
}
