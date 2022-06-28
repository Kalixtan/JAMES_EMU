/*
 *
 *	Libble Rabble
 *
 */

import MappySound from '../libs/EMU.js/devices/SOUND/mappy_sound.js';
import {seq, rseq, convertGFX, Timer} from '../libs/EMU.js/utils.js';
import {init} from '../libs/EMU.js/main.js';
import MC6809 from '../libs/EMU.js/devices/CPU/mc6809.js';
import MC68000 from '../libs/EMU.js/devices/CPU/mc68000.js';
let game, sound;

class LibbleRabble {
	cxScreen = 224;
	cyScreen = 288;
	width = 256;
	height = 512;
	xOffset = 16;
	yOffset = 16;
	rotate = 3;

	fReset = true;
	fTest = false;
	fDIPSwitchChanged = true;
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;
	nLibbleRabble = 3;
	nBonus = 'A_H';
	fRound = false;
	fAttract = true;
	fPractice = true;
	nRank = 'A';

	fInterruptEnable = false;
	fInterruptEnable2 = false;
	ram = new Uint8Array(0x2000).addBase();
	ram2 = new Uint8Array(0x800).addBase();
	ram3 = new Uint8Array(0x40000).addBase();
	vram = new Uint8Array(0x10000).addBase();
	port = new Uint8Array(0x40);
	in = new Uint8Array(15);
	edge = 0xf;

	bg = new Uint8Array(0x8000).fill(3);
	obj = new Uint8Array(0x10000).fill(3);
	rgb = Int32Array.from(seq(0x100), i => 0xff000000 | BLUE[i] * 255 / 15 << 16 | GREEN[i] * 255 / 15 << 8 | RED[i] * 255 / 15);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;
	palette = 0;

	cpu = new MC6809(Math.floor(6144000 / 4));
	cpu2 = new MC6809(Math.floor(6144000 / 4));
	cpu3 = new MC68000(6144000);
	timer = new Timer(60);

