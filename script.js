document.addEventListener("DOMContentLoaded", async () => {
	const response = await fetch("data.json");
	const data = await response.json();

	let currentLang = 'en';
	let suwarData = data.suwar;
	let activeReciter = null;
	let playlist = [];
	let currentTrackIndex = -1;
	let repeatMode = 0; // 0: Off, 1: Liste, 2: Piste

	const sidebar = document.getElementById("sidebar");
	const burgerBtn = document.getElementById("burger-btn");
	const langBtn = document.getElementById("lang-switch");
	const recitersList = document.getElementById("reciters-list");
	const suwarList = document.getElementById("suwar-list");
	const reciterTitle = document.getElementById("reciter-name");

	const audio = document.getElementById("global-audio");
	const playerBar = document.getElementById('player-bar');
	const btnRepeat = document.getElementById("btn-repeat");
	const btnPlay = document.getElementById("btn-play");
	const btnPrev = document.getElementById("btn-prev");
	const btnNext = document.getElementById("btn-next");
	const btnRewind = document.getElementById("btn-rewind");
	const btnForward = document.getElementById("btn-forward");
	const btnStop = document.getElementById('btn-stop');
	const seekBar = document.getElementById("seek-bar");
	const volumeBar = document.getElementById("volume-bar");
	const speedSelect = document.getElementById("speed-select");
	const timeCurrent = document.getElementById("time-current");
	const timeTotal = document.getElementById("time-total");
	const playerTitle = document.getElementById("player-title");
	const btnDownload = document.getElementById("btn-download");

	burgerBtn.addEventListener("click", () => {
		sidebar.classList.toggle("pinned");
	});

	burgerBtn.addEventListener("mouseenter", () => {
		if (window.innerWidth > 768) sidebar.classList.add("open");
	});

	sidebar.addEventListener("mouseleave", () => {
		if (window.innerWidth > 768) sidebar.classList.remove("open");
	});

	langBtn.addEventListener("click", () => {
		currentLang = currentLang === 'en' ? 'ar' : 'en';
		document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
		updateDOMTexts();
	});

	for (const [key, reciter] of Object.entries(data.reciters)) {
		const li = document.createElement("li");
		li.dataset.key = key;
		li.textContent = reciter.name[currentLang];

		if (!reciter.path) {
			li.classList.add("unavailable");
		} else {
			li.onclick = () => {
				document.querySelectorAll("#reciters-list li").forEach(el => el.classList.remove("active"));
				li.classList.add("active");
				if (window.innerWidth <= 768) sidebar.classList.remove("pinned", "open");
				loadSuwar(reciter);
			};
		}
		recitersList.appendChild(li);
	}

	function loadSuwar(reciter) {
		activeReciter = reciter;
		reciterTitle.textContent = currentLang === 'ar' ? reciter.name.ar : reciter.name.en;
		suwarList.innerHTML = "";
		playlist = [];

		suwarData.en.forEach((_, index) => {
			const surahNumber = String(index + 1).padStart(3, '0');
			const audioUrl = `${reciter.path}/${surahNumber}.mp3`;
			
			playlist.push({ index, url: audioUrl });

			const div = document.createElement("div");
			div.className = "surah";
			div.dataset.index = index;
			div.onclick = () => playTrack(index);

			const idSpan = document.createElement("span");
			idSpan.className = "surah-id";

			const nameSpan = document.createElement("span");
			nameSpan.className = "surah-name";

			const statusSpan = document.createElement("span");
			statusSpan.className = "surah-status";

			const hiddenAudio = document.createElement("audio");
			hiddenAudio.className = "hidden-audio";
			hiddenAudio.preload = "metadata";
			hiddenAudio.src = audioUrl;
			hiddenAudio.onerror = () => {
				div.classList.add("unavailable");
			};

			div.appendChild(idSpan);
			div.appendChild(nameSpan);
			div.appendChild(statusSpan);
			div.appendChild(hiddenAudio);
			suwarList.appendChild(div);
		});

		updateDOMTexts();
	}

	function updateDOMTexts() {
		if (activeReciter) {
			reciterTitle.textContent = activeReciter.name[currentLang];
		}

		document.querySelectorAll("#reciters-list li").forEach(li => {
			const key = li.dataset.key;
			li.textContent = data.reciters[key].name[currentLang];
		});

		document.querySelectorAll(".surah").forEach(div => {
			const index = parseInt(div.dataset.index, 10);
			const idSpan = div.querySelector(".surah-id");
			const nameSpan = div.querySelector(".surah-name");
			
			idSpan.textContent = currentLang === 'ar' 
				? new Intl.NumberFormat('ar-SA').format(index + 1) + '.'
				: (index + 1) + '.';
			
			nameSpan.textContent = suwarData[currentLang][index];
		});

		if (currentTrackIndex !== -1) {
			updatePlayerTitle();
		}
		btnPrev.textContent = currentLang === 'ar' ? '⏭' : '⏮';
		btnNext.textContent = currentLang === 'ar' ? '⏮' : '⏭';
		btnRewind.textContent = currentLang === 'ar' ? '5s ⏩' : '⏪ 5s';
		btnForward.textContent = currentLang === 'ar' ? '5s ⏪' : '⏩ 5s';
	}

	function updateMediaSession(surahName, reciterName) {
		if ('mediaSession' in navigator) {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: `${surahName} - ${reciterName}`,
				artist: 'Quran Player',
				/*
				artwork: [
					// Suggestion : mets une icône ici pour éviter le carré gris vide de l'OS
					{ src: '/path/to/icon-512.png', sizes: '512x512', type: 'image/png' }
				]*/
			});

			navigator.mediaSession.setActionHandler('play', () => audio.play());
			navigator.mediaSession.setActionHandler('pause', () => audio.pause());
			navigator.mediaSession.setActionHandler('previoustrack', () => playPrev()); // Remplace par ta fonction
			navigator.mediaSession.setActionHandler('nexttrack', () => playNext()); // Remplace par ta fonction
			
			navigator.mediaSession.setActionHandler('seekbackward', () => { audio.currentTime -= 5; });
			navigator.mediaSession.setActionHandler('seekforward', () => { audio.currentTime += 5; });
		}
	}

	function playTrack(index) {
		currentTrackIndex = index;
		const track = playlist[index];
		audio.src = track.url;
		audio.play();
		
		playerBar.style.display = 'grid';
		if ('mediaSession' in navigator) {
			navigator.mediaSession.playbackState = 'playing';
		}
		
		btnDownload.href = track.url;
		updatePlayerTitle();

		document.querySelectorAll(".surah").forEach(div => div.classList.remove("playing"));
		const activeDiv = document.querySelector(`.surah[data-index="${index}"]`);
		if (activeDiv) activeDiv.classList.add("playing");
		
		updateMediaSession(
			suwarData[currentLang][index],
			currentLang === 'ar' ? activeReciter.name.ar : activeReciter.name.en
		);
	}

	function updatePlayerTitle() {
		const title = suwarData[currentLang][currentTrackIndex];
		const number = currentLang === 'ar' 
			? new Intl.NumberFormat('ar-SA').format(currentTrackIndex + 1) 
			: currentTrackIndex + 1;
		const reciterName = currentLang === 'ar' ? activeReciter.name.ar : activeReciter.name.en;
		playerTitle.textContent = `${number}. ${title} - ${reciterName}`;
	}

	function stopPlayer() {
		audio.pause();
		audio.currentTime = 0;
		playerBar.style.display = 'none';
		
		if ('mediaSession' in navigator) {
			navigator.mediaSession.metadata = null;
			navigator.mediaSession.playbackState = 'none';
		}
	}

	btnStop.addEventListener('click', stopPlayer);

	btnPlay.addEventListener("click", () => {
		if (!audio.src) return;
		if (audio.paused) audio.play();
		else audio.pause();
	});

	audio.addEventListener("play", () => btnPlay.textContent = "⏸");
	audio.addEventListener("pause", () => btnPlay.textContent = "▶");

	btnPrev.addEventListener("click", () => {
		if (currentTrackIndex > 0) playTrack(currentTrackIndex - 1);
	});

	btnNext.addEventListener("click", () => {
		if (currentTrackIndex < playlist.length - 1) playTrack(currentTrackIndex + 1);
	});

	btnRewind.addEventListener("click", () => audio.currentTime = Math.max(0, audio.currentTime - 5));
	btnForward.addEventListener("click", () => audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5));

	audio.addEventListener("timeupdate", () => {
		if (isNaN(audio.duration)) return;
		seekBar.value = (audio.currentTime / audio.duration) * 100;
		timeCurrent.textContent = formatTime(audio.currentTime);
		timeTotal.textContent = formatTime(audio.duration);
	});

	btnRepeat.addEventListener("click", () => {
		repeatMode = (repeatMode + 1) % 3;
		const icons = ["🔁", "🔁 (All)", "🔂 (1)"];
		btnRepeat.textContent = icons[repeatMode];
	});

	seekBar.addEventListener("input", (e) => {
		if (isNaN(audio.duration)) return;
		audio.currentTime = (e.target.value / 100) * audio.duration;
	});

	volumeBar.addEventListener("input", (e) => audio.volume = e.target.value);
	
	speedSelect.addEventListener("change", (e) => audio.playbackRate = e.target.value);

	function playNext() {
		let nextIndex = currentTrackIndex + 1;
		if (nextIndex >= playlist.length) {
			nextIndex = 0;
		}
		playTrack(nextIndex);
	}

	function playPrev() {
		let prevIndex = currentTrackIndex - 1;
		if (prevIndex < 0) {
			prevIndex = playlist.length - 1;
		}
		playTrack(prevIndex);
	}

	audio.addEventListener("ended", () => {
		if (repeatMode === 2) {
			audio.currentTime = 0;
			audio.play();
			return;
		}

		if (repeatMode === 0 && currentTrackIndex === playlist.length - 1) {
			stopPlayer();
			return;
		}
		
		playNext();
	});

	function formatTime(seconds) {
		if (isNaN(seconds)) return "00:00";
		
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		
		const mStr = m.toString().padStart(2, '0');
		const sStr = s.toString().padStart(2, '0');
		
		if (h > 0) {
			return `${h}:${mStr}:${sStr}`;
		}
		
		return `${mStr}:${sStr}`;
	}
});
