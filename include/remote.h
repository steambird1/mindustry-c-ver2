/*
 * Remote service support by Seabird Gunnhildr
 * as a part of standard library of MindC, 2025 - 2026.
*/

#define begin_atomic
#define end_atomic wait(0);

/*
 * Algorithms of preventing conflicting resource access.
 *
 * 1: Filter algorithm / Extended Peterson algorithm
 * 2: Token algorithm
*/

// Remote version
inline void rpeinit(int me, remote bool flag[2], remote int *turn) {
	flag[0] = false;
	flag[1] = false;
}

inline void rpelock(int me, remote bool flag[2], remote int *turn) {
	const int opposite = 1 - me;
	flag[me] = true;
	(*turn) = opposite;
	while (flag[opposite] && ((*turn) == opposite)) {
		wait(0);
	}
}

inline void rpeunlock(int me, remote bool flag[2]) {
	flag[me] = false;
}

inline void rpeminit(int me, int total, remote int level[], remote int turn[]) {
	int i;
	for (i = 0; i < total; i++) {
		level[i] = 0;
		turn[i] = 0;
	}
}

// Filter algorithm
inline void rpemlock(int me, int total, remote int level[], remote int turn[]) {
	int i;
	
	for (i = 0; i < total - 1; i++) {
		level[me] = i;
		turn[i] = me;
		while (turn[i] == me) {
			bool flag = true;
			int j;
			
			for (j = 0; j < total; j++) {
				if (j != me && level[j] >= i) {
					flag = false;
					break;
				}
			}
			if (flag) break;
		}
	}
}

inline void rpemunlock(int me, int total, remote int level[]) {
	level[me] = 0;
}

