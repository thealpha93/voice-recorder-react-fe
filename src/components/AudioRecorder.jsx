import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import { EVENTS } from '../configs/constants';
import './AudioRecorder.css';
import { BACKEND_URL } from '../configs/config';

function AudioRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [status, setStatus] = useState('Ready to record');
    const [duration, setDuration] = useState(0);

    const mediaRecorder = useRef(null);
    const socket = useRef(null);
    const recordingStream = useRef(null);
    const startTime = useRef(null);
    const pausedDuration = useRef(0);
    const pauseStartTime = useRef(null);
    const timerInterval = useRef(null);

    useEffect(() => {
        socket.current = io(BACKEND_URL);

        socket.current.on('connect', () => {
            setStatus('Connected to server');
        });

        socket.current.on('disconnect', () => {
            setStatus('Disconnected from server');
        });

        return () => {
            if (socket.current) {
                socket.current.disconnect();
            }
            if (timerInterval.current) {
                clearInterval(timerInterval.current);
            }
        };
    }, []);

    // Timer effect
    useEffect(() => {
        if (isRecording && !isPaused) {
            timerInterval.current = setInterval(() => {
                if (startTime.current) {
                    const currentDuration = Date.now() - startTime.current - pausedDuration.current;
                    setDuration(currentDuration);
                }
            }, 100);
        }

        return () => {
            if (timerInterval.current) {
                clearInterval(timerInterval.current);
            }
        };
    }, [isRecording, isPaused]);

    // TODO: move to time utils
    const formattedDuration = React.useMemo(() => {
        const totalSeconds = Math.floor(duration / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, [duration]);

    // TODO: Can be later refactored to use custom hooks for decoupling
    const startRecording = async () => {
        try {
            if (isPaused) {
                resumeRecording();
                return;
            }

            if (socket.current) {
                socket.current.emit(EVENTS.START_RECORDING);
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            recordingStream.current = stream;
            mediaRecorder.current = new MediaRecorder(stream);

            mediaRecorder.current.ondataavailable = (event) => {
                if (event.data.size > 0 && socket.current) {
                    socket.current.emit(EVENTS.AUDIO_DATA, event.data);
                }
            };

            // collect 100ms of data
            mediaRecorder.current.start(100);
            setIsRecording(true);
            startTime.current = Date.now();
            pausedDuration.current = 0;
            setStatus('Recording...');
        } catch (error) {
            console.error('Error accessing microphone:', error);
            setStatus('Error accessing microphone');
        }
    };

    const pauseRecording = () => {
        if (mediaRecorder.current && isRecording) {
            mediaRecorder.current.pause();
            setIsPaused(true);
            pauseStartTime.current = Date.now();
            setStatus('Recording paused');
            socket.current.emit(EVENTS.PAUSE_RECORDING);
        }
    };

    const resumeRecording = () => {
        if (mediaRecorder.current && isPaused) {
            mediaRecorder.current.resume();
            setIsPaused(false);
            pausedDuration.current += Date.now() - pauseStartTime.current;
            setStatus('Recording...');
            socket.current.emit(EVENTS.RESUME_RECORDING);
        }
    };

    const stopRecording = () => {
        if (mediaRecorder.current && (isRecording || isPaused)) {
            mediaRecorder.current.stop();
            recordingStream.current.getTracks().forEach(track => track.stop());
            socket.current.emit(EVENTS.STOP_RECORDING);

            setIsRecording(false);
            setIsPaused(false);
            startTime.current = null;
            pausedDuration.current = 0;
            setDuration(0);
            setStatus('Recording stopped');
        }
    };

    return (
        <div className="audio-recorder">
            <div className="controls">
                <button 
                    onClick={startRecording}
                    disabled={isRecording && !isPaused}
                    className="control-btn"
                >
                    {isPaused ? 'Resume' : 'Start Recording'}
                </button>
                <button 
                    onClick={pauseRecording}
                    disabled={!isRecording || isPaused}
                    className="control-btn pause"
                >
                    Pause
                </button>
                <button 
                    onClick={stopRecording}
                    disabled={!isRecording && !isPaused}
                    className="control-btn stop"
                >
                    Stop Recording
                </button>
            </div>
            <div className="status">
                {status}
            </div>
            {(isRecording || isPaused) && (
                <div className="timer">
                    {formattedDuration}
                </div>
            )}
        </div>
    );
}

export default AudioRecorder;