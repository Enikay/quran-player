class AudioEngine {
	constructor(app) {
		this.app = app;
		this.audio = document.getElementById("global-audio");
		
		this.playlist = [];
		this.reciter = null;
		this.currentIndex = -1;
		this.repeatMode = 0; // 0: Off, 1: All, 2: One
		
		this.setupListeners();
	}

	setupListeners() {
		this.audio.addEventListener("play", () => {
			this.app.ui.updatePlayState(true);
			this.startProgressLoop();
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
	}

	startProgressLoop() {
		const loop = () => {
			this.app.ui.updateProgress(this.audio.currentTime, this.audio.duration);
			this.animationFrame = requestAnimationFrame(loop);
		};
		this.animationFrame = requestAnimationFrame(loop);
	}

	stopProgressLoop() {
		cancelAnimationFrame(this.animationFrame);
	}

	play(index, reciter = this.reciter, playlist = this.playlist) {
		this.reciter = reciter;
		this.playlist = playlist;
		this.currentIndex = index;

		const track = this.playlist[this.currentIndex];
		this.audio.src = track.url;
		this.audio.play();

		this.app.ui.showPlayer();
		this.app.ui.updateDownloadLink(track.url);
		this.app.ui.highlightPlayingSurah(this.currentIndex, this.reciter);
		this.app.ui.updatePlayerTitle();
		
		this.updateMediaSession();
	}

	stop() {
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

	playNext() {
		if (!this.playlist.length) return;
		let nextIndex = (this.currentIndex + 1) % this.playlist.length;
		this.play(nextIndex);
	}

	playPrev() {
		if (!this.playlist.length) return;
		let prevIndex = this.currentIndex - 1;
		if (prevIndex < 0) prevIndex = this.playlist.length - 1;
		this.play(prevIndex);
	}

	seek(seconds) {
		if (isNaN(this.audio.duration)) return;
		this.audio.currentTime = seconds;
	}

	seekRelative(offset) {
		if (isNaN(this.audio.duration)) return;
		this.audio.currentTime = Math.max(0, Math.min(this.audio.duration, this.audio.currentTime + offset));
	}

	setVolume(value) { this.audio.volume = value; }
	setSpeed(value) { this.audio.playbackRate = value; }
	togglePlay() { this.audio.paused ? this.audio.play() : this.audio.pause(); }
	
	toggleRepeat() {
		this.repeatMode = (this.repeatMode + 1) % 3;
		return this.repeatMode;
	}

	updateMediaSession() {
		if (!('mediaSession' in navigator) || !this.reciter) return;
		
		navigator.mediaSession.playbackState = 'playing';
		navigator.mediaSession.metadata = new MediaMetadata({
			title: this.app.suwarData[this.app.lang][this.currentIndex],
			artist: this.reciter.name[this.app.lang],
			album: 'Quran Player',
			artwork: [{ src: 'icon.png', sizes: '512x512', type: 'image/png' }]
		});

		navigator.mediaSession.setActionHandler('play', () => this.audio.play());
		navigator.mediaSession.setActionHandler('pause', () => this.audio.pause());
		navigator.mediaSession.setActionHandler('previoustrack', () => this.playPrev());
		navigator.mediaSession.setActionHandler('nexttrack', () => this.playNext());
		navigator.mediaSession.setActionHandler('seekbackward', () => this.seekRelative(-5));
		navigator.mediaSession.setActionHandler('seekforward', () => this.seekRelative(5));
	}
}

class UIController {
	constructor(app) {
		this.app = app;
		this.showRemainingTime = false;
		this.bindElements();
		this.setupEvents();
	}

	bindElements() {
		this.sidebar = document.getElementById("sidebar");
		this.burgerBtn = document.getElementById("burger-btn");
		this.langBtn = document.getElementById("lang-switch");
		this.recitersList = document.getElementById("reciters-list");
		this.suwarList = document.getElementById("suwar-list");
		this.reciterTitle = document.getElementById("reciter-name");

		this.playerBar = document.getElementById('player-bar');
		this.btnRepeat = document.getElementById("btn-repeat");
		this.btnPlay = document.getElementById("btn-play");
		this.btnPrev = document.getElementById("btn-prev");
		this.btnNext = document.getElementById("btn-next");
		this.btnRewind = document.getElementById("btn-rewind");
		this.btnForward = document.getElementById("btn-forward");
		this.btnStop = document.getElementById('btn-stop');
		this.seekBar = document.getElementById("seek-bar");
		this.volumeBar = document.getElementById("volume-bar");
		this.speedSelect = document.getElementById("speed-select");
		this.timeCurrent = document.getElementById("time-current");
		this.timeTotal = document.getElementById("time-total");
		this.playerTitle = document.getElementById("player-title");
		this.btnDownload = document.getElementById("btn-download");
	}

	setupEvents() {
		// Navigation
		this.burgerBtn.addEventListener("click", () => this.sidebar.classList.toggle("pinned"));
		this.burgerBtn.addEventListener("mouseenter", () => {
			if (window.innerWidth > 768) this.sidebar.classList.add("open");
		});
		this.sidebar.addEventListener("mouseleave", () => {
			if (window.innerWidth > 768) this.sidebar.classList.remove("open");
		});

		this.langBtn.addEventListener("click", () => this.app.toggleLang());

		// Lecteur Audio
		this.btnPlay.addEventListener("click", () => this.app.audio.togglePlay());
		this.btnStop.addEventListener("click", () => this.app.audio.stop());
		this.btnPrev.addEventListener("click", () => this.app.audio.playPrev());
		this.btnNext.addEventListener("click", () => this.app.audio.playNext());
		this.btnRewind.addEventListener("click", () => this.app.audio.seekRelative(-5));
		this.btnForward.addEventListener("click", () => this.app.audio.seekRelative(5));
		
		this.btnRepeat.addEventListener("click", () => {
			const mode = this.app.audio.toggleRepeat();
			const icons = ["🔁", "🔁 (All)", "🔂 (1)"];
			this.btnRepeat.textContent = icons[mode];
		});

		this.timeTotal.addEventListener("click", () => {
			this.showRemainingTime = !this.showRemainingTime;
			this.updateProgress(this.app.audio.audio.currentTime, this.app.audio.audio.duration);
		});

		// Inputs
		this.seekBar.addEventListener("mousedown", () => this.isDragging = true);
        this.seekBar.addEventListener("touchstart", () => this.isDragging = true, { passive: true });
        
        this.seekBar.addEventListener("mouseup", () => this.isDragging = false);
        this.seekBar.addEventListener("touchend", () => this.isDragging = false);

        this.seekBar.addEventListener("input", (e) => {
            const duration = this.app.audio.audio.duration;
            if (!isNaN(duration)) {
                this.app.audio.seek((e.target.value / 100) * duration);
                this.timeCurrent.textContent = this.formatTime(this.app.audio.audio.currentTime);
            }
        });

        this.volumeBar.addEventListener("input", (e) => this.app.audio.setVolume(e.target.value));
        this.speedSelect.addEventListener("change", (e) => this.app.audio.setSpeed(e.target.value));
    }

    updateProgress(current, duration) {
        if (isNaN(duration) || this.isDragging) return;
        
        this.seekBar.value = (current / duration) * 100;
        this.timeCurrent.textContent = this.formatTime(current);
        this.timeTotal.textContent = this.showRemainingTime 
            ? "-" + this.formatTime(duration - current) 
            : this.formatTime(duration);
    }

	renderReciters(recitersData) {
		this.recitersList.innerHTML = "";
		for (const [key, reciter] of Object.entries(recitersData)) {
			const li = document.createElement("li");
			li.dataset.key = key;
			li.textContent = reciter.name[this.app.lang];

			if (!reciter.path) li.classList.add("unavailable");
			else li.onclick = () => this.app.selectReciter(li, reciter);
			
			this.recitersList.appendChild(li);
		}
	}

	renderSuwar(reciter, suwarListNames, activePlaylist) {
		this.reciterTitle.textContent = reciter.name[this.app.lang];
		this.suwarList.innerHTML = "";

		suwarListNames.forEach((_, index) => {
			const track = activePlaylist[index];
			const div = document.createElement("div");
			div.className = "surah";
			div.dataset.index = index;
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
			hiddenAudio.onerror = () => div.classList.add("unavailable");

			div.append(idSpan, nameSpan, statusSpan, durationSpan, hiddenAudio);
			
			// Restaure l'état si on affiche le récitateur en cours d'écoute
			if (this.app.audio.reciter === reciter && this.app.audio.currentIndex === index) {
				div.classList.add("playing");
			}
			
			this.suwarList.appendChild(div);
		});

		this.updateTexts();
	}

	updateTexts() {
		document.documentElement.dir = this.app.lang === 'ar' ? 'rtl' : 'ltr';

		if (this.app.activeReciter) {
			this.reciterTitle.textContent = this.app.activeReciter.name[this.app.lang];
		}

		document.querySelectorAll("#reciters-list li").forEach(li => {
			const key = li.dataset.key;
			li.textContent = this.app.recitersData[key].name[this.app.lang];
		});

		document.querySelectorAll(".surah").forEach(div => {
			const index = parseInt(div.dataset.index, 10);
			div.querySelector(".surah-id").textContent = this.app.lang === 'ar' 
				? new Intl.NumberFormat('ar-SA').format(index + 1) + '.'
				: (index + 1) + '.';
			div.querySelector(".surah-name").textContent = this.app.suwarData[this.app.lang][index];
		});

		this.updatePlayerTitle();

		this.btnPrev.textContent = this.app.lang === 'ar' ? '⏭' : '⏮';
		this.btnNext.textContent = this.app.lang === 'ar' ? '⏮' : '⏭';
		this.btnRewind.textContent = this.app.lang === 'ar' ? '5s ⏩' : '⏪ 5s';
		this.btnForward.textContent = this.app.lang === 'ar' ? '5s ⏪' : '⏩ 5s';
	}

	updatePlayerTitle() {
		if (!this.app.audio.reciter || this.app.audio.currentIndex === -1) return;
		const title = this.app.suwarData[this.app.lang][this.app.audio.currentIndex];
		const reciterName = this.app.audio.reciter.name[this.app.lang];
		this.playerTitle.textContent = `${title} - ${reciterName}`;
	}

	highlightPlayingSurah(index, playingReciter) {
		document.querySelectorAll(".surah").forEach(div => div.classList.remove("playing"));
		if (this.app.activeReciter === playingReciter && index !== -1) {
			const activeDiv = document.querySelector(`.surah[data-index="${index}"]`);
			if (activeDiv) activeDiv.classList.add("playing");
		}
	}

	updatePlayState(isPlaying) {
		this.btnPlay.textContent = isPlaying ? "⏸" : "▶";
	}

	updateProgress(current, duration) {
		if (isNaN(duration)) return;
		this.seekBar.value = (current / duration) * 100;
		this.timeCurrent.textContent = this.formatTime(current);
		this.timeTotal.textContent = this.showRemainingTime 
			? "-" + this.formatTime(duration - current) 
			: this.formatTime(duration);
	}

	showPlayer() { this.playerBar.style.display = 'grid'; }
	hidePlayer() { this.playerBar.style.display = 'none'; }
	updateDownloadLink(url) { this.btnDownload.href = url; }
	
	closeSidebarOnMobile() {
		if (window.innerWidth <= 768) this.sidebar.classList.remove("pinned", "open");
	}

	formatTime(seconds) {
		if (isNaN(seconds)) return "00:00";
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
		const s = Math.floor(seconds % 60).toString().padStart(2, '0');
		return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
	}
}

class QuranApp {
	constructor() {
		this.lang = 'en';
		this.suwarData = {};
		this.recitersData = {};
		this.activeReciter = null;
		
		this.audio = new AudioEngine(this);
		this.ui = new UIController(this);
	}

	async init() {
		try {
			const response = await fetch("data.json");
			const data = await response.json();
			this.suwarData = data.suwar;
			this.recitersData = data.reciters;
			this.ui.renderReciters(this.recitersData);
		} catch (e) {
			console.error("Crash au chargement JSON :", e);
		}
	}

	toggleLang() {
		this.lang = this.lang === 'en' ? 'ar' : 'en';
		this.ui.updateTexts();
		this.audio.updateMediaSession();
	}

	selectReciter(liElement, reciter) {
		document.querySelectorAll("#reciters-list li").forEach(el => el.classList.remove("active"));
		liElement.classList.add("active");
		this.ui.closeSidebarOnMobile();
		
		this.activeReciter = reciter;
		const playlist = this.suwarData.en.map((_, i) => ({
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