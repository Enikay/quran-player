// === CONTRATS DE DONNÉES ===
type Lang = 'en' | 'ar';
const SEEK_STEP = 5;

interface ReciterName {
	en: string;
	ar: string;
}

interface Reciter {
	path: string;
	name: ReciterName;
}

interface Track {
	index: number;
	url: string;
	isUnavailable?: boolean;
}

interface JsonData {
	suwar: Record<Lang, string[]>;
	reciters: Record<string, Reciter>;
}

// === MOTEUR AUDIO ===
class AudioEngine {
	app: QuranApp;
	audio: HTMLAudioElement;
	playlist: Track[] = [];
	reciter: Reciter | null = null;
	currentIndex: number = -1;
	repeatMode: number = 0; // 0: Off, 1: All, 2: One
	animationFrame: number = 0;
	speedIndex: number = 2;

	readonly SPEEDS: number[] = [0.5, 0.7, 1, 1.2, 1.5, 1.7, 2];

	constructor(app: QuranApp) {
		this.app = app;
		this.audio = document.getElementById("global-audio") as HTMLAudioElement;
		this.setupListeners();
	}

	setupListeners(): void {
		this.audio.addEventListener("play", () => {
			this.app.ui.updatePlayState(true);
			this.startProgressLoop();
			this.updateMediaSessionPosition();
		});
		
		this.audio.addEventListener("pause", () => {
			this.app.ui.updatePlayState(false);
			this.stopProgressLoop();
		});
		
		this.audio.addEventListener("ended", () => {
			if (this.repeatMode === 2) {
				this.audio.currentTime = 0;
				this.audio.play();
				return;
			}
			if (this.repeatMode === 0 && this.currentIndex === this.playlist.length - 1) {
				this.stop();
				return;
			}
			this.playNext();
		});

		this.audio.addEventListener("loadedmetadata", () => this.updateMediaSessionPosition());
		this.audio.addEventListener("seeked", () => this.updateMediaSessionPosition());
		this.audio.addEventListener("ratechange", () => this.updateMediaSessionPosition());

		this.audio.addEventListener("error", () => {
			const currentTrack = this.playlist[this.currentIndex];
			if (this.currentIndex > -1 && currentTrack) {
				currentTrack.isUnavailable = true;
				
				const div = document.querySelector(`.surah[data-index="${this.currentIndex}"]`);
				if (div) div.classList.add("unavailable");
				
				this.playNext();
			}
		});
	}

	startProgressLoop(): void {
		const loop = () => {
			this.app.ui.updateProgress(this.audio.currentTime, this.audio.duration);
			this.animationFrame = requestAnimationFrame(loop);
		};
		this.animationFrame = requestAnimationFrame(loop);
	}

	stopProgressLoop(): void {
		cancelAnimationFrame(this.animationFrame);
	}

	play(index: number, reciter: Reciter | null = this.reciter, playlist: Track[] = this.playlist): void {
		this.reciter = reciter;
		this.playlist = playlist;
		this.currentIndex = index;

		const track = this.playlist[this.currentIndex];
		if (!track) return;

		this.audio.src = track.url;
		this.audio.play();

		this.app.ui.showPlayer();
		this.app.ui.updateDownloadLink(track.url);
		this.app.ui.highlightPlayingSurah(this.currentIndex, this.reciter);
		this.app.ui.updatePlayerTitle();
		
		this.updateMediaSession();
	}

	stop(): void {
		this.audio.pause();
		this.audio.currentTime = 0;
		this.currentIndex = -1;
		this.app.ui.hidePlayer();
		this.app.ui.highlightPlayingSurah(-1, null);
		
		if ('mediaSession' in navigator) {
			navigator.mediaSession.metadata = null;
			navigator.mediaSession.playbackState = 'none';
		}
	}

	playNext(): void {
		if (!this.playlist.length) return;
		
		let attempts = 0;
		let nextIndex = this.currentIndex;
		
		do {
			nextIndex = (nextIndex + 1) % this.playlist.length;
			attempts++;
		} while (this.playlist[nextIndex]?.isUnavailable && attempts < this.playlist.length);
		
		if (attempts < this.playlist.length) {
			this.play(nextIndex);
		}
	}

	playPrev(): void {
		if (!this.playlist.length) return;
		
		let attempts = 0;
		let prevIndex = this.currentIndex;
		
		do {
			prevIndex = prevIndex - 1 < 0 ? this.playlist.length - 1 : prevIndex - 1;
			attempts++;
		} while (this.playlist[prevIndex]?.isUnavailable && attempts < this.playlist.length);
		
		if (attempts < this.playlist.length) {
			this.play(prevIndex);
		}
	}

