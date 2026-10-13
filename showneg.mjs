import {spawnSync} from 'child_process';
const r = spawnSync('node', ['../tools/negative.mjs'], {cwd: 'D:/Project/MindustryC/mindustry-c/testers/unit_tests', encoding:'utf8'});
const lines = r.stdout.split('\n');
const idx = lines.findIndex(l=>l.includes('1 failed'));
for(let i=Math.max(0,idx-10); i<Math.min(lines.length, idx+60); i++) console.log(lines[i]);
