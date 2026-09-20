仍然存在一个问题（还是和之前的程序类似）：

```c
#pragma optimize(array)

auto device unloader1;
auto device vault1;

const int thre[4] = array("embedded_lookup", {200, 200, 200, 200}); // 此处读取正确，但没有写入数值
const item_t objs[4] = {@lead, @silicon, @graphite, @copper};   // 修复后，请检查非数值类型数组是否存在相似问题
const int osize = 4;

bool proc(device vault, device unloader, item_t obj, int thr) {
    int sens = (int)(sensor(vault, obj));
    wait(0.5);
    if (sens > thr) {
        control("enabled", unloader, true);
        control("configure", unloader, obj);
        return true;
    } else {
        return false;
    }
}

void main() {
    int i;
    bool done = false;
    for (i = 0; i < osize; i++) {
        if (proc(vault1, unloader1, objs[i], thre[i])) {
            done = true;
            break;
        }
    }
    if (!done) {
        control("enabled", unloader1, false);
    }
}
```

此外，其在不指定 `array()`、有内存时生成：

```
set __linkscan 0
jump 10 always x 0
getlink __building __linkscan
sensor __buildingtype __building @type
jump 9 strictEqual __buildingtype @memory-cell
jump 9 strictEqual __buildingtype @memory-bank
jump 9 strictEqual __buildingtype @world-cell
op add __linkscan __linkscan 1
jump 2 always x 0
set @counter __linker_ret
op add __linker_ret @counter 1
jump 2 always x 0
set cell1_id __linkscan
op add __linkscan __linkscan 1
set null_block null
set null_pos null
write -1 cell1 0
write -1 cell1 1
write 64 cell1 2
write 0 cell1 3
set g:.thre_block cell1_id
set g:.thre_pos 4
set g:.thre_block cell1_id
set g:.thre_pos 4
write 200 cell1 4
write 200 cell1 5
write 200 cell1 6
write 200 cell1 7
set g:.objs_block cell1_id
set g:.objs_pos 8
set g:.objs_block cell1_id
set g:.objs_pos 8
set g:.__tempsym_1 1
write g:.__tempsym_1 cell1 8
set g:.__tempsym_2 9
write g:.__tempsym_2 cell1 9
set g:.__tempsym_3 3
write g:.__tempsym_3 cell1 10
set g:.__tempsym_4 0
write g:.__tempsym_4 cell1 11
op add _proc @counter 1
jump 56 always x 0
set g:.f:proc.__preserved_stackpos __stackpos
lookup item g:.f:proc.b:1.__tempsym_0 g:.f:proc.obj
sensor g:.f:proc.b:1.sens g:.f:proc.vault g:.f:proc.b:1.__tempsym_0
wait 0.5
jump 53 lessThanEq g:.f:proc.b:1.sens g:.f:proc.thr
control enabled g:.f:proc.unloader true x x
lookup item g:.f:proc.b:1.b:2.__tempsym_0 g:.f:proc.obj
control configure g:.f:proc.unloader g:.f:proc.b:1.b:2.__tempsym_0 x x
set __return true
jump 55 always x 0
jump 55 always x 0
set __return false
jump 55 always x 0
set @counter g:.f:proc.__preserved_stackpos
op add _main @counter 1
jump 90 always x 0
set g:.f:main.__preserved_stackpos __stackpos
set g:.f:main.b:4.done false
set g:.f:main.b:4.i 0
jump 85 greaterThanEq g:.f:main.b:4.i 4
set g:.f:proc.vault vault1
set g:.f:proc.unloader unloader1
set g:.f:main.b:4.b:5.__tempsym_ptr_0_block g:.objs_block
set g:.f:main.b:4.b:5.__tempsym_ptr_0_pos g:.objs_pos
op add g:.f:main.b:4.b:5.__tempsym_ptr_0_pos g:.f:main.b:4.b:5.__tempsym_ptr_0_pos g:.f:main.b:4.i
getlink __curb g:.f:main.b:4.b:5.__tempsym_ptr_0_block
read g:.f:proc.obj __curb g:.f:main.b:4.b:5.__tempsym_ptr_0_pos
set g:.f:main.b:4.b:5.__tempsym_ptr_1_block g:.thre_block
set g:.f:main.b:4.b:5.__tempsym_ptr_1_pos g:.thre_pos
op add g:.f:main.b:4.b:5.__tempsym_ptr_1_pos g:.f:main.b:4.b:5.__tempsym_ptr_1_pos g:.f:main.b:4.i
getlink __curb g:.f:main.b:4.b:5.__tempsym_ptr_1_block
read g:.f:proc.thr __curb g:.f:main.b:4.b:5.__tempsym_ptr_1_pos
set g:.f:main.__preserved_stackpos __stackpos
op add __stackpos @counter 1
set @counter _proc
set __stackpos g:.f:main.__preserved_stackpos
set g:.f:main.b:4.b:5.__tempsym_4 __return
jump 82 equal g:.f:main.b:4.b:5.__tempsym_4 false
set g:.f:main.b:4.done true
jump 85 always x 0
set g:.f:main.b:4.__tempsym_0 g:.f:main.b:4.i
op add g:.f:main.b:4.i g:.f:main.b:4.i 1
jump 61 always x 0
op equal g:.f:main.b:4.__tempsym_0 g:.f:main.b:4.done false
select g:.f:main.b:4.__tempsym_1 equal g:.f:main.b:4.__tempsym_0 0 false true
jump 89 equal g:.f:main.b:4.__tempsym_1 false
control enabled unloader1 false x x
end
set __stackframe_block cell1_id
set __stackframe_pos 12
set __internal_stackpos __stackpos
op add __stackpos @counter 1
set @counter _main
set __stackpos __internal_stackpos
```

代码在两个方面过于复杂：

1. 初始化进行了两遍，如下（之前提到过）。冗余明显，请进行消除。
```
set g:.objs_block cell1_id
set g:.objs_pos 8
set g:.objs_block cell1_id
set g:.objs_pos 8
```

2. 大量临时变量可以消除，但没有消除，如下面两个例子。请尝试消除形如第一个例子中的临时变量，并尽量（如果难以做到，可以不进行，并告诉我复杂性产生的原因）消除如第二个例子的临时变量。
```
set g:.__tempsym_1 1
write g:.__tempsym_1 cell1 8
```
又如：
```
set g:.f:main.b:4.b:5.__tempsym_ptr_0_block g:.objs_block
set g:.f:main.b:4.b:5.__tempsym_ptr_0_pos g:.objs_pos
op add g:.f:main.b:4.b:5.__tempsym_ptr_0_pos g:.f:main.b:4.b:5.__tempsym_ptr_0_pos g:.f:main.b:4.i
getlink __curb g:.f:main.b:4.b:5.__tempsym_ptr_0_block
read g:.f:proc.obj __curb g:.f:main.b:4.b:5.__tempsym_ptr_0_pos
```
（注：此处其实不需要 `g:.f:main.b:4.b:5.__tempsym_ptr_0_block`