
// TODO: Some changes...

// 向量结构体
struct Vector2 {
    double x; double y;
};

// 全局常量（假设已知）
Vector2 P0 = {0, 0};        // 炮塔位置
Vector2 P1 = {100, 50};     // 飞行器初始位置
Vector2 v = {20, 10};       // 飞行器初始速度
Vector2 a = {2, -1};        // 飞行器初始加速度
const double M_PI = acos(0.5) * 3;
const double v_b = 300;             // 子弹速度
const double a_max = 50;            // 最大加加速度
const double EPS = 1e-9;              // 精度阈值
const int MAX_ITER = 50;              // 最大迭代次数

// 向量运算函数
Vector2 vec_add(Vector2 a, Vector2 b) {
    return {a.x + b.x, a.y + b.y};
}

Vector2 vec_sub(Vector2 a, Vector2 b) {
    return {a.x - b.x, a.y - b.y};
}

Vector2 vec_mul(Vector2 v, double s) {
    return {v.x * s, v.y * s};
}

double vec_dot(Vector2 a, Vector2 b) {
    return a.x * b.x + a.y * b.y;
}

double vec_length_sq(Vector2 v) {
    return v.x * v.x + v.y * v.y;
}

// Example of asm-speedup
double vec_length(Vector2 v) {
    //return sqrt(vec_length_sq(v));
    const double _a = v.x, _b = v.y;
    asm(":varStorage _a _a");
    asm(":varStorage _b _a");
    asm("op len _result _a _b");
    return asm(":varRead _result");
}

Vector2 vec_normalize(Vector2 v) {
    double len = vec_length(v);
    if (len < EPS) return {0.0, 0.0};
    return {v.x / len, v.y / len};
}

// 计算一阶提前量的时间 T1
double solve_T1() {
    Vector2 delta = vec_sub(P1, P0);
    
    // 定义函数 f(T) = |delta + v*T + 0.5*a*T²|² - (v_b*T)²
    // 及其导数 f'(T)
    double T = vec_length(delta) / v_b;  // 初始猜测
    double T_prev = 0;
    int iter = 0, i;
    
    while (abs(T - T_prev) > EPS && iter < MAX_ITER) {
        T_prev = T;
        
        // 计算当前位置
        Vector2 pos = vec_add(delta, vec_add(vec_mul(v, T), vec_mul(a, 0.5*T*T)));
        double pos_len_sq = vec_length_sq(pos);
        double pos_len = sqrt(pos_len_sq);
        
        // f(T)
        double f = pos_len_sq - v_b*v_b*T*T;
        
        // f'(T)
        Vector2 vel = vec_add(v, vec_mul(a, T));
        double f_prime = 2.0*vec_dot(pos, vel) - 2.0*v_b*v_b*T;
        
        if (abs(f_prime) < EPS) {
            // 导数为零，使用二分法回退
            double T_low = 0.0, T_high = T * 2.0;
            for (i = 0; i < 30; i++) {
                T = (T_low + T_high) * 0.5;
                pos = vec_add(delta, vec_add(vec_mul(v, T), vec_mul(a, 0.5*T*T)));
                pos_len_sq = vec_length_sq(pos);
                f = pos_len_sq - v_b*v_b*T*T;
                
                if (f > 0) T_high = T;
                else T_low = T;
            }
            break;
        }
        
        // 牛顿迭代
        T = T - f / f_prime;
        
        // 确保 T 为正
        if (T < 0) T = T_prev * 0.5;
        
        iter++;
    }
    
    return T;
}