	seek(seconds: number): void {
		if (isNaN(this.audio.duration)) return;
		this.audio.currentTime = seconds;
	}

	seekRelative(offset: number): void {
		if (isNaN(this.audio.duration)) return;
		this.audio.currentTime = Math.max(0, Math.min(this.audio.duration, this.audio.currentTime + offset));
	}

	setVolume(value: number): void { 
		this.audio.volume = value;
		if (this.audio.muted && value > 0) {
			this.audio.muted = false;
		}
	}

	toggleMute(): boolean {
		this.audio.muted = !this.audio.muted;
		return this.audio.muted;
	}
	
	setSpeed(value: number): void { 
		this.audio.playbackRate = value; 
	}
	
	togglePlay(): void { 
		this.audio.paused ? this.audio.play() : this.audio.pause(); 
	}
	
	toggleRepeat(): number {
		this.repeatMode = (this.repeatMode + 1) % 3;
		return this.repeatMode;
	}
	
	toggleSpeed(): number {
		this.speedIndex = (this.speedIndex + 1) % this.SPEEDS.length;
		this.audio.playbackRate = this.SPEEDS[this.speedIndex]!;
		return this.audio.playbackRate;
	}

	updateMediaSessionPosition(): void {
		if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
			if (!isNaN(this.audio.duration) && this.audio.duration > 0) {
				navigator.mediaSession.setPositionState({
					duration: this.audio.duration,
					playbackRate: this.audio.playbackRate,
					position: Math.min(this.audio.currentTime, this.audio.duration)
				});
			}
		}
	}

	updateMediaSession(): void {
		if (!('mediaSession' in navigator) || !this.reciter) return;

		const title = this.app.suwarData[this.app.lang][this.currentIndex] || "Inconnu";
		
		navigator.mediaSession.playbackState = 'playing';
		navigator.mediaSession.metadata = new MediaMetadata({
			title: title,
			artist: this.reciter.name[this.app.lang],
			album: 'Quran Player',
			artwork: [{ src: 'icon.png', sizes: '512x512', type: 'image/png' }]
		});

		navigator.mediaSession.setActionHandler('play', () => this.audio.play());
		navigator.mediaSession.setActionHandler('pause', () => this.audio.pause());
		navigator.mediaSession.setActionHandler('previoustrack', () => this.playPrev());
		navigator.mediaSession.setActionHandler('nexttrack', () => this.playNext());
		//navigator.mediaSession.setActionHandler('seekbackward', () => this.seekRelative(-SEEK_STEP));
		//navigator.mediaSession.setActionHandler('seekforward', () => this.seekRelative(SEEK_STEP));
		navigator.mediaSession.setActionHandler('seekto', (details) => {
			if (details.seekTime !== undefined) {
				this.seek(details.seekTime);
			}
		});
	}
}

// === CONTRÔLEUR INTERFACE ===
class UIController {
	app: QuranApp;
	showRemainingTime: boolean = false;
	isDragging: boolean = false;

	// Déclaration stricte des éléments du DOM
	sidebar!: HTMLElement;
	burgerBtn!: HTMLButtonElement;
	langBtn!: HTMLButtonElement;
	recitersList!: HTMLUListElement;
	suwarList!: HTMLDivElement;
	reciterTitle!: HTMLHeadingElement;

	playerBar!: HTMLDivElement;
	btnRepeat!: HTMLButtonElement;
	btnPlay!: HTMLButtonElement;
	btnPrev!: HTMLButtonElement;
	btnNext!: HTMLButtonElement;
	btnRewind!: HTMLButtonElement;
	btnForward!: HTMLButtonElement;
	btnStop!: HTMLButtonElement;
	seekBar!: HTMLInputElement;
	volumeBar!: HTMLInputElement;
	btnSpeed!: HTMLButtonElement;
	timeCurrent!: HTMLSpanElement;
	timeTotal!: HTMLSpanElement;
	playerTitle!: HTMLSpanElement;
	btnDownload!: HTMLAnchorElement;
	btnMute!: HTMLButtonElement;

	readonly REPEAT_ICONS = ["repeat_off.svg", "repeat_all.svg", "repeat_one.svg"];

	constructor(app: QuranApp) {
		this.app = app;
		this.bindElements();
		this.setupEvents();
	}

