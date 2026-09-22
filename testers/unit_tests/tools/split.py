import os, re, sys

text = open('/data/inputs/result.txt', encoding='utf-8').read().replace('\r\n', '\n')
lines = text.split('\n')
out_root = '/data/workspace'
cur = None
buf = []
written = []
seen = set()

begin_re = re.compile(r'(?P<pre>[^\n]*?)/\*\s*BEGIN:\s*(?P<name>[^*\n]+?)\s*\*/(?P<post>[^\n]*)')
end_re = re.compile(r'(?P<pre>[^\n]*?)/\*\s*END:\s*(?P<name>[^*\n]+?)\s*\*/(?P<post>[^\n]*)')


def flush():
    global cur, buf
    if cur is None:
        return
    p = os.path.join(out_root, cur)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    body = '\n'.join(buf).rstrip() + '\n'
    # The bundle contains every test twice; keep the first copy.
    if cur in seen:
        cur = None
        buf = []
        return
    seen.add(cur)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(body)
    written.append(cur)
    cur = None
    buf = []


for line in lines:
    m = end_re.search(line)
    if m and cur is not None:
        pre = m.group('pre')
        if pre.strip():
            buf.append(pre)
        flush()
        continue
    m = begin_re.search(line)
    if m:
        flush()
        name = m.group('name').replace('\\', '/')
        cur = name
        buf = []
        post = m.group('post')
        if post.strip():
            buf.append(post)
        continue
    if cur is not None:
        buf.append(line)
flush()
sys.stderr.write('wrote %d files\n' % len(written))
