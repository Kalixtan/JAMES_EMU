/*
 *
 *	Z80 Emulator
 *
 */

import Cpu, {dummypage} from './cpu.js';
import {seq} from "../../utils.js";

export default class Z80 extends Cpu {
	b = 0;
	c = 0;
	d = 0;
	e = 0;
	h = 0;
	l = 0;
	a = 0;
	f = 0; // f:sz-h-pnc
	ixh = 0;
	ixl = 0;
	iyh = 0;
	iyl = 0;
	iff = 0;
	im = 0;
	i = 0;
	r = 0;
	b_prime = 0;
	c_prime = 0;
	d_prime = 0;
	e_prime = 0;
	h_prime = 0;
	l_prime = 0;
	a_prime = 0;
	f_prime = 0;
	sp = 0;
	iomap = [];

	constructor(clock) {
		super(clock);
		for (let i = 0; i < 0x100; i++)
			this.iomap.push({base: dummypage, read: null, write: () => {}});
	}

	reset() {
		super.reset();
		this.iff = 0;
		this.im = 0;
		this.pc = 0;
		this.i = 0;
		this.r = 0;
	}

	interrupt(intvec = 0xff) {
		if (!super.interrupt() || this.iff !== 3)
			return false;
		this.iff = 0;
		switch (this.im) {
		case 0:
			this.cycle -= cc_op[intvec] + cc_ex[0xff];
			switch (intvec) {
			case 0xc7: // RST 00h
				return this.rst(0x00), true;
			case 0xcf: // RST 08h
				return this.rst(0x08), true;
			case 0xd7: // RST 10h
				return this.rst(0x10), true;
			case 0xdf: // RST 18h
				return this.rst(0x18), true;
			case 0xe7: // RST 20h
				return this.rst(0x20), true;
			case 0xef: // RST 28h
				return this.rst(0x28), true;
			case 0xf7: // RST 30h
				return this.rst(0x30), true;
			case 0xff: // RST 38h
				return this.rst(0x38), true;
			}
			break;
		case 1:
			return this.cycle -= cc_op[0xff] + cc_ex[0xff], this.rst(0x38), true;
		case 2:
			return this.cycle -= cc_op[0xcd] + cc_ex[0xff], this.rst(this.read16(intvec & 0xff | this.i << 8)), true;
		}
		return true;
	}

	non_maskable_interrupt() {
		if (!super.interrupt())
			return false;
		return this.cycle -= 11, this.iff &= 2, this.rst(0x66), true;
	}

