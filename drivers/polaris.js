/*
 *
 *	Polaris
 *
 * 
 * - polariso doesnt boot.
 * 
 */

import {init} from '../libs/EMU.js/main.js';
import RomBootLoader from '../libs/RomBootLoader/RomBootLoader.js';
import I8080 from '../libs/EMU.js/devices/CPU/i8080.js';
let game, sound;

class Polaris {
	cxScreen = 224;
	cyScreen = 256;
	width = 256;
	height = 256;
	xOffset = 0;
	yOffset = 0;
	rotate = 0;

	fReset = false;
	fDIPSwitchChanged = true;
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;
	nStock = 3;

	ram = new Uint8Array(0x4000).addBase();
	io = new Uint8Array(0x100);
	cpu_irq = false;
	cpu_irq2 = false;

	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;
	shifter = {shift: 0, reg: 0};

	cpu = new I8080(Math.floor(19968000 / 10));
	scanline = {rate: 256 * 60, frac: 0, count: 0, execute(rate, fn) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			fn(this.count = this.count + 1 & 255);
	}};

	constructor() {
		//SETUP CPU
		for (let i = 0; i < 0x20; i++)
			this.cpu.memorymap[i].base = PRG1.base[i];
		for (let i = 0; i < 0x18; i++)
			this.cpu.memorymap[0x40 + i].base = PRG2.base[i];
		for (let i = 0; i < 0x20; i++) {
			this.cpu.memorymap[0x20 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x20 + i].write = null;
		}
		for (let i = 0; i < 0x20; i++) {
			this.cpu.memorymap[0xc0 + i].base = this.ram.base[0x20 + i];
			this.cpu.memorymap[0xc0 + i].write = (addr, data) => { this.ram[0x2000 | addr & 0x1f9f] = data; };
		}
		this.cpu.iomap.base = this.io;
		this.cpu.iomap.write = (addr, data) => {
			switch (addr) {
			case 0x00:
				return void(this.shifter.shift = data & 7);
			case 0x03:
				this.io[3] = data << this.shifter.shift | this.shifter.reg >> (8 - this.shifter.shift);
				return void(this.shifter.reg = data);
			default:
//				this.io[addr] = data;
				return;
			}
		};

		this.cpu.check_interrupt = () => {
			if (this.cpu_irq && this.cpu.interrupt(0xd7)) //RST 10H
				return this.cpu_irq = false, true;
			if (this.cpu_irq2 && this.cpu.interrupt(0xcf)) //RST 08H
				return this.cpu_irq2 = false, true;
			return false;
		};

		//DIPSW SETUP
		this.io[1] = 1;
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.scanline.execute(tick_rate, (vpos) => { vpos === 96 && (this.cpu_irq2 = true), vpos === 224 && (update(), this.cpu_irq = true); });
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
			switch (this.nStock) {
			case 3:
				this.io[2] &= ~3;
				break;
			case 4:
				this.io[2] = this.io[2] & ~3 | 1;
				break;
			case 5:
				this.io[2] = this.io[2] & ~3 | 2;
				break;
			case 6:
				this.io[2] |= 3;
				break;
			}
			this.fReset = true;
		}

		//RESET
		if (this.fReset) {
			this.fReset = false;
			this.cpu_irq = this.cpu_irq2 = false;
			this.ram.fill(0, 0, 0x2000);
			this.cpu.reset();
		}
		return this;
	}

	updateInput() {
		this.io[1] = this.io[1] & ~7 | !this.fCoin << 0 | !!this.fStart1P << 2 | !!this.fStart2P << 1;
		this.fCoin -= !!this.fCoin, this.fStart1P -= !!this.fStart1P, this.fStart2P -= !!this.fStart2P;
		return this;
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
		this.io[1] = this.io[1] & ~(1 << 7 | fDown << 5) | fDown << 7;
	}

	right(fDown) {
		this.io[1] = this.io[1] & ~(1 << 4 | fDown << 6) | fDown << 4;
	}

	down(fDown) {
		this.io[1] = this.io[1] & ~(1 << 5 | fDown << 7) | fDown << 5;
	}

	left(fDown) {
		this.io[1] = this.io[1] & ~(1 << 6 | fDown << 4) | fDown << 6;
	}

	triggerA(fDown) {
		this.io[1] = this.io[1] & ~(1 << 3) | fDown << 3;
	}

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		const rgb = Int32Array.of(
			0xff000000, //black
			0xff0000ff, //red
			0xffff0000, //blue
			0xffff00ff, //magenta
			0xff00ff00, //green
			0xff00ffff, //yellow
			0xffffff00, //cyan
			0xffffffff, //white
		);

		for (let p = 256 * 8 * 31, k = 0x0400, i = 256 >> 3; i !== 0; --i) {
			for (let j = 224 >> 2; j !== 0; k += 0x80, p += 4, --j) {
				const color = rgb[~this.ram[k & 0x1f9f | 0x2000] & 7];
				const back = rgb[MAP[k >> 3 & 0x3e0 | k & 0x1f] & 1 ? 6 : 2];
				let a = this.ram[k];
				this.bitmap[p + 7 * 256] = a & 1 ? color : back;
				this.bitmap[p + 6 * 256] = a & 2 ? color : back;
				this.bitmap[p + 5 * 256] = a & 4 ? color : back;
				this.bitmap[p + 4 * 256] = a & 8 ? color : back;
				this.bitmap[p + 3 * 256] = a & 0x10 ? color : back;
				this.bitmap[p + 2 * 256] = a & 0x20 ? color : back;
				this.bitmap[p + 256] = a & 0x40 ? color : back;
				this.bitmap[p] = a & 0x80 ? color : back;
				a = this.ram[k + 0x20];
				this.bitmap[p + 1 + 7 * 256] = a & 1 ? color : back;
				this.bitmap[p + 1 + 6 * 256] = a & 2 ? color : back;
				this.bitmap[p + 1 + 5 * 256] = a & 4 ? color : back;
				this.bitmap[p + 1 + 4 * 256] = a & 8 ? color : back;
				this.bitmap[p + 1 + 3 * 256] = a & 0x10 ? color : back;
				this.bitmap[p + 1 + 2 * 256] = a & 0x20 ? color : back;
				this.bitmap[p + 1 + 256] = a & 0x40 ? color : back;
				this.bitmap[p + 1] = a & 0x80 ? color : back;
				a = this.ram[k + 0x40];
				this.bitmap[p + 2 + 7 * 256] = a & 1 ? color : back;
				this.bitmap[p + 2 + 6 * 256] = a & 2 ? color : back;
				this.bitmap[p + 2 + 5 * 256] = a & 4 ? color : back;
				this.bitmap[p + 2 + 4 * 256] = a & 8 ? color : back;
				this.bitmap[p + 2 + 3 * 256] = a & 0x10 ? color : back;
				this.bitmap[p + 2 + 2 * 256] = a & 0x20 ? color : back;
				this.bitmap[p + 2 + 256] = a & 0x40 ? color : back;
				this.bitmap[p + 2] = a & 0x80 ? color : back;
				a = this.ram[k + 0x60];
				this.bitmap[p + 3 + 7 * 256] = a & 1 ? color : back;
				this.bitmap[p + 3 + 6 * 256] = a & 2 ? color : back;
				this.bitmap[p + 3 + 5 * 256] = a & 4 ? color : back;
				this.bitmap[p + 3 + 4 * 256] = a & 8 ? color : back;
				this.bitmap[p + 3 + 3 * 256] = a & 0x10 ? color : back;
				this.bitmap[p + 3 + 2 * 256] = a & 0x20 ? color : back;
				this.bitmap[p + 3 + 256] = a & 0x40 ? color : back;
				this.bitmap[p + 3] = a & 0x80 ? color : back;
			}
			k -= 0x20 * 224 - 1;
			p -= 224 + 256 * 8;
		}

		return this.bitmap;
	}
}

