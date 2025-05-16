import React, { useEffect, useRef, useState } from 'react';

const DualPlayerWebAudio = () => {
  const audioCtxRef = useRef(null);
  const vocalGainRef = useRef(null);
  const instGainRef = useRef(null);
  const vocalBufferRef = useRef(null);
  const instBufferRef = useRef(null);
  const startTimeRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const animationFrameRef = useRef(null);
  const sourceRefs = useRef({ vocal: null, inst: null });
  const [lyrics, setLyrics] = useState([]);

  // Load audio and lyrics
  useEffect(() => {
    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();

    const loadBuffer = async (url) => {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      return await audioCtxRef.current.decodeAudioData(arrayBuffer);
    };

    const loadAll = async () => {
      const [vocalBuf, instBuf] = await Promise.all([
        loadBuffer('/vocals.wav'),
        loadBuffer('/no_vocals.wav'),
      ]);
      vocalBufferRef.current = vocalBuf;
      instBufferRef.current = instBuf;
      setDuration(vocalBuf.duration);
    };

    const fetchLyrics = async () => {
      const res = await fetch('/lyrics.json');
      const data = await res.json();
      setLyrics(data);
    };

    loadAll();
    fetchLyrics();

    return () => {
      audioCtxRef.current.close();
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const play = (offset = 0) => {
    const ctx = audioCtxRef.current;

    const vocalSource = ctx.createBufferSource();
    const instSource = ctx.createBufferSource();

    vocalSource.buffer = vocalBufferRef.current;
    instSource.buffer = instBufferRef.current;

    const vocalGain = ctx.createGain();
    const instGain = ctx.createGain();

    vocalSource.connect(vocalGain).connect(ctx.destination);
    instSource.connect(instGain).connect(ctx.destination);

    vocalGainRef.current = vocalGain;
    instGainRef.current = instGain;

    vocalSource.start(0, offset);
    instSource.start(0, offset);

    sourceRefs.current.vocal = vocalSource;
    sourceRefs.current.inst = instSource;
    startTimeRef.current = ctx.currentTime - offset;
    setIsPlaying(true);

    updateProgress();
  };

  const pause = () => {
    if (sourceRefs.current.vocal) sourceRefs.current.vocal.stop();
    if (sourceRefs.current.inst) sourceRefs.current.inst.stop();
    setIsPlaying(false);
    cancelAnimationFrame(animationFrameRef.current);
  };

  const togglePlay = () => {
    if (!isPlaying) {
      play(progress);
    } else {
      pause();
    }
  };

  const updateProgress = () => {
    const current = audioCtxRef.current.currentTime - startTimeRef.current;
    if (current >= duration) {
      setIsPlaying(false);
      setProgress(duration);
      return;
    }
    setProgress(current);
    animationFrameRef.current = requestAnimationFrame(updateProgress);
  };

  const seek = (value) => {
    pause();
    setProgress(value);
    play(value);
  };

  const setVolume = (type, value) => {
    if (type === 'vocal' && vocalGainRef.current) {
      vocalGainRef.current.gain.value = value;
    } else if (type === 'inst' && instGainRef.current) {
      instGainRef.current.gain.value = value;
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto'}}>
      <h2>🎧 Web Audio Sync Player</h2>

      <button onClick={togglePlay}>{isPlaying ? 'Pause' : 'Play'}</button>

      <div style={{ marginTop: '1rem' }}>
        <label>Seek: </label>
        <input
          type="range"
          min="0"
          max={duration}
          step="0.01"
          value={progress}
          onChange={(e) => seek(parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
        <div>{progress.toFixed(1)} / {duration.toFixed(1)} sec</div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label>Vocals Volume:</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          defaultValue="1"
          onChange={(e) => setVolume('vocal', parseFloat(e.target.value))}
        />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label>Instrumental Volume:</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          defaultValue="1"
          onChange={(e) => setVolume('inst', parseFloat(e.target.value))}
        />
  {/* Lyrics Display */}
  <div style={{ marginTop: '2rem', minHeight: '5em', textAlign: 'center' }}>
        {lyrics.map((line, i) => {
          const isCurrent = progress >= line.start && progress < line.end;
          const isPrevious = i > 0 && progress >= lyrics[i - 1].start && progress < line.start;
          const isNext = i < lyrics.length - 1 && progress >= line.end && progress < lyrics[i + 1].start;

          const style = {
            opacity: isCurrent ? 1 : (isPrevious || isNext) ? 0.5 : 0.2,
            color: isCurrent ? '#ffd700' : '#999',
            fontWeight: isCurrent ? 'bold' : 'normal',
            fontSize: isCurrent ? '1.5rem' : '1rem',
            transition: 'all 0.2s ease',
          };

          if (isPrevious || isCurrent || isNext) {
            return (
              <div key={i} style={style}>
                {line.text.trim() === '' ? '...' : line.text}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
	</div>
  );
};

export default DualPlayerWebAudio;