	_execute() {
		let v, op = this.fetch();
		this.cycle -= cc_op[op], this.r = this.r & 0x80 | this.r + 1 & 0x7f;
		switch (op) {
		case 0x00: // NOP
			return;
		case 0x01: // LD BC,nn
			return void([this.c, this.b] = this.split(this.fetch16()));
		case 0x02: // LD (BC),A
			return this.write(this.c | this.b << 8, this.a);
		case 0x03: // INC BC
			return void([this.c, this.b] = this.split((this.c | this.b << 8) + 1 & 0xffff));
		case 0x04: // INC B
			return void(this.b = this.inc8(this.b));
		case 0x05: // DEC B
			return void(this.b = this.dec8(this.b));
		case 0x06: // LD B,n
			return void(this.b = this.fetch());
		case 0x07: // RLCA
			return this.f = this.f & ~0x13 | this.a >> 7, void(this.a = this.a << 1 & 0xfe | this.a >> 7);
		case 0x08: // EX AF,AF'
			return void([this.f, this.a, this.f_prime, this.a_prime] = [this.f_prime, this.a_prime, this.f, this.a]);
		case 0x09: // ADD HL,BC
			return void([this.l, this.h] = this.split(this.add16(this.l | this.h << 8, this.c | this.b << 8)));
		case 0x0a: // LD A,(BC)
			return void(this.a = this.read(this.c | this.b << 8));
		case 0x0b: // DEC BC
			return void([this.c, this.b] = this.split((this.c | this.b << 8) - 1 & 0xffff));
		case 0x0c: // INC C
			return void(this.c = this.inc8(this.c));
		case 0x0d: // DEC C
			return void(this.c = this.dec8(this.c));
		case 0x0e: // LD C,n
			return void(this.c = this.fetch());
		case 0x0f: // RRCA
			return this.f = this.f & ~0x13 | this.a & 1, void(this.a = this.a << 7 & 0x80 | this.a >> 1);
		case 0x10: // DJNZ e
			return (this.b = this.b - 1 & 0xff) && (this.cycle -= cc_ex[0x10]), this.jr(this.b !== 0);
		case 0x11: // LD DE,nn
			return void([this.e, this.d] = this.split(this.fetch16()));
		case 0x12: // LD (DE),A
			return this.write(this.e | this.d << 8, this.a);
		case 0x13: // INC DE
			return void([this.e, this.d] = this.split((this.e | this.d << 8) + 1 & 0xffff));
		case 0x14: // INC D
			return void(this.d = this.inc8(this.d));
		case 0x15: // DEC D
			return void(this.d = this.dec8(this.d));
		case 0x16: // LD D,n
			return void(this.d = this.fetch());
		case 0x17: // RLA
			return v = this.a << 1 | this.f & 1, this.f = this.f & ~0x13 | v >> 8, void(this.a = v & 0xff);
		case 0x18: // JR e
			return this.jr(true);
		case 0x19: // ADD HL,DE
			return void([this.l, this.h] = this.split(this.add16(this.l | this.h << 8, this.e | this.d << 8)));
		case 0x1a: // LD A,(DE)
			return void(this.a = this.read(this.e | this.d << 8));
		case 0x1b: // DEC DE
			return void([this.e, this.d] = this.split((this.e | this.d << 8) - 1 & 0xffff));
		case 0x1c: // INC E
			return void(this.e = this.inc8(this.e));
		case 0x1d: // DEC E
			return void(this.e = this.dec8(this.e));
		case 0x1e: // LD E,n
			return void(this.e = this.fetch());
		case 0x1f: // RRA
			return v = this.f << 8 | this.a, this.f = this.f & ~0x13 | v & 1, void(this.a = v >> 1 & 0xff);
		case 0x20: // JR NZ,e
			return !(this.f & 0x40) && (this.cycle -= cc_ex[0x20]), this.jr(!(this.f & 0x40));
		case 0x21: // LD HL,nn
			return void([this.l, this.h] = this.split(this.fetch16()));
		case 0x22: // LD (nn),HL
			return this.write16(this.fetch16(), this.l | this.h << 8);
		case 0x23: // INC HL
			return void([this.l, this.h] = this.split((this.l | this.h << 8) + 1 & 0xffff));
		case 0x24: // INC H
			return void(this.h = this.inc8(this.h));
		case 0x25: // DEC H
			return void(this.h = this.dec8(this.h));
		case 0x26: // LD H,n
			return void(this.h = this.fetch());
		case 0x27: // DAA
			return this.daa();
		case 0x28: // JR Z,e
			return this.f & 0x40 && (this.cycle -= cc_ex[0x28]), this.jr((this.f & 0x40) !== 0);
		case 0x29: // ADD HL,HL
			return void([this.l, this.h] = this.split(this.add16(this.l | this.h << 8, this.l | this.h << 8)));
		case 0x2a: // LD HL,(nn)
			return void([this.l, this.h] = this.split(this.read16(this.fetch16())));
		case 0x2b: // DEC HL
			return void([this.l, this.h] = this.split((this.l | this.h << 8) - 1 & 0xffff));
		case 0x2c: // INC L
			return void(this.l = this.inc8(this.l));
		case 0x2d: // DEC L
			return void(this.l = this.dec8(this.l));
		case 0x2e: // LD L,n
			return void(this.l = this.fetch());
		case 0x2f: // CPL
			return this.f |= 0x12, void(this.a ^= 0xff);
		case 0x30: // JR NC,e
			return !(this.f & 1) && (this.cycle -= cc_ex[0x30]), this.jr(!(this.f & 1));
		case 0x31: // LD SP,nn
			return void(this.sp = this.fetch16());
		case 0x32: // LD (nn),A
			return this.write(this.fetch16(), this.a);
		case 0x33: // INC SP
			return void(this.sp = this.sp + 1 & 0xffff);
		case 0x34: // INC (HL)
			return v = this.l | this.h << 8, this.write(v, this.inc8(this.read(v)));
		case 0x35: // DEC (HL)
			return v = this.l | this.h << 8, this.write(v, this.dec8(this.read(v)));
		case 0x36: // LD (HL),n
			return this.write(this.l | this.h << 8, this.fetch());
		case 0x37: // SCF
			return void(this.f = this.f & ~0x12 | 1);
		case 0x38: // JR C,e
			return this.f & 1 && (this.cycle -= cc_ex[0x38]), this.jr((this.f & 1) !== 0);
		case 0x39: // ADD HL,SP
			return void([this.l, this.h] = this.split(this.add16(this.l | this.h << 8, this.sp)));
		case 0x3a: // LD A,(nn)
			return void(this.a = this.read(this.fetch16()));
		case 0x3b: // DEC SP
			return void(this.sp = this.sp - 1 & 0xffff);
		case 0x3c: // INC A
			return void(this.a = this.inc8(this.a));
		case 0x3d: // DEC A
			return void(this.a = this.dec8(this.a));
		case 0x3e: // LD A,n
			return void(this.a = this.fetch());
		case 0x3f: // CCF
			return void(this.f = this.f & ~0x12 ^ 1 | this.f << 4 & 0x10);
		case 0x40: // LD B,B
			return;
		case 0x41: // LD B,C
			return void(this.b = this.c);
		case 0x42: // LD B,D
			return void(this.b = this.d);
		case 0x43: // LD B,E
			return void(this.b = this.e);
		case 0x44: // LD B,H
			return void(this.b = this.h);
		case 0x45: // LD B,L
			return void(this.b = this.l);
		case 0x46: // LD B,(HL)
			return void(this.b = this.read(this.l | this.h << 8));
		case 0x47: // LD B,A
			return void(this.b = this.a);
		case 0x48: // LD C,B
			return void(this.c = this.b);
		case 0x49: // LD C,C
			return;
		case 0x4a: // LD C,D
			return void(this.c = this.d);
		case 0x4b: // LD C,E
			return void(this.c = this.e);
		case 0x4c: // LD C,H
			return void(this.c = this.h);
		case 0x4d: // LD C,L
			return void(this.c = this.l);
		case 0x4e: // LD C,(HL)
			return void(this.c = this.read(this.l | this.h << 8));
		case 0x4f: // LD C,A
			return void(this.c = this.a);
		case 0x50: // LD D,B
			return void(this.d = this.b);
		case 0x51: // LD D,C
			return void(this.d = this.c);
		case 0x52: // LD D,D
			return;
		case 0x53: // LD D,E
			return void(this.d = this.e);
		case 0x54: // LD D,H
			return void(this.d = this.h);
		case 0x55: // LD D,L
			return void(this.d = this.l);
		case 0x56: // LD D,(HL)
			return void(this.d = this.read(this.l | this.h << 8));
		case 0x57: // LD D,A
			return void(this.d = this.a);
		case 0x58: // LD E,B
			return void(this.e = this.b);
		case 0x59: // LD E,C
			return void(this.e = this.c);
		case 0x5a: // LD E,D
			return void(this.e = this.d);
		case 0x5b: // LD E,E
			return;
		case 0x5c: // LD E,H
			return void(this.e = this.h);
		case 0x5d: // LD E,L
			return void(this.e = this.l);
		case 0x5e: // LD E,(HL)
			return void(this.e = this.read(this.l | this.h << 8));
		case 0x5f: // LD E,A
			return void(this.e = this.a);
		case 0x60: // LD H,B
			return void(this.h = this.b);
		case 0x61: // LD H,C
			return void(this.h = this.c);
		case 0x62: // LD H,D
			return void(this.h = this.d);
		case 0x63: // LD H,E
			return void(this.h = this.e);
		case 0x64: // LD H,H
			return;
		case 0x65: // LD H,L
			return void(this.h = this.l);
		case 0x66: // LD H,(HL)
			return void(this.h = this.read(this.l | this.h << 8));
		case 0x67: // LD H,A
			return void(this.h = this.a);
		case 0x68: // LD L,B
			return void(this.l = this.b);
		case 0x69: // LD L,C
			return void(this.l = this.c);
		case 0x6a: // LD L,D
			return void(this.l = this.d);
		case 0x6b: // LD L,E
			return void(this.l = this.e);
		case 0x6c: // LD L,H
			return void(this.l = this.h);
		case 0x6d: // LD L,L
			return;
		case 0x6e: // LD L,(HL)
			return void(this.l = this.read(this.l | this.h << 8));
		case 0x6f: // LD L,A
			return void(this.l = this.a);
		case 0x70: // LD (HL),B
			return this.write(this.l | this.h << 8, this.b);
		case 0x71: // LD (HL),C
			return this.write(this.l | this.h << 8, this.c);
		case 0x72: // LD (HL),D
			return this.write(this.l | this.h << 8, this.d);
		case 0x73: // LD (HL),E
			return this.write(this.l | this.h << 8, this.e);
		case 0x74: // LD (HL),H
			return this.write(this.l | this.h << 8, this.h);
		case 0x75: // LD (HL),L
			return this.write(this.l | this.h << 8, this.l);
		case 0x76: // HALT
			return this.suspend();
		case 0x77: // LD (HL),A
			return this.write(this.l | this.h << 8, this.a);
		case 0x78: // LD A,B
			return void(this.a = this.b);
		case 0x79: // LD A,C
			return void(this.a = this.c);
		case 0x7a: // LD A,D
			return void(this.a = this.d);
		case 0x7b: // LD A,E
			return void(this.a = this.e);
		case 0x7c: // LD A,H
			return void(this.a = this.h);
		case 0x7d: // LD A,L
			return void(this.a = this.l);
		case 0x7e: // LD A,(HL)
			return void(this.a = this.read(this.l | this.h << 8));
		case 0x7f: // LD A,A
			return;
		case 0x80: // ADD A,B
			return void(this.a = this.add8(this.a, this.b));
		case 0x81: // ADD A,C
			return void(this.a = this.add8(this.a, this.c));
		case 0x82: // ADD A,D
			return void(this.a = this.add8(this.a, this.d));
		case 0x83: // ADD A,E
			return void(this.a = this.add8(this.a, this.e));
		case 0x84: // ADD A,H
			return void(this.a = this.add8(this.a, this.h));
		case 0x85: // ADD A,L
			return void(this.a = this.add8(this.a, this.l));
		case 0x86: // ADD A,(HL)
			return void(this.a = this.add8(this.a, this.read(this.l | this.h << 8)));
		case 0x87: // ADD A,A
			return void(this.a = this.add8(this.a, this.a));
		case 0x88: // ADC A,B
			return void(this.a = this.adc8(this.a, this.b));
		case 0x89: // ADC A,C
			return void(this.a = this.adc8(this.a, this.c));
		case 0x8a: // ADC A,D
			return void(this.a = this.adc8(this.a, this.d));
		case 0x8b: // ADC A,E
			return void(this.a = this.adc8(this.a, this.e));
		case 0x8c: // ADC A,H
			return void(this.a = this.adc8(this.a, this.h));
		case 0x8d: // ADC A,L
			return void(this.a = this.adc8(this.a, this.l));
		case 0x8e: // ADC A,(HL)
			return void(this.a = this.adc8(this.a, this.read(this.l | this.h << 8)));
		case 0x8f: // ADC A,A
			return void(this.a = this.adc8(this.a, this.a));
		case 0x90: // SUB B
			return void(this.a = this.sub8(this.a, this.b));
		case 0x91: // SUB C
			return void(this.a = this.sub8(this.a, this.c));
		case 0x92: // SUB D
			return void(this.a = this.sub8(this.a, this.d));
		case 0x93: // SUB E
			return void(this.a = this.sub8(this.a, this.e));
		case 0x94: // SUB H
			return void(this.a = this.sub8(this.a, this.h));
		case 0x95: // SUB L
			return void(this.a = this.sub8(this.a, this.l));
		case 0x96: // SUB (HL)
			return void(this.a = this.sub8(this.a, this.read(this.l | this.h << 8)));
		case 0x97: // SUB A
			return void(this.a = this.sub8(this.a, this.a));
		case 0x98: // SBC A,B
			return void(this.a = this.sbc8(this.a, this.b));
		case 0x99: // SBC A,C
			return void(this.a = this.sbc8(this.a, this.c));
		case 0x9a: // SBC A,D
			return void(this.a = this.sbc8(this.a, this.d));
		case 0x9b: // SBC A,E
			return void(this.a = this.sbc8(this.a, this.e));
		case 0x9c: // SBC A,H
			return void(this.a = this.sbc8(this.a, this.h));
		case 0x9d: // SBC A,L
			return void(this.a = this.sbc8(this.a, this.l));
		case 0x9e: // SBC A,(HL)
			return void(this.a = this.sbc8(this.a, this.read(this.l | this.h << 8)));
		case 0x9f: // SBC A,A
			return void(this.a = this.sbc8(this.a, this.a));
		case 0xa0: // AND B
			return void(this.a = this.and8(this.a, this.b));
		case 0xa1: // AND C
			return void(this.a = this.and8(this.a, this.c));
		case 0xa2: // AND D
			return void(this.a = this.and8(this.a, this.d));
		case 0xa3: // AND E
			return void(this.a = this.and8(this.a, this.e));
		case 0xa4: // AND H
			return void(this.a = this.and8(this.a, this.h));
		case 0xa5: // AND L
			return void(this.a = this.and8(this.a, this.l));
		case 0xa6: // AND (HL)
			return void(this.a = this.and8(this.a, this.read(this.l | this.h << 8)));
		case 0xa7: // AND A
			return void(this.a = this.and8(this.a, this.a));
		case 0xa8: // XOR B
			return void(this.a = this.xor8(this.a, this.b));
		case 0xa9: // XOR C
			return void(this.a = this.xor8(this.a, this.c));
		case 0xaa: // XOR D
			return void(this.a = this.xor8(this.a, this.d));
		case 0xab: // XOR E
			return void(this.a = this.xor8(this.a, this.e));
		case 0xac: // XOR H
			return void(this.a = this.xor8(this.a, this.h));
		case 0xad: // XOR L
			return void(this.a = this.xor8(this.a, this.l));
		case 0xae: // XOR (HL)
			return void(this.a = this.xor8(this.a, this.read(this.l | this.h << 8)));
		case 0xaf: // XOR A
			return void(this.a = this.xor8(this.a, this.a));
		case 0xb0: // OR B
			return void(this.a = this.or8(this.a, this.b));
		case 0xb1: // OR C
			return void(this.a = this.or8(this.a, this.c));
		case 0xb2: // OR D
			return void(this.a = this.or8(this.a, this.d));
		case 0xb3: // OR E
			return void(this.a = this.or8(this.a, this.e));
		case 0xb4: // OR H
			return void(this.a = this.or8(this.a, this.h));
		case 0xb5: // OR L
			return void(this.a = this.or8(this.a, this.l));
		case 0xb6: // OR (HL)
			return void(this.a = this.or8(this.a, this.read(this.l | this.h << 8)));
		case 0xb7: // OR A
			return void(this.a = this.or8(this.a, this.a));
		case 0xb8: // CP B
			return void(this.sub8(this.a, this.b));
		case 0xb9: // CP C
			return void(this.sub8(this.a, this.c));
		case 0xba: // CP D
			return void(this.sub8(this.a, this.d));
		case 0xbb: // CP E
			return void(this.sub8(this.a, this.e));
		case 0xbc: // CP H
			return void(this.sub8(this.a, this.h));
		case 0xbd: // CP L
			return void(this.sub8(this.a, this.l));
		case 0xbe: // CP (HL)
			return void(this.sub8(this.a, this.read(this.l | this.h << 8)));
		case 0xbf: // CP A
			return void(this.sub8(this.a, this.a));
		case 0xc0: // RET NZ
			return !(this.f & 0x40) && (this.cycle -= cc_ex[0xc0]), this.ret(!(this.f & 0x40));
		case 0xc1: // POP BC
			return void([this.c, this.b] = this.split(this.pop16()));
		case 0xc2: // JP NZ,nn
			return this.jp(!(this.f & 0x40));
		case 0xc3: // JP nn
			return this.jp(true);
		case 0xc4: // CALL NZ,nn
			return !(this.f & 0x40) && (this.cycle -= cc_ex[0xc4]), this.call(!(this.f & 0x40));
		case 0xc5: // PUSH BC
			return this.push16(this.c | this.b << 8);
		case 0xc6: // ADD A,n
			return void(this.a = this.add8(this.a, this.fetch()));
		case 0xc7: // RST 00h
			return this.rst(0x00);
		case 0xc8: // RET Z
			return this.f & 0x40 && (this.cycle -= cc_ex[0xc8]), this.ret((this.f & 0x40) !== 0);
		case 0xc9: // RET
			return this.ret(true);
		case 0xca: // JP Z,nn
			return this.jp((this.f & 0x40) !== 0);
		case 0xcb:
			return this.execute_cb();
		case 0xcc: // CALL Z,nn
			return this.f & 0x40 && (this.cycle -= cc_ex[0xcc]), this.call((this.f & 0x40) !== 0);
		case 0xcd: // CALL nn
			return this.call(true);
		case 0xce: // ADC A,n
			return void(this.a = this.adc8(this.a, this.fetch()));
		case 0xcf: // RST 08h
			return this.rst(0x08);
		case 0xd0: // RET NC
			return !(this.f & 1) && (this.cycle -= cc_ex[0xd0]), this.ret(!(this.f & 1));
		case 0xd1: // POP DE
			return void([this.e, this.d] = this.split(this.pop16()));
		case 0xd2: // JP NC,nn
			return this.jp(!(this.f & 1));
		case 0xd3: // OUT n,A
			return this.iowrite(this.a, this.fetch(), this.a);
		case 0xd4: // CALL NC,nn
			return !(this.f & 1) && (this.cycle -= cc_ex[0xd4]), this.call(!(this.f & 1));
		case 0xd5: // PUSH DE
			return this.push16(this.e | this.d << 8);
		case 0xd6: // SUB n
			return void(this.a = this.sub8(this.a, this.fetch()));
		case 0xd7: // RST 10h
			return this.rst(0x10);
		case 0xd8: // RET C
			return this.f & 1 && (this.cycle -= cc_ex[0xd8]), this.ret((this.f & 1) !== 0);
		case 0xd9: // EXX
			[this.c, this.b, this.c_prime, this.b_prime] = [this.c_prime, this.b_prime, this.c, this.b];
			[this.e, this.d, this.e_prime, this.d_prime] = [this.e_prime, this.d_prime, this.e, this.d];
			[this.l, this.h, this.l_prime, this.h_prime] = [this.l_prime, this.h_prime, this.l, this.h];
			return;
		case 0xda: // JP C,nn
			return this.jp((this.f & 1) !== 0);
		case 0xdb: // IN A,n
			return void(this.a = this.ioread(this.a, this.fetch()));
		case 0xdc: // CALL C,nn
			return this.f & 1 && (this.cycle -= cc_ex[0xdc]), this.call((this.f & 1) !== 0);
		case 0xdd:
			return this.execute_dd();
		case 0xde: // SBC A,n
			return void(this.a = this.sbc8(this.a, this.fetch()));
		case 0xdf: // RST 18h
			return this.rst(0x18);
		case 0xe0: // RET PO
			return !(this.f & 4) && (this.cycle -= cc_ex[0xe0]), this.ret(!(this.f & 4));
		case 0xe1: // POP HL
			return void([this.l, this.h] = this.split(this.pop16()));
		case 0xe2: // JP PO,nn
			return this.jp(!(this.f & 4));
		case 0xe3: // EX (SP),HL
			return v = this.l | this.h << 8, [this.l, this.h] = this.split(this.pop16()), this.push16(v);
		case 0xe4: // CALL PO,nn
			return !(this.f & 4) && (this.cycle -= cc_ex[0xe4]), this.call(!(this.f & 4));
		case 0xe5: // PUSH HL
			return this.push16(this.l | this.h << 8);
		case 0xe6: // AND n
			return void(this.a = this.and8(this.a, this.fetch()));
		case 0xe7: // RST 20h
			return this.rst(0x20);
		case 0xe8: // RET PE
			return this.f & 4 && (this.cycle -= cc_ex[0xe8]), this.ret((this.f & 4) !== 0);
		case 0xe9: // JP (HL)
			return void(this.pc = this.l | this.h << 8);
		case 0xea: // JP PE,nn
			return this.jp((this.f & 4) !== 0);
		case 0xeb: // EX DE,HL
			return void([this.e, this.d, this.l, this.h] = [this.l, this.h, this.e, this.d]);
		case 0xec: // CALL PE,nn
			return this.f & 4 && (this.cycle -= cc_ex[0xec]), this.call((this.f & 4) !== 0);
		case 0xed:
			return this.execute_ed();
		case 0xee: // XOR n
			return void(this.a = this.xor8(this.a, this.fetch()));
		case 0xef: // RST 28h
			return this.rst(0x28);
		case 0xf0: // RET P
			return !(this.f & 0x80) && (this.cycle -= cc_ex[0xf0]), this.ret(!(this.f & 0x80));
		case 0xf1: // POP AF
			return void([this.f, this.a] = this.split(this.pop16()));
		case 0xf2: // JP P,nn
			return this.jp(!(this.f & 0x80));
		case 0xf3: // DI
			return void(this.iff = 0);
		case 0xf4: // CALL P,nn
			return !(this.f & 0x80) && (this.cycle -= cc_ex[0xf4]), this.call(!(this.f & 0x80));
		case 0xf5: // PUSH AF
			return this.push16(this.f | this.a << 8);
		case 0xf6: // OR n
			return void(this.a = this.or8(this.a, this.fetch()));
		case 0xf7: // RST 30h
			return this.rst(0x30);
		case 0xf8: // RET M
			return this.f & 0x80 && (this.cycle -= cc_ex[0xf8]), this.ret((this.f & 0x80) !== 0);
		case 0xf9: // LD SP,HL
			return void(this.sp = this.l | this.h << 8);
		case 0xfa: // JP M,nn
			return this.jp((this.f & 0x80) !== 0);
		case 0xfb: // EI
			return void(this.iff = 3);
		case 0xfc: // CALL M,nn
			return this.f & 0x80 && (this.cycle -= cc_ex[0xfc]), this.call((this.f & 0x80) !== 0);
		case 0xfd:
			return this.execute_fd();
		case 0xfe: // CP n
			return void(this.sub8(this.a, this.fetch()));
		case 0xff: // RST 38h
			return this.rst(0x38);
		}
	}

