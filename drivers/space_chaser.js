/*
 *
 *	Space Chaser
 *
 */

import {init} from '../libs/EMU.js/main.js';
import RomBootLoader from '../libs/RomBootLoader/RomBootLoader.js';
import I8080 from '../libs/EMU.js/devices/CPU/i8080.js';
let game, sound;

class SpaceChaser {
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
	nRank = 'EASY';

	ram = new Uint8Array(0x4000).addBase();
	io = new Uint8Array(0x100);
	cpu_irq = false;
	cpu_irq2 = false;

	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;
	shifter = {shift: 0, reg: 0};
	background_disable = false;
	background_select = false;

	cpu = new I8080(Math.floor(19968000 / 10));
	scanline = {rate: 256 * 60, frac: 0, count: 0, execute(rate, fn) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			fn(this.count = this.count + 1 & 255);
	}};

	constructor() {
		//SETUP CPU
		for (let i = 0; i < 0x20; i++)
			this.cpu.memorymap[i].base = PRG1.base[i];
		for (let i = 0; i < 8; i++)
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
			case 0x02:
				return void(this.shifter.shift = data & 7);
			case 0x03:
//				check_sound3(this, data);
				return this.background_disable = (data & 8) !== 0, void(this.background_select = (data & 0x10) !== 0);
			case 0x04:
				this.io[3] = data << this.shifter.shift | this.shifter.reg >> (8 - this.shifter.shift);
				return void(this.shifter.reg = data);
			case 0x05:
//				check_sound5(this, data);
				return;
			default:
				return void(this.io[addr] = data);
			}
		};

		this.cpu.check_interrupt = () => {
			if (this.cpu_irq && this.cpu.interrupt(0xd7)) //RST 10H
				return this.cpu_irq = false, true;
			if (this.cpu_irq2 && this.cpu.interrupt(0xcf)) //RST 08H
				return this.cpu_irq2 = false, true;
			return false;
		};
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
			switch (this.nRank) {
			case 'EASY':
				this.io[2] &= ~8;
				break;
			case 'HARD':
				this.io[2] |= 8;
				break;
			}
			this.fReset = true;
		}

		//RESET
		if (this.fReset) {
			this.fReset = false;
			this.cpu_irq = this.cpu_irq2 = false;
			this.ram.fill(0);
			this.cpu.reset();
		}
		return this;
	}

	updateInput() {
		this.io[1] = this.io[1] & ~0xe0 | !this.fCoin << 7 | !!this.fStart1P << 6 | !!this.fStart2P << 5;
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
		this.io[1] = this.io[1] & ~(1 << 0 | fDown << 2) | fDown << 0;
	}

	right(fDown) {
		this.io[1] = this.io[1] & ~(1 << 3 | fDown << 1) | fDown << 3;
	}

	down(fDown) {
		this.io[1] = this.io[1] & ~(1 << 2 | fDown << 0) | fDown << 2;
	}

	left(fDown) {
		this.io[1] = this.io[1] & ~(1 << 1 | fDown << 3) | fDown << 1;
	}

	triggerA(fDown) {
		this.io[1] = this.io[1] & ~(1 << 4) | fDown << 4;
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
				const color = rgb[this.ram[k & 0x1f9f | 0x2000] & 7];
				const map_data = MAP[k >> 3 & 0x3e0 | k & 0x1f] & 0x0c;
				const back = rgb[this.background_disable ? 0 : this.background_select && map_data === 0x0c ? 4 : 2];
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
 *	Space Invaders
 *
 */
const RBL = new RomBootLoader();

const RomSetInfo = [
	{
		// Mame name  'schaser'
		display_name: 'Space Chaser (set 1)',
		developer: 'Taito',
		year: '1979',
		Notes: '',

		archive_name: 'schaser',
		driver: SpaceChaser,
		mappings: [
		{
			name: 'MAP',
			roms: ['rt06.ic2'],
		},
		{
			name: 'PRG1',
			roms: ['rt13.bin', 'rt14.bin', 'rt15.bin', 'rt16.bin', 'rt17.bin', 'rt18.bin', 'rt19.bin', 'rt20.bin'],
		},
		{
			name: 'PRG2',
			roms: ['rt21.bin', 'rt22.bin'],
		},
		]
	},/*
	{
		// Mame name  'schasera'
		display_name: 'Space Chaser (set 2)',
		developer: 'Taito',
		year: '1979',
		Notes: 'TODO: Unsubported rom layout?',

		archive_name: 'schaser',
		driver: SpaceChaser,
		mappings: [
		{
			name: 'MAP',
			roms: ['rt06.ic2'],
		},
		{
			name: 'PRG1',
			roms: ['rt13.bin', 'rt15.bin', 'rt17.bin', 'rt19.bin', 'rt21.bin'],
		},
		]
	},*/
	{
		// Mame name  'schaserb'
		display_name: 'Space Chaser (set 3)',
		developer: 'Taito',
		year: '1979',
		Notes: '',

		archive_name: 'schaser',
		driver: SpaceChaser,
		mappings: [
		{
			name: 'MAP',
			roms: ['rt06.ic2'],
		},
		{
			name: 'PRG1',
			roms: ['rt33.bin', 'rt34.bin', 'rt35.bin', 'rt36.bin', 'rt37.bin'],
		},
		{
			name: 'PRG2',
			roms: ['rt37.bin'],
		},
		]
	},
	{
		// Mame name  'schaserc'
		display_name: 'Space Chaser (set 4)',
		developer: 'Taito',
		year: '1979',
		Notes: '',

		archive_name: 'schaser',
		driver: SpaceChaser,
		mappings: [
		{
			name: 'MAP',
			roms: ['rt06.ic2'],
		},
		{
			name: 'PRG1',
			roms: ['45.ic30', '46.ic36', 'rt15.bin', 'rt16.bin', 'rt17.bin', 'rt18.bin', 'rt19.bin', '47.ic39'],
		},
		{
			name: 'PRG2',
			roms: ['rt21.bin','rt22.bin'],
		},
		]
	},
	{
		// Mame name  'schasercv'
		display_name: 'Space Chaser (CV version - set 1)',
		developer: 'Taito',
		year: '1979',
		Notes: '',

		archive_name: 'schaser',
		driver: SpaceChaser,
		mappings: [
		{
			name: 'MAP',
			roms: ['cv01', 'cv02'],
		},
		{
			name: 'PRG1',
			roms: ['1', '2', '3', '4', '5', '6', '7', '8'],
		},
		{
			name: 'PRG2',
			roms: ['9', '10'],
		},
		]
	},
	{
		// Mame name  'schaserm'
		display_name: 'Space Chaser (Model Racing bootleg)',
		developer: 'bootleg (Model Racing)',
		year: '1979',
		Notes: '',

		archive_name: 'schaser',
		driver: SpaceChaser,
		mappings: [
		{
			name: 'MAP',
			roms: ['rt06.ic2'],
		},
		{
			name: 'PRG1',
			roms: ['mr26.71', 'rt08.70', 'rt09.69', 'mr27.62'],
		},
		{
			name: 'PRG2',
			roms: ['rt11.61'],
		},
		]
	},
	{
		// Mame name  'crashrd'
		display_name: 'Crash Road (bootleg of Space Chaser)',
		developer: 'bootleg (Centromatic)',
		year: '1979',
		Notes: '',

		archive_name: 'schaser',
		driver: SpaceChaser,
		mappings: [
		{
			name: 'MAP',
			roms: ['rt06.ic2'],
		},
		{
			name: 'PRG1',
			roms: ['2716-5m.bin', '2716-5n.bin', '2716-5p.bin', '2716-5r.bin'],
		},
		{
			name: 'PRG2',
			roms: ['2716-5s.bin'],
		},
		]
	},
]

let ROM_INDEX = RomSetInfo.length-1
console.log("TOTAL ROMSETS AVALIBLE: "+RomSetInfo.length)
console.log("GAME INDEX: "+(ROM_INDEX+1))

let PRG1, PRG2, MAP;
window.addEventListener('load', () =>
	RBL.Load_Rom(RomSetInfo[ROM_INDEX]).then((ROM) => {
		
		PRG1 = ROM["PRG1"].addBase();
		PRG2 = ROM["PRG2"].addBase();
		MAP  = ROM["MAP" ].addBase();
		
		
		game  = new ROM.settings.driver();
		sound = [];
		
		canvas.addEventListener('click', () => game.coin(true));
		init({game, sound});
		
	})
);

