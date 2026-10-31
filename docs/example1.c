// Example 1: Scatter shooting any air target

auto device scatter1;

const string_t filter1 = "flying", filter2 = "any", filter3 = "any", sorter = "distance";

void main() {
    int order = 1;
    device former = null;
    while (true) {
        device target = radar(filter1, filter2, filter3, sorter, scatter1, order++);
        control("shootp", scatter1, target, 1);
        if (target == former) break;
    }
}