	execute_cb() {
		let v, op = this.fetch();
		this.cycle -= cc_cb[op];
		switch (op) {
		case 0x00: // RLC B
			return void(this.b = this.rlc8(this.b));
		case 0x01: // RLC C
			return void(this.c = this.rlc8(this.c));
		case 0x02: // RLC D
			return void(this.d = this.rlc8(this.d));
		case 0x03: // RLC E
			return void(this.e = this.rlc8(this.e));
		case 0x04: // RLC H
			return void(this.h = this.rlc8(this.h));
		case 0x05: // RLC L
			return void(this.l = this.rlc8(this.l));
		case 0x06: // RLC (HL)
			return v = this.l | this.h << 8, this.write(v, this.rlc8(this.read(v)));
		case 0x07: // RLC A
			return void(this.a = this.rlc8(this.a));
		case 0x08: // RRC B
			return void(this.b = this.rrc8(this.b));
		case 0x09: // RRC C
			return void(this.c = this.rrc8(this.c));
		case 0x0a: // RRC D
			return void(this.d = this.rrc8(this.d));
		case 0x0b: // RRC E
			return void(this.e = this.rrc8(this.e));
		case 0x0c: // RRC H
			return void(this.h = this.rrc8(this.h));
		case 0x0d: // RRC L
			return void(this.l = this.rrc8(this.l));
		case 0x0e: // RRC (HL)
			return v = this.l | this.h << 8, this.write(v, this.rrc8(this.read(v)));
		case 0x0f: // RRC A
			return void(this.a = this.rrc8(this.a));
		case 0x10: // RL B
			return void(this.b = this.rl8(this.b));
		case 0x11: // RL C
			return void(this.c = this.rl8(this.c));
		case 0x12: // RL D
			return void(this.d = this.rl8(this.d));
		case 0x13: // RL E
			return void(this.e = this.rl8(this.e));
		case 0x14: // RL H
			return void(this.h = this.rl8(this.h));
		case 0x15: // RL L
			return void(this.l = this.rl8(this.l));
		case 0x16: // RL (HL)
			return v = this.l | this.h << 8, this.write(v, this.rl8(this.read(v)));
		case 0x17: // RL A
			return void(this.a = this.rl8(this.a));
		case 0x18: // RR B
			return void(this.b = this.rr8(this.b));
		case 0x19: // RR C
			return void(this.c = this.rr8(this.c));
		case 0x1a: // RR D
			return void(this.d = this.rr8(this.d));
		case 0x1b: // RR E
			return void(this.e = this.rr8(this.e));
		case 0x1c: // RR H
			return void(this.h = this.rr8(this.h));
		case 0x1d: // RR L
			return void(this.l = this.rr8(this.l));
		case 0x1e: // RR (HL)
			return v = this.l | this.h << 8, this.write(v, this.rr8(this.read(v)));
		case 0x1f: // RR A
			return void(this.a = this.rr8(this.a));
		case 0x20: // SLA B
			return void(this.b = this.sla8(this.b));
		case 0x21: // SLA C
			return void(this.c = this.sla8(this.c));
		case 0x22: // SLA D
			return void(this.d = this.sla8(this.d));
		case 0x23: // SLA E
			return void(this.e = this.sla8(this.e));
		case 0x24: // SLA H
			return void(this.h = this.sla8(this.h));
		case 0x25: // SLA L
			return void(this.l = this.sla8(this.l));
		case 0x26: // SLA (HL)
			return v = this.l | this.h << 8, this.write(v, this.sla8(this.read(v)));
		case 0x27: // SLA A
			return void(this.a = this.sla8(this.a));
		case 0x28: // SRA B
			return void(this.b = this.sra8(this.b));
		case 0x29: // SRA C
			return void(this.c = this.sra8(this.c));
		case 0x2a: // SRA D
			return void(this.d = this.sra8(this.d));
		case 0x2b: // SRA E
			return void(this.e = this.sra8(this.e));
		case 0x2c: // SRA H
			return void(this.h = this.sra8(this.h));
		case 0x2d: // SRA L
			return void(this.l = this.sra8(this.l));
		case 0x2e: // SRA (HL)
			return v = this.l | this.h << 8, this.write(v, this.sra8(this.read(v)));
		case 0x2f: // SRA A
			return void(this.a = this.sra8(this.a));
		case 0x38: // SRL B
			return void(this.b = this.srl8(this.b));
		case 0x39: // SRL C
			return void(this.c = this.srl8(this.c));
		case 0x3a: // SRL D
			return void(this.d = this.srl8(this.d));
		case 0x3b: // SRL E
			return void(this.e = this.srl8(this.e));
		case 0x3c: // SRL H
			return void(this.h = this.srl8(this.h));
		case 0x3d: // SRL L
			return void(this.l = this.srl8(this.l));
		case 0x3e: // SRL (HL)
			return v = this.l | this.h << 8, this.write(v, this.srl8(this.read(v)));
		case 0x3f: // SRL A
			return void(this.a = this.srl8(this.a));
		case 0x40: // BIT 0,B
			return this.bit8(0, this.b);
		case 0x41: // BIT 0,C
			return this.bit8(0, this.c);
		case 0x42: // BIT 0,D
			return this.bit8(0, this.d);
		case 0x43: // BIT 0,E
			return this.bit8(0, this.e);
		case 0x44: // BIT 0,H
			return this.bit8(0, this.h);
		case 0x45: // BIT 0,L
			return this.bit8(0, this.l);
		case 0x46: // BIT 0,(HL)
			return this.bit8(0, this.read(this.l | this.h << 8));
		case 0x47: // BIT 0,A
			return this.bit8(0, this.a);
		case 0x48: // BIT 1,B
			return this.bit8(1, this.b);
		case 0x49: // BIT 1,C
			return this.bit8(1, this.c);
		case 0x4a: // BIT 1,D
			return this.bit8(1, this.d);
		case 0x4b: // BIT 1,E
			return this.bit8(1, this.e);
		case 0x4c: // BIT 1,H
			return this.bit8(1, this.h);
		case 0x4d: // BIT 1,L
			return this.bit8(1, this.l);
		case 0x4e: // BIT 1,(HL)
			return this.bit8(1, this.read(this.l | this.h << 8));
		case 0x4f: // BIT 1,A
			return this.bit8(1, this.a);
		case 0x50: // BIT 2,B
			return this.bit8(2, this.b);
		case 0x51: // BIT 2,C
			return this.bit8(2, this.c);
		case 0x52: // BIT 2,D
			return this.bit8(2, this.d);
		case 0x53: // BIT 2,E
			return this.bit8(2, this.e);
		case 0x54: // BIT 2,H
			return this.bit8(2, this.h);
		case 0x55: // BIT 2,L
			return this.bit8(2, this.l);
		case 0x56: // BIT 2,(HL)
			return this.bit8(2, this.read(this.l | this.h << 8));
		case 0x57: // BIT 2,A
			return this.bit8(2, this.a);
		case 0x58: // BIT 3,B
			return this.bit8(3, this.b);
		case 0x59: // BIT 3,C
			return this.bit8(3, this.c);
		case 0x5a: // BIT 3,D
			return this.bit8(3, this.d);
		case 0x5b: // BIT 3,E
			return this.bit8(3, this.e);
		case 0x5c: // BIT 3,H
			return this.bit8(3, this.h);
		case 0x5d: // BIT 3,L
			return this.bit8(3, this.l);
		case 0x5e: // BIT 3,(HL)
			return this.bit8(3, this.read(this.l | this.h << 8));
		case 0x5f: // BIT 3,A
			return this.bit8(3, this.a);
		case 0x60: // BIT 4,B
			return this.bit8(4, this.b);
		case 0x61: // BIT 4,C
			return this.bit8(4, this.c);
		case 0x62: // BIT 4,D
			return this.bit8(4, this.d);
		case 0x63: // BIT 4,E
			return this.bit8(4, this.e);
		case 0x64: // BIT 4,H
			return this.bit8(4, this.h);
		case 0x65: // BIT 4,L
			return this.bit8(4, this.l);
		case 0x66: // BIT 4,(HL)
			return this.bit8(4, this.read(this.l | this.h << 8));
		case 0x67: // BIT 4,A
			return this.bit8(4, this.a);
		case 0x68: // BIT 5,B
			return this.bit8(5, this.b);
		case 0x69: // BIT 5,C
			return this.bit8(5, this.c);
		case 0x6a: // BIT 5,D
			return this.bit8(5, this.d);
		case 0x6b: // BIT 5,E
			return this.bit8(5, this.e);
		case 0x6c: // BIT 5,H
			return this.bit8(5, this.h);
		case 0x6d: // BIT 5,L
			return this.bit8(5, this.l);
		case 0x6e: // BIT 5,(HL)
			return this.bit8(5, this.read(this.l | this.h << 8));
		case 0x6f: // BIT 5,A
			return this.bit8(5, this.a);
		case 0x70: // BIT 6,B
			return this.bit8(6, this.b);
		case 0x71: // BIT 6,C
			return this.bit8(6, this.c);
		case 0x72: // BIT 6,D
			return this.bit8(6, this.d);
		case 0x73: // BIT 6,E
			return this.bit8(6, this.e);
		case 0x74: // BIT 6,H
			return this.bit8(6, this.h);
		case 0x75: // BIT 6,L
			return this.bit8(6, this.l);
		case 0x76: // BIT 6,(HL)
			return this.bit8(6, this.read(this.l | this.h << 8));
		case 0x77: // BIT 6,A
			return this.bit8(6, this.a);
		case 0x78: // BIT 7,B
			return this.bit8(7, this.b);
		case 0x79: // BIT 7,C
			return this.bit8(7, this.c);
		case 0x7a: // BIT 7,D
			return this.bit8(7, this.d);
		case 0x7b: // BIT 7,E
			return this.bit8(7, this.e);
		case 0x7c: // BIT 7,H
			return this.bit8(7, this.h);
		case 0x7d: // BIT 7,L
			return this.bit8(7, this.l);
		case 0x7e: // BIT 7,(HL)
			return this.bit8(7, this.read(this.l | this.h << 8));
		case 0x7f: // BIT 7,A
			return this.bit8(7, this.a);
		case 0x80: // RES 0,B
			return void(this.b = this.res8(0, this.b));
		case 0x81: // RES 0,C
			return void(this.c = this.res8(0, this.c));
		case 0x82: // RES 0,D
			return void(this.d = this.res8(0, this.d));
		case 0x83: // RES 0,E
			return void(this.e = this.res8(0, this.e));
		case 0x84: // RES 0,H
			return void(this.h = this.res8(0, this.h));
		case 0x85: // RES 0,L
			return void(this.l = this.res8(0, this.l));
		case 0x86: // RES 0,(HL)
			return v = this.l | this.h << 8, this.write(v, this.res8(0, this.read(v)));
		case 0x87: // RES 0,A
			return void(this.a = this.res8(0, this.a));
		case 0x88: // RES 1,B
			return void(this.b = this.res8(1, this.b));
		case 0x89: // RES 1,C
			return void(this.c = this.res8(1, this.c));
		case 0x8a: // RES 1,D
			return void(this.d = this.res8(1, this.d));
		case 0x8b: // RES 1,E
			return void(this.e = this.res8(1, this.e));
		case 0x8c: // RES 1,H
			return void(this.h = this.res8(1, this.h));
		case 0x8d: // RES 1,L
			return void(this.l = this.res8(1, this.l));
		case 0x8e: // RES 1,(HL)
			return v = this.l | this.h << 8, this.write(v, this.res8(1, this.read(v)));
		case 0x8f: // RES 1,A
			return void(this.a = this.res8(1, this.a));
		case 0x90: // RES 2,B
			return void(this.b = this.res8(2, this.b));
		case 0x91: // RES 2,C
			return void(this.c = this.res8(2, this.c));
		case 0x92: // RES 2,D
			return void(this.d = this.res8(2, this.d));
		case 0x93: // RES 2,E
			return void(this.e = this.res8(2, this.e));
		case 0x94: // RES 2,H
			return void(this.h = this.res8(2, this.h));
		case 0x95: // RES 2,L
			return void(this.l = this.res8(2, this.l));
		case 0x96: // RES 2,(HL)
			return v = this.l | this.h << 8, this.write(v, this.res8(2, this.read(v)));
		case 0x97: // RES 2,A
			return void(this.a = this.res8(2, this.a));
		case 0x98: // RES 3,B
			return void(this.b = this.res8(3, this.b));
		case 0x99: // RES 3,C
			return void(this.c = this.res8(3, this.c));
		case 0x9a: // RES 3,D
			return void(this.d = this.res8(3, this.d));
		case 0x9b: // RES 3,E
			return void(this.e = this.res8(3, this.e));
		case 0x9c: // RES 3,H
			return void(this.h = this.res8(3, this.h));
		case 0x9d: // RES 3,L
			return void(this.l = this.res8(3, this.l));
		case 0x9e: // RES 3,(HL)
			return v = this.l | this.h << 8, this.write(v, this.res8(3, this.read(v)));
		case 0x9f: // RES 3,A
			return void(this.a = this.res8(3, this.a));
		case 0xa0: // RES 4,B
			return void(this.b = this.res8(4, this.b));
		case 0xa1: // RES 4,C
			return void(this.c = this.res8(4, this.c));
		case 0xa2: // RES 4,D
			return void(this.d = this.res8(4, this.d));
		case 0xa3: // RES 4,E
			return void(this.e = this.res8(4, this.e));
		case 0xa4: // RES 4,H
			return void(this.h = this.res8(4, this.h));
		case 0xa5: // RES 4,L
			return void(this.l = this.res8(4, this.l));
		case 0xa6: // RES 4,(HL)
			return v = this.l | this.h << 8, this.write(v, this.res8(4, this.read(v)));
		case 0xa7: // RES 4,A
			return void(this.a = this.res8(4, this.a));
		case 0xa8: // RES 5,B
			return void(this.b = this.res8(5, this.b));
		case 0xa9: // RES 5,C
			return void(this.c = this.res8(5, this.c));
		case 0xaa: // RES 5,D
			return void(this.d = this.res8(5, this.d));
		case 0xab: // RES 5,E
			return void(this.e = this.res8(5, this.e));
		case 0xac: // RES 5,H
			return void(this.h = this.res8(5, this.h));
		case 0xad: // RES 5,L
			return void(this.l = this.res8(5, this.l));
		case 0xae: // RES 5,(HL)
			return v = this.l | this.h << 8, this.write(v, this.res8(5, this.read(v)));
		case 0xaf: // RES 5,A
			return void(this.a = this.res8(5, this.a));
		case 0xb0: // RES 6,B
			return void(this.b = this.res8(6, this.b));
		case 0xb1: // RES 6,C
			return void(this.c = this.res8(6, this.c));
		case 0xb2: // RES 6,D
			return void(this.d = this.res8(6, this.d));
		case 0xb3: // RES 6,E
			return void(this.e = this.res8(6, this.e));
		case 0xb4: // RES 6,H
			return void(this.h = this.res8(6, this.h));
		case 0xb5: // RES 6,L
			return void(this.l = this.res8(6, this.l));
		case 0xb6: // RES 6,(HL)
			return v = this.l | this.h << 8, this.write(v, this.res8(6, this.read(v)));
		case 0xb7: // RES 6,A
			return void(this.a = this.res8(6, this.a));
		case 0xb8: // RES 7,B
			return void(this.b = this.res8(7, this.b));
		case 0xb9: // RES 7,C
			return void(this.c = this.res8(7, this.c));
		case 0xba: // RES 7,D
			return void(this.d = this.res8(7, this.d));
		case 0xbb: // RES 7,E
			return void(this.e = this.res8(7, this.e));
		case 0xbc: // RES 7,H
			return void(this.h = this.res8(7, this.h));
		case 0xbd: // RES 7,L
			return void(this.l = this.res8(7, this.l));
		case 0xbe: // RES 7,(HL)
			return v = this.l | this.h << 8, this.write(v, this.res8(7, this.read(v)));
		case 0xbf: // RES 7,A
			return void(this.a = this.res8(7, this.a));
		case 0xc0: // SET 0,B
			return void(this.b = this.set8(0, this.b));
		case 0xc1: // SET 0,C
			return void(this.c = this.set8(0, this.c));
		case 0xc2: // SET 0,D
			return void(this.d = this.set8(0, this.d));
		case 0xc3: // SET 0,E
			return void(this.e = this.set8(0, this.e));
		case 0xc4: // SET 0,H
			return void(this.h = this.set8(0, this.h));
		case 0xc5: // SET 0,L
			return void(this.l = this.set8(0, this.l));
		case 0xc6: // SET 0,(HL)
			return v = this.l | this.h << 8, this.write(v, this.set8(0, this.read(v)));
		case 0xc7: // SET 0,A
			return void(this.a = this.set8(0, this.a));
		case 0xc8: // SET 1,B
			return void(this.b = this.set8(1, this.b));
		case 0xc9: // SET 1,C
			return void(this.c = this.set8(1, this.c));
		case 0xca: // SET 1,D
			return void(this.d = this.set8(1, this.d));
		case 0xcb: // SET 1,E
			return void(this.e = this.set8(1, this.e));
		case 0xcc: // SET 1,H
			return void(this.h = this.set8(1, this.h));
		case 0xcd: // SET 1,L
			return void(this.l = this.set8(1, this.l));
		case 0xce: // SET 1,(HL)
			return v = this.l | this.h << 8, this.write(v, this.set8(1, this.read(v)));
		case 0xcf: // SET 1,A
			return void(this.a = this.set8(1, this.a));
		case 0xd0: // SET 2,B
			return void(this.b = this.set8(2, this.b));
		case 0xd1: // SET 2,C
			return void(this.c = this.set8(2, this.c));
		case 0xd2: // SET 2,D
			return void(this.d = this.set8(2, this.d));
		case 0xd3: // SET 2,E
			return void(this.e = this.set8(2, this.e));
		case 0xd4: // SET 2,H
			return void(this.h = this.set8(2, this.h));
		case 0xd5: // SET 2,L
			return void(this.l = this.set8(2, this.l));
		case 0xd6: // SET 2,(HL)
			return v = this.l | this.h << 8, this.write(v, this.set8(2, this.read(v)));
		case 0xd7: // SET 2,A
			return void(this.a = this.set8(2, this.a));
		case 0xd8: // SET 3,B
			return void(this.b = this.set8(3, this.b));
		case 0xd9: // SET 3,C
			return void(this.c = this.set8(3, this.c));
		case 0xda: // SET 3,D
			return void(this.d = this.set8(3, this.d));
		case 0xdb: // SET 3,E
			return void(this.e = this.set8(3, this.e));
		case 0xdc: // SET 3,H
			return void(this.h = this.set8(3, this.h));
		case 0xdd: // SET 3,L
			return void(this.l = this.set8(3, this.l));
		case 0xde: // SET 3,(HL)
			return v = this.l | this.h << 8, this.write(v, this.set8(3, this.read(v)));
		case 0xdf: // SET 3,A
			return void(this.a = this.set8(3, this.a));
		case 0xe0: // SET 4,B
			return void(this.b = this.set8(4, this.b));
		case 0xe1: // SET 4,C
			return void(this.c = this.set8(4, this.c));
		case 0xe2: // SET 4,D
			return void(this.d = this.set8(4, this.d));
		case 0xe3: // SET 4,E
			return void(this.e = this.set8(4, this.e));
		case 0xe4: // SET 4,H
			return void(this.h = this.set8(4, this.h));
		case 0xe5: // SET 4,L
			return void(this.l = this.set8(4, this.l));
		case 0xe6: // SET 4,(HL)
			return v = this.l | this.h << 8, this.write(v, this.set8(4, this.read(v)));
		case 0xe7: // SET 4,A
			return void(this.a = this.set8(4, this.a));
		case 0xe8: // SET 5,B
			return void(this.b = this.set8(5, this.b));
		case 0xe9: // SET 5,C
			return void(this.c = this.set8(5, this.c));
		case 0xea: // SET 5,D
			return void(this.d = this.set8(5, this.d));
		case 0xeb: // SET 5,E
			return void(this.e = this.set8(5, this.e));
		case 0xec: // SET 5,H
			return void(this.h = this.set8(5, this.h));
		case 0xed: // SET 5,L
			return void(this.l = this.set8(5, this.l));
		case 0xee: // SET 5,(HL)
			return v = this.l | this.h << 8, this.write(v, this.set8(5, this.read(v)));
		case 0xef: // SET 5,A
			return void(this.a = this.set8(5, this.a));
		case 0xf0: // SET 6,B
			return void(this.b = this.set8(6, this.b));
		case 0xf1: // SET 6,C
			return void(this.c = this.set8(6, this.c));
		case 0xf2: // SET 6,D
			return void(this.d = this.set8(6, this.d));
		case 0xf3: // SET 6,E
			return void(this.e = this.set8(6, this.e));
		case 0xf4: // SET 6,H
			return void(this.h = this.set8(6, this.h));
		case 0xf5: // SET 6,L
			return void(this.l = this.set8(6, this.l));
		case 0xf6: // SET 6,(HL)
			return v = this.l | this.h << 8, this.write(v, this.set8(6, this.read(v)));
		case 0xf7: // SET 6,A
			return void(this.a = this.set8(6, this.a));
		case 0xf8: // SET 7,B
			return void(this.b = this.set8(7, this.b));
		case 0xf9: // SET 7,C
			return void(this.c = this.set8(7, this.c));
		case 0xfa: // SET 7,D
			return void(this.d = this.set8(7, this.d));
		case 0xfb: // SET 7,E
			return void(this.e = this.set8(7, this.e));
		case 0xfc: // SET 7,H
			return void(this.h = this.set8(7, this.h));
		case 0xfd: // SET 7,L
			return void(this.l = this.set8(7, this.l));
		case 0xfe: // SET 7,(HL)
			return v = this.l | this.h << 8, this.write(v, this.set8(7, this.read(v)));
		case 0xff: // SET 7,A
			return void(this.a = this.set8(7, this.a));
		default:
			this.undefsize = 2;
			this.undef();
			return;
		}
	}

