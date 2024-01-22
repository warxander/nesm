import { Controller } from './jsnes/controller';
import { NES } from './jsnes/nes';

interface NesOptions {
	textureDict: string;
	textureName: string;
	targetFrameTime: number;
	areControlsVisible: boolean;
	sampleRate: number;
}

interface NesControl {
	id: number;
	controllerId: number;
	name: string;
	label: string;
}

class Nes {
	public static readonly SCREEN_WIDTH = 256;
	public static readonly SCREEN_HEIGHT = 240;

	private static readonly CONTROLS: NesControl[] = [
		{ id: 206, controllerId: Controller.BUTTON_B, name: '~INPUT_FRONTEND_RB~', label: 'B' },
		{ id: 205, controllerId: Controller.BUTTON_A, name: '~INPUT_FRONTEND_LB~', label: 'A' },
		{ id: 201, controllerId: Controller.BUTTON_SELECT, name: '~INPUT_FRONTEND_ACCEPT~', label: 'Select' },
		{ id: 199, controllerId: Controller.BUTTON_START, name: '~INPUT_FRONTEND_PAUSE~', label: 'Start' },
		{ id: 190, controllerId: Controller.BUTTON_RIGHT, name: '~INPUT_FRONTEND_RIGHT~', label: 'Right' },
		{ id: 189, controllerId: Controller.BUTTON_LEFT, name: '~INPUT_FRONTEND_LEFT~', label: 'Left' },
		{ id: 188, controllerId: Controller.BUTTON_UP, name: '~INPUT_FRONTEND_UP~', label: 'Up' },
		{ id: 187, controllerId: Controller.BUTTON_DOWN, name: '~INPUT_FRONTEND_DOWN~', label: 'Down' }
	];

	private readonly nes: NES;

	private frameBuffer: number[] = [];
	private tickHandler = -1;

	private frameTimer = -1;
	private timeSinceLastFrame = -1;

	private scaleform: number | undefined = undefined;

	constructor(private readonly texture: number, private readonly options: NesOptions) {
		this.nes = new NES({
			onFrame: this.onFrame.bind(this),
			sampleRate: this.options.sampleRate
		});
	}

	getTextureDict(): string {
		return this.options.textureDict;
	}

	getTextureName(): string {
		return this.options.textureName;
	}

	isRunning(): boolean {
		return this.tickHandler !== -1;
	}

	run(romBytes: number[]) {
		if (romBytes.length === 0) return;

		this.stop();

		let romData = new String();
		for (const byte of romBytes) romData += String.fromCharCode(byte);
		this.nes.loadROM(romData);

		this.tickHandler = setTick(this.onTick.bind(this));

		this.timeSinceLastFrame = 0;
		this.frameTimer = GetGameTimer();
	}

	stop() {
		if (!this.isRunning()) return;

		clearTick(this.tickHandler);
		this.tickHandler = -1;

		this.nes.reset();
	}

	private static drawInstructionalButton(scaleform: number, index: number, name: string, label: string) {
		PushScaleformMovieFunction(scaleform, 'SET_DATA_SLOT');
		PushScaleformMovieMethodParameterInt(index);
		PushScaleformMovieMethodParameterString(name);
		PushScaleformMovieMethodParameterString(label);
		PopScaleformMovieFunctionVoid();
	}

	private onFrame(buffer: number[]) {
		for (let i = 0; i < buffer.length; ++i) this.frameBuffer[i] = buffer[i];
	}

