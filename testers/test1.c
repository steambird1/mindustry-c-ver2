struct _q {
  int w; int r;
}

union _u {
  int a;
  struct _q ttt;
};

struct _s {
  int w; int q;
};

typedef struct _s s;

struct _t {
  s test1;
  int www;
  struct _s test2;
};

int subcall(int x, int y) {
   if (x > y) return x - y + 1;
   else return y - x - 1;
}

void main() {
   s tester, *testptr;
   int w, *wp, r, t;
   
   w = 5;
   r = 0;
   t = 0;
   if (r + 1) {
	int q = w*3, i;
	tester.q = subcall(q, w);
	if (q) {
		w++;
	}
	for (i = 0; i < w; i++) {
		while (r % 5) {
			r++;
		}
		t++;
		if (t == 114) {
			break;
		}
	}
    testptr = &tester;
   }
   
   wp = &tester.q;
   (*wp) = 1919810;
   
}