"""Generate the three programs of the generalised (N-process) Peterson test."""
N = 3
ROUNDS = 3

def program(i):
    others = [k for k in range(N) if k != i]
    lines = []
    if i == 0:
        lines.append("/* Peterson (filter algorithm), process 0 of 3 -- the main program. It owns\n"
                     "   `turn`; every other process writes it remotely. */")
    else:
        lines.append(f"/* Peterson (filter algorithm), process {i} of {3} (a peer). */")
    devs = [f"processor{k}" for k in range(N) if k != i]
    for d in devs:
        lines.append(f"auto device {d};")
    lines.append("auto device message1;")
    lines.append("")
    lines.append(f"int lvl{i}[1] = array(\"embedded_divided\", {{0}});")
    for k in others:
        lines.append(f"remote int lv{k}[1] = remote(processor{k}, lvl{k}, \"embedded_divided\");")
    if i == 0:
        lines.append(f"int turn[{N}] = array(\"embedded_divided\", {{0, 0, 0}});")
    else:
        lines.append(f"remote int turn[{N}] = remote(processor0, turn, \"embedded_divided\");")
    lines.append(f"int entered{i} = 0;")
    lines.append(f"int scratch{i} = 0;")
    if i == 0:
        for k in others:
            lines.append(f"remote int entered{k} = remote(processor{k}, entered{k});")
        lines.append("int owner = 0;")
        lines.append("int violations = 0;")
        for k in others:
            lines.append(f"int done{k} = 0;")
    else:
        lines.append("remote int owner = remote(processor0, owner);")
        lines.append("remote int violations = remote(processor0, violations);")
        lines.append(f"remote int done{i} = remote(processor0, done{i});")
    lines.append("")
    lines.append("void main() {")
    lines.append("    int round;")
    lines.append("    int l;")
    lines.append("    int d;")
    lines.append(f"    for (round = 0; round < {ROUNDS}; round++) {{")
    lines.append(f"        for (l = 1; l <= {N - 1}; l++) {{")
    lines.append(f"            lvl{i}[0] = l;")
    lines.append(f"            turn[l] = {i};")
    cond = " || ".join(f"lv{k}[0] >= l" for k in others)
    lines.append(f"            while (turn[l] == {i} && ({cond})) {{")
    lines.append(f"                scratch{i} = scratch{i} + 1;")
    lines.append("            }")
    lines.append("        }")
    lines.append("        /* critical section */")
    lines.append(f"        owner = {i};")
    lines.append(f"        for (d = 0; d < 4; d++) scratch{i} = scratch{i} + 1;")
    lines.append(f"        if (owner != {i}) violations = 1;")
    lines.append(f"        entered{i} = entered{i} + 1;")
    lines.append(f"        lvl{i}[0] = 0;")
    lines.append("    }")
    if i == 0:
        lines.append("    while (" + " || ".join(f"done{k} == 0" for k in others) + ") {")
        lines.append("        scratch0 = scratch0 + 1;")
        lines.append("    }")
        for k in range(N):
            lines.append(f"    print(entered{k});")
        lines.append("    print(violations);")
        lines.append("    printflush(message1);")
        lines.append("    stop();")
    else:
        lines.append(f"    done{i} = 1;")
        lines.append("    printflush(message1);")
    lines.append("}")
    return "\n".join(lines) + "\n"

import os
os.makedirs('check/peers', exist_ok=True)
for i in range(1, N):
    open(f'check/peers/t106_peterson3_p{i}.c', 'w', encoding='utf-8').write(program(i))
main = program(0)
header = ("/* EXPECT: 3 3 3 0 */\n"
          "/* The generalised (N-process) Peterson algorithm -- the `level` / `turn` filter\n"
          "   algorithm -- between three real processors running CONCURRENTLY (// INTERLEAVE),\n"
          "   entirely over remote variables:\n\n"
          "     - `level[i]` is written by process i only, so each one lives on its own\n"
          "       processor and the other two read it as a REMOTE ARRAY;\n"
          "     - `turn[l]` is written by all of them, so it lives here and the others write\n"
          "       it remotely;\n"
          "     - `owner` / `violations` / `done` are shared the same way.\n\n"
          "   A process claims `owner` on entry and checks it still owns it after a little\n"
          "   work, which is what catches two processes being inside at once. */\n"
          "// PEER: processor1=peers/t106_peterson3_p1.c, processor2=peers/t106_peterson3_p2.c\n"
          "// SELF: processor0\n"
          "// INTERLEAVE\n")
open('check/t106_peterson3.c', 'w', encoding='utf-8').write(header + main)
print('written')