	bindElements(): void {
		this.sidebar = document.getElementById("sidebar") as HTMLElement;
		this.burgerBtn = document.getElementById("burger-btn") as HTMLButtonElement;
		this.langBtn = document.getElementById("lang-switch") as HTMLButtonElement;
		this.recitersList = document.getElementById("reciters-list") as HTMLUListElement;
		this.suwarList = document.getElementById("suwar-list") as HTMLDivElement;
		this.reciterTitle = document.getElementById("reciter-name") as HTMLHeadingElement;

		this.playerBar = document.getElementById('player-bar') as HTMLDivElement;
		this.btnRepeat = document.getElementById("btn-repeat") as HTMLButtonElement;
		this.btnPlay = document.getElementById("btn-play") as HTMLButtonElement;
		this.btnPrev = document.getElementById("btn-prev") as HTMLButtonElement;
		this.btnNext = document.getElementById("btn-next") as HTMLButtonElement;
		this.btnRewind = document.getElementById("btn-rewind") as HTMLButtonElement;
		this.btnForward = document.getElementById("btn-forward") as HTMLButtonElement;
		this.btnStop = document.getElementById('btn-stop') as HTMLButtonElement;
		this.seekBar = document.getElementById("seek-bar") as HTMLInputElement;
		this.volumeBar = document.getElementById("volume-bar") as HTMLInputElement;
		this.btnSpeed = document.getElementById("btn-speed") as HTMLButtonElement;
		this.timeCurrent = document.getElementById("time-current") as HTMLSpanElement;
		this.timeTotal = document.getElementById("time-total") as HTMLSpanElement;
		this.playerTitle = document.getElementById("player-title") as HTMLSpanElement;
		this.btnDownload = document.getElementById("btn-download") as HTMLAnchorElement;
		this.btnMute = document.getElementById("btn-mute") as HTMLButtonElement;
	}

	setupEvents(): void {
		this.burgerBtn.addEventListener("click", () => this.sidebar.classList.toggle("pinned"));
		this.burgerBtn.addEventListener("mouseenter", () => {
			if (window.innerWidth > 768) this.sidebar.classList.add("open");
		});
		this.sidebar.addEventListener("mouseleave", () => {
			if (window.innerWidth > 768) this.sidebar.classList.remove("open");
		});

		this.langBtn.addEventListener("click", () => this.app.toggleLang());

		this.btnPlay.addEventListener("click", () => this.app.audio.togglePlay());
		this.btnStop.addEventListener("click", () => this.app.audio.stop());
		this.btnPrev.addEventListener("click", () => this.app.audio.playPrev());
		this.btnNext.addEventListener("click", () => this.app.audio.playNext());
		this.btnRewind.addEventListener("click", () => this.app.audio.seekRelative(-SEEK_STEP));
		this.btnForward.addEventListener("click", () => this.app.audio.seekRelative(SEEK_STEP));
		
		this.btnRepeat.addEventListener("click", () => {
			const mode = this.app.audio.toggleRepeat();
			const img = this.btnRepeat.querySelector("img") as HTMLImageElement;
			if (img) img.src = `icons/${this.REPEAT_ICONS[mode]}`;
		});

		this.timeTotal.addEventListener("click", () => {
			this.showRemainingTime = !this.showRemainingTime;
			this.updateProgress(this.app.audio.audio.currentTime, this.app.audio.audio.duration);
		});

		this.seekBar.addEventListener("mousedown", () => this.isDragging = true);
		this.seekBar.addEventListener("touchstart", () => this.isDragging = true, { passive: true });
		this.seekBar.addEventListener("mouseup", () => this.isDragging = false);
		this.seekBar.addEventListener("touchend", () => this.isDragging = false);

		this.seekBar.addEventListener("input", (e: Event) => {
			const target = e.target as HTMLInputElement;
			const duration = this.app.audio.audio.duration;
			if (!isNaN(duration)) {
				this.app.audio.seek((parseFloat(target.value) / 100) * duration);
				this.timeCurrent.textContent = this.formatTime(this.app.audio.audio.currentTime);
			}
		});

		this.btnMute.addEventListener("click", () => {
			const isMuted = this.app.audio.toggleMute();
			this.updateVolumeIcon(this.app.audio.audio.volume, isMuted);
		});

		this.volumeBar.addEventListener("input", (e: Event) => {
			const target = e.target as HTMLInputElement;
			const vol = parseFloat(target.value);
			this.app.audio.setVolume(vol);
			this.updateVolumeIcon(vol, this.app.audio.audio.muted);
		});

		this.btnSpeed.addEventListener("click", () => {
			const newSpeed = this.app.audio.toggleSpeed();
			const speedStr = newSpeed.toString().replace('.', '_') + "x";
			
			const img = this.btnSpeed.querySelector("img") as HTMLImageElement;
			if (img) img.src = `icons/speed_${speedStr}.svg`;
		});

		document.addEventListener("click", (e: Event) => {
			if (window.innerWidth > 768) return;

			const target = e.target as HTMLElement;
			const isMenuOpen = this.sidebar?.classList.contains("pinned") || this.sidebar?.classList.contains("open");

			if (!isMenuOpen) return;

			const clickedInsideSidebar = this.sidebar?.contains(target);
			const clickedInsideTopbar = target.closest("#topbar");
			const clickedBurger = this.burgerBtn?.contains(target);

			if (!clickedInsideSidebar && !clickedInsideTopbar && !clickedBurger) {
				this.closeSidebarOnMobile();
			}
		});
	}

