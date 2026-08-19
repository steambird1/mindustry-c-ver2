#include "mindc.h"

/*
Connect node1 for connection,
node2 for mainly-using,
node3 for mainly-supporting

This will cutoff electricity when the supply goes dangerously low
to prevent collapse.

Since cut_node does not participate in calculation, it can be anything (e.g. a battery or even a factory
-- in case you want to save energy.)
*/

auto device node1, node2, node3;
auto device display1;

const device cut_node = node1, consume_node = node2, supply_node = node3;
const device display = display1;

extern int threshold = 0;

float round(float x) {
	return floor(floor(x*10)/10);
}

void show_amount(float amount) {
	float val = abs(amount);
	if (val > 1000000) {
		print(round(amount/1000000),"M");
	} else if (val > 1000) {
		print(round(amount/1000),"K");
	} else {
		print(floor(amount));
	}
}

void show_node(int where, char who, device whose) {
	print(who);
	draw("color", 255, 255, 255, 255);
	draw("print", 5, where, @bottomLeft);
	draw("color", 0, 255, 0, 255);
	show_amount((float)sensor(whose, @powerNetIn));
	draw("print", 30, where, @bottomLeft);
	draw("color", 255, 0, 0, 255);
	show_amount((float)sensor(whose, @powerNetOut));
	draw("print", 55, where, @bottomLeft);
}

void show_status(char msg) {
	draw("clear", 0, 0, 0);
	show_node(65, "C", consume_node);
	show_node(50, "S", supply_node);
	if ((bool)sensor(cut_node, @enabled)) {
		draw("color", 0, 255, 0, 255);
		print("ON  transmit");
	} else {
		draw("color", 255, 0, 0, 255);
		print("OFF transmit");
	}
	draw("print", 5, 35, @bottomLeft);
	draw("color", 255, 255, 255, 255);
	print(msg);
	draw("print", 5, 10, @bottomLeft);
	drawflush(display);
}

void main() {
	while (true) {
		char state = "";
		float demand = ((float)sensor(consume_node, @powerNetIn) - (float)sensor(consume_node, @powerNetOut));
		if ((float)sensor(supply_node, @powerNetCapacity) < (demand * -50)) {
			state = "Low PNC";
		}
		bool pok = ((float)sensor(supply_node, @powerNetIn)) - ((float)sensor(supply_node, @powerNetOut)) >= threshold;
		if ((bool)sensor(cut_node, @enabled)) {
			if (!pok) {
				control("enabled", cut_node, false);
			}
		} else {
			if (pok && (float)sensor(supply_node, @powerNetCapacity) > (demand * -36)) {
				control("enabled", cut_node, true);
			}
		}
		show_status(state);
	}
}