	constructor() {
		//SETUP CPU
		for (let i = 0; i < 0x20; i++) {
			this.cpu.memorymap[i].base = this.ram.base[i];
			this.cpu.memorymap[i].write = null;
		}
		for (let i = 0; i < 8; i++) {
			this.cpu.memorymap[0x28 + i].base = this.ram2.base[i];
			this.cpu.memorymap[0x28 + i].write = null;
		}
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x60 + i].read = (addr) => { return sound.read(addr); };
			this.cpu.memorymap[0x60 + i].write = (addr, data) => { sound.write(addr, data); };
		}
		this.cpu.memorymap[0x68].read = (addr) => { return this.port[addr & 0x3f] | 0xf0; };
		this.cpu.memorymap[0x68].write = (addr, data) => { this.port[addr & 0x3f] = data & 0xf; };
		for (let i = 0; i < 0x10; i++)
			this.cpu.memorymap[0x70 + i].write = (addr) => { this.fInterruptEnable = !(addr & 0x800); };
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[0x80 + i].base = PRG1.base[i];
		for (let i = 0; i < 0x10; i++)
			this.cpu.memorymap[0x80 + i].write = (addr) => { addr & 0x800 ? this.cpu3.disable() : this.cpu3.enable(); };
		for (let i = 0; i < 0x10; i++)
			this.cpu.memorymap[0x90 + i].write = (addr) => { addr & 0x800 ? this.cpu2.disable() : this.cpu2.enable(); };
		this.cpu.memorymap[0xa0].write = (addr) => { this.palette = addr << 7 & 0x80; };

		for (let i = 0; i < 4; i++) {
			this.cpu2.memorymap[i].read = (addr) => { return sound.read(addr); };
			this.cpu2.memorymap[i].write = (addr, data) => { sound.write(addr, data); };
		}
		for (let i = 0; i < 0x20; i++)
			this.cpu2.memorymap[0xe0 + i].base = PRG2.base[i];

		for (let i = 0; i < 0x80; i++)
			this.cpu3.memorymap[i].base = PRG3.base[i];
		for (let i = 0; i < 0x400; i++) {
			this.cpu3.memorymap[0x800 + i].base = this.ram3.base[i];
			this.cpu3.memorymap[0x800 + i].write = null;
		}
		for (let i = 0; i < 0x10; i++) {
			this.cpu3.memorymap[0x1000 + i].read = (addr) => { return this.ram2[addr >> 1 & 0x7ff]; };
			this.cpu3.memorymap[0x1000 + i].write = (addr, data) => { this.ram2[addr >> 1 & 0x7ff] = data; };
		}
		for (let i = 0; i < 0x80; i++) {
			this.cpu3.memorymap[0x1800 + i].read = (addr) => { return addr = addr << 1 & 0xfffe, this.vram[addr] << 4 | this.vram[addr | 1] & 0xf; };
			this.cpu3.memorymap[0x1800 + i].write = (addr, data) => { addr = addr << 1 & 0xfffe, this.vram[addr] = data >> 4, this.vram[addr | 1] = data & 0xf; };
		}
		for (let i = 0; i < 0x500; i++) {
			this.cpu3.memorymap[0x1900 + i].base = this.vram.base[i & 0xff];
			this.cpu3.memorymap[0x1900 + i].write = null;
		}
		for (let i = 0; i < 0x1000; i++)
			this.cpu3.memorymap[0x3000 + i].write16 = (addr) => { this.fInterruptEnable2 = !(addr & 0x80000); };

		//SETUP VIDEO
		convertGFX(this.bg, BG, 512, rseq(8, 0, 8), seq(4, 64).concat(seq(4)), [0, 4], 16);
		convertGFX(this.obj, OBJ, 256, rseq(8, 256, 8).concat(rseq(8, 0, 8)), seq(4).concat(seq(4, 64), seq(4, 128), seq(4, 192)), [0, 4], 64);
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.cpu2.execute(tick_rate);
			this.cpu3.execute(tick_rate);
			this.timer.execute(tick_rate, () => { update(), this.fInterruptEnable && this.cpu.interrupt(), this.cpu2.interrupt(), this.fInterruptEnable2 && this.cpu3.interrupt(6); });
			sound.execute(tick_rate);
			audio.execute(tick_rate);
		}
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		//DIP SWITCH UPDATE
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			switch (this.nLibbleRabble) {
			case 1:
				this.in[8] = this.in[8] & ~3 | 1;
				break;
			case 2:
				this.in[8] |= 3;
				break;
			case 3:
				this.in[8] &= ~3;
				break;
			case 5:
				this.in[8] = this.in[8] & ~3 | 2;
				break;
			}
			switch (this.nBonus) {
			case 'A_H': //1st 40000 2nd 120000 3rd 200000 4th 400000 5th 600000 6th 1000000
				this.in[8] &= ~0xc, this.in[5] &= ~1;
				break;
			case 'B_I': //1st 40000 2nd 140000 3rd 250000 4th 400000 5th 700000 6th 1000000
				this.in[8] &= ~0xc, this.in[5] |= 1;
				break;
			case 'C_J': //C: 1st 50000 2nd 150000 3rd 320000 4th 500000 5th 700000 6th 1000000
						//J: 1st 20000 2nd 120000
				this.in[8] = this.in[8] & ~0xc | 8, this.in[5] &= ~1;
				break;
			case 'D_K': //D: 1st 40000 2nd 120000 Every 120000
						//K: 1st 50000 2nd 150000
				this.in[8] = this.in[8] & ~0xc | 8, this.in[5] |= 1;
				break;
			case 'E_L': //1st 50000 2nd 150000 Every 150000
				this.in[8] = this.in[8] & ~0xc | 4, this.in[5] &= ~1;
				break;
			case 'F_M': //F: 1st 50000 2nd 150000 3rd 300000
						//M: 1st 60000 2nd 200000 Every 200000
				this.in[8] = this.in[8] & ~0xc | 4, this.in[5] |= 1;
				break;
			case 'G_N': //G: 1st 40000 2nd 120000 3rd 200000
						//N: 1st 50000
				this.in[8] |= 0xc, this.in[5] &= ~1;
				break;
			case 'Nothing':
				this.in[8] |= 0xc, this.in[5] |= 1;
				break;
			}
			if (this.fRound)
				this.in[6] |= 2;
			else
				this.in[6] &= ~2;
			if (this.fAttract)
				this.in[6] &= ~4;
			else
				this.in[6] |= 4;
			if (this.fPractice)
				this.in[7] &= ~2;
			else
				this.in[7] |= 2;
			switch (this.nRank) {
			case 'A':
				this.in[7] &= ~0xc;
				break;
			case 'B':
				this.in[7] = this.in[7] & ~0xc | 8;
				break;
			case 'C':
				this.in[7] = this.in[7] & ~0xc | 4;
				break;
			case 'D':
				this.in[7] |= 0xc;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.in[13] |= 8;
		else
			this.in[13] &= ~8;

		//RESET
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
			this.cpu2.disable();
			this.cpu3.disable();
		}
		return this;
	}

	updateInput() {
		this.in[0] = !!this.fCoin << 3, this.in[3] = this.in[3] & 3 | !!this.fStart1P << 2 | !!this.fStart2P << 3;
		this.fCoin -= !!this.fCoin, this.fStart1P -= !!this.fStart1P, this.fStart2P -= !!this.fStart2P;
		this.edge &= this.in[3];
		if (this.port[8] === 1)
			this.port.set(this.in.subarray(0, 4), 4);
		else if (this.port[8] === 3) {
			let credit = this.port[2] * 10 + this.port[3];
			if (this.fCoin && credit < 150)
				this.port[0] += 1, credit = Math.min(credit + 1, 99);
			if (!this.port[9] && this.fStart1P && credit > 0)
				this.port[1] += 1, credit -= (credit < 150);
			if (!this.port[9] && this.fStart2P && credit > 1)
				this.port[1] += 2, credit -= (credit < 150) * 2;
			this.port[2] = credit / 10, this.port[3] = credit % 10;
			this.port.set([this.in[1], this.in[3] << 1 & 0xa | this.edge & 5, this.in[2], this.in[3] & 0xa | this.edge >> 1 & 5], 4);
		} else if (this.port[8] === 5)
			this.port.set([0, 0xf, 0xd, 9, 1, 0xc, 0xc], 1);
		if (this.port[0x18] === 1)
			this.port.set(this.in.subarray(5, 9), 0x10);
		else if (this.port[0x18] === 7)
			this.port[0x12] = 0xe;
		if (this.port[0x28] === 7)
			this.port[0x27] = 6;
		else if (this.port[0x28] === 9)
			this.port.set([this.in[10], this.in[14], this.in[11], this.in[11], this.in[12], this.in[12], this.in[13], this.in[13]], 0x20);
		return this.edge = this.in[3] ^ 0xf, this;
	}

	coin(fDown) {
		fDown && (this.fCoin = 2);
	}

	start1P(fDown) {
		fDown && (this.fStart1P = 2);
	}

	start2P(fDown) {
		fDown && (this.fStart2P = 2);
	}

	up(fDown) {
		this.in[11] = this.in[11] & ~(1 << 0 | fDown << 2) | fDown << 0;
	}

	right(fDown) {
		this.in[11] = this.in[11] & ~(1 << 1 | fDown << 3) | fDown << 1;
	}

	down(fDown) {
		this.in[11] = this.in[11] & ~(1 << 2 | fDown << 0) | fDown << 2;
	}

	left(fDown) {
		this.in[11] = this.in[11] & ~(1 << 3 | fDown << 1) | fDown << 3;
	}

	up2(fDown) {
		this.in[1] = this.in[1] & ~(1 << 0 | fDown << 2) | fDown << 0;
	}

	right2(fDown) {
		this.in[1] = this.in[1] & ~(1 << 1 | fDown << 3) | fDown << 1;
	}

	down2(fDown) {
		this.in[1] = this.in[1] & ~(1 << 2 | fDown << 0) | fDown << 2;
	}

	left2(fDown) {
		this.in[1] = this.in[1] & ~(1 << 3 | fDown << 1) | fDown << 3;
	}

	triggerA(fDown) {
		this.in[3] = this.in[3] & ~(1 << 0) | fDown << 0;
	}

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		//graphic drawing
		let p = 256 * 8 * 2 + 239;
		let idx = 0x60 | this.palette;
		for (let k = 0x200, i = 0; i < 224; p -= 256 * 288 + 1, i++)
			for (let j = 0; j < 288; k++, p += 256, j++)
				this.bitmap[p] = idx | this.vram[k];

		//bg drawing
		p = 256 * 8 * 4 + 232;
		for (let k = 0x40, i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(this.bitmap, p, k);
		p = 256 * 8 * 36 + 232;
		for (let k = 2, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(this.bitmap, p, k);
		p = 256 * 8 * 37 + 232;
		for (let k = 0x22, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(this.bitmap, p, k);
		p = 256 * 8 * 2 + 232;
		for (let k = 0x3c2, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(this.bitmap, p, k);
		p = 256 * 8 * 3 + 232;
		for (let k = 0x3e2, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(this.bitmap, p, k);

		//obj drawing
		for (let k = 0xf80, i = 64; i !== 0; k += 2, --i) {
			const x = this.ram[k + 0x800] + 7 & 0xff;
			const y = (this.ram[k + 0x801] | this.ram[k + 0x1001] << 8) - 55 & 0x1ff;
			const src = this.ram[k] | this.ram[k + 1] << 8;
			switch (this.ram[k + 0x1000] & 0x0f) {
			case 0x00: //normal
				this.xfer16x16(this.bitmap, x | y << 8, src);
				break;
			case 0x01: //V invert
				this.xfer16x16V(this.bitmap, x | y << 8, src);
				break;
			case 0x02: //H invert
				this.xfer16x16H(this.bitmap, x | y << 8, src);
				break;
			case 0x03: //HV invert
				this.xfer16x16HV(this.bitmap, x | y << 8, src);
				break;
			case 0x04: //normal
				this.xfer16x16(this.bitmap, x | y << 8, src & ~1);
				this.xfer16x16(this.bitmap, x | (y + 16 & 0x1ff) << 8, src | 1);
				break;
			case 0x05: //V invert
				this.xfer16x16V(this.bitmap, x | y << 8, src | 1);
				this.xfer16x16V(this.bitmap, x | (y + 16 & 0x1ff) << 8, src & ~1);
				break;
			case 0x06: //H invert
				this.xfer16x16H(this.bitmap, x | y << 8, src & ~1);
				this.xfer16x16H(this.bitmap, x | (y + 16 & 0x1ff) << 8, src | 1);
				break;
			case 0x07: //HV invert
				this.xfer16x16HV(this.bitmap, x | y << 8, src | 1);
				this.xfer16x16HV(this.bitmap, x | (y + 16 & 0x1ff) << 8, src & ~1);
				break;
			case 0x08: //normal
				this.xfer16x16(this.bitmap, x | y << 8, src | 2);
				this.xfer16x16(this.bitmap, x + 16 & 0xff | y << 8, src & ~2);
				break;
			case 0x09: //V invert
				this.xfer16x16V(this.bitmap, x | y << 8, src | 2);
				this.xfer16x16V(this.bitmap, x + 16 & 0xff | y << 8, src & ~2);
				break;
			case 0x0a: //H invert
				this.xfer16x16H(this.bitmap, x | y << 8, src & ~2);
				this.xfer16x16H(this.bitmap, x + 16 & 0xff | y << 8, src | 2);
				break;
			case 0x0b: //HV invert
				this.xfer16x16HV(this.bitmap, x | y << 8, src & ~2);
				this.xfer16x16HV(this.bitmap, x + 16 & 0xff | y << 8, src | 2);
				break;
			case 0x0c: //normal
				this.xfer16x16(this.bitmap, x | y << 8, src & ~3 | 2);
				this.xfer16x16(this.bitmap, x | (y + 16 & 0x1ff) << 8, src | 3);
				this.xfer16x16(this.bitmap, x + 16 & 0xff | y << 8, src & ~3);
				this.xfer16x16(this.bitmap, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3 | 1);
				break;
			case 0x0d: //V invert
				this.xfer16x16V(this.bitmap, x | y << 8, src | 3);
				this.xfer16x16V(this.bitmap, x | (y + 16 & 0x1ff) << 8, src & ~3 | 2);
				this.xfer16x16V(this.bitmap, x + 16 & 0xff | y << 8, src & ~3 | 1);
				this.xfer16x16V(this.bitmap, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3);
				break;
			case 0x0e: //H invert
				this.xfer16x16H(this.bitmap, x | y << 8, src & ~3);
				this.xfer16x16H(this.bitmap, x | (y + 16 & 0x1ff) << 8, src & ~3 | 1);
				this.xfer16x16H(this.bitmap, x + 16 & 0xff | y << 8, src & ~3 | 2);
				this.xfer16x16H(this.bitmap, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src | 3);
				break;
			case 0x0f: //HV invert
				this.xfer16x16HV(this.bitmap, x | y << 8, src & ~3 | 1);
				this.xfer16x16HV(this.bitmap, x | (y + 16 & 0x1ff) << 8, src & ~3);
				this.xfer16x16HV(this.bitmap, x + 16 & 0xff | y << 8, src | 3);
				this.xfer16x16HV(this.bitmap, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3 | 2);
				break;
			}
		}

		//update palette
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				this.bitmap[p] = this.rgb[this.bitmap[p]];

		return this.bitmap;
	}

	xfer8x8(data, p, k) {
		const q = this.ram[k] << 6, idx = this.ram[k + 0x400] << 2 & 0xfc, idx2 = 0x70 | this.palette;
		let px;

		(px = BGCOLOR[idx | this.bg[q | 0x00]]) !== 0xf && (data[p + 0x000] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x01]]) !== 0xf && (data[p + 0x001] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x02]]) !== 0xf && (data[p + 0x002] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x03]]) !== 0xf && (data[p + 0x003] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x04]]) !== 0xf && (data[p + 0x004] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x05]]) !== 0xf && (data[p + 0x005] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x06]]) !== 0xf && (data[p + 0x006] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x07]]) !== 0xf && (data[p + 0x007] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x08]]) !== 0xf && (data[p + 0x100] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x09]]) !== 0xf && (data[p + 0x101] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x0a]]) !== 0xf && (data[p + 0x102] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x0b]]) !== 0xf && (data[p + 0x103] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x0c]]) !== 0xf && (data[p + 0x104] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x0d]]) !== 0xf && (data[p + 0x105] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x0e]]) !== 0xf && (data[p + 0x106] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x0f]]) !== 0xf && (data[p + 0x107] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x10]]) !== 0xf && (data[p + 0x200] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x11]]) !== 0xf && (data[p + 0x201] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x12]]) !== 0xf && (data[p + 0x202] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x13]]) !== 0xf && (data[p + 0x203] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x14]]) !== 0xf && (data[p + 0x204] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x15]]) !== 0xf && (data[p + 0x205] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x16]]) !== 0xf && (data[p + 0x206] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x17]]) !== 0xf && (data[p + 0x207] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x18]]) !== 0xf && (data[p + 0x300] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x19]]) !== 0xf && (data[p + 0x301] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x1a]]) !== 0xf && (data[p + 0x302] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x1b]]) !== 0xf && (data[p + 0x303] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x1c]]) !== 0xf && (data[p + 0x304] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x1d]]) !== 0xf && (data[p + 0x305] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x1e]]) !== 0xf && (data[p + 0x306] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x1f]]) !== 0xf && (data[p + 0x307] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x20]]) !== 0xf && (data[p + 0x400] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x21]]) !== 0xf && (data[p + 0x401] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x22]]) !== 0xf && (data[p + 0x402] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x23]]) !== 0xf && (data[p + 0x403] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x24]]) !== 0xf && (data[p + 0x404] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x25]]) !== 0xf && (data[p + 0x405] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x26]]) !== 0xf && (data[p + 0x406] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x27]]) !== 0xf && (data[p + 0x407] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x28]]) !== 0xf && (data[p + 0x500] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x29]]) !== 0xf && (data[p + 0x501] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x2a]]) !== 0xf && (data[p + 0x502] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x2b]]) !== 0xf && (data[p + 0x503] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x2c]]) !== 0xf && (data[p + 0x504] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x2d]]) !== 0xf && (data[p + 0x505] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x2e]]) !== 0xf && (data[p + 0x506] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x2f]]) !== 0xf && (data[p + 0x507] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x30]]) !== 0xf && (data[p + 0x600] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x31]]) !== 0xf && (data[p + 0x601] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x32]]) !== 0xf && (data[p + 0x602] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x33]]) !== 0xf && (data[p + 0x603] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x34]]) !== 0xf && (data[p + 0x604] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x35]]) !== 0xf && (data[p + 0x605] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x36]]) !== 0xf && (data[p + 0x606] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x37]]) !== 0xf && (data[p + 0x607] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x38]]) !== 0xf && (data[p + 0x700] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x39]]) !== 0xf && (data[p + 0x701] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x3a]]) !== 0xf && (data[p + 0x702] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x3b]]) !== 0xf && (data[p + 0x703] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x3c]]) !== 0xf && (data[p + 0x704] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x3d]]) !== 0xf && (data[p + 0x705] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x3e]]) !== 0xf && (data[p + 0x706] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x3f]]) !== 0xf && (data[p + 0x707] = idx2 | px);
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 6 & 0xfc | 0x100;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0xff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[src++]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 6 & 0xfc | 0x100;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[src++]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 6 & 0xfc | 0x100;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[--src]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 6 & 0xfc | 0x100;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[--src]]) !== 0xff)
					data[dst] = px;
	}
}

