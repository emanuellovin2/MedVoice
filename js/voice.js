// Voice input: Web Speech API (Google) — online, very accurate for Romanian
const Voice = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  let _recognition   = null;
  let _isRecording   = false;
  let _callbacks     = {};
  let _finalText     = '';
  let _generation    = 0;

  function init(callbacks) {
    _callbacks = {
      onModelLoading:  callbacks.onModelLoading  || (() => {}),
      onModelReady:    callbacks.onModelReady    || (() => {}),
      onStart:         callbacks.onStart         || (() => {}),
      onStop:          callbacks.onStop          || (() => {}),
      onTranscribing:  callbacks.onTranscribing  || (() => {}),
      onInterim:       callbacks.onInterim       || (() => {}),
      onTranscript:    callbacks.onTranscript    || (() => {}),
      onFieldComplete: callbacks.onFieldComplete || (() => {}),
      onClearField:    callbacks.onClearField    || (() => {}),
      onPrevField:     callbacks.onPrevField     || (() => {}),
      onGenerateDoc:   callbacks.onGenerateDoc   || (() => {}),
      onError:         callbacks.onError         || (() => {}),
    };
  }

  // Nu e nevoie de download — gata imediat
  function loadModel() {
    setTimeout(() => _callbacks.onModelReady(), 200);
  }

  function start(initialText) {
    if (_isRecording) return;
    if (!SR) {
      _callbacks.onError('Dictarea vocală nu este suportată în acest browser. Folosește Chrome.');
      return;
    }

    _finalText   = typeof initialText === 'string' ? initialText : '';
    _recognition = new SR();

    _recognition.lang            = 'ro-RO';
    _recognition.continuous      = true;
    _recognition.interimResults  = true;
    _recognition.maxAlternatives = 1;

    _recognition.onstart = () => {
      _isRecording = true;
      _callbacks.onStart();
    };

    // Capturăm generația curentă — rezultatele din generații mai vechi sunt ignorate
    const gen = _generation;

    _recognition.onresult = (event) => {
      if (_generation !== gen) return;
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          _finalText += t;
        } else {
          interim = t;
        }
      }
      _callbacks.onInterim((_finalText + interim).trim());
    };

    _recognition.onend = () => {
      if (_isRecording) {
        // S-a oprit singur (pauză lungă) — repornește automat
        try { _recognition.start(); } catch (_) {}
        return;
      }
      // Oprit de utilizator
      _callbacks.onStop();
      if (_generation !== gen) return;
      const text = _finalText.trim();
      if (text) _processText(text);
    };

    _recognition.onerror = (e) => {
      if (e.error === 'aborted' || e.error === 'no-speech') return;
      _isRecording = false;
      _finalText = '';
      _callbacks.onError('Eroare microfon: ' + e.error);
    };

    _recognition.start();
  }

  function stop() {
    if (!_isRecording || !_recognition) return;
    _isRecording = false;
    _recognition.stop();
  }

  function _processText(text) {
    _callbacks.onTranscript(text.trim());
  }

  function resume(previousText) {
    const base = (previousText || '').trim();
    start(base ? base + ' ' : '');
  }

  function resetText()   { _finalText = ''; _generation++; }
  function toggle()      { _isRecording ? stop() : start(); }
  function isRecording() { return _isRecording; }
  function isReady()     { return true; }
  function isLoading()   { return false; }
  function isSupported() { return !!SR; }

  return { init, loadModel, start, stop, resume, toggle, isRecording, isReady, isLoading, isSupported, resetText };
})();
