document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 요소 ---
    const themeToggleButton = document.getElementById('themeToggleButton');
    const themeIcon = themeToggleButton.querySelector('i');
    const smartReadingToggle = document.getElementById('smartReadingToggle');
    const smartReadingStatus = smartReadingToggle.querySelector('.toggle-status');
    const flashcardDisplay = document.getElementById('flashcardDisplay');
    const wordContent = document.getElementById('wordContent');
    const fullscreenButton = document.getElementById('fullscreenButton');
    const playPauseOverlay = document.getElementById('playPauseOverlay');
    const playPauseIcon = playPauseOverlay.querySelector('i');
    const currentTimeDisplay = document.getElementById('currentTime');
    const totalTimeDisplay = document.getElementById('totalTime');
    const wordProgressBar = document.getElementById('wordProgressBar');
    const currentWordIndexLabel = document.getElementById('currentWordIndexLabel');
    const totalWordCountLabel = document.getElementById('totalWordCountLabel');
    const prevWordButton = document.getElementById('prevWordButton');
    const playButton = document.getElementById('playButton');
    const pauseButton = document.getElementById('pauseButton');
    const stopButton = document.getElementById('stopButton');
    const nextWordButton = document.getElementById('nextWordButton');
    const sentenceInput = document.getElementById('sentenceInput');
    const fileInput = document.getElementById('fileInput');
    const wpmSlider = document.getElementById('wpmSlider');
    const wpmInput = document.getElementById('wpmInput');
    const wpmValueLabel = document.getElementById('wpmValueLabel');

    // --- 상태 변수 ---
    let words = [];
    let currentIndex = 0;
    let totalWords = 0;
    let isPlaying = false;
    let isSmartReadingEnabled = false; // 스마트 리딩 상태
    let currentWpm = parseInt(wpmInput.value, 10) || 120;
    let baseDelay = calculateBaseDelay(currentWpm); // 기본 WPM 기준 딜레이
    let timeoutId = null; // setTimeout ID
    let timeUpdateIntervalId = null;
    let startTime = 0;
    let elapsedTimeBeforePause = 0;
    const SMART_READING_OPTIONS = { // 스마트 리딩 설정값
        baseWordLength: 5,
        speedUpFactorMax: 0.85, // 15% faster
        slowDownFactorMax: 1.25, // 25% slower
        referenceLengthShort: 1,
        referenceLengthLong: 10,
        minAbsoluteDelay: 120 // ms
    };

    // --- 초기화 ---
    loadTheme();
    loadSmartReadingSetting(); // 스마트 리딩 설정 로드
    updateWpmDisplay(currentWpm);
    updateButtonStates();
    resetTimeDisplay();
    disableNavigation();

    // --- 함수 정의 ---

    // 기본 WPM -> ms 딜레이 계산
    function calculateBaseDelay(wpm) {
        if (isNaN(wpm) || wpm <= 0) return 5000;
        return (60 / wpm) * 1000;
    }

    /**
     * 스마트 리딩 알고리즘: 단어 길이에 따라 동적 지연 시간 계산
     * (새로운 기준 적용)
     */
    function calculateSmartDelay(word, baseWpm, options = SMART_READING_OPTIONS) {
        if (!word || typeof word !== 'string') word = " ";
        if (isNaN(baseWpm) || baseWpm <= 0) baseWpm = 120;

        const baseDelayMs = calculateBaseDelay(baseWpm);
        const currentWordLength = word.length;

        const {
            baseWordLength, speedUpFactorMax, slowDownFactorMax,
            referenceLengthShort, referenceLengthLong, minAbsoluteDelay
        } = options;

        let factor = 1.0;
        const shortRange = baseWordLength - referenceLengthShort; // 5 - 1 = 4
        const longRange = referenceLengthLong - baseWordLength;   // 10 - 5 = 5

        if (currentWordLength < baseWordLength && shortRange > 0) {
            // 길이 5 -> 1 갈수록 1.0 -> 0.85
            const effectiveLength = Math.max(referenceLengthShort, currentWordLength); // 1보다 작아지지 않게
            factor = 1.0 - (1.0 - speedUpFactorMax) * (baseWordLength - effectiveLength) / shortRange;
        } else if (currentWordLength > baseWordLength && longRange > 0) {
            // 길이 5 -> 10 갈수록 1.0 -> 1.25
            const effectiveLength = Math.min(referenceLengthLong, currentWordLength); // 10보다 커지지 않게
            factor = 1.0 + (slowDownFactorMax - 1.0) * (effectiveLength - baseWordLength) / longRange;
        } else if (currentWordLength <= referenceLengthShort) { // 길이 1 이하
             factor = speedUpFactorMax;
        } else if (currentWordLength >= referenceLengthLong) { // 길이 10 이상
             factor = slowDownFactorMax;
        }
        // baseWordLength(5) 이거나 range가 0이면 factor 1.0 유지

        factor = Math.max(speedUpFactorMax, Math.min(slowDownFactorMax, factor)); // 안전장치
        const calculatedDelay = baseDelayMs * factor;
        const finalDelay = Math.max(calculatedDelay, minAbsoluteDelay);

        // console.log(`Word: "${word}"(${currentWordLength}), Factor: ${factor.toFixed(2)}, Delay: ${finalDelay.toFixed(0)}ms`); // 디버깅
        return finalDelay;
    }

    // 현재 설정(스마트리딩 on/off)에 맞는 지연시간 반환
    function getCurrentDelayForWord(word) {
        if (isSmartReadingEnabled) {
            return calculateSmartDelay(word, currentWpm);
        } else {
            return baseDelay; // 기본 WPM 딜레이 사용
        }
    }

    // 밀리초 -> mm:ss 형식 변환 (동일)
    function formatTime(ms) {
        if (isNaN(ms) || ms < 0) return "00:00";
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    // 전체 예상 시간 계산 및 표시 (단순히 기본 WPM 기준으로 계산)
    function calculateAndDisplayTotalTime() {
        const estimatedTotalMs = totalWords * baseDelay; // 스마트리딩 고려 안 함 (단순 예상치)
        totalTimeDisplay.textContent = formatTime(estimatedTotalMs);
    }

    // 현재 재생 시간 업데이트 (동일)
    function updateCurrentTime() {
        if (!isPlaying) return;
        const elapsed = Date.now() - startTime + elapsedTimeBeforePause;
        currentTimeDisplay.textContent = formatTime(elapsed);
    }

    // 시간 표시 초기화 (동일)
    function resetTimeDisplay() {
        currentTimeDisplay.textContent = "00:00";
    }

    // WPM UI 업데이트 및 기본 딜레이 재계산 (동일)
    function updateWpmDisplay(wpm) {
        const validWpm = Math.max(20, Math.min(600, parseInt(wpm, 10) || currentWpm));
        currentWpm = validWpm;
        wpmValueLabel.textContent = currentWpm;
        if (wpmInput.value != currentWpm) wpmInput.value = currentWpm;
        if (wpmSlider.value != currentWpm) wpmSlider.value = currentWpm;

        const newBaseDelay = calculateBaseDelay(currentWpm);
        if (newBaseDelay !== baseDelay) {
             baseDelay = newBaseDelay;
             calculateAndDisplayTotalTime(); // 전체 예상 시간 업데이트
             // 재생 중 WPM 변경 시 즉시 반영은 setTimeout 구조에서 다음 단어 시 적용됨
        }
    }

    // 테마 로드 및 적용 (동일)
    function loadTheme() {
        const savedTheme = localStorage.getItem('smartReaderTheme') || 'light';
        document.body.classList.toggle('dark-mode', savedTheme === 'dark');
        if (savedTheme === 'dark') {
            themeIcon.classList.replace('fa-moon', 'fa-sun');
            themeToggleButton.title = "라이트 모드";
        } else {
            themeIcon.classList.replace('fa-sun', 'fa-moon');
            themeToggleButton.title = "다크 모드";
        }
    }
    // 테마 토글 (동일)
    function toggleTheme() {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('smartReaderTheme', isDarkMode ? 'dark' : 'light');
        themeIcon.classList.toggle('fa-sun', isDarkMode);
        themeIcon.classList.toggle('fa-moon', !isDarkMode);
        themeToggleButton.title = isDarkMode ? "라이트 모드" : "다크 모드";
    }

    // 스마트 리딩 설정 로드 및 적용
    function loadSmartReadingSetting() {
        const savedSetting = localStorage.getItem('smartReaderEnabled') === 'true';
        isSmartReadingEnabled = savedSetting;
        smartReadingToggle.classList.toggle('active', isSmartReadingEnabled);
        smartReadingStatus.textContent = isSmartReadingEnabled ? '(켜짐)' : '(꺼짐)';
    }
    // 스마트 리딩 토글
    function toggleSmartReading() {
        isSmartReadingEnabled = !isSmartReadingEnabled;
        localStorage.setItem('smartReaderEnabled', isSmartReadingEnabled);
        smartReadingToggle.classList.toggle('active', isSmartReadingEnabled);
        smartReadingStatus.textContent = isSmartReadingEnabled ? '(켜짐)' : '(꺼짐)';
        // 재생 중이었다면 다음 딜레이 계산 시 바로 반영됨. 즉시 반영 원하면 pause/play 필요.
    }

    // 텍스트 처리 및 초기화 (동일)
    function processText(text) {
        stopPlayback();
        words = text.trim().split(/[\s\n]+/).filter(word => word !== '');
        totalWords = words.length;
        currentIndex = 0;
        elapsedTimeBeforePause = 0;
        resetTimeDisplay();

        if (totalWords > 0) {
            setupNavigation();
            displayWord(0);
            calculateAndDisplayTotalTime();
            enableNavigation();
        } else {
            wordContent.textContent = "";
            disableNavigation();
            totalTimeDisplay.textContent = "00:00";
        }
        updateButtonStates();
    }

    // 파일 읽기 (동일)
    function handleFileSelect(event) {
        // ... (이전과 동일한 파일 처리 로직) ...
        const file = event.target.files[0];
        if (file && file.type === "text/plain") {
            const reader = new FileReader();
            reader.onload = (e) => {
                sentenceInput.value = e.target.result;
                processText(e.target.result);
            };
            reader.onerror = (e) => { /* 에러 처리 */ };
            reader.readAsText(file);
        } else if (file) { /* 타입 오류 알림 */ }
        event.target.value = null;
    }

    // 특정 인덱스의 단어 표시 (동일)
    function displayWord(index) {
        if (index >= 0 && index < totalWords) {
            wordContent.textContent = words[index];
            updateNavigationUI(index);
        } else if (totalWords === 0) { wordContent.textContent = ""; }
        // 효과 (선택적)
        wordContent.style.transform = 'scale(1.05)';
        setTimeout(() => { wordContent.style.transform = 'scale(1)'; }, 100);
    }

    // --- setTimeout 기반 재생 로직 ---

    // 다음 단어 표시 및 다음 스케줄링
    function displayAndScheduleNext() {
         // 현재 인덱스 + 1이 유효하면 다음 단어 표시
        if (currentIndex + 1 < totalWords) {
            currentIndex++;
            displayWord(currentIndex);
            scheduleNextWord(); // 다음 단어 표시 예약
        } else {
            // 마지막 단어 도달
            displayWord(currentIndex); // 마지막 단어 유지
            stopPlayback(); // 재생 중지
            wordContent.textContent = "끝!";
            // currentIndex는 마지막 인덱스 유지
            updateNavigationUI(currentIndex);
             // 버튼 상태 업데이트 필요
             updateButtonStates();
        }
    }

    // 다음 단어 표시 예약
    function scheduleNextWord() {
        if (!isPlaying || currentIndex >= totalWords -1 ) return; // 재생 중 아니거나 마지막 단어면 예약 안 함

        const delay = getCurrentDelayForWord(words[currentIndex]); // 현재 표시된 단어 기준 딜레이
        clearTimeout(timeoutId); // 이전 예약 취소
        timeoutId = setTimeout(displayAndScheduleNext, delay);
    }


    // 재생 시작
    function startPlayback() {
        if (isPlaying || totalWords === 0) return;

        // 마지막 단어였으면 처음부터
        if (currentIndex >= totalWords - 1) {
             currentIndex = 0;
             elapsedTimeBeforePause = 0;
             resetTimeDisplay();
             // displayWord(0); // displayAndScheduleNext 에서 처리됨
        }

        isPlaying = true;
        startTime = Date.now(); // 시작 시간 기록 (일시정지 후 재개 시 사용)

        // 현재 단어 표시 후 다음 단어 스케줄링 시작
        displayWord(currentIndex); // 현재 단어 즉시 표시
        scheduleNextWord(); // 다음 단어 표시 예약

        // 시간 업데이트 시작
        clearInterval(timeUpdateIntervalId); // 이전 인터벌 클리어
        timeUpdateIntervalId = setInterval(updateCurrentTime, 200);

        updateButtonStates();
        updateOverlayIcon();
    }

    // 일시정지
    function pausePlayback() {
        if (!isPlaying) return;
        isPlaying = false;
        clearTimeout(timeoutId); // 예약된 다음 단어 표시 취소!
        clearInterval(timeUpdateIntervalId); // 시간 업데이트 중지
        elapsedTimeBeforePause += Date.now() - startTime; // 누적 시간 기록

        updateButtonStates();
        updateOverlayIcon();
    }

    // 재생 정지 (처음으로)
    function stopPlayback() {
        const wasPlaying = isPlaying;
        isPlaying = false;
        clearTimeout(timeoutId);
        clearInterval(timeUpdateIntervalId);
        currentIndex = 0;
        elapsedTimeBeforePause = 0;
        resetTimeDisplay();

        if (totalWords > 0) displayWord(0);
        else wordContent.textContent = "";

        if (wasPlaying || totalWords > 0) {
            updateButtonStates();
            updateOverlayIcon();
        }
    }

    // 이전 단어로 이동 (동일)
    function goToPrevWord() {
        if (totalWords === 0 || currentIndex <= 0) return;
        pausePlayback();
        currentIndex--;
        elapsedTimeBeforePause = currentIndex * baseDelay; // 기본 WPM 기준으로 시간 추정 (단순화)
        resetTimeDisplay(); updateCurrentTime(); // 추정 시간 업데이트
        displayWord(currentIndex);
        updateButtonStates();
    }
    // 다음 단어로 이동 (동일)
    function goToNextWord() {
        if (totalWords === 0 || currentIndex >= totalWords - 1) return;
        pausePlayback();
        currentIndex++;
        elapsedTimeBeforePause = currentIndex * baseDelay; // 추정
        resetTimeDisplay(); updateCurrentTime();
        displayWord(currentIndex);
        updateButtonStates();
    }
    // 특정 단어로 점프 (동일)
    function jumpToWord(index) {
         if (totalWords === 0 || index < 0 || index >= totalWords || index === currentIndex) return;
         pausePlayback();
         currentIndex = index;
         elapsedTimeBeforePause = currentIndex * baseDelay; // 추정
         resetTimeDisplay(); updateCurrentTime();
         displayWord(currentIndex);
         updateButtonStates();
    }

    // --- UI 업데이트 함수 (대부분 동일) ---
    function setupNavigation() { /* 이전과 동일 */
        wordProgressBar.max = totalWords > 0 ? totalWords - 1 : 0;
        totalWordCountLabel.textContent = totalWords;
        updateNavigationUI(0);
    }
    function updateNavigationUI(index) { /* 이전과 동일 */
        if (totalWords > 0 && index >= 0 && index < totalWords) {
             if (wordProgressBar.value != index) wordProgressBar.value = index;
             currentWordIndexLabel.textContent = index + 1;
        } else if (totalWords === 0) { currentWordIndexLabel.textContent = 0; }
    }
    function enableNavigation() { /* 이전과 동일, 스마트 리딩 토글도 활성화 */
        wordProgressBar.disabled = false; prevWordButton.disabled = false; nextWordButton.disabled = false;
        stopButton.disabled = false; playButton.disabled = false; smartReadingToggle.disabled = false;
    }
    function disableNavigation() { /* 이전과 동일, 스마트 리딩 토글도 비활성화 */
        wordProgressBar.value = 0; wordProgressBar.max = 0; wordProgressBar.disabled = true;
        currentWordIndexLabel.textContent = 0; totalWordCountLabel.textContent = 0;
        prevWordButton.disabled = true; playButton.disabled = true; pauseButton.disabled = true;
        stopButton.disabled = true; nextWordButton.disabled = true; smartReadingToggle.disabled = true;
        resetTimeDisplay(); totalTimeDisplay.textContent = "00:00";
    }
    function updateButtonStates() { /* 이전과 동일 */
        const hasWords = totalWords > 0;
        playButton.style.display = isPlaying ? 'none' : 'inline-flex';
        pauseButton.style.display = isPlaying ? 'inline-flex' : 'none';
        playButton.disabled = !hasWords || isPlaying;
        pauseButton.disabled = !hasWords || !isPlaying;
        stopButton.disabled = !hasWords;
        prevWordButton.disabled = !hasWords || currentIndex <= 0;
        nextWordButton.disabled = !hasWords || currentIndex >= totalWords - 1;
        smartReadingToggle.disabled = !hasWords; // 단어가 있어야 토글 의미 있음
    }
    function updateOverlayIcon() { /* 이전과 동일 */
        playPauseOverlay.classList.toggle('is-playing', isPlaying);
        playPauseOverlay.classList.toggle('is-paused', !isPlaying);
        playPauseIcon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
    }

    // --- 전체 화면 함수 (동일) ---
    function toggleFullscreen() { /* 이전과 동일 */
        if (!document.fullscreenElement) flashcardDisplay.requestFullscreen().catch(/* 에러 처리 */);
        else if (document.exitFullscreen) document.exitFullscreen();
    }
    function handleFullscreenChange() { /* 이전과 동일 */
        const fullscreenIcon = fullscreenButton.querySelector('i');
        const isFullscreen = document.fullscreenElement === flashcardDisplay;
        fullscreenIcon.className = isFullscreen ? 'fas fa-compress' : 'fas fa-expand';
        fullscreenButton.title = isFullscreen ? "전체 화면 나가기" : "전체 화면 보기";
    }

    // --- 이벤트 리스너 ---
    themeToggleButton.addEventListener('click', toggleTheme);
    smartReadingToggle.addEventListener('click', toggleSmartReading); // 스마트 리딩 토글
    wpmSlider.addEventListener('input', (e) => updateWpmDisplay(e.target.value));
    wpmInput.addEventListener('input', (e) => updateWpmDisplay(e.target.value));
    wpmInput.addEventListener('change', (e) => updateWpmDisplay(e.target.value)); // 값 검증
    sentenceInput.addEventListener('input', (e) => processText(e.target.value));
    fileInput.addEventListener('change', handleFileSelect);
    playButton.addEventListener('click', startPlayback);
    pauseButton.addEventListener('click', pausePlayback);
    stopButton.addEventListener('click', stopPlayback);
    prevWordButton.addEventListener('click', goToPrevWord);
    nextWordButton.addEventListener('click', goToNextWord);
    flashcardDisplay.addEventListener('click', () => { // 플래시카드 클릭 = 재생/일시정지
        if (!playButton.disabled || !pauseButton.disabled) { // 버튼 활성화 시에만
             if (isPlaying) pausePlayback(); else startPlayback();
        }
    });
    wordProgressBar.addEventListener('input', (e) => jumpToWord(parseInt(e.target.value, 10)));
    fullscreenButton.addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(); });
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    // 키보드 단축키 (동일)
    document.addEventListener('keydown', (e) => { /* 이전과 동일한 키보드 로직 */
        if (e.target === sentenceInput || e.target === wpmInput) return;
        switch (e.key) {
            case ' ': e.preventDefault(); if (isPlaying) pausePlayback(); else startPlayback(); break;
            case 'ArrowLeft': if (e.shiftKey) { e.preventDefault(); goToPrevWord(); } break;
            case 'ArrowRight': if (e.shiftKey) { e.preventDefault(); goToNextWord(); } break;
            case 'Escape': if (document.fullscreenElement) document.exitFullscreen(); else stopPlayback(); break;
            case 'Home': e.preventDefault(); jumpToWord(0); break;
            case 'End': e.preventDefault(); jumpToWord(totalWords > 0 ? totalWords - 1 : 0); break;
        }
    });

}); // DOMContentLoaded End