/*
 *
 *	Libble Rabble
 *
 */

import {ROM} from "../roms/libble_rabble.png.js";
let PRG1, PRG2, PRG3, BG, OBJ, RED, GREEN, BLUE, BGCOLOR, OBJCOLOR, SND;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	PRG1 = new Uint8Array(ROM.buffer, 0x0, 0x8000).addBase();
	PRG2 = new Uint8Array(ROM.buffer, 0x8000, 0x2000).addBase();
	PRG3 = new Uint8Array(ROM.buffer, 0xa000, 0x8000).addBase();
	BG = new Uint8Array(ROM.buffer, 0x12000, 0x2000);
	OBJ = new Uint8Array(ROM.buffer, 0x14000, 0x4000);
	RED = new Uint8Array(ROM.buffer, 0x18000, 0x100);
	GREEN = new Uint8Array(ROM.buffer, 0x18100, 0x100);
	BLUE = new Uint8Array(ROM.buffer, 0x18200, 0x100);
	BGCOLOR = new Uint8Array(ROM.buffer, 0x18300, 0x100);
	OBJCOLOR = new Uint8Array(ROM.buffer, 0x18400, 0x200);
	SND = new Uint8Array(ROM.buffer, 0x18600, 0x100);
	game = new LibbleRabble();
	sound = new MappySound({SND});
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound});
}));