	execute_dd() {
		let v, op = this.fetch();
		this.cycle -= cc_xy[op];
		switch (op) {
		case 0x09: // ADD IX,BC
			return void([this.ixl, this.ixh] = this.split(this.add16(this.ixl | this.ixh << 8, this.c | this.b << 8)));
		case 0x19: // ADD IX,DE
			return void([this.ixl, this.ixh] = this.split(this.add16(this.ixl | this.ixh << 8, this.e | this.d << 8)));
		case 0x21: // LD IX,nn
			return void([this.ixl, this.ixh] = this.split(this.fetch16()));
		case 0x22: // LD (nn),IX
			return this.write16(this.fetch16(), this.ixl | this.ixh << 8);
		case 0x23: // INC IX
			return void([this.ixl, this.ixh] = this.split((this.ixl | this.ixh << 8) + 1 & 0xffff));
		case 0x24: // INC IXH (undefined operation)
			return void(this.ixh = this.inc8(this.ixh));
		case 0x25: // DEC IXH (undefined operation)
			return void(this.ixh = this.dec8(this.ixh));
		case 0x26: // LD IXH,n (undefined operation)
			return void(this.ixh = this.fetch());
		case 0x29: // ADD IX,IX
			return void([this.ixl, this.ixh] = this.split(this.add16(this.ixl | this.ixh << 8, this.ixl | this.ixh << 8)));
		case 0x2a: // LD IX,(nn)
			return void([this.ixl, this.ixh] = this.split(this.read16(this.fetch16())));
		case 0x2b: // DEC IX
			return void([this.ixl, this.ixh] = this.split((this.ixl | this.ixh << 8) - 1 & 0xffff));
		case 0x2c: // INC IXL (undefined operation)
			return void(this.ixl = this.inc8(this.ixl));
		case 0x2d: // DEC IXL (undefined operation)
			return void(this.ixl = this.dec8(this.ixl));
		case 0x2e: // LD IXL,n (undefined operation)
			return void(this.ixl = this.fetch());
		case 0x34: // INC (IX+d)
			return v = this.disp(this.ixh, this.ixl), this.write(v, this.inc8(this.read(v)));
		case 0x35: // DEC (IX+d)
			return v = this.disp(this.ixh, this.ixl), this.write(v, this.dec8(this.read(v)));
		case 0x36: // LD (IX+d),n
			return v = this.disp(this.ixh, this.ixl), this.write(v, this.fetch());
		case 0x39: // ADD IX,SP
			return void([this.ixl, this.ixh] = this.split(this.add16(this.ixl | this.ixh << 8, this.sp)));
		case 0x44: // LD B,IXH (undefined operation)
			return void(this.b = this.ixh);
		case 0x45: // LD B,IXL (undefined operation)
			return void(this.b = this.ixl);
		case 0x46: // LD B,(IX+d)
			return void(this.b = this.read(this.disp(this.ixh, this.ixl)));
		case 0x4c: // LD C,IXH (undefined operation)
			return void(this.c = this.ixh);
		case 0x4d: // LD C,IXL (undefined operation)
			return void(this.c = this.ixl);
		case 0x4e: // LD C,(IX+d)
			return void(this.c = this.read(this.disp(this.ixh, this.ixl)));
		case 0x54: // LD D,IXH (undefined operation)
			return void(this.d = this.ixh);
		case 0x55: // LD D,IXL (undefined operation)
			return void(this.d = this.ixl);
		case 0x56: // LD D,(IX+d)
			return void(this.d = this.read(this.disp(this.ixh, this.ixl)));
		case 0x5c: // LD E,IXH (undefined operation)
			return void(this.e = this.ixh);
		case 0x5d: // LD E,IXL (undefined operation)
			return void(this.e = this.ixl);
		case 0x5e: // LD E,(IX+d)
			return void(this.e = this.read(this.disp(this.ixh, this.ixl)));
		case 0x60: // LD IXH,B (undefined operation)
			return void(this.ixh = this.b);
		case 0x61: // LD IXH,C (undefined operation)
			return void(this.ixh = this.c);
		case 0x62: // LD IXH,D (undefined operation)
			return void(this.ixh = this.d);
		case 0x63: // LD IXH,E (undefined operation)
			return void(this.ixh = this.e);
		case 0x66: // LD H,(IX+d)
			return void(this.h = this.read(this.disp(this.ixh, this.ixl)));
		case 0x67: // LD IXH,A (undefined operation)
			return void(this.ixh = this.a);
		case 0x68: // LD IXL,B (undefined operation)
			return void(this.ixl = this.b);
		case 0x69: // LD IXL,C (undefined operation)
			return void(this.ixl = this.c);
		case 0x6a: // LD IXL,D (undefined operation)
			return void(this.ixl = this.d);
		case 0x6b: // LD IXL,E (undefined operation)
			return void(this.ixl = this.e);
		case 0x6e: // LD L,(IX+d)
			return void(this.l = this.read(this.disp(this.ixh, this.ixl)));
		case 0x6f: // LD IXL,A (undefined operation)
			return void(this.ixl = this.a);
		case 0x70: // LD (IX+d),B
			return this.write(this.disp(this.ixh, this.ixl), this.b);
		case 0x71: // LD (IX+d),C
			return this.write(this.disp(this.ixh, this.ixl), this.c);
		case 0x72: // LD (IX+d),D
			return this.write(this.disp(this.ixh, this.ixl), this.d);
		case 0x73: // LD (IX+d),E
			return this.write(this.disp(this.ixh, this.ixl), this.e);
		case 0x74: // LD (IX+d),H
			return this.write(this.disp(this.ixh, this.ixl), this.h);
		case 0x75: // LD (IX+d),L
			return this.write(this.disp(this.ixh, this.ixl), this.l);
		case 0x77: // LD (IX+d),A
			return this.write(this.disp(this.ixh, this.ixl), this.a);
		case 0x7c: // LD A,IXH (undefined operation)
			return void(this.a = this.ixh);
		case 0x7d: // LD A,IXL (undefined operation)
			return void(this.a = this.ixl);
		case 0x7e: // LD A,(IX+d)
			return void(this.a = this.read(this.disp(this.ixh, this.ixl)));
		case 0x84: // ADD A,IXH (undefined operation)
			return void(this.a = this.add8(this.a, this.ixh));
		case 0x85: // ADD A,IXL (undefined operation)
			return void(this.a = this.add8(this.a, this.ixl));
		case 0x86: // ADD A,(IX+d)
			return void(this.a = this.add8(this.a, this.read(this.disp(this.ixh, this.ixl))));
		case 0x8c: // ADC A,IXH (undefined operation)
			return void(this.a = this.adc8(this.a, this.ixh));
		case 0x8d: // ADC A,IXL (undefined operation)
			return void(this.a = this.adc8(this.a, this.ixl));
		case 0x8e: // ADC A,(IX+d)
			return void(this.a = this.adc8(this.a, this.read(this.disp(this.ixh, this.ixl))));
		case 0x94: // SUB IXH (undefined operation)
			return void(this.a = this.sub8(this.a, this.ixh));
		case 0x95: // SUB IXL (undefined operation)
			return void(this.a = this.sub8(this.a, this.ixl));
		case 0x96: // SUB (IX+d)
			return void(this.a = this.sub8(this.a, this.read(this.disp(this.ixh, this.ixl))));
		case 0x9c: // SBC A,IXH (undefined operation)
			return void(this.a = this.sbc8(this.a, this.ixh));
		case 0x9d: // SBC A,IXL (undefined operation)
			return void(this.a = this.sbc8(this.a, this.ixl));
		case 0x9e: // SBC A,(IX+d)
			return void(this.a = this.sbc8(this.a, this.read(this.disp(this.ixh, this.ixl))));
		case 0xa4: // AND IXH (undefined operation)
			return void(this.a = this.and8(this.a, this.ixh));
		case 0xa5: // AND IXL (undefined operation)
			return void(this.a = this.and8(this.a, this.ixl));
		case 0xa6: // AND (IX+d)
			return void(this.a = this.and8(this.a, this.read(this.disp(this.ixh, this.ixl))));
		case 0xac: // XOR IXH (undefined operation)
			return void(this.a = this.xor8(this.a, this.ixh));
		case 0xad: // XOR IXL (undefined operation)
			return void(this.a = this.xor8(this.a, this.ixl));
		case 0xae: // XOR (IX+d)
			return void(this.a = this.xor8(this.a, this.read(this.disp(this.ixh, this.ixl))));
		case 0xb4: // OR IXH (undefined operation)
			return void(this.a = this.or8(this.a, this.ixh));
		case 0xb5: // OR IXL (undefined operation)
			return void(this.a = this.or8(this.a, this.ixl));
		case 0xb6: // OR (IX+d)
			return void(this.a = this.or8(this.a, this.read(this.disp(this.ixh, this.ixl))));
		case 0xbc: // CP IXH (undefined operation)
			return void(this.sub8(this.a, this.ixh));
		case 0xbd: // CP IXL (undefined operation)
			return void(this.sub8(this.a, this.ixl));
		case 0xbe: // CP (IX+d)
			return void(this.sub8(this.a, this.read(this.disp(this.ixh, this.ixl))));
		case 0xcb:
			v = this.disp(this.ixh, this.ixl), this.cycle -= cc_xycb[op = this.fetch()];
			switch (op) {
			case 0x06: // RLC (IX+d)
				return this.write(v, this.rlc8(this.read(v)));
			case 0x0e: // RRC (IX+d)
				return this.write(v, this.rrc8(this.read(v)));
			case 0x16: // RL (IX+d)
				return this.write(v, this.rl8(this.read(v)));
			case 0x1e: // RR (IX+d)
				return this.write(v, this.rr8(this.read(v)));
			case 0x26: // SLA (IX+d)
				return this.write(v, this.sla8(this.read(v)));
			case 0x2e: // SRA (IX+d)
				return this.write(v, this.sra8(this.read(v)));
			case 0x3e: // SRL (IX+d)
				return this.write(v, this.srl8(this.read(v)));
			case 0x46: // BIT 0,(IX+d)
				return this.bit8(0, this.read(v));
			case 0x4e: // BIT 1,(IX+d)
				return this.bit8(1, this.read(v));
			case 0x56: // BIT 2,(IX+d)
				return this.bit8(2, this.read(v));
			case 0x5e: // BIT 3,(IX+d)
				return this.bit8(3, this.read(v));
			case 0x66: // BIT 4,(IX+d)
				return this.bit8(4, this.read(v));
			case 0x6e: // BIT 5,(IX+d)
				return this.bit8(5, this.read(v));
			case 0x76: // BIT 6,(IX+d)
				return this.bit8(6, this.read(v));
			case 0x7e: // BIT 7,(IX+d)
				return this.bit8(7, this.read(v));
			case 0x86: // RES 0,(IX+d)
				return this.write(v, this.res8(0, this.read(v)));
			case 0x8e: // RES 1,(IX+d)
				return this.write(v, this.res8(1, this.read(v)));
			case 0x96: // RES 2,(IX+d)
				return this.write(v, this.res8(2, this.read(v)));
			case 0x9e: // RES 3,(IX+d)
				return this.write(v, this.res8(3, this.read(v)));
			case 0xa6: // RES 4,(IX+d)
				return this.write(v, this.res8(4, this.read(v)));
			case 0xae: // RES 5,(IX+d)
				return this.write(v, this.res8(5, this.read(v)));
			case 0xb6: // RES 6,(IX+d)
				return this.write(v, this.res8(6, this.read(v)));
			case 0xbe: // RES 7,(IX+d)
				return this.write(v, this.res8(7, this.read(v)));
			case 0xc6: // SET 0,(IX+d)
				return this.write(v, this.set8(0, this.read(v)));
			case 0xce: // SET 1,(IX+d)
				return this.write(v, this.set8(1, this.read(v)));
			case 0xd6: // SET 2,(IX+d)
				return this.write(v, this.set8(2, this.read(v)));
			case 0xde: // SET 3,(IX+d)
				return this.write(v, this.set8(3, this.read(v)));
			case 0xe6: // SET 4,(IX+d)
				return this.write(v, this.set8(4, this.read(v)));
			case 0xee: // SET 5,(IX+d)
				return this.write(v, this.set8(5, this.read(v)));
			case 0xf6: // SET 6,(IX+d)
				return this.write(v, this.set8(6, this.read(v)));
			case 0xfe: // SET 7,(IX+d)
				return this.write(v, this.set8(7, this.read(v)));
			default:
				this.undefsize = 4;
				this.undef();
				return;
			}
		case 0xe1: // POP IX
			return void([this.ixl, this.ixh] = this.split(this.pop16()));
		case 0xe3: // EX (SP),IX
			return v = this.ixl | this.ixh << 8, [this.ixl, this.ixh] = this.split(this.pop16()), this.push16(v);
		case 0xe5: // PUSH IX
			return this.push16(this.ixl | this.ixh << 8);
		case 0xe9: // JP (IX)
			return void(this.pc = this.ixl | this.ixh << 8);
		case 0xf9: // LD SP,IX
			return void(this.sp = this.ixl | this.ixh << 8);
		default:
			this.undefsize = 2;
			this.undef();
			return;
		}
	}