	renderReciters(recitersData: Record<string, Reciter>): void {
		this.recitersList.innerHTML = "";
		for (const [key, reciter] of Object.entries(recitersData)) {
			const li = document.createElement("li");
			li.dataset.key = key;
			li.textContent = reciter.name[this.app.lang];

			if (!reciter.path) {
				li.classList.add("unavailable");
			} else {
				li.onclick = () => this.app.selectReciter(li, reciter);
			}
			
			this.recitersList.appendChild(li);
		}
	}

	renderSuwar(reciter: Reciter, suwarListNames: string[], activePlaylist: Track[]): void {
		this.reciterTitle.textContent = reciter.name[this.app.lang];
		this.suwarList.innerHTML = "";

		suwarListNames.forEach((_, index) => {
			const track = activePlaylist[index];
			if (!track) return;

			const div = document.createElement("div");
			div.className = "surah";
			div.dataset.index = index.toString();
			div.onclick = () => this.app.audio.play(index, reciter, activePlaylist);

			const idSpan = document.createElement("span");
			idSpan.className = "surah-id";
			
			const nameSpan = document.createElement("span");
			nameSpan.className = "surah-name";
			
			const statusSpan = document.createElement("span");
			statusSpan.className = "surah-status";

			const durationSpan = document.createElement("span");
			durationSpan.className = "surah-duration";

			const hiddenAudio = document.createElement("audio");
			hiddenAudio.className = "hidden-audio";
			hiddenAudio.preload = "metadata";
			hiddenAudio.src = track.url;
			
			hiddenAudio.addEventListener("loadedmetadata", () => {
				durationSpan.textContent = this.formatTime(hiddenAudio.duration);
			});
			
			hiddenAudio.onerror = () => {
				div.classList.add("unavailable");
				track.isUnavailable = true;
			}

			div.append(idSpan, nameSpan, statusSpan, durationSpan, hiddenAudio);
			
			if (this.app.audio.reciter === reciter && this.app.audio.currentIndex === index) {
				div.classList.add("playing");
			}
			
			this.suwarList.appendChild(div);
		});

		this.updateTexts();
	}

	updateTexts(): void {
		const isAr = this.app.lang === 'ar';
		document.documentElement.dir = isAr ? 'rtl' : 'ltr';

		if (this.app.activeReciter) {
			this.reciterTitle.textContent = this.app.activeReciter.name[this.app.lang];
		}

		document.querySelectorAll("#reciters-list li").forEach(el => {
			const li = el as HTMLLIElement;
			const key = li.dataset.key;
			if (key && this.app.recitersData[key]) {
				li.textContent = this.app.recitersData[key].name[this.app.lang];
			}
		});

		document.querySelectorAll(".surah").forEach(el => {
			const div = el as HTMLDivElement;
			const index = parseInt(div.dataset.index || "0", 10);
			
			const idSpan = div.querySelector(".surah-id");
			const nameSpan = div.querySelector(".surah-name");

			if (idSpan) {
				idSpan.textContent = this.app.lang === 'ar' 
					? new Intl.NumberFormat('ar-SA').format(index + 1) + '.'
					: (index + 1) + '.';
			}
			
			if (nameSpan) {
				nameSpan.textContent = this.app.suwarData[this.app.lang][index] || "";
			}
		});

		this.updatePlayerTitle();

		const imgPrev = this.btnPrev.querySelector("img") as HTMLImageElement;
		if (imgPrev) imgPrev.src = isAr ? "icons/skip_right.svg" : "icons/skip_left.svg";

		const imgNext = this.btnNext.querySelector("img") as HTMLImageElement;
		if (imgNext) imgNext.src = isAr ? "icons/skip_left.svg" : "icons/skip_right.svg";

		const imgRewind = this.btnRewind.querySelector("img") as HTMLImageElement;
		if (imgRewind) imgRewind.src = isAr ? "icons/seek_right.svg" : "icons/seek_left.svg";

		const imgForward = this.btnForward.querySelector("img") as HTMLImageElement;
		if (imgForward) imgForward.src = isAr ? "icons/seek_left.svg" : "icons/seek_right.svg";
	}