	private onTick() {
		const currentTimer = GetGameTimer();
		this.timeSinceLastFrame += currentTimer - this.frameTimer;
		this.frameTimer = currentTimer;

		this.processInput();

		while (this.timeSinceLastFrame >= this.options.targetFrameTime) {
			this.nes.frame();
			this.timeSinceLastFrame -= this.options.targetFrameTime;
		}

		const argbFrameBuffer = new Uint8Array(Nes.SCREEN_WIDTH * Nes.SCREEN_HEIGHT * 4);
		let i = 0;

		for (let y = 0; y < Nes.SCREEN_HEIGHT; ++y) {
			for (let x = 0; x < Nes.SCREEN_WIDTH; ++x) {
				const color = this.frameBuffer[y * Nes.SCREEN_WIDTH + x];
				argbFrameBuffer[i++] = (color >> 16) & 0xff;
				argbFrameBuffer[i++] = (color >> 8) & 0xff;
				argbFrameBuffer[i++] = color & 0xff;
				argbFrameBuffer[i++] = 255;
			}
		}

		if (!SetRuntimeTextureArgbData(this.texture, argbFrameBuffer as any, argbFrameBuffer.length))
			throw new Error('SetRuntimeTextureArgbData() failed');

		CommitRuntimeTexture(this.texture);

		if (this.options.areControlsVisible) this.showControls();
	}

	private processInput() {
		DisableAllControlActions(0);
		DisableAllControlActions(2);

		for (const control of Nes.CONTROLS) this.processKey(control.id, control.controllerId);
	}

	private processKey(id: number, controllerId: number) {
		if (IsDisabledControlPressed(2, id)) this.nes.buttonDown(1, controllerId);
		else this.nes.buttonUp(1, controllerId);
	}

	private showControls() {
		if (this.scaleform === undefined) this.scaleform = RequestScaleformMovie('INSTRUCTIONAL_BUTTONS');
		if (!HasScaleformMovieLoaded(this.scaleform)) return;

		PushScaleformMovieFunction(this.scaleform, 'CLEAR_ALL');
		PopScaleformMovieFunctionVoid();

		for (let i = 0; i < Nes.CONTROLS.length; ++i)
			Nes.drawInstructionalButton(this.scaleform, i, Nes.CONTROLS[i].name, Nes.CONTROLS[i].label);

		PushScaleformMovieFunction(this.scaleform, 'DRAW_INSTRUCTIONAL_BUTTONS');
		PopScaleformMovieFunctionVoid();

		DrawScaleformMovieFullscreen(this.scaleform, 255, 255, 255, 255, 0);
	}
}

let nes: Nes | undefined;
let isInitializing = false;

globalThis.exports('init', () => {
	if (isInitializing || nes !== undefined) return;

	isInitializing = true;

	RegisterNuiCallback('init', (options: NesOptions, callback: Function) => {
		const resourceName = GetCurrentResourceName();

		const txdName = GetResourceMetadata(resourceName, 'txd_name', 0);
		if (txdName.length === 0) throw new Error('txd_name must be an non-empty string');
		options.textureDict = txdName;

		const txnName = GetResourceMetadata(resourceName, 'txn_name', 0);
		if (txnName.length === 0) throw new Error('txn_name must be an non-empty string');
		options.textureName = txnName;

		const txd = CreateRuntimeTxd(txdName);
		if (txd <= 0) throw new Error('CreateRuntimeTxd() failed');

		const targetFps = parseInt(GetResourceMetadata(resourceName, 'target_fps', 0));
		if (targetFps <= 0) throw new Error('target_fps must be a positive integer');
		options.targetFrameTime = Math.floor(1000 / targetFps);

		options.areControlsVisible = GetResourceMetadata(resourceName, 'show_controls', 0) === 'true';

		const tx = CreateRuntimeTexture(txd, txnName, Nes.SCREEN_WIDTH, Nes.SCREEN_HEIGHT);
		if (tx <= 0) throw new Error('CreateRuntimeTexture() failed');

		nes = new Nes(tx, options);

		callback({ ok: true });
		isInitializing = false;
	});

	SendNUIMessage({ initRequest: true });
});

globalThis.exports('isReady', (): boolean => {
	return nes !== undefined;
});

globalThis.exports('getTextureDict', (): string => {
	return nes !== undefined ? nes.getTextureDict() : '';
});

globalThis.exports('getTextureName', (): string => {
	return nes !== undefined ? nes.getTextureName() : '';
});

globalThis.exports('isRunning', (): boolean => {
	return nes !== undefined && nes.isRunning();
});

globalThis.exports('run', (romBytes: number[]) => nes?.run(romBytes));
globalThis.exports('stop', () => nes?.stop());