	execute_ed() {
		let v, op = this.fetch();
		this.cycle -= cc_ed[op];
		switch (op) {
		case 0x40: // IN B,(C)
			return void(this.f = this.f & ~0xd6 | fLogic[this.b = this.ioread(this.b, this.c)]);
		case 0x41: // OUT (C),B
			return this.iowrite(this.b, this.c, this.b);
		case 0x42: // SBC HL,BC
			return void([this.l, this.h] = this.split(this.sbc16(this.l | this.h << 8, this.c | this.b << 8)));
		case 0x43: // LD (nn),BC
			return this.write16(this.fetch16(), this.c | this.b << 8);
		case 0x44: // NEG
			return void(this.a = this.neg8(this.a));
		case 0x45: // RETN
			return this.iff = this.iff & 2 | this.iff >> 1, this.ret(true);
		case 0x46: // IM 0
			return void(this.im = 0);
		case 0x47: // LD I,A
			return void(this.i = this.a);
		case 0x48: // IN C,(C)
			return void(this.f = this.f & ~0xd6 | fLogic[this.c = this.ioread(this.b, this.c)]);
		case 0x49: // OUT (C),C
			return this.iowrite(this.b, this.c, this.c);
		case 0x4a: // ADC HL,BC
			return void([this.l, this.h] = this.split(this.adc16(this.l | this.h << 8, this.c | this.b << 8)));
		case 0x4b: // LD BC,(nn)
			return void([this.c, this.b] = this.split(this.read16(this.fetch16())));
		case 0x4d: // RETI
			return this.ret(true);
		case 0x4f: // LD R,A
			return void(this.r = this.a);
		case 0x50: // IN D,(C)
			return void(this.f = this.f & ~0xd6 | fLogic[this.d = this.ioread(this.b, this.c)]);
		case 0x51: // OUT (C),D
			return this.iowrite(this.b, this.c, this.d);
		case 0x52: // SBC HL,DE
			return void([this.l, this.h] = this.split(this.sbc16(this.l | this.h << 8, this.e | this.d << 8)));
		case 0x53: // LD (nn),DE
			return this.write16(this.fetch16(), this.e | this.d << 8);
		case 0x56: // IM 1
			return void(this.im = 1);
		case 0x57: // LD A,I
			return void(this.f = this.f & ~0xd6 | fLogic[this.a = this.i] & 0xc0 | this.iff << 1 & 4);
		case 0x58: // IN E,(C)
			return void(this.f = this.f & ~0xd6 | fLogic[this.e = this.ioread(this.b, this.c)]);
		case 0x59: // OUT (C),E
			return this.iowrite(this.b, this.c, this.e);
		case 0x5a: // ADC HL,DE
			return void([this.l, this.h] = this.split(this.adc16(this.l | this.h << 8, this.e | this.d << 8)));
		case 0x5b: // LD DE,(nn)
			return void([this.e, this.d] = this.split(this.read16(this.fetch16())));
		case 0x5e: // IM 2
			return void(this.im = 2);
		case 0x5f: // LD A,R
			return void(this.f = this.f & ~0xd6 | fLogic[this.a = this.r] & 0xc0 | this.iff << 1 & 4);
		case 0x60: // IN H,(C)
			return void(this.f = this.f & ~0xd6 | fLogic[this.h = this.ioread(this.b, this.c)]);
		case 0x61: // OUT (C),H
			return this.iowrite(this.b, this.c, this.h);
		case 0x62: // SBC HL,HL
			return void([this.l, this.h] = this.split(this.sbc16(this.l | this.h << 8, this.l | this.h << 8)));
		case 0x67: // RRD
			return v = this.read(this.l | this.h << 8) | this.a << 8, this.write(this.l | this.h << 8, v >> 4 & 0xff), void(this.f = this.f & ~0xd6 | fLogic[this.a = this.a & 0xf0 | v & 0x0f]);
		case 0x68: // IN L,(C)
			return void(this.f = this.f & ~0xd6 | fLogic[this.l = this.ioread(this.b, this.c)]);
		case 0x69: // OUT (C),L
			return this.iowrite(this.b, this.c, this.l);
		case 0x6a: // ADC HL,HL
			return void([this.l, this.h] = this.split(this.adc16(this.l | this.h << 8, this.l | this.h << 8)));
		case 0x6f: // RLD
			return v = this.a & 0x0f | this.read(this.l | this.h << 8) << 4, this.write(this.l | this.h << 8, v & 0xff), void(this.f = this.f & ~0xd6 | fLogic[this.a = this.a & 0xf0 | v >> 8]);
		case 0x72: // SBC HL,SP
			return void([this.l, this.h] = this.split(this.sbc16(this.l | this.h << 8, this.sp)));
		case 0x73: // LD (nn),SP
			return this.write16(this.fetch16(), this.sp);
		case 0x78: // IN A,(C)
			return void(this.f = this.f & ~0xd6 | fLogic[this.a = this.ioread(this.b, this.c)]);
		case 0x79: // OUT (C),A
			return this.iowrite(this.b, this.c, this.a);
		case 0x7a: // ADC HL,SP
			return void([this.l, this.h] = this.split(this.adc16(this.l | this.h << 8, this.sp)));
		case 0x7b: // LD SP,(nn)
			return void(this.sp = this.read16(this.fetch16()));
		case 0xa0: // LDI
			return this.ldi();
		case 0xa1: // CPI
			return this.cpi();
		case 0xa2: // INI
			return this.ini();
		case 0xa3: // OUTI
			return this.outi();
		case 0xa8: // LDD
			return this.ldd();
		case 0xa9: // CPD
			return this.cpd();
		case 0xaa: // IND
			return this.ind();
		case 0xab: // OUTD
			return this.outd();
		case 0xb0: // LDIR
			return this.ldi(), void(this.f & 4 && (this.cycle -= cc_ex[0xb0], this.pc = this.pc - 2 & 0xffff));
		case 0xb1: // CPIR
			return this.cpi(), void((this.f & 0x44) === 4 && (this.cycle -= cc_ex[0xb1], this.pc = this.pc - 2 & 0xffff));
		case 0xb2: // INIR
			return this.ini(), void(~this.f & 0x40 && (this.cycle -= cc_ex[0xb2], this.pc = this.pc - 2 & 0xffff));
		case 0xb3: // OTIR
			return this.outi(), void(~this.f & 0x40 && (this.cycle -= cc_ex[0xb3], this.pc = this.pc - 2 & 0xffff));
		case 0xb8: // LDDR
			return this.ldd(), void(this.f & 4 && (this.cycle -= cc_ex[0xb8], this.pc = this.pc - 2 & 0xffff));
		case 0xb9: // CPDR
			return this.cpd(), void((this.f & 0x44) === 4 && (this.cycle -= cc_ex[0xb9], this.pc = this.pc - 2 & 0xffff));
		case 0xba: // INDR
			return this.ind(), void(~this.f & 0x40 && (this.cycle -= cc_ex[0xba], this.pc = this.pc - 2 & 0xffff));
		case 0xbb: // OTDR
			return this.outd(), void(~this.f & 0x40 && (this.cycle -= cc_ex[0xbb], this.pc = this.pc - 2 & 0xffff));
		default:
			this.undefsize = 2;
			this.undef();
			return;
		}
	}