	updatePlayerTitle(): void {
		if (!this.app.audio.reciter || this.app.audio.currentIndex === -1) return;
		const title = this.app.suwarData[this.app.lang][this.app.audio.currentIndex];
		const reciterName = this.app.audio.reciter.name[this.app.lang];
		this.playerTitle.textContent = `${title} - ${reciterName}`;
	}

	highlightPlayingSurah(index: number, playingReciter: Reciter | null): void {
		document.querySelectorAll(".surah").forEach(div => div.classList.remove("playing"));
		if (this.app.activeReciter === playingReciter && index !== -1) {
			const activeDiv = document.querySelector(`.surah[data-index="${index}"]`);
			if (activeDiv) activeDiv.classList.add("playing");
		}
	}

	updatePlayState(isPlaying: boolean): void {
		const img = this.btnPlay.querySelector("img") as HTMLImageElement;
		if (img) img.src = isPlaying ? "icons/pause.svg" : "icons/play.svg";
	}

	updateProgress(current: number, duration: number): void {
		if (isNaN(duration) || this.isDragging) return;
		
		this.seekBar.value = ((current / duration) * 100).toString();
		this.timeCurrent.textContent = this.formatTime(current);
		this.timeTotal.textContent = this.showRemainingTime 
			? "-" + this.formatTime(duration - current) 
			: this.formatTime(duration);
	}

	showPlayer(): void { 
		this.playerBar.style.display = 'grid';
		requestAnimationFrame(() => {
			const playerHeight = this.playerBar.offsetHeight;
			document.documentElement.style.setProperty('--player-height', `${playerHeight}px`);
		});
	}
	
	hidePlayer(): void { 
		this.playerBar.style.display = 'none';
		document.documentElement.style.setProperty('--player-height', `0px`);
	}
	
	updateDownloadLink(url: string): void { 
		this.btnDownload.href = url; 
	}
	
	updateVolumeIcon(volume: number, isMuted: boolean): void {
		const img = this.btnMute.querySelector("img") as HTMLImageElement;
		if (!img) return;

		if (isMuted) {
			img.src = "icons/mute.svg";
		} else if (volume === 0) {
			img.src = "icons/volume_off.svg";
		} else if (volume < 0.4) {
			img.src = "icons/volume_down.svg";
		} else {
			img.src = "icons/volume_up.svg";
		}
	}
	
	closeSidebarOnMobile(): void {
		if (window.innerWidth <= 768) this.sidebar.classList.remove("pinned", "open");
	}

	formatTime(seconds: number): string {
		if (isNaN(seconds)) return "00:00";
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
		const s = Math.floor(seconds % 60).toString().padStart(2, '0');
		return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
	}
}

// === ORCHESTRATEUR ===
class QuranApp {
	lang: Lang = 'en';
	suwarData: Record<Lang, string[]> = { en: [], ar: [] };
	recitersData: Record<string, Reciter> = {};
	activeReciter: Reciter | null = null;
	
	audio: AudioEngine;
	ui: UIController;

	constructor() {
		this.audio = new AudioEngine(this);
		this.ui = new UIController(this);
	}

	async init(): Promise<void> {
		try {
			const response = await fetch("data.json");
			const data: JsonData = await response.json();
			this.suwarData = data.suwar;
			this.recitersData = data.reciters;
			this.ui.renderReciters(this.recitersData);
		} catch (e) {
			console.error("Error loading JSON data :", e);
		}
	}

	toggleLang(): void {
		this.lang = this.lang === 'en' ? 'ar' : 'en';
		this.ui.updateTexts();
		this.audio.updateMediaSession();
	}

	selectReciter(liElement: HTMLLIElement, reciter: Reciter): void {
		document.querySelectorAll("#reciters-list li").forEach(el => el.classList.remove("active"));
		liElement.classList.add("active");
		this.ui.closeSidebarOnMobile();
		
		this.activeReciter = reciter;
		const playlist: Track[] = this.suwarData.en.map((_, i) => ({
			index: i,
			url: `${reciter.path}/${String(i + 1).padStart(3, '0')}.mp3`
		}));
		
		this.ui.renderSuwar(reciter, this.suwarData.en, playlist);
	}
}

document.addEventListener("DOMContentLoaded", () => {
	const app = new QuranApp();
	app.init();
});