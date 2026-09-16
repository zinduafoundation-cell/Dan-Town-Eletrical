"use client";

import { ScanLine, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type DetectedBarcode = { rawValue?: string };
type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

declare global {
  interface Window { BarcodeDetector?: BarcodeDetectorConstructor }
}

export function CameraBarcodeScanner({ onDetected }: { onDetected: (barcode: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  function close() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setOpen(false);
  }

  useEffect(() => close, []);

  useEffect(() => {
    const BarcodeDetectorClass = window.BarcodeDetector;
    if (!open || !streamRef.current || !videoRef.current || !BarcodeDetectorClass) return;
    let cancelled = false;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    const startScanning = async () => {
      try {
        await video.play();
        const detector = new BarcodeDetectorClass({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] });
        const scan = async () => {
          if (cancelled || !videoRef.current || !streamRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            const barcode = results.find((result) => result.rawValue)?.rawValue;
            if (barcode) {
              onDetected(barcode);
              close();
              return;
            }
          } catch {
            setMessage("The camera could not read this image. Hold the barcode steady and try again.");
          }
          frameRef.current = requestAnimationFrame(scan);
        };
        frameRef.current = requestAnimationFrame(scan);
      } catch {
        setMessage("The camera could not start. Check browser permissions and try again.");
      }
    };
    startScanning();
    return () => { cancelled = true; if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); };
  }, [open, onDetected]);

  async function start() {
    setMessage("");
    if (!window.BarcodeDetector) {
      setOpen(true);
      setMessage("Camera barcode scanning is not supported in this browser. Use a hardware scanner or type the barcode.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setOpen(true);
      setMessage("This device does not provide camera access. Use a hardware scanner or type the barcode.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setOpen(true);
    } catch {
      setOpen(true);
      setMessage("Camera access was not granted. Check browser permissions or use a hardware scanner.");
    }
  }

  return <>
    <button type="button" className="pos-camera-scan-button" onClick={start} aria-label="Scan barcode with camera"><ScanLine size={16} /> Scan</button>
    {open && <div className="pos-camera-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><div className="pos-camera-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-scan-title"><div className="pos-camera-heading"><div><p className="eyebrow">POS scanner</p><h2 id="camera-scan-title">Scan a product barcode</h2></div><button type="button" className="pos-camera-close" onClick={close} aria-label="Close camera scanner"><X size={18} /></button></div>{message ? <p className="pos-camera-message" role="status">{message}</p> : <div className="pos-camera-viewfinder"><video ref={videoRef} muted playsInline /><span aria-hidden="true" /></div>}<p className="pos-camera-hint">Use good light and keep the barcode inside the frame.</p></div></div>}
  </>;
}