	execute_fd() {
		let v, op = this.fetch();
		this.cycle -= cc_xy[op];
		switch (op) {
		case 0x09: // ADD IY,BC
			return void([this.iyl, this.iyh] = this.split(this.add16(this.iyl | this.iyh << 8, this.c | this.b << 8)));
		case 0x19: // ADD IY,DE
			return void([this.iyl, this.iyh] = this.split(this.add16(this.iyl | this.iyh << 8, this.e | this.d << 8)));
		case 0x21: // LD IY,nn
			return void([this.iyl, this.iyh] = this.split(this.fetch16()));
		case 0x22: // LD (nn),IY
			return this.write16(this.fetch16(), this.iyl | this.iyh << 8);
		case 0x23: // INC IY
			return void([this.iyl, this.iyh] = this.split((this.iyl | this.iyh << 8) + 1 & 0xffff));
		case 0x24: // INC IYH (undefined operation)
			return void(this.iyh = this.inc8(this.iyh));
		case 0x25: // DEC IYH (undefined operation)
			return void(this.iyh = this.dec8(this.iyh));
		case 0x26: // LD IYH,n (undefined operation)
			return void(this.iyh = this.fetch());
		case 0x29: // ADD IY,IY
			return void([this.iyl, this.iyh] = this.split(this.add16(this.iyl | this.iyh << 8, this.iyl | this.iyh << 8)));
		case 0x2a: // LD IY,(nn)
			return void([this.iyl, this.iyh] = this.split(this.read16(this.fetch16())));
		case 0x2b: // DEC IY
			return void([this.iyl, this.iyh] = this.split((this.iyl | this.iyh << 8) - 1 & 0xffff));
		case 0x2c: // INC IYL (undefined operation)
			return void(this.iyl = this.inc8(this.iyl));
		case 0x2d: // DEC IYL (undefined operation)
			return void(this.iyl = this.dec8(this.iyl));
		case 0x2e: // LD IYL,n (undefined operation)
			return void(this.iyl = this.fetch());
		case 0x34: // INC (IY+d)
			return v = this.disp(this.iyh, this.iyl), this.write(v, this.inc8(this.read(v)));
		case 0x35: // DEC (IY+d)
			return v = this.disp(this.iyh, this.iyl), this.write(v, this.dec8(this.read(v)));
		case 0x36: // LD (IY+d),n
			return v = this.disp(this.iyh, this.iyl), this.write(v, this.fetch());
		case 0x39: // ADD IY,SP
			return void([this.iyl, this.iyh] = this.split(this.add16(this.iyl | this.iyh << 8, this.sp)));
		case 0x44: // LD B,IYH (undefined operation)
			return void(this.b = this.iyh);
		case 0x45: // LD B,IYL (undefined operation)
			return void(this.b = this.iyl);
		case 0x46: // LD B,(IY+d)
			return void(this.b = this.read(this.disp(this.iyh, this.iyl)));
		case 0x4c: // LD C,IYH (undefined operation)
			return void(this.c = this.iyh);
		case 0x4d: // LD C,IYL (undefined operation)
			return void(this.c = this.iyl);
		case 0x4e: // LD C,(IY+d)
			return void(this.c = this.read(this.disp(this.iyh, this.iyl)));
		case 0x54: // LD D,IYH (undefined operation)
			return void(this.d = this.iyh);
		case 0x55: // LD D,IYL (undefined operation)
			return void(this.d = this.iyl);
		case 0x56: // LD D,(IY+d)
			return void(this.d = this.read(this.disp(this.iyh, this.iyl)));
		case 0x5c: // LD E,IYH (undefined operation)
			return void(this.e = this.iyh);
		case 0x5d: // LD E,IYL (undefined operation)
			return void(this.e = this.iyl);
		case 0x5e: // LD E,(IY+d)
			return void(this.e = this.read(this.disp(this.iyh, this.iyl)));
		case 0x60: // LD IYH,B (undefined operation)
			return void(this.iyh = this.b);
		case 0x61: // LD IYH,C (undefined operation)
			return void(this.iyh = this.c);
		case 0x62: // LD IYH,D (undefined operation)
			return void(this.iyh = this.d);
		case 0x63: // LD IYH,E (undefined operation)
			return void(this.iyh = this.e);
		case 0x66: // LD H,(IY+d)
			return void(this.h = this.read(this.disp(this.iyh, this.iyl)));
		case 0x67: // LD IYH,A (undefined operation)
			return void(this.iyh = this.a);
		case 0x68: // LD IYL,B (undefined operation)
			return void(this.iyl = this.b);
		case 0x69: // LD IYL,C (undefined operation)
			return void(this.iyl = this.c);
		case 0x6a: // LD IYL,D (undefined operation)
			return void(this.iyl = this.d);
		case 0x6b: // LD IYL,E (undefined operation)
			return void(this.iyl = this.e);
		case 0x6e: // LD L,(IY+d)
			return void(this.l = this.read(this.disp(this.iyh, this.iyl)));
		case 0x6f: // LD IYL,A (undefined operation)
			return void(this.iyl = this.a);
		case 0x70: // LD (IY+d),B
			return this.write(this.disp(this.iyh, this.iyl), this.b);
		case 0x71: // LD (IY+d),C
			return this.write(this.disp(this.iyh, this.iyl), this.c);
		case 0x72: // LD (IY+d),D
			return this.write(this.disp(this.iyh, this.iyl), this.d);
		case 0x73: // LD (IY+d),E
			return this.write(this.disp(this.iyh, this.iyl), this.e);
		case 0x74: // LD (IY+d),H
			return this.write(this.disp(this.iyh, this.iyl), this.h);
		case 0x75: // LD (IY+d),L
			return this.write(this.disp(this.iyh, this.iyl), this.l);
		case 0x77: // LD (IY+d),A
			return this.write(this.disp(this.iyh, this.iyl), this.a);
		case 0x7c: // LD A,IYH (undefined operation)
			return void(this.a = this.iyh);
		case 0x7d: // LD A,IYL (undefined operation)
			return void(this.a = this.iyl);
		case 0x7e: // LD A,(IY+d)
			return void(this.a = this.read(this.disp(this.iyh, this.iyl)));
		case 0x84: // ADD A,IYH (undefined operation)
			return void(this.a = this.add8(this.a, this.iyh));
		case 0x85: // ADD A,IYL (undefined operation)
			return void(this.a = this.add8(this.a, this.iyl));
		case 0x86: // ADD A,(IY+d)
			return void(this.a = this.add8(this.a, this.read(this.disp(this.iyh, this.iyl))));
		case 0x8c: // ADC A,IYH (undefined operation)
			return void(this.a = this.adc8(this.a, this.iyh));
		case 0x8d: // ADC A,IYL (undefined operation)
			return void(this.a = this.adc8(this.a, this.iyl));
		case 0x8e: // ADC A,(IY+d)
			return void(this.a = this.adc8(this.a, this.read(this.disp(this.iyh, this.iyl))));
		case 0x94: // SUB IYH (undefined operation)
			return void(this.a = this.sub8(this.a, this.iyh));
		case 0x95: // SUB IYL (undefined operation)
			return void(this.a = this.sub8(this.a, this.iyl));
		case 0x96: // SUB (IY+d)
			return void(this.a = this.sub8(this.a, this.read(this.disp(this.iyh, this.iyl))));
		case 0x9c: // SBC A,IYH (undefined operation)
			return void(this.a = this.sbc8(this.a, this.iyh));
		case 0x9d: // SBC A,IYL (undefined operation)
			return void(this.a = this.sbc8(this.a, this.iyl));
		case 0x9e: // SBC A,(IY+d)
			return void(this.a = this.sbc8(this.a, this.read(this.disp(this.iyh, this.iyl))));
		case 0xa4: // AND IYH (undefined operation)
			return void(this.a = this.and8(this.a, this.iyh));
		case 0xa5: // AND IYL (undefined operation)
			return void(this.a = this.and8(this.a, this.iyl));
		case 0xa6: // AND (IY+d)
			return void(this.a = this.and8(this.a, this.read(this.disp(this.iyh, this.iyl))));
		case 0xac: // XOR IYH (undefined operation)
			return void(this.a = this.xor8(this.a, this.iyh));
		case 0xad: // XOR IYL (undefined operation)
			return void(this.a = this.xor8(this.a, this.iyl));
		case 0xae: // XOR (IY+d)
			return void(this.a = this.xor8(this.a, this.read(this.disp(this.iyh, this.iyl))));
		case 0xb4: // OR IYH (undefined operation)
			return void(this.a = this.or8(this.a, this.iyh));
		case 0xb5: // OR IYL (undefined operation)
			return void(this.a = this.or8(this.a, this.iyl));
		case 0xb6: // OR (IY+d)
			return void(this.a = this.or8(this.a, this.read(this.disp(this.iyh, this.iyl))));
		case 0xbc: // CP IYH (undefined operation)
			return void(this.sub8(this.a, this.iyh));
		case 0xbd: // CP IYL (undefined operation)
			return void(this.sub8(this.a, this.iyl));
		case 0xbe: // CP (IY+d)
			return void(this.sub8(this.a, this.read(this.disp(this.iyh, this.iyl))));
		case 0xcb:
			v = this.disp(this.iyh, this.iyl), this.cycle -= cc_xycb[op = this.fetch()];
			switch (op) {
			case 0x06: // RLC (IY+d)
				return this.write(v, this.rlc8(this.read(v)));
			case 0x0e: // RRC (IY+d)
				return this.write(v, this.rrc8(this.read(v)));
			case 0x16: // RL (IY+d)
				return this.write(v, this.rl8(this.read(v)));
			case 0x1e: // RR (IY+d)
				return this.write(v, this.rr8(this.read(v)));
			case 0x26: // SLA (IY+d)
				return this.write(v, this.sla8(this.read(v)));
			case 0x2e: // SRA (IY+d)
				return this.write(v, this.sra8(this.read(v)));
			case 0x3e: // SRL (IY+d)
				return this.write(v, this.srl8(this.read(v)));
			case 0x46: // BIT 0,(IY+d)
				return this.bit8(0, this.read(v));
			case 0x4e: // BIT 1,(IY+d)
				return this.bit8(1, this.read(v));
			case 0x56: // BIT 2,(IY+d)
				return this.bit8(2, this.read(v));
			case 0x5e: // BIT 3,(IY+d)
				return this.bit8(3, this.read(v));
			case 0x66: // BIT 4,(IY+d)
				return this.bit8(4, this.read(v));
			case 0x6e: // BIT 5,(IY+d)
				return this.bit8(5, this.read(v));
			case 0x76: // BIT 6,(IY+d)
				return this.bit8(6, this.read(v));
			case 0x7e: // BIT 7,(IY+d)
				return this.bit8(7, this.read(v));
			case 0x86: // RES 0,(IY+d)
				return this.write(v, this.res8(0, this.read(v)));
			case 0x8e: // RES 1,(IY+d)
				return this.write(v, this.res8(1, this.read(v)));
			case 0x96: // RES 2,(IY+d)
				return this.write(v, this.res8(2, this.read(v)));
			case 0x9e: // RES 3,(IY+d)
				return this.write(v, this.res8(3, this.read(v)));
			case 0xa6: // RES 4,(IY+d)
				return this.write(v, this.res8(4, this.read(v)));
			case 0xae: // RES 5,(IY+d)
				return this.write(v, this.res8(5, this.read(v)));
			case 0xb6: // RES 6,(IY+d)
				return this.write(v, this.res8(6, this.read(v)));
			case 0xbe: // RES 7,(IY+d)
				return this.write(v, this.res8(7, this.read(v)));
			case 0xc6: // SET 0,(IY+d)
				return this.write(v, this.set8(0, this.read(v)));
			case 0xce: // SET 1,(IY+d)
				return this.write(v, this.set8(1, this.read(v)));
			case 0xd6: // SET 2,(IY+d)
				return this.write(v, this.set8(2, this.read(v)));
			case 0xde: // SET 3,(IY+d)
				return this.write(v, this.set8(3, this.read(v)));
			case 0xe6: // SET 4,(IY+d)
				return this.write(v, this.set8(4, this.read(v)));
			case 0xee: // SET 5,(IY+d)
				return this.write(v, this.set8(5, this.read(v)));
			case 0xf6: // SET 6,(IY+d)
				return this.write(v, this.set8(6, this.read(v)));
			case 0xfe: // SET 7,(IY+d)
				return this.write(v, this.set8(7, this.read(v)));
			default:
				this.undefsize = 4;
				this.undef();
				return;
			}
		case 0xe1: // POP IY
			return void([this.iyl, this.iyh] = this.split(this.pop16()));
		case 0xe3: // EX (SP),IY
			return v = this.iyl | this.iyh << 8, [this.iyl, this.iyh] = this.split(this.pop16()), this.push16(v);
		case 0xe5: // PUSH IY
			return this.push16(this.iyl | this.iyh << 8);
		case 0xe9: // JP (IY)
			return void(this.pc = this.iyl | this.iyh << 8);
		case 0xf9: // LD SP,IY
			return void(this.sp = this.iyl | this.iyh << 8);
		default:
			this.undefsize = 2;
			this.undef();
			return;
		}
	}

