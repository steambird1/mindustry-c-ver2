class AttributeClass {
	setAttribute(key, value) {
        this._attributes.set(key, value);
        return this;
    }
    
    getAttribute(key) {
        return this._attributes.get(key);
    }
    
    hasAttribute(key) {
        return this._attributes.has(key);
    }
}

class Instruction extends AttributeClass {
	constructor(instructSequence = [], instructionReturn = null) {
        super();
		this.isInstructionGroup = true;
		if (instructSequence.length !== undefined) {
			this.instructions = instructSequence;
		} else {
			this.instructions = [instructSequence];
		}
		this.instructionReturn = instructionReturn;	// What this instruction returns
	}
	
	/**
	 Connect 2 instruction types.
	 @param other {Instruction}
	 @return {Instruction} - this. This function modifies current instruction class.
	 @remark This copies the object.
	*/
	concat(other) {
		/*
		const currentLength = this.instructions.length;
		other.instructions.forEach(stmt => {
			this.instructions.push({
				content: stmt.content,
				referrer: stmt.referrer.map(refId => (refId + currentLength))
			});
		});
		return this;
		*/
		if (!other) return;
		this.instructions.push(other);
		return this;
	}
	
	/**
	 * 
	 * @param {number} [additionalLength = 0] 
	 * @returns 
	 * @bug
	 * @todo
	 */
	output(additionalLength = 0, additionalIteration = 0) {
		this.currentLength = additionalLength;
		let currentIteration = 0;
		return this.instructions.flatMap(stmt => {
			if (stmt.isInstructionGroup) {
				const combination = stmt.output(this.currentLength, currentIteration);
				this.currentLength += combination.length;
				currentIteration++;
				return combination;
			} else {
				let code = stmt.content;
				for (let i = 0; i < stmt.referrer.length; i++) {
					let reg = new RegExp('\\{' + i + '\\}', 'g');
					code = code.replace(reg, stmt.referrer[i] + this.currentLength - currentIteration - additionalIteration);
				}
				this.currentLength++;
				currentIteration++;
				return [code];
			}
		});
	}

	replace(variable, value) {
		this.instructions.forEach(stmt => {
			if (stmt.isInstructionGroup) {
				stmt.replace(variable, value);
			} else {
				stmt.content = stmt.content.replace(new RegExp(`\\{${variable}\\}`, 'g'), `{${stmt.referrer.length}}`);
				stmt.referrer.push(value);
			}
		});
		return this;
	}

	size() {
		let currentSize = 0;
		this.instructions.forEach(instruction => {
			if (instruction.isInstructionGroup) {
				currentSize += instruction.size();
			} else {
				currentSize++;
			}
		});
		return currentSize;
	}
}

var a = new Instruction();
a.concat(new Instruction({content: '{0}', referrer: [3]}));
var b = new Instruction();
b.concat(new Instruction({content: '{0}', referrer: [1]}));
b.concat(new Instruction({content: 'seg.1', referrer: []}));
b.concat(new Instruction({content: '{0}', referrer: [3]}));
b.concat(new Instruction({content: 'seg.2', referrer: []}));
b.concat({content: '{0}', referrer: [0]});
a.concat(b);
a.output();