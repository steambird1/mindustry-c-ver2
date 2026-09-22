void test(remote int s[5]) {
   s[1] = 1;
}

extern int r[5] = array("embedded_divided");
remote int rs[] = remote(@this, r);

void main() {
    test(rs);
}