	disp(h, l) {
		const d = this.fetch();
		return (l | h << 8) + (d << 24 >> 24) & 0xffff;
	}

	jr(cond) {
		const d = this.fetch();
		if (cond) this.pc += (d << 24 >> 24) & 0xffff;
	}

	ret(cond) {
		if (cond) this.pc = this.pop16();
	}

	jp(cond) {
		const addr = this.fetch16();
		if (cond) this.pc = addr;
	}

	call(cond) {
		const addr = this.fetch16();
		if (cond) this.rst(addr);
	}

	rst(addr) {
		this.push16(this.pc), this.pc = addr;
	}

	push16(r) {
		this.sp = this.sp - 1 & 0xffff, this.write(this.sp, r >> 8), this.sp = this.sp - 1 & 0xffff, this.write(this.sp, r & 0xff);
	}

	pop16() {
		const r = this.read16(this.sp);
		return this.sp = this.sp + 2 & 0xffff, r;
	}

	add8(dst, src) {
		const r = dst + src & 0xff, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		return this.f = this.f & ~0xd7 | r & 0x80 | !r << 6 | c << 1 & 0x10 | v >> 5 & 4 | c >> 7 & 1, r;
	}

	add16(dst, src) {
		const r = dst + src & 0xffff, c = dst & src | src & ~r | ~r & dst;
		return this.f = this.f & ~13 | c >> 7 & 0x10 | c >> 15 & 1, r;
	}

	adc8(dst, src) {
		const r = dst + src + (this.f & 1) & 0xff, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		return this.f = this.f & ~0xd7 | r & 0x80 | !r << 6 | c << 1 & 0x10 | v >> 5 & 4 | c >> 7 & 1, r;
	}

	adc16(dst, src) {
		const r = dst + src + (this.f & 1) & 0xffff, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		return this.f = this.f & ~0xd7 | r >> 8 & 0x80 | !r << 6 | c >> 7 & 0x10 | v >> 13 & 4 | c >> 15 & 1, r;
	}

	sub8(dst, src) {
		const r = dst - src & 0xff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		return this.f = this.f & ~0xd7 | r & 0x80 | !r << 6 | c << 1 & 0x10 | v >> 5 & 4 | 2 | c >> 7 & 1, r;
	}

	sbc8(dst, src) {
		const r = dst - src - (this.f & 1) & 0xff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		return this.f = this.f & ~0xd7 | r & 0x80 | !r << 6 | c << 1 & 0x10 | v >> 5 & 4 | 2 | c >> 7 & 1, r;
	}

	sbc16(dst, src) {
		const r = dst - src - (this.f & 1) & 0xffff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		return this.f = this.f & ~0xd7 | r >> 8 & 0x80 | !r << 6 | c >> 7 & 0x10 | v >> 13 & 4 | 2 | c >> 15 & 1, r;
	}

	and8(dst, src) {
		const r = dst & src;
		return this.f = this.f & ~0xd7 | fLogic[r] | 0x10, r;
	}

	xor8(dst, src) {
		const r = dst ^ src;
		return this.f = this.f & ~0xd7 | fLogic[r], r;
	}

	or8(dst, src) {
		const r = dst | src;
		return this.f = this.f & ~0xd7 | fLogic[r], r;
	}

	inc8(dst) {
		const r = dst + 1 & 0xff, v = dst & 1 & ~r | ~dst & ~1 & r, c = dst & 1 | 1 & ~r | ~r & dst;
		return this.f = this.f & ~0xd6 | r & 0x80 | !r << 6 | c << 1 & 0x10 | v >> 5 & 4, r;
	}

	dec8(dst) {
		const r = dst - 1 & 0xff, v = dst & ~1 & ~r | ~dst & 1 & r, c = ~dst & 1 | 1 & r | r & ~dst;
		return this.f = this.f & ~0xd6 | r & 0x80 | !r << 6 | c << 1 & 0x10 | v >> 5 & 4 | 2, r;
	}

	daa() {
		let r = this.a;
		if (this.f & 2) {
			if (this.f & 0x10 && (r & 0x0f) > 5 || (r & 0x0f) > 9)
				r -= 6, this.f |= 0x10;
			if (this.f & 1 && (r & 0xf0) > 0x50 || (r & 0xf0) > 0x90)
				r -= 0x60, this.f |= 1;
		} else {
			if (this.f & 0x10 && (r & 0x0f) < 4 || (r & 0x0f) > 9) {
				if ((r += 6) >= 0x100)
					this.f |= 1;
				this.f |= 0x10;
			}
			if (this.f & 1 && (r & 0xf0) < 0x40 || (r & 0xf0) > 0x90)
				r += 0x60, this.f |= 1;
		}
		this.a = r &= 0xff, this.f = this.f & ~0xc4 | fLogic[r];
	}

	rlc8(dst) {
		const r = dst << 1 & 0xfe | dst >> 7;
		return this.f = this.f & ~0xd7 | fLogic[r] | dst >> 7, r;
	}

	rrc8(dst) {
		const r = dst << 7 & 0x80 | dst >> 1;
		return this.f = this.f & ~0xd7 | fLogic[r] | dst & 1, r;
	}

	rl8(dst) {
		const r = dst << 1 & 0xfe | this.f & 1;
		return this.f = this.f & ~0xd7 | fLogic[r] | dst >> 7, r;
	}

	rr8(dst) {
		const r = this.f << 7 & 0x80 | dst >> 1;
		return this.f = this.f & ~0xd7 | fLogic[r] | dst & 1, r;
	}

	sla8(dst) {
		const r = dst << 1 & 0xfe;
		return this.f = this.f & ~0xd7 | fLogic[r] | dst >> 7, r;
	}

