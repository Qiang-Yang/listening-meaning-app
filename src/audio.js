import { useEffect, useRef, useState } from "react";

export function speakText(text, setAudioStatus, options = {}) {
  if (!("speechSynthesis" in window)) {
    setAudioStatus("error");
    return false;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = options.lang || "en-US";
  utterance.rate = options.rate || 0.86;
  utterance.onstart = () => setAudioStatus("playing");
  utterance.onend = () => {
    setAudioStatus("ready");
    options.onEnd?.();
  };
  utterance.onerror = (event) => {
    if (event.error !== "canceled" && event.error !== "interrupted") {
      setAudioStatus("error");
    }
    options.onEnd?.();
  };
  window.speechSynthesis.speak(utterance);
  return true;
}

export function useRecorder() {
  const mediaRecorder = useRef(null);
  const streamRef = useRef(null);
  const chunks = useRef([]);
  const [status, setStatus] = useState("idle");
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [audioUrl]);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("当前浏览器不支持录音，请换用最新版 Chrome、Edge 或 Safari。");
      setStatus("error");
      return false;
    }
    try {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setError(null);
      chunks.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        setStatus("recorded");
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      setStatus("recording");
      return true;
    } catch {
      setError("无法使用麦克风。请允许浏览器麦克风权限后再试。");
      setStatus("error");
      return false;
    }
  };

  const stop = () => {
    if (mediaRecorder.current?.state === "recording") {
      mediaRecorder.current.stop();
    }
  };

  const clear = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setStatus("idle");
    setError(null);
  };

  return { status, audioUrl, error, start, stop, clear };
}
