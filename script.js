document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 요소 ---
    const themeToggleButton = document.getElementById('themeToggleButton');
    const themeIcon = themeToggleButton.querySelector('i');
    const smartReadingCheckbox = document.getElementById('smartReadingCheckbox');
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
    const wordJumpInput = document.getElementById('wordJumpInput');
    const jumpButton = document.getElementById('jumpButton');
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
    const fullscreenInfo = document.getElementById('fullscreenInfo');
    const fsCurrentWord = document.getElementById('fsCurrentWord');
    const fsTotalWords = document.getElementById('fsTotalWords');
    const fsProgressPercent = document.getElementById('fsProgressPercent');

    // --- 상태 변수 ---
    let words = [];
    let currentIndex = 0;
    let totalWords = 0;
    let isPlaying = false;
    let isSmartReadingEnabled = true; // 기본값 true, 로드 시 덮어씀
    let currentWpm = 120; // 기본값, 로드 시 덮어씀
    let baseDelay = calculateBaseDelay(currentWpm);
    let timeoutId = null;
    let timeUpdateIntervalId = null;
    let startTime = 0;
    let elapsedTimeBeforePause = 0;
    // LocalStorage 키
    const SAVE_DATA_KEY = 'smartReaderSaveDataV2'; // 버전 관리 위해 키 변경

    // --- 스마트 리딩 설정 ---
    const smartReadingOptions = {
        baseWordLength: 5, speedUpFactorMax: 0.85, slowDownFactorMax: 1.25,
        referenceLengthShort: 1, referenceLengthLong: 10, minAbsoluteDelay: 90
    };

    // --- 초기화 ---
    function initializeApp() {
        loadTheme(); // 테마 먼저 로드
        loadState(); // 저장된 상태 로드 (WPM, 텍스트, 위치, 스마트리딩 포함)
        // loadState 이후에 현재 상태 기준으로 UI 업데이트
        updateWpmUIComponents(currentWpm); // WPM 관련 UI 컴포넌트 업데이트
        smartReadingCheckbox.checked = isSmartReadingEnabled; // 체크박스 상태 반영

        // 텍스트가 로드되었다면 초기화 진행
        if (sentenceInput.value.trim() !== "") {
            processText(sentenceInput.value, true); // true 플래그로 초기 로드임을 표시
        } else {
            disableControls();
            resetTimeDisplay();
            wordContent.textContent = "텍스트를 로드하세요";
            updateFullscreenInfo(-1, 0);
        }

        bindEventListeners();
    }

    // --- 상태 저장 및 로드 ---

    // 현재 상태를 localStorage에 저장
    function saveState() {
        try {
            const state = {
                text: sentenceInput.value,
                index: currentIndex,
                wpm: currentWpm,
                smartMode: isSmartReadingEnabled,
                elapsedTime: isPlaying ? elapsedTimeBeforePause + (Date.now() - startTime) : elapsedTimeBeforePause // 현재 재생 시간도 저장
            };
            localStorage.setItem(SAVE_DATA_KEY, JSON.stringify(state));
            // console.log("State saved:", state); // 디버깅용
        } catch (error) {
            console.error("Failed to save state to localStorage:", error);
        }
    }

    // localStorage에서 상태 로드
    function loadState() {
        try {
            const savedStateJSON = localStorage.getItem(SAVE_DATA_KEY);
            if (savedStateJSON) {
                const savedState = JSON.parse(savedStateJSON);
                // console.log("State loaded:", savedState); // 디버깅용

                // 로드된 값으로 상태 변수 업데이트
                sentenceInput.value = savedState.text || "";
                currentIndex = savedState.index || 0;
                currentWpm = savedState.wpm || 120;
                isSmartReadingEnabled = typeof savedState.smartMode === 'boolean' ? savedState.smartMode : true;
                elapsedTimeBeforePause = savedState.elapsedTime || 0; // 저장된 시간 로드

                // 기본 딜레이 업데이트
                baseDelay = calculateBaseDelay(currentWpm);

                // 유효성 검사는 processText 내부에서 수행
            } else {
                 // 저장된 데이터가 없으면 기본값 사용 (상태 변수 초기값)
                 isSmartReadingEnabled = smartReadingCheckbox.checked; // 체크박스 기본값 따름
                 currentWpm = parseInt(wpmInput.value, 10) || 120;
                 baseDelay = calculateBaseDelay(currentWpm);
            }
        } catch (error) {
            console.error("Failed to load state from localStorage:", error);
            // 오류 발생 시 기본값 사용
            localStorage.removeItem(SAVE_DATA_KEY); // 손상된 데이터 제거
            sentenceInput.value = "";
            currentIndex = 0;
            currentWpm = 120;
            isSmartReadingEnabled = true;
            elapsedTimeBeforePause = 0;
            baseDelay = calculateBaseDelay(currentWpm);
        }
    }


    // --- 핵심 함수 (이전과 유사, 일부 saveState 호출 추가) ---

    function calculateBaseDelay(wpm) { /* ... (이전과 동일) ... */
         if (isNaN(wpm) || wpm <= 0) return 3000; return (60 / wpm) * 1000;
    }
    function calculateSmartDelay(word) { /* ... (이전과 동일) ... */
         const wordLength = word ? word.length : 0; if (wordLength === 0) return baseDelay;
         const { baseWordLength, speedUpFactorMax, slowDownFactorMax, referenceLengthShort, referenceLengthLong, minAbsoluteDelay } = smartReadingOptions;
         let factor = 1.0; const shortRange = baseWordLength - referenceLengthShort; const longRange = referenceLengthLong - baseWordLength;
         if (wordLength < baseWordLength && shortRange > 0) { const effectiveLength = Math.max(referenceLengthShort, wordLength); factor = 1.0 - (1.0 - speedUpFactorMax) * (baseWordLength - effectiveLength) / shortRange; }
         else if (wordLength > baseWordLength && longRange > 0) { const effectiveLength = Math.min(referenceLengthLong, wordLength); factor = 1.0 + (slowDownFactorMax - 1.0) * (effectiveLength - baseWordLength) / longRange; }
         else if (wordLength > referenceLengthLong && longRange > 0) { factor = slowDownFactorMax; }
         const calculatedDelay = baseDelay * factor; return Math.max(calculatedDelay, minAbsoluteDelay);
    }
    function formatTime(ms) { /* ... (이전과 동일) ... */
         if (isNaN(ms) || ms < 0) return "00:00"; const totalSeconds = Math.round(ms / 1000); const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function calculateAndDisplayTotalTime() { /* ... (이전과 동일, 전체화면 업데이트 포함) ... */
        const totalMs = totalWords * baseDelay; totalTimeDisplay.textContent = formatTime(totalMs);
        if (totalWords > 0) { fsTotalWords.textContent = totalWords; } else { fsTotalWords.textContent = '0'; fsCurrentWord.textContent = '0'; fsProgressPercent.textContent = '0.0'; }
    }

    function updateCurrentTime() { /* ... (이전과 동일) ... */
        if (!isPlaying) return; const elapsed = Date.now() - startTime + elapsedTimeBeforePause; currentTimeDisplay.textContent = formatTime(elapsed);
    }
    function resetTimeDisplay() { /* ... (이전과 동일) ... */
        currentTimeDisplay.textContent = "00:00"; totalTimeDisplay.textContent = "00:00";
    }

    // WPM UI 업데이트 함수 분리 (값 설정만)
    function updateWpmUIComponents(wpmVal) {
        const displayWpm = Math.max(1, parseInt(wpmVal, 10) || 120); // 표시용 WPM (최소 1)
        const sliderWpm = Math.round(Math.max(20, Math.min(600, displayWpm)) / 5) * 5; // 슬라이더 값 (20-600, 5단위)

        wpmValueLabel.textContent = displayWpm; // 레이블 업데이트
        if (wpmSlider.value != sliderWpm) wpmSlider.value = sliderWpm; // 슬라이더 업데이트
        if (wpmInput.value != displayWpm) wpmInput.value = displayWpm; // 숫자 입력 업데이트
    }


    // WPM 변경 처리 (상태 및 딜레이 업데이트)
    function handleWpmChange(newWpm) {
        const parsedWpm = parseInt(newWpm, 10);
        if (isNaN(parsedWpm)) return; // 유효하지 않으면 무시

        currentWpm = Math.max(1, parsedWpm); // 실제 WPM 업데이트 (1 이상)
        updateWpmUIComponents(currentWpm); // UI 반영

        const newBaseDelay = calculateBaseDelay(currentWpm);
        if (newBaseDelay !== baseDelay) {
            baseDelay = newBaseDelay;
            calculateAndDisplayTotalTime(); // 총 시간 다시 계산
            // 재생 중 속도 변경 시 타이머 즉시 재시작 (선택적)
            // if (isPlaying) {
            //     clearTimeout(timeoutId);
            //     scheduleNextWord();
            // }
            saveState(); // WPM 변경 시 상태 저장
        }
    }

    function loadTheme() { /* ... (이전과 동일) ... */
        const savedTheme = localStorage.getItem('smartReaderThemeV2') || 'light'; applyTheme(savedTheme);
    }
    function applyTheme(theme) { /* ... (이전과 동일) ... */
         if (theme === 'dark') { document.body.classList.add('dark-mode'); themeIcon.classList.replace('fa-moon', 'fa-sun'); themeToggleButton.title = "라이트 모드"; } else { document.body.classList.remove('dark-mode'); themeIcon.classList.replace('fa-sun', 'fa-moon'); themeToggleButton.title = "다크 모드"; }
    }
    function toggleTheme() { /* ... (이전과 동일, localStorage 키 확인) ... */
        const isDarkMode = document.body.classList.toggle('dark-mode'); const newTheme = isDarkMode ? 'dark' : 'light'; localStorage.setItem('smartReaderThemeV2', newTheme); applyTheme(newTheme);
    }

    function toggleSmartReading() {
        isSmartReadingEnabled = smartReadingCheckbox.checked;
        saveState(); // 스마트 리딩 설정 변경 시 상태 저장
    }

    // 텍스트 처리 (초기 로드 구분 추가)
    function processText(text, isInitialLoad = false) {
        if (!isInitialLoad) { // 초기 로드가 아니면 항상 재생 중지 및 초기화
            stopPlayback();
        }

        words = text.trim().split(/[\s\n]+/).filter(word => word !== '');
        totalWords = words.length;

        // 초기 로드 시, 저장된 인덱스가 유효한지 확인
        if (isInitialLoad) {
            currentIndex = Math.max(0, Math.min(currentIndex, totalWords - 1)); // 유효 범위 조정
        } else {
            currentIndex = 0; // 새로 텍스트 입력/파일 로드 시 처음부터
            elapsedTimeBeforePause = 0; // 시간 초기화
        }

        resetTimeDisplay(); // 시간 표시 초기화 (현재 시간은 로드된 값 반영)
        currentTimeDisplay.textContent = formatTime(elapsedTimeBeforePause); // 로드된 현재 시간 표시


        if (totalWords > 0) {
            updateNavigationUI(currentIndex); // 현재 인덱스로 네비 UI 설정
            displayWord(currentIndex);      // 현재 인덱스 단어 표시
            calculateAndDisplayTotalTime(); // 전체 시간 계산
            enableControls();               // 컨트롤 활성화
            wordJumpInput.max = totalWords; // 점프 최대값
        } else {
            wordContent.textContent = "텍스트를 로드하세요";
            disableControls();
            updateFullscreenInfo(-1, 0);
        }

        // 텍스트 변경 시 상태 저장 (초기 로드 시에는 이미 로드했으므로 저장 불필요)
        if (!isInitialLoad) {
            saveState();
        }
    }


    function handleFileSelect(event) { /* ... (processText 호출, saveState는 processText 내부에서) ... */
        const file = event.target.files[0]; if (!file) return; if (file.type === "text/plain") { const reader = new FileReader(); reader.onload = (e) => { sentenceInput.value = e.target.result; processText(e.target.result); }; reader.onerror = () => alert("파일 읽기 오류"); reader.readAsText(file); } else { alert("'.txt' 텍스트 파일만 선택해주세요."); } event.target.value = null;
    }
    function displayWord(index) { /* ... (이전과 동일, 전체화면 업데이트 포함) ... */
        if (index >= 0 && index < totalWords) { wordContent.classList.add('updating'); setTimeout(() => { wordContent.textContent = words[index]; wordContent.classList.remove('updating'); }, 50); updateNavigationUI(index); updateFullscreenInfo(index, totalWords); }
        else if (totalWords === 0) { wordContent.textContent = "텍스트를 로드하세요"; updateFullscreenInfo(-1, 0); }
    }
    function updateFullscreenInfo(currentIdx, total) { /* ... (이전과 동일) ... */
         if (total > 0 && currentIdx >= 0) { const currentNum = currentIdx + 1; const percent = (currentNum / total * 100).toFixed(1); fsCurrentWord.textContent = currentNum; fsTotalWords.textContent = total; fsProgressPercent.textContent = percent; }
         else { fsCurrentWord.textContent = '0'; fsTotalWords.textContent = '0'; fsProgressPercent.textContent = '0.0'; }
    }

    function scheduleNextWord() { /* ... (이전과 동일) ... */
        if (!isPlaying || currentIndex >= totalWords) { if (currentIndex >= totalWords && totalWords > 0) { handlePlaybackEnd(); } return; }
        displayWord(currentIndex); const currentWord = words[currentIndex]; const delay = isSmartReadingEnabled ? calculateSmartDelay(currentWord) : baseDelay; clearTimeout(timeoutId); timeoutId = setTimeout(() => { currentIndex++; scheduleNextWord(); }, delay);
    }

    function handlePlaybackEnd() { /* ... (이전과 동일, saveState 호출 추가) ... */
        isPlaying = false; clearTimeout(timeoutId); clearInterval(timeUpdateIntervalId);
        wordContent.textContent = "✨ 완료 ✨"; currentIndex = totalWords; updateNavigationUI(totalWords - 1); updateFullscreenInfo(totalWords - 1, totalWords);
        updateButtonStates(); updateOverlayIcon();
        elapsedTimeBeforePause += Date.now() - startTime; updateCurrentTime(); // 마지막 시간 업데이트
        saveState(); // 완료 시 상태 저장
    }

    function startPlayback() { /* ... (이전과 동일) ... */
        if (isPlaying || totalWords === 0) return; if (currentIndex >= totalWords) { currentIndex = 0; elapsedTimeBeforePause = 0; resetTimeDisplay(); } isPlaying = true; startTime = Date.now(); clearTimeout(timeoutId); scheduleNextWord(); clearInterval(timeUpdateIntervalId); timeUpdateIntervalId = setInterval(updateCurrentTime, 200); updateButtonStates(); updateOverlayIcon();
    }

    function pausePlayback() { /* ... (이전과 동일, saveState 호출 추가) ... */
        if (!isPlaying) return; isPlaying = false; clearTimeout(timeoutId); clearInterval(timeUpdateIntervalId); elapsedTimeBeforePause += Date.now() - startTime; updateButtonStates(); updateOverlayIcon();
        saveState(); // 일시정지 시 상태 저장
    }

    function stopPlayback() { /* ... (이전과 동일, saveState 호출 추가) ... */
        const wasPlaying = isPlaying; isPlaying = false; clearTimeout(timeoutId); clearInterval(timeUpdateIntervalId); currentIndex = 0; elapsedTimeBeforePause = 0; resetTimeDisplay();
        if (totalWords > 0) { displayWord(0); } else { wordContent.textContent = "텍스트를 로드하세요"; updateFullscreenInfo(-1, 0); }
        if (wasPlaying || totalWords > 0) { updateButtonStates(); updateOverlayIcon(); } if (totalWords === 0) disableControls();
        saveState(); // 정지 시 상태 저장 (초기화된 상태)
    }

    // navigateWord 내부에서 saveState 호출
    function navigateWord(direction) {
        if (totalWords === 0) return;
        const wasPlaying = isPlaying;
        pausePlayback(); // 이동 시 항상 일시정지 (pausePlayback 내부에서 saveState 호출됨)

        let newIndex = currentIndex;
        if (direction === 'prev') { newIndex = Math.max(0, currentIndex - 1); }
        else if (direction === 'next') { newIndex = Math.min(totalWords - 1, currentIndex + 1); }
        else if (typeof direction === 'number') { newIndex = Math.max(0, Math.min(totalWords - 1, direction)); wordJumpInput.value = ''; }

        if (newIndex !== currentIndex) {
            currentIndex = newIndex;
            elapsedTimeBeforePause = currentIndex * baseDelay; // 시간 추정치 업데이트
            resetTimeDisplay(); // 시간 리셋
            updateCurrentTime(); // 추정 시간 표시
            displayWord(currentIndex); // 단어 및 전체화면 정보 표시
            updateButtonStates();
            // navigateWord 자체는 saveState를 직접 호출하지 않고, 내부의 pausePlayback이 호출함.
            // 만약 이동 후 즉시 저장하고 싶다면 여기에 saveState() 추가 가능.
        }
         // 이동 후 자동으로 다시 재생하지 않음 (사용자가 결정)
    }

    function handleJump() { /* ... (이전과 동일, navigateWord 호출) ... */
        const targetIndex = parseInt(wordJumpInput.value, 10) - 1; if (!isNaN(targetIndex) && targetIndex >= 0 && targetIndex < totalWords) { navigateWord(targetIndex); } else if (wordJumpInput.value.trim() !== '') { alert(`1부터 ${totalWords} 사이의 번호를 입력하세요.`); wordJumpInput.value = ''; }
    }

    function updateNavigationUI(index) { /* ... (이전과 동일) ... */
        if (totalWords > 0) { const displayIndex = Math.min(index, totalWords - 1); if (wordProgressBar.value != displayIndex) wordProgressBar.value = displayIndex; currentWordIndexLabel.textContent = displayIndex + 1; totalWordCountLabel.textContent = totalWords; }
        else { wordProgressBar.value = 0; currentWordIndexLabel.textContent = 0; totalWordCountLabel.textContent = 0; }
    }
    function enableControls() { /* ... (이전과 동일) ... */
        wordProgressBar.disabled = false; wordJumpInput.disabled = false; jumpButton.disabled = false; prevWordButton.disabled = false; playButton.disabled = false; stopButton.disabled = false; nextWordButton.disabled = false; updateButtonStates();
    }
    function disableControls() { /* ... (이전과 동일) ... */
        wordProgressBar.disabled = true; wordProgressBar.value = 0; wordJumpInput.disabled = true; wordJumpInput.value = ''; jumpButton.disabled = true; prevWordButton.disabled = true; playButton.disabled = true; pauseButton.disabled = true; pauseButton.style.display = 'none'; playButton.style.display = 'inline-flex'; stopButton.disabled = true; nextWordButton.disabled = true; updateNavigationUI(-1);
    }
    function updateButtonStates() { /* ... (이전과 동일) ... */
        const hasWords = totalWords > 0; const canPlay = hasWords && !isPlaying; const canPause = hasWords && isPlaying; const canStop = hasWords; const canPrev = hasWords && currentIndex > 0; const canNext = hasWords && currentIndex < totalWords;
        playButton.style.display = !isPlaying ? 'inline-flex' : 'none'; pauseButton.style.display = isPlaying ? 'inline-flex' : 'none'; playButton.disabled = !canPlay; pauseButton.disabled = !canPause; stopButton.disabled = !canStop; prevWordButton.disabled = !canPrev; nextWordButton.disabled = !canNext; jumpButton.disabled = !hasWords; wordJumpInput.disabled = !hasWords;
    }
    function updateOverlayIcon() { /* ... (이전과 동일) ... */
        playPauseOverlay.classList.toggle('is-playing', isPlaying); playPauseOverlay.classList.toggle('is-paused', !isPlaying); playPauseIcon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
    }
    function toggleFullscreen() { /* ... (이전과 동일) ... */
        if (!document.fullscreenElement) { flashcardDisplay.requestFullscreen().catch(err => alert(`전체 화면 오류: ${err.message}`)); } else { if (document.exitFullscreen) document.exitFullscreen(); }
    }
    function handleFullscreenChange() { /* ... (이전과 동일) ... */
        const fullscreenIcon = fullscreenButton.querySelector('i'); const isFullscreen = document.fullscreenElement === flashcardDisplay; fullscreenIcon.className = isFullscreen ? 'fas fa-compress' : 'fas fa-expand'; fullscreenButton.title = isFullscreen ? "전체 화면 나가기" : "전체 화면 보기";
    }

    // --- 이벤트 리스너 바인딩 ---
    function bindEventListeners() {
        themeToggleButton.addEventListener('click', toggleTheme);
        smartReadingCheckbox.addEventListener('change', toggleSmartReading);

        // WPM 변경 리스너 (handleWpmChange 호출)
        wpmSlider.addEventListener('input', (e) => handleWpmChange(e.target.value));
        wpmInput.addEventListener('input', (e) => handleWpmChange(e.target.value));
        wpmInput.addEventListener('change', (e) => handleWpmChange(e.target.value)); // 최종 검증

        // 텍스트 변경 시 저장 (Debounce 적용 고려 가능)
        sentenceInput.addEventListener('input', (e) => {
             processText(e.target.value); // processText 내부에서 saveState 호출
        });
        // 또는 sentenceInput.addEventListener('change', (e) => processText(e.target.value)); // 포커스 잃을 때만

        fileInput.addEventListener('change', handleFileSelect); // 내부에서 processText 호출

        playButton.addEventListener('click', startPlayback);
        pauseButton.addEventListener('click', pausePlayback); // 내부에서 saveState 호출
        stopButton.addEventListener('click', stopPlayback); // 내부에서 saveState 호출
        prevWordButton.addEventListener('click', () => navigateWord('prev')); // 내부에서 pausePlayback(->saveState) 호출
        nextWordButton.addEventListener('click', () => navigateWord('next')); // 내부에서 pausePlayback(->saveState) 호출

        flashcardDisplay.addEventListener('click', () => { if (totalWords > 0) isPlaying ? pausePlayback() : startPlayback(); });

        // 진행 바 조작 (input: 드래그 중, change: 드래그 완료)
        wordProgressBar.addEventListener('input', (e) => { // 드래그 중 시각적 피드백
             const targetIndex = parseInt(e.target.value, 10);
             displayWord(targetIndex); // 단어만 표시 (시간/상태 변경 없음)
        });
        wordProgressBar.addEventListener('change', (e) => { // 드래그 완료 후 실제 이동 및 저장
             navigateWord(parseInt(e.target.value, 10));
        });

        jumpButton.addEventListener('click', handleJump); // 내부에서 navigateWord(->pausePlayback->saveState) 호출
        wordJumpInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleJump(); } });

        fullscreenButton.addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(); });
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        // 키보드 단축키 (이전과 동일, 각 액션 함수에서 saveState 처리)
        document.addEventListener('keydown', (e) => { /* ... (이전 코드와 동일, 각 액션 함수 내부에서 상태 저장) ... */
             if (['textarea', 'input'].includes(e.target.tagName.toLowerCase())) return;
             switch (e.code) {
                 case 'Space': e.preventDefault(); if (totalWords > 0) isPlaying ? pausePlayback() : startPlayback(); break;
                 case 'ArrowLeft': if (e.shiftKey) { e.preventDefault(); navigateWord('prev'); } break;
                 case 'ArrowRight': if (e.shiftKey) { e.preventDefault(); navigateWord('next'); } break;
                 case 'Escape': if (document.fullscreenElement) document.exitFullscreen(); else if (totalWords > 0) stopPlayback(); break;
                 case 'Home': if(totalWords > 0) { e.preventDefault(); navigateWord(0); } break;
                 case 'End': if(totalWords > 0) { e.preventDefault(); navigateWord(totalWords - 1); } break;
             }
        });

        // 페이지를 떠나기 전에 상태 저장 (추가적인 안전장치)
        window.addEventListener('beforeunload', () => {
            if (isPlaying) { // 재생 중이었다면 현재 시간 업데이트 후 저장
                 elapsedTimeBeforePause += Date.now() - startTime;
            }
            saveState();
        });
    }

    // --- 앱 시작 ---
    initializeApp();

}); // DOMContentLoaded End