	sra8(dst) {
		const r = dst & 0x80 | dst >> 1;
		return this.f = this.f & ~0xd7 | fLogic[r] | dst & 1, r;
	}

	srl8(dst) {
		const r = dst >> 1;
		return this.f = this.f & ~0xd7 | fLogic[r] | dst & 1, r;
	}

	bit8(src, dst) {
		this.f = this.f & ~0x52 | ~dst >> src << 6 & 0x40 | 0x10;
	}

	set8(src, dst) {
		return dst | 1 << src;
	}

	res8(src, dst) {
		return dst & ~(1 << src);
	}

	neg8(dst) {
		const r = -dst & 0xff, v = dst & r, c = dst | r;
		return this.f = this.f & ~0xd7 | r & 0x80 | !r << 6 | c << 1 & 0x10 | v >> 5 & 4 | 2 | c >> 7 & 1, r;
	}

	ldi() {
		this.write(this.e | this.d << 8, this.read(this.l | this.h << 8));
		[this.e, this.d] = this.split((this.e | this.d << 8) + 1 & 0xffff);
		[this.l, this.h] = this.split((this.l | this.h << 8) + 1 & 0xffff);
		[this.c, this.b] = this.split((this.c | this.b << 8) - 1 & 0xffff);
		this.f = this.f & ~0x16 | ((this.b | this.c) !== 0) << 2;
	}

	ldd() {
		this.write(this.e | this.d << 8, this.read(this.l | this.h << 8));
		[this.e, this.d] = this.split((this.e | this.d << 8) - 1 & 0xffff);
		[this.l, this.h] = this.split((this.l | this.h << 8) - 1 & 0xffff);
		[this.c, this.b] = this.split((this.c | this.b << 8) - 1 & 0xffff);
		this.f = this.f & ~0x16 | ((this.b | this.c) !== 0) << 2;
	}

	cpi() {
		const dst = this.a, src = this.read(this.l | this.h << 8), r = dst - src & 0xff, c = ~dst & src | src & r | r & ~dst;
		[this.l, this.h] = this.split((this.l | this.h << 8) + 1 & 0xffff);
		[this.c, this.b] = this.split((this.c | this.b << 8) - 1 & 0xffff);
		this.f = this.f & ~0xd6 | r & 0x80 | !r << 6 | c << 1 & 0x10 | ((this.b | this.c) !== 0) << 2 | 2;
	}

	cpd() {
		const dst = this.a, src = this.read(this.l | this.h << 8), r = dst - src & 0xff, c = ~dst & src | src & r | r & ~dst;
		[this.l, this.h] = this.split((this.l | this.h << 8) - 1 & 0xffff);
		[this.c, this.b] = this.split((this.c | this.b << 8) - 1 & 0xffff);
		this.f = this.f & ~0xd6 | r & 0x80 | !r << 6 | c << 1 & 0x10 | ((this.b | this.c) !== 0) << 2 | 2;
	}

	ini() {
		this.write(this.l | this.h << 8, this.ioread(this.b, this.c));
		[this.l, this.h] = this.split((this.l | this.h << 8) + 1 & 0xffff);
		this.f = this.f & ~0x42 | !(this.b = this.b - 1 & 0xff) << 6 | 2;
	}

	ind() {
		this.write(this.l | this.h << 8, this.ioread(this.b, this.c));
		[this.l, this.h] = this.split((this.l | this.h << 8) - 1 & 0xffff);
		this.f = this.f & ~0x42 | !(this.b = this.b - 1 & 0xff) << 6 | 2;
	}

	outi() {
		this.iowrite(this.b, this.c, this.read(this.l | this.h << 8));
		[this.l, this.h] = this.split((this.l | this.h << 8) + 1 & 0xffff);
		this.f = this.f & ~0x42 | !(this.b = this.b - 1 & 0xff) << 6 | 2;
	}

	outd() {
		this.iowrite(this.b, this.c, this.read(this.l | this.h << 8));
		[this.l, this.h] = this.split((this.l | this.h << 8) - 1 & 0xffff);
		this.f = this.f & ~0x42 | !(this.b = this.b - 1 & 0xff) << 6 | 2;
	}

	ioread(h, l) {
		const page = this.iomap[h];
		return !page.read ? page.base[l] : page.read(l | h << 8);
	}

	iowrite(h, l, data) {
		const page = this.iomap[h];
		!page.write ? void(page.base[l] = data) : page.write(l | h << 8, data);
	}

	split(v) {
		return [v & 0xff, v >> 8];
	}

	fetch16() {
		const data = this.fetch();
		return data | this.fetch() << 8;
	}

	read16(addr) {
		const data = this.read(addr);
		return data | this.read(addr + 1 & 0xffff) << 8;
	}

	write16(addr, data) {
		this.write(addr, data & 0xff), this.write(addr + 1 & 0xffff, data >> 8);
	}
}

const fLogic = Uint8Array.from(seq(0x100), e => {
	let p = e ^ e >> 4;
	return p ^= p >> 2, p ^= p >> 1, e & 0x80 | !e << 6 | ~p << 2 & 4;
});

const cc_op = Uint8Array.of(
	4,10, 7, 6, 4, 4, 7, 4, 4,11, 7, 6, 4, 4, 7, 4,
	8,10, 7, 6, 4, 4, 7, 4,12,11, 7, 6, 4, 4, 7, 4,
	7,10,16, 6, 4, 4, 7, 4, 7,11,16, 6, 4, 4, 7, 4,
	7,10,13, 6,11,11,10, 4, 7,11,13, 6, 4, 4, 7, 4,
	4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,
	4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,
	4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,
	7, 7, 7, 7, 7, 7, 4, 7, 4, 4, 4, 4, 4, 4, 7, 4,
	4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,
	4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,
	4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,
	4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,
	5,10,10,10,10,11, 7,11, 5,10,10, 0,10,17, 7,11,
	5,10,10,11,10,11, 7,11, 5, 4,10,11,10, 0, 7,11,
	5,10,10,19,10,11, 7,11, 5, 4,10, 4,10, 0, 7,11,
	5,10,10, 4,10,11, 7,11, 5, 6,10, 4,10, 0, 7,11);

const cc_cb = Uint8Array.of(
	8, 8, 8, 8, 8, 8,15, 8, 8, 8, 8, 8, 8, 8,15, 8,
	8, 8, 8, 8, 8, 8,15, 8, 8, 8, 8, 8, 8, 8,15, 8,
	8, 8, 8, 8, 8, 8,15, 8, 8, 8, 8, 8, 8, 8,15, 8,
	8, 8, 8, 8, 8, 8,15, 8, 8, 8, 8, 8, 8, 8,15, 8,
	8, 8, 8, 8, 8, 8,12, 8, 8, 8, 8, 8, 8, 8,12, 8,
	8, 8, 8, 8, 8, 8,12, 8, 8, 8, 8, 8, 8, 8,12, 8,
	8, 8, 8, 8, 8, 8,12, 8, 8, 8, 8, 8, 8, 8,12, 8,
	8, 8, 8, 8, 8, 8,12, 8, 8, 8, 8, 8, 8, 8,12, 8,
	8, 8, 8, 8, 8, 8,15, 8, 8, 8, 8, 8, 8, 8,15, 8,
	8, 8, 8, 8, 8, 8,15, 8, 8, 8, 8, 8, 8, 8,15, 8,
	8, 8, 8, 8, 8, 8,15, 8, 8, 8, 8, 8, 8, 8,15, 8,
	8, 8, 8, 8, 8, 8,15, 8, 8, 8, 8, 8, 8, 8,15, 8,
	8, 8, 8, 8, 8, 8,15, 8, 8, 8, 8, 8, 8, 8,15, 8,
	8, 8, 8, 8, 8, 8,15, 8, 8, 8, 8, 8, 8, 8,15, 8,
	8, 8, 8, 8, 8, 8,15, 8, 8, 8, 8, 8, 8, 8,15, 8,
	8, 8, 8, 8, 8, 8,15, 8, 8, 8, 8, 8, 8, 8,15, 8);

const cc_ed = Uint8Array.of(
	8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
	8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
	8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
	8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
	12,12,15,20,8,14, 8, 9,12,12,15,20, 8,14, 8, 9,
	12,12,15,20,8,14, 8, 9,12,12,15,20, 8,14, 8, 9,
	12,12,15,20,8,14, 8,18,12,12,15,20, 8,14, 8,18,
	12,12,15,20,8,14, 8, 8,12,12,15,20, 8,14, 8, 8,
	8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
	8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
	16,16,16,16,8, 8, 8, 8,16,16,16,16, 8, 8, 8, 8,
	16,16,16,16,8, 8, 8, 8,16,16,16,16, 8, 8, 8, 8,
	8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
	8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
	8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
	8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8);

const cc_xy = Uint8Array.of(
	4+4,10+4, 7+4, 6+4, 4+4, 4+4, 7+4, 4+4, 4+4,11+4, 7+4, 6+4, 4+4, 4+4, 7+4, 4+4,
	8+4,10+4, 7+4, 6+4, 4+4, 4+4, 7+4, 4+4,12+4,11+4, 7+4, 6+4, 4+4, 4+4, 7+4, 4+4,
	7+4,10+4,16+4, 6+4, 4+4, 4+4, 7+4, 4+4, 7+4,11+4,16+4, 6+4, 4+4, 4+4, 7+4, 4+4,
	7+4,10+4,13+4, 6+4,23  ,23  ,19  , 4+4, 7+4,11+4,13+4, 6+4, 4+4, 4+4, 7+4, 4+4,
	4+4, 4+4, 4+4, 4+4, 4+4, 4+4,19  , 4+4, 4+4, 4+4, 4+4, 4+4, 4+4, 4+4,19  , 4+4,
	4+4, 4+4, 4+4, 4+4, 4+4, 4+4,19  , 4+4, 4+4, 4+4, 4+4, 4+4, 4+4, 4+4,19  , 4+4,
	4+4, 4+4, 4+4, 4+4, 4+4, 4+4,19  , 4+4, 4+4, 4+4, 4+4, 4+4, 4+4, 4+4,19  , 4+4,
	19 ,19  ,19  ,19  ,19  ,19  , 4+4,19  , 4+4, 4+4, 4+4, 4+4, 4+4, 4+4,19  , 4+4,
	4+4, 4+4, 4+4, 4+4, 4+4, 4+4,19  , 4+4, 4+4, 4+4, 4+4, 4+4, 4+4, 4+4,19  , 4+4,
	4+4, 4+4, 4+4, 4+4, 4+4, 4+4,19  , 4+4, 4+4, 4+4, 4+4, 4+4, 4+4, 4+4,19  , 4+4,
	4+4, 4+4, 4+4, 4+4, 4+4, 4+4,19  , 4+4, 4+4, 4+4, 4+4, 4+4, 4+4, 4+4,19  , 4+4,
	4+4, 4+4, 4+4, 4+4, 4+4, 4+4,19  , 4+4, 4+4, 4+4, 4+4, 4+4, 4+4, 4+4,19  , 4+4,
	5+4,10+4,10+4,10+4,10+4,11+4, 7+4,11+4, 5+4,10+4,10+4, 0  ,10+4,17+4, 7+4,11+4,
	5+4,10+4,10+4,11+4,10+4,11+4, 7+4,11+4, 5+4, 4+4,10+4,11+4,10+4, 4  , 7+4,11+4,
	5+4,10+4,10+4,19+4,10+4,11+4, 7+4,11+4, 5+4, 4+4,10+4, 4+4,10+4, 4  , 7+4,11+4,
	5+4,10+4,10+4, 4+4,10+4,11+4, 7+4,11+4, 5+4, 6+4,10+4, 4+4,10+4, 4  , 7+4,11+4);

const cc_xycb = Uint8Array.of(
	23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,
	23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,
	23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,
	23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,
	20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,
	20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,
	20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,
	20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,
	23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,
	23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,
	23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,
	23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,
	23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,
	23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,
	23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,
	23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23);

const cc_ex = Uint8Array.of(
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	5, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0,
	5, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0,
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	5, 5, 5, 5, 0, 0, 0, 0, 5, 5, 5, 5, 0, 0, 0, 0,
	6, 0, 0, 0, 7, 0, 0, 2, 6, 0, 0, 0, 7, 0, 0, 2,
	6, 0, 0, 0, 7, 0, 0, 2, 6, 0, 0, 0, 7, 0, 0, 2,
	6, 0, 0, 0, 7, 0, 0, 2, 6, 0, 0, 0, 7, 0, 0, 2,
	6, 0, 0, 0, 7, 0, 0, 2, 6, 0, 0, 0, 7, 0, 0, 2);

