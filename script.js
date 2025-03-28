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

    // --- 상태 변수 ---
    let words = [];
    let currentIndex = 0;
    let totalWords = 0;
    let isPlaying = false;
    let isSmartReadingEnabled = smartReadingCheckbox.checked;
    let currentWpm = parseInt(wpmInput.value, 10) || 120;
    let baseDelay = calculateBaseDelay(currentWpm); // 기본 WPM 기준 딜레이
    let timeoutId = null; // setTimeout ID
    let timeUpdateIntervalId = null;
    let startTime = 0;
    let elapsedTimeBeforePause = 0;

    // --- 스마트 리딩 설정 ---
    const smartReadingOptions = {
        baseWordLength: 5,
        speedUpFactorMax: 0.85, // 15% faster (1.0 - 0.15)
        slowDownFactorMax: 1.25, // 25% slower (1.0 + 0.25)
        referenceLengthShort: 1,
        referenceLengthLong: 10,
        minAbsoluteDelay: 100 // 최소 지연 시간 (ms)
    };

    // --- 초기화 ---
    function initializeApp() {
        loadTheme();
        updateWpmDisplay(currentWpm); // 초기 WPM 표시 및 baseDelay 계산
        disableControls(); // 초기 컨트롤 비활성화
        resetTimeDisplay();

        // 이벤트 리스너 연결
        bindEventListeners();
    }

    // --- 핵심 함수 ---

    // 기본 딜레이 계산 (WPM -> ms)
    function calculateBaseDelay(wpm) {
        if (isNaN(wpm) || wpm <= 0) return 3000; // 안전값 (20 WPM)
        return (60 / wpm) * 1000;
    }

    // 스마트 리딩 딜레이 계산
    function calculateSmartDelay(word) {
        const wordLength = word.length;
        const { baseWordLength, speedUpFactorMax, slowDownFactorMax,
                referenceLengthShort, referenceLengthLong, minAbsoluteDelay } = smartReadingOptions;

        let factor = 1.0;
        const shortRange = baseWordLength - referenceLengthShort;
        const longRange = referenceLengthLong - baseWordLength;

        if (wordLength < baseWordLength && shortRange > 0) {
            const effectiveLength = Math.max(referenceLengthShort, wordLength);
            factor = 1.0 - (1.0 - speedUpFactorMax) * (baseWordLength - effectiveLength) / shortRange;
        } else if (wordLength > baseWordLength && longRange > 0) {
            const effectiveLength = Math.min(referenceLengthLong, wordLength);
            factor = 1.0 + (slowDownFactorMax - 1.0) * (effectiveLength - baseWordLength) / longRange;
        }

        factor = Math.max(speedUpFactorMax, Math.min(slowDownFactorMax, factor)); // 범위 제한
        const calculatedDelay = baseDelay * factor;
        return Math.max(calculatedDelay, minAbsoluteDelay); // 최소 딜레이 적용
    }

    // 밀리초 -> mm:ss 변환
    function formatTime(ms) {
        if (isNaN(ms) || ms < 0) return "00:00";
        const totalSeconds = Math.round(ms / 1000); // 반올림
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    // 총 예상 시간 계산 및 표시 (기본 WPM 기준)
    function calculateAndDisplayTotalTime() {
        const totalMs = totalWords * baseDelay;
        totalTimeDisplay.textContent = formatTime(totalMs);
    }

    // 현재 재생 시간 업데이트
    function updateCurrentTime() {
        if (!isPlaying) return;
        const elapsed = Date.now() - startTime + elapsedTimeBeforePause;
        currentTimeDisplay.textContent = formatTime(elapsed);
    }

    // 시간 표시 초기화
    function resetTimeDisplay() {
        currentTimeDisplay.textContent = "00:00";
        totalTimeDisplay.textContent = "00:00";
    }

    // WPM UI 업데이트 및 딜레이 재계산
    function updateWpmDisplay(wpm) {
        // 숫자 입력은 제한 없음, 슬라이더와 레이블만 범위 적용
        const displayWpm = Math.max(20, Math.min(600, parseInt(wpm, 10) || currentWpm));
        currentWpm = parseInt(wpm, 10) || currentWpm; // 실제 WPM 값 업데이트 (제한 없이)
        if (currentWpm <= 0) currentWpm = 1; // 0 이하 방지

        wpmValueLabel.textContent = currentWpm; // 레이블에는 실제 값 표시

        // 슬라이더 값은 범위 내로 조정
        const sliderWpm = Math.max(20, Math.min(600, currentWpm));
        if (wpmSlider.value != sliderWpm) wpmSlider.value = sliderWpm;

        // 현재 WPM 입력 필드 값이 다를 경우에만 업데이트 (사용자 입력 방해 방지)
        if (wpmInput.value != currentWpm) wpmInput.value = currentWpm;

        const newBaseDelay = calculateBaseDelay(currentWpm);
        if (newBaseDelay !== baseDelay) {
            baseDelay = newBaseDelay;
            calculateAndDisplayTotalTime(); // 총 시간 다시 계산
        }
    }

    // 테마 로드 및 적용
    function loadTheme() {
        const savedTheme = localStorage.getItem('smartReaderTheme') || 'light';
        applyTheme(savedTheme);
    }

    // 테마 적용
    function applyTheme(theme) {
         if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeIcon.classList.replace('fa-moon', 'fa-sun');
            themeToggleButton.title = "라이트 모드";
        } else {
            document.body.classList.remove('dark-mode');
            themeIcon.classList.replace('fa-sun', 'fa-moon');
            themeToggleButton.title = "다크 모드";
        }
    }

    // 테마 토글
    function toggleTheme() {
        const isDarkMode = document.body.classList.toggle('dark-mode');
        const newTheme = isDarkMode ? 'dark' : 'light';
        localStorage.setItem('smartReaderTheme', newTheme);
        applyTheme(newTheme); // 아이콘 및 title 업데이트 위해 호출
    }

    // 스마트 리딩 모드 토글
    function toggleSmartReading() {
        isSmartReadingEnabled = smartReadingCheckbox.checked;
        // 필요 시 시각적 피드백 추가 가능
    }

    // 텍스트 처리 및 상태 초기화
    function processText(text) {
        stopPlayback(); // 기존 재생 중지 및 초기화
        words = text.trim().split(/[\s\n]+/).filter(word => word !== '');
        totalWords = words.length;
        currentIndex = 0;
        elapsedTimeBeforePause = 0;
        resetTimeDisplay();

        if (totalWords > 0) {
            updateNavigationUI(0); // 네비게이션 UI 설정
            displayWord(0); // 첫 단어 표시
            calculateAndDisplayTotalTime(); // 전체 시간 계산
            enableControls(); // 컨트롤 활성화
            wordJumpInput.max = totalWords; // 점프 입력 최대값 설정
        } else {
            wordContent.textContent = "내용 없음";
            disableControls(); // 컨트롤 비활성화
        }
    }

    // 파일 읽기
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file && file.type === "text/plain") {
            const reader = new FileReader();
            reader.onload = (e) => {
                sentenceInput.value = e.target.result;
                processText(e.target.result);
            };
            reader.onerror = () => alert("파일 읽기 오류");
            reader.readAsText(file);
        } else if (file) {
            alert("'.txt' 텍스트 파일만 선택해주세요.");
        }
        event.target.value = null;
    }

    // 특정 단어 표시 및 UI 업데이트
    function displayWord(index) {
        if (index >= 0 && index < totalWords) {
            // 단어 변경 효과
            wordContent.classList.add('updating');
            setTimeout(() => {
                 wordContent.textContent = words[index];
                 wordContent.classList.remove('updating');
            }, 50); // CSS transition 시간과 비슷하게

            updateNavigationUI(index);
        } else if (totalWords === 0) {
            wordContent.textContent = "내용 없음";
        }
    }

    // 다음 단어 표시 예약 및 실행 (setTimeout 체인)
    function scheduleNextWord() {
        if (!isPlaying || currentIndex >= totalWords) {
            if (currentIndex >= totalWords && totalWords > 0) { // 재생 완료
                handlePlaybackEnd();
            }
            return; // 더 이상 예약 안 함
        }

        // 현재 단어 표시 (이미 scheduleNextWord는 다음 단어를 위한 예약을 의미)
        displayWord(currentIndex);

        // 다음 단어 표시까지의 딜레이 계산
        const currentWord = words[currentIndex];
        const delay = isSmartReadingEnabled
                      ? calculateSmartDelay(currentWord)
                      : baseDelay;

        // 다음 호출 예약
        clearTimeout(timeoutId); // 이전 예약 취소 (안전장치)
        timeoutId = setTimeout(() => {
            currentIndex++; // 다음 단어로 이동
            scheduleNextWord(); // 재귀적으로 다음 예약
        }, delay);
    }

     // 재생 완료 처리
    function handlePlaybackEnd() {
        isPlaying = false; // 여기서 isPlaying을 false로 설정해야 함
        clearTimeout(timeoutId);
        clearInterval(timeUpdateIntervalId);
        // 마지막 단어 유지 또는 완료 메시지 표시
        // displayWord(totalWords - 1);
        wordContent.textContent = "✨ 완료 ✨";
        currentIndex = totalWords; // 인덱스를 끝으로 설정 (다음 재생 시 처음부터 시작)
        updateNavigationUI(totalWords - 1); // UI는 마지막 단어 인덱스
        updateButtonStates();
        updateOverlayIcon();
        // 시간 표시 정지 (마지막 시간으로)
        elapsedTimeBeforePause += Date.now() - startTime;
        updateCurrentTime(); // 마지막 시간 업데이트
    }


    // 재생 시작
    function startPlayback() {
        if (isPlaying || totalWords === 0) return;

        // 완료 상태에서 재생 시 처음부터
        if (currentIndex >= totalWords) {
            currentIndex = 0;
            elapsedTimeBeforePause = 0;
            resetTimeDisplay();
        }

        isPlaying = true;
        startTime = Date.now();

        clearTimeout(timeoutId);
        scheduleNextWord(); // setTimeout 체인 시작

        clearInterval(timeUpdateIntervalId); // 기존 시간 업데이트 중지
        timeUpdateIntervalId = setInterval(updateCurrentTime, 200);

        updateButtonStates();
        updateOverlayIcon();
    }

    // 일시정지
    function pausePlayback() {
        if (!isPlaying) return;
        isPlaying = false;
        clearTimeout(timeoutId); // 예약된 다음 단어 표시 취소
        clearInterval(timeUpdateIntervalId);
        elapsedTimeBeforePause += Date.now() - startTime; // 시간 누적

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

        if (totalWords > 0) {
            displayWord(0);
        } else {
            wordContent.textContent = "텍스트를 입력하거나 파일을 여세요";
        }

        // UI 업데이트 (상태 변경 시 또는 단어가 있을 때)
        if (wasPlaying || totalWords > 0) {
            updateButtonStates();
            updateOverlayIcon();
        }
         if (totalWords === 0) disableControls(); // 단어 없으면 비활성화
    }

    // 이전/다음 단어 이동 공통 로직
    function navigateWord(direction) {
        if (totalWords === 0) return;
        const wasPlaying = isPlaying;
        pausePlayback(); // 이동 시 항상 일시정지

        if (direction === 'prev') {
             currentIndex = Math.max(0, currentIndex - 1);
        } else if (direction === 'next') {
             currentIndex = Math.min(totalWords - 1, currentIndex + 1);
        } else if (typeof direction === 'number') { // 특정 인덱스로 점프
             currentIndex = Math.max(0, Math.min(totalWords - 1, direction));
             wordJumpInput.value = ''; // 점프 후 입력 필드 비우기
        }

        // 시간 추정치 업데이트 (선택적, 더 정확하게 하려면 복잡해짐)
        elapsedTimeBeforePause = currentIndex * baseDelay;
        resetTimeDisplay(); // 간단히 리셋 또는
        updateCurrentTime(); // 추정치로 업데이트

        displayWord(currentIndex);
        updateButtonStates();

        // 옵션: 이동 후 자동으로 다시 재생 (이전 상태가 재생 중이었을 경우)
        // if (wasPlaying) { startPlayback(); }
    }

    // 특정 단어로 점프 (입력 필드 및 버튼 핸들러)
    function handleJump() {
        const targetIndex = parseInt(wordJumpInput.value, 10) - 1; // 1 기반 입력 -> 0 기반 인덱스
        if (!isNaN(targetIndex) && targetIndex >= 0 && targetIndex < totalWords) {
            navigateWord(targetIndex);
        } else if (wordJumpInput.value.trim() !== '') {
            alert(`1부터 ${totalWords} 사이의 번호를 입력하세요.`);
            wordJumpInput.value = '';
        }
    }

    // 네비게이션 UI 업데이트
    function updateNavigationUI(index) {
        if (totalWords > 0) {
            const displayIndex = Math.min(index, totalWords - 1); // 완료 상태 고려
             if (wordProgressBar.value != displayIndex) wordProgressBar.value = displayIndex;
             currentWordIndexLabel.textContent = displayIndex + 1; // 1 기반
             totalWordCountLabel.textContent = totalWords;
        } else {
             wordProgressBar.value = 0;
             currentWordIndexLabel.textContent = 0;
             totalWordCountLabel.textContent = 0;
        }
    }

    // 컨트롤 활성화/비활성화
    function enableControls() {
        wordProgressBar.disabled = false;
        wordJumpInput.disabled = false;
        jumpButton.disabled = false;
        prevWordButton.disabled = false;
        playButton.disabled = false;
        // pauseButton은 isPlaying 상태에 따라 JS에서 제어
        stopButton.disabled = false;
        nextWordButton.disabled = false;
        updateButtonStates(); // 현재 상태에 맞게 버튼 활성화/비활성화
    }
    function disableControls() {
        wordProgressBar.disabled = true;
        wordProgressBar.value = 0;
        wordJumpInput.disabled = true;
        wordJumpInput.value = '';
        jumpButton.disabled = true;
        prevWordButton.disabled = true;
        playButton.disabled = true;
        pauseButton.disabled = true;
        pauseButton.style.display = 'none'; // 확실히 숨김
        playButton.style.display = 'inline-flex'; // Play 버튼 표시
        stopButton.disabled = true;
        nextWordButton.disabled = true;
        updateNavigationUI(-1); // 레이블 초기화
    }

    // 버튼 상태 업데이트
    function updateButtonStates() {
        const hasWords = totalWords > 0;
        const canPlay = hasWords && !isPlaying;
        const canPause = hasWords && isPlaying;
        const canStop = hasWords; // 단어 있으면 정지 가능
        const canPrev = hasWords && currentIndex > 0;
        const canNext = hasWords && currentIndex < totalWords - 1; // 완료 상태 아닐 때만

        playButton.style.display = !isPlaying ? 'inline-flex' : 'none';
        pauseButton.style.display = isPlaying ? 'inline-flex' : 'none';

        playButton.disabled = !canPlay;
        pauseButton.disabled = !canPause;
        stopButton.disabled = !canStop;
        prevWordButton.disabled = !canPrev;
        nextWordButton.disabled = !canNext;

        // 점프 버튼은 단어가 있을 때만 활성화
        jumpButton.disabled = !hasWords;
        wordJumpInput.disabled = !hasWords;
    }

    // 오버레이 아이콘 업데이트
    function updateOverlayIcon() {
        playPauseOverlay.classList.toggle('is-playing', isPlaying);
        playPauseOverlay.classList.toggle('is-paused', !isPlaying);
        playPauseIcon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
    }

    // 전체 화면 토글
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            flashcardDisplay.requestFullscreen().catch(err => alert(`전체 화면 오류: ${err.message}`));
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    }

    // 전체 화면 변경 감지
    function handleFullscreenChange() {
        const fullscreenIcon = fullscreenButton.querySelector('i');
        const isFullscreen = document.fullscreenElement === flashcardDisplay;
        fullscreenIcon.className = isFullscreen ? 'fas fa-compress' : 'fas fa-expand';
        fullscreenButton.title = isFullscreen ? "전체 화면 나가기" : "전체 화면 보기";
    }

    // --- 이벤트 리스너 바인딩 ---
    function bindEventListeners() {
        themeToggleButton.addEventListener('click', toggleTheme);
        smartReadingCheckbox.addEventListener('change', toggleSmartReading);

        wpmSlider.addEventListener('input', (e) => updateWpmDisplay(e.target.value));
        wpmInput.addEventListener('input', (e) => updateWpmDisplay(e.target.value));
        wpmInput.addEventListener('change', (e) => { // 포커스 아웃 시 최종 값 반영 및 검증
             const val = parseInt(e.target.value, 10);
             updateWpmDisplay(isNaN(val) || val <= 0 ? 1 : val); // 0 이하면 1로 강제
        });


        sentenceInput.addEventListener('input', (e) => processText(e.target.value));
        fileInput.addEventListener('change', handleFileSelect);

        playButton.addEventListener('click', startPlayback);
        pauseButton.addEventListener('click', pausePlayback);
        stopButton.addEventListener('click', stopPlayback);
        prevWordButton.addEventListener('click', () => navigateWord('prev'));
        nextWordButton.addEventListener('click', () => navigateWord('next'));

        flashcardDisplay.addEventListener('click', () => {
            if (totalWords > 0) { // 단어가 있을 때만 작동
                 if (isPlaying) pausePlayback();
                 else startPlayback();
            }
        });

        wordProgressBar.addEventListener('input', (e) => {
            navigateWord(parseInt(e.target.value, 10));
        });

        jumpButton.addEventListener('click', handleJump);
        wordJumpInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // 폼 제출 방지
                handleJump();
            }
        });


        fullscreenButton.addEventListener('click', (e) => {
            e.stopPropagation(); // 플래시카드 클릭(재생/일시정지) 방지
            toggleFullscreen();
        });
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        // 키보드 단축키
        document.addEventListener('keydown', (e) => {
            if (['textarea', 'input'].includes(e.target.tagName.toLowerCase())) return; // 입력 중엔 무시

            switch (e.code) { // e.key 대신 e.code 사용 (레이아웃 무관)
                case 'Space':
                    e.preventDefault();
                    if (totalWords > 0) isPlaying ? pausePlayback() : startPlayback();
                    break;
                case 'ArrowLeft':
                    if (e.shiftKey) { e.preventDefault(); navigateWord('prev'); }
                    break;
                case 'ArrowRight':
                    if (e.shiftKey) { e.preventDefault(); navigateWord('next'); }
                    break;
                case 'Escape':
                    if (document.fullscreenElement) document.exitFullscreen();
                    else if (totalWords > 0) stopPlayback();
                    break;
                case 'Home':
                    if(totalWords > 0) { e.preventDefault(); navigateWord(0); }
                    break;
                case 'End':
                     if(totalWords > 0) { e.preventDefault(); navigateWord(totalWords - 1); }
                    break;
            }
        });
    }

    // --- 앱 시작 ---
    initializeApp();

}); // DOMContentLoaded End
