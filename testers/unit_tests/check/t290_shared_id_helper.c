/*
For a repeated stable-id mapping, `#pragma optimize(shared_ids)` emits the
select chain once as a helper. Both directions are covered: the writer converts
a runtime building to a stable id, and the reader maps it back.
*/
/* EXPECT: 3 */
/* EMIT: select __shared_building equal __shared_id 1 bank1 __shared_building */
/* EMIT: set @counter ___sharedIdToBuilding */
/* EMIT: set @counter ___sharedBuildingToId */
#pragma optimize(shared_ids)
#pragma noinline(put)
auto device message1;

int data[4] = {1, 2, 3, 4};
shared int *volatile slot;

void put(shared int *p) {
    slot = p;
}

void main() {
    put(&data[2]);
    print(*slot);
    printflush(message1);
    stop();
}