/*
 *
 *	Polaris
 *
 */
 


const RBL = new RomBootLoader();

const RomSetInfo = [
	{
		// Mame name  'polaris'
		display_name: 'Polaris (latest version)',
		developer: 'Taito',
		year: '1980',
		Notes: '',

		archive_name: 'polaris',
		driver: Polaris,
		mappings: [
		{
			name: 'MAP',
			roms: ['ps08.1b'],
		},
		{
			name: 'PRG1',
			roms: ['ps01-1.30', 'ps02.36', 'ps03-1.31', 'ps04.37'],
		},
		{
			name: 'PRG2',
			roms: ['ps05.32', 'ps06.38', 'ps26'],
		},
		{
			name: 'OBJ',
			roms: ['ps07.2c'],
		},
		]
	},
	
	
	{
		// Mame name  'polarisa'
		display_name: 'Polaris (second revision)',
		developer: 'Taito',
		year: '1980',
		Notes: '',

		archive_name: 'polaris',
		driver: Polaris,
		mappings: [
		{
			name: 'MAP',
			roms: ['ps08.1b'],
		},
		{
			name: 'PRG1',
			roms: ['ps01-1.30', 'ps02.36', 'ps03.31', 'ps04.37'],
		},
		{
			name: 'PRG2',
			roms: ['ps05.32', 'ps06.38', 'ps26'],
		},
		{
			name: 'OBJ',
			roms: ['ps07.2c'],
		},
		]
	},
	{
		// Mame name  'polarisb'
		display_name: 'Polaris (first revision)',
		developer: 'Taito',
		year: '1980',
		Notes: '',

		archive_name: 'polaris',
		driver: Polaris,
		mappings: [
		{
			name: 'MAP',
			roms: ['ps08.1b'],
		},
		{
			name: 'PRG1',
			roms: ['ps01.30', 'ps02.36', 'ps03.31', 'ps04.37'],
		},
		{
			name: 'PRG2',
			roms: ['ps05.32', 'ps06.38'],
		},
		{
			name: 'OBJ',
			roms: ['ps07.2c'],
		},
		]
	},
	{
		// Mame name  'polariso'
		display_name: 'Polaris (original version)',
		developer: 'Taito',
		year: '1980',
		Notes: 'TODO: Doesnt boot. (romsets likely wrong)',

		archive_name: 'polaris',
		driver: Polaris,
		mappings: [
		{
			name: 'MAP',
			roms: ['ps08.1b'],
		},
		{
			name: 'PRG1',
			roms: ['ps01-1.30', 'ps02.36', 'ps03.31' ],
		},
		{
			name: 'PRG2',
			roms: ['ps04.37','ps05.32', 'ps06.38'],
		},
		{
			name: 'OBJ',
			roms: ['ps07.2c'],
		},
		]
	},
	{
		// Mame name  'polarisbr'
		display_name: 'Polaris (Brazil)',
		developer: 'Taito do Brasil',
		year: '1981',
		Notes: '',

		archive_name: 'polaris',
		driver: Polaris,
		mappings: [
		{
			name: 'MAP',
			roms: ['ps08.1b'],
		},
		{
			name: 'PRG1',
			roms: ['1', 'ps02.36', '3', 'ps04.37'],
		},
		{
			name: 'PRG2',
			roms: ['5', 'ps06.38', '7'],
		},
		{
			name: 'OBJ',
			roms: ['ps07.2c'],
		},
		]
	},
]


let ROM_INDEX = RomSetInfo.length-1
console.log("TOTAL ROMSETS AVALIBLE: "+RomSetInfo.length)
console.log("GAME INDEX: "+(ROM_INDEX+1))

let PRG1, PRG2, MAP, OBJ;
window.addEventListener('load', () =>
	RBL.Load_Rom(RomSetInfo[ROM_INDEX]).then((ROM) => {
		
		PRG1 = ROM["PRG1"].addBase();
		PRG2 = ROM["PRG2"].addBase();
		MAP  = ROM["MAP" ].addBase();
		OBJ  = ROM["OBJ" ].addBase(); // unused in emulation
		
		
		game  = new ROM.settings.driver();
		sound = [];
		
		canvas.addEventListener('click', () => game.coin(true));
		init({game, sound});
		
	})
);