// 计算二阶提前量的时间 T2
double solve_T2(double T1, Vector2 j0) {
    Vector2 delta = vec_sub(P1, P0);
    
    // 定义函数 g(T) = |delta + v*T + 0.5*a*T² + (1/6)*j0*T³|² - (v_b*T)²
    double T = T1;  // 初始猜测
    double T_prev = 0;
    int iter = 0, i;
    
    while (abs(T - T_prev) > EPS && iter < MAX_ITER) {
        T_prev = T;
        
        // 计算当前位置
        Vector2 pos = vec_add(delta, vec_mul(v, T));
        pos = vec_add(pos, vec_mul(a, 0.5*T*T));
        pos = vec_add(pos, vec_mul(j0, T*T*T/6.0));
        
        double pos_len_sq = vec_length_sq(pos);
        
        // g(T)
        double g = pos_len_sq - v_b*v_b*T*T;
        
        // g'(T)
        Vector2 vel = vec_add(v, vec_mul(a, T));
        vel = vec_add(vel, vec_mul(j0, 0.5*T*T));
        
        double g_prime = 2.0*vec_dot(pos, vel) - 2.0*v_b*v_b*T;
        
        if (abs(g_prime) < EPS) {
            // 导数为零，使用二分法回退
            double T_low = 0.0, T_high = T * 2.0;
            for (i = 0; i < 30; i++) {
                T = (T_low + T_high) * 0.5;
                pos = vec_add(delta, vec_mul(v, T));
                pos = vec_add(pos, vec_mul(a, 0.5*T*T));
                pos = vec_add(pos, vec_mul(j0, T*T*T/6.0));
                pos_len_sq = vec_length_sq(pos);
                g = pos_len_sq - v_b*v_b*T*T;
                
                if (g > 0) T_high = T;
                else T_low = T;
            }
            break;
        }
        
        // 牛顿迭代
        T = T - g / g_prime;
        
        // 确保 T 为正且不超过 T1（飞行器可能在 T1 后改变策略）
        if (T < 0) T = T_prev * 0.5;
        if (T > T1) T = T1;
        
        iter++;
    }
    
    return T;
}

Vector2 sensor_loc(device dev) {
    
}

void execute(device tower, int max_target) {
    P0.x = (double)sensor(@x, tower);
    P0.y = (double)sensor(@y, tower);
    int order = 0;
    device current;
    Vector2 S1, S2;
    while (order < max_target && (current = radar("flying", "any", "any", "distance", tower)) != null) {
        P1.x = (double)sensor(@x, current);
        P1.y = (double)sensor(@y, current);
        // Get speed information

        // Get acceleration information

    }
}

void main() {
    // 步骤1: 计算一阶提前量 T1 和 n1
    double T1 = solve_T1();
    
    // 计算 n1
    Vector2 delta = vec_sub(P1, P0);
    Vector2 pos_at_T1 = vec_add(delta, vec_add(vec_mul(v, T1), vec_mul(a, 0.5*T1*T1)));
    Vector2 n1 = vec_normalize(pos_at_T1);
    
    // 步骤2: 飞行器最优规避方向（垂直于 n1）
    // 选择逆时针旋转90度的方向
    Vector2 j0 = {-n1.y, n1.x};
    j0 = vec_mul(vec_normalize(j0), a_max);
    
    // 步骤3: 计算二阶提前量 T2
    double T2 = solve_T2(T1, j0);
    
    // 步骤4: 计算发射方向 n2 和角度
    Vector2 pos_at_T2 = vec_add(delta, vec_mul(v, T2));
    pos_at_T2 = vec_add(pos_at_T2, vec_mul(a, 0.5*T2*T2));
    pos_at_T2 = vec_add(pos_at_T2, vec_mul(j0, T2*T2*T2/6.0));
    
    Vector2 n2 = vec_normalize(pos_at_T2);
    
    // 计算角度（以 x 轴正方向为 0，逆时针增大）
    /*
    double angle = atan2(n2.y, n2.x);
    if (angle < 0) angle += 2.0 * M_PI;  // 转换为 0 到 2π
    
    printf("一阶提前量时间 T1: %.6f\n", T1);
    printf("一阶瞄准方向 n1: (%.6f, %.6f)\n", n1.x, n1.y);
    printf("飞行器加加速度 j0: (%.6f, %.6f)\n", j0.x, j0.y);
    printf("二阶提前量时间 T2: %.6f\n", T2);
    printf("二阶瞄准方向 n2: (%.6f, %.6f)\n", n2.x, n2.y);
    printf("射击角度: %.6f rad (%.6f°)\n", angle, angle * 180.0 / M_PI);
     */
}