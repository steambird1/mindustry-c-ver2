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

auto device node1;
auto device display1;

const device elec_node = node1;
const device display = display1;

extern int threshold = 0;
bool status;

float round(float x) {
	return floor(x*10)/10;
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
	draw("print", 30, where-15, @bottomLeft);
}

void show_status(char msg) {
	draw("clear", 0, 0, 0);
	show_node(70, "El", elec_node);
	if (status) {
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
		float demand = ((float)sensor(elec_node, @powerNetIn) - (float)sensor(elec_node, @powerNetOut));
		if ((float)sensor(elec_node, @powerNetStored) < (demand * -50)) {
			state = "Low PNC";
		}
		status = (float)sensor(elec_node, @powerNetStored) >= (demand * -25);
		int i;
		for (i = 0; i < @links; ++i) {
			const device build = getlink(i);
			const content_t type = (content_t)sensor(build, @type);
			if (type == @power_node) continue;
			if (type == @power_node_large) continue;
			if (type == @logic_display) continue;
			if (type == @large_logic_display) continue;
			control("enabled", build, status);
		}
		show_status(state);
	}
}