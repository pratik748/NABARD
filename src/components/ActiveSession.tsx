/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { type SurveySession, type FieldValue, PREDEFINED_QUESTIONS } from '../types';
import { db, saveSurvey, createDefaultAnswers, runCrossValidation, validateField } from '../utils/db';
import { Pencil,  
  Mic, MicOff, Check, X, MapPin, Camera, Save, ArrowLeft, Play, Pause,
  CheckCircle2, AlertTriangle, HelpCircle, MessageSquare, ChevronRight, ChevronLeft, RefreshCw 
 } from 'lucide-react';
import DigitalSignature from './DigitalSignature';

interface ActiveSessionProps {
  surveyId?: string | null;
  onBack: () => void;
}

export default function ActiveSession({ surveyId, onBack }: ActiveSessionProps) {
  const [survey, setSurvey] = useState<SurveySession | null>(null);
  const [activeSection, setActiveSection] = useState('Respondent Details');
  const [isRecording, setIsRecording] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string>('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [crossValidationIssues, setCrossValidationIssues] = useState<any[]>([]);
  const [playbackAudioUrl, setPlaybackAudioUrl] = useState<string | null>(null);
  const [isPlayingRecordedAudio, setIsPlayingRecordedAudio] = useState(false);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>("");

  // Recording variables
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Web Speech API Ref
  const speechRecognitionRef = useRef<any>(null);

  // Organize questions by sections
  const sections = Array.from(new Set(PREDEFINED_QUESTIONS.map(q => q.section)));

  // Load or create survey session
  useEffect(() => {
    let timerInterval: any;

    const initSurvey = async () => {
      if (surveyId) {
        const dbSurvey = await db.surveys.get(surveyId);
        if (dbSurvey) {
          setSurvey(dbSurvey);
          setCrossValidationIssues(runCrossValidation(dbSurvey.answers));
          if (dbSurvey.audioBlob) {
            const blob = new Blob([dbSurvey.audioBlob], { type: 'audio/webm' });
            setPlaybackAudioUrl(URL.createObjectURL(blob));
          }
          
          // Calculate elapsed time from creation for existing surveys
          const elapsed = Math.floor((Date.now() - dbSurvey.createdAt) / 1000);
          if (dbSurvey.status !== 'completed') {
            setSessionDuration(elapsed);
            timerInterval = setInterval(() => {
              setSessionDuration(prev => prev + 1);
            }, 1000);
          }
          return;
        }
      }

      // Create new session
      const newSurvey: SurveySession = {
        id: `survey_${Date.now()}`,
        respondentName: '',
        villageName: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'draft',
        answers: createDefaultAnswers(),
        fullTranscript: []
      };
      await db.surveys.put(newSurvey);
      setSurvey(newSurvey);
      requestGPS(newSurvey);
      
      timerInterval = setInterval(() => {
        setSessionDuration(prev => prev + 1);
      }, 1000);
    };

    initSurvey();

    return () => {
      stopRecording();
      if (timerInterval) clearInterval(timerInterval);
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.abort();
      }
    };
  }, [surveyId]);

  // Request GPS coordinates (PWA geolocation capability)
  const requestGPS = (currentSurvey: SurveySession) => {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation not supported on this device.');
      return;
    }

    setGpsLoading(true);
    setGpsStatus('Locating field coordinates...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const gpsData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };
        
        const updated = { ...currentSurvey, gps: gpsData };
        setSurvey(updated);
        saveSurvey(updated);
        setGpsLoading(false);
        setGpsStatus(`Lat: ${gpsData.latitude.toFixed(5)}, Lng: ${gpsData.longitude.toFixed(5)} (±${Math.round(gpsData.accuracy)}m)`);
      },
      (error) => {
        setGpsLoading(false);
        setGpsStatus(`GPS Denied: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Web Speech API real-time microphone support
  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported on this browser.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'hi-IN'; // Default to Hindi and Hinglish speech recognition

    rec.onresult = async (event: any) => {
      const resultIndex = event.resultIndex;
      const text = event.results[resultIndex][0].transcript;
      const confidence = event.results[resultIndex][0].confidence;
      
      const elapsedSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      handleVoiceTranscriptReceived(text, 'Respondent', elapsedSeconds, confidence);
    };

    rec.onerror = (e: any) => {
      console.error('Speech recognition error:', e);
    };

    rec.onend = () => {
      if (isRecording) {
        rec.start(); // Keep listening while recording is active
      }
    };

    speechRecognitionRef.current = rec;
    rec.start();
  };

  // Record audio locally
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRecording(true);
      startTimeRef.current = Date.now();
      audioChunksRef.current = [];

      // Primary Speech Recognition Web Speech API start
      startSpeechRecognition();

      // Audio Recording MediaRecorder
      const options = { mimeType: 'audio/webm' };
      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, options);
      } catch (e) {
        mediaRecorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        
        if (survey) {
          const updated = { ...survey, audioBlob: arrayBuffer };
          setSurvey(updated);
          await saveSurvey(updated);
          setPlaybackAudioUrl(URL.createObjectURL(audioBlob));
        }

        // Release mic resources
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // chunk every 1 second

      // Simulated sound wave mic level animation
      recordIntervalRef.current = setInterval(() => {
        setMicLevel(Math.floor(Math.random() * 80) + 10);
      }, 150);

    } catch (err) {
      alert('Microphone access is required to use the conversational voice assistant.');
      console.error(err);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    setMicLevel(0);
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.abort();
    }
  };

  // Voice Commands Parser ("Next", "Previous", "Repeat")
  const parseVoiceCommands = (text: string) => {
    const textLower = text.toLowerCase();
    
    // Voice command: "Next" / "agli sawal" / "aage"
    if (textLower.includes('next') || textLower.includes('agli') || textLower.includes('aage')) {
      const currentIndex = sections.indexOf(activeSection);
      if (currentIndex < sections.length - 1) {
        setActiveSection(sections[currentIndex + 1]);
        speakFeedback("Moving to next section");
        return true;
      }
    }
    // Voice command: "Previous" / "pichla sawal" / "piche"
    if (textLower.includes('previous') || textLower.includes('pichla') || textLower.includes('piche')) {
      const currentIndex = sections.indexOf(activeSection);
      if (currentIndex > 0) {
        setActiveSection(sections[currentIndex - 1]);
        speakFeedback("Moving to previous section");
        return true;
      }
    }
    // Voice command: "Repeat" / "dohrao"
    if (textLower.includes('repeat') || textLower.includes('dohrao')) {
      speakFeedback("Repeating active fields in this section.");
      return true;
    }
    return false;
  };

  const speakFeedback = (msg: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Processes transcripts dynamically (calls server backend Mistral)
  const handleVoiceTranscriptReceived = async (
    text: string, 
    speaker: 'Enumerator' | 'Respondent' | 'Woman 1' | 'Woman 2' | 'Unknown',
    timestampSeconds: number,
    confidence: number = 0.9
  ) => {
    if (!survey) return;

    // First check voice commands
    const isCommand = parseVoiceCommands(text);
    if (isCommand) return;

    // Append transcript item locally
    const transcriptItem = { speaker, text, timestamp: timestampSeconds, confidence };
    const updatedTranscript = [...survey.fullTranscript, transcriptItem];

    // Optimistically update local transcript list
    let updatedSurvey = { ...survey, fullTranscript: updatedTranscript };
    setSurvey(updatedSurvey);
    await saveSurvey(updatedSurvey);

    // Call server API for Structured Extraction
    setIsProcessingAI(true);
    try {
      const response = await fetch('/api/survey/process-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          currentAnswers: survey.answers,
          transcriptHistory: survey.fullTranscript
        })
      });

      if (response.ok) {
        const aiOutput = await response.json();
        
        // Map extracted fields into current session answers
        const updatedAnswers = { ...survey.answers };
        
        if (aiOutput.extractedFields && Array.isArray(aiOutput.extractedFields)) {
          aiOutput.extractedFields.forEach((field: any) => {
            const predefined = PREDEFINED_QUESTIONS.find(q => q.id === field.fieldId);
            if (!predefined) return;

            // Handle value type formatting & normalization
            let parsedValue = field.value;
            if (predefined.type === 'number') {
              parsedValue = Number(field.value);
            } else if (predefined.type === 'boolean') {
              parsedValue = String(field.value) === 'true';
            } else if (predefined.type === 'multiselect') {
              try {
                parsedValue = Array.isArray(field.value) ? field.value : JSON.parse(field.value);
              } catch {
                parsedValue = String(field.value).split(',').map(v => v.trim());
              }
            }

            // Perform field-level validation check
            const validationCheck = validateField(field.fieldId, parsedValue);

            updatedAnswers[field.fieldId] = {
              value: parsedValue,
              confidence: field.confidence || 0.95,
              sourceSnippet: field.sourceSnippet || text,
              audioTimestamp: timestampSeconds,
              status: validationCheck.isValid 
                ? (field.confidence >= 0.95 ? 'green' : field.confidence >= 0.8 ? 'yellow' : 'red')
                : 'red',
              lastModifiedBy: 'system',
              isConfirmed: false
            };

            // Capture respondent name and village name for easy summary in listings
            if (field.fieldId === 'respondent_name') {
              updatedSurvey.respondentName = String(parsedValue);
            }
            if (field.fieldId === 'address') {
              updatedSurvey.villageName = String(parsedValue);
            }
          });
        }

        updatedSurvey = {
          ...updatedSurvey,
          answers: updatedAnswers,
          // Correct speaker diarization if model classified it
          fullTranscript: updatedTranscript.map((item, idx) => {
            if (idx === updatedTranscript.length - 1 && aiOutput.speaker) {
              return { ...item, speaker: aiOutput.speaker };
            }
            return item;
          })
        };

        // Recalculate cross validation checks
        const issues = runCrossValidation(updatedAnswers);
        setCrossValidationIssues(issues);

        setSurvey(updatedSurvey);
        await saveSurvey(updatedSurvey);
      }
      else {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 503) {
          alert('API Key Error: ' + (errData.reasoning || 'Missing Mistral API Key'));
        } else {
          console.error('Extraction failed:', response.statusText);
        }
      }
    } catch (e) {
      console.error('Error extracting speech parameters:', e);
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Handles manual override text edits directly in form
  const handleFieldManualOverride = async (fieldId: string, value: any) => {
    if (!survey) return;

    const validationCheck = validateField(fieldId, value);
    const updatedAnswers = {
      ...survey.answers,
      [fieldId]: {
        value,
        confidence: 1.0,
        sourceSnippet: 'Manually entered',
        status: validationCheck.isValid ? 'green' : 'red',
        lastModifiedBy: 'user',
        isConfirmed: true
      } as FieldValue
    };

    let updatedSurvey = { ...survey, answers: updatedAnswers };
    
    // Update listing values if necessary
    if (fieldId === 'respondent_name') {
      updatedSurvey.respondentName = String(value);
    }
    if (fieldId === 'address') {
      updatedSurvey.villageName = String(value);
    }

    const issues = runCrossValidation(updatedAnswers);
    setCrossValidationIssues(issues);

    setSurvey(updatedSurvey);
    await saveSurvey(updatedSurvey);
  };

  // Handles investigator clicking "Confirm" on Yellow unconfirmed fields
  
  const handleEditSave = async (fieldId: string) => {
    if (!survey || editValue === "" || editValue === null) return;
    const updatedAnswers = { ...survey.answers };
    updatedAnswers[fieldId] = {
      value: editValue,
      confidence: 1.0,
      sourceSnippet: 'Manual Correction',
      audioTimestamp: 0,
      status: 'green',
      isConfirmed: true
    };
    const updatedSurvey = { ...survey, answers: updatedAnswers };
    setSurvey(updatedSurvey);
    await saveSurvey(updatedSurvey);
    setEditingField(null);
  };

  const handleConfirmField = async (fieldId: string) => {
    if (!survey) return;

    const field = survey.answers[fieldId];
    if (!field) return;

    const updatedAnswers = {
      ...survey.answers,
      [fieldId]: {
        ...field,
        status: 'green',
        isConfirmed: true
      } as FieldValue
    };

    const updatedSurvey = { ...survey, answers: updatedAnswers };
    setSurvey(updatedSurvey);
    await saveSurvey(updatedSurvey);
  };

  // Handles On-device compressed photo capturing
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!survey || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = async (event: any) => {
      const img = new Image();
      img.onload = async () => {
        // Compress Image using temporary canvas
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scale = MAX_WIDTH / img.width;
        
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convert to high-compression JPEG
        const base64Compressed = canvas.toDataURL('image/jpeg', 0.7);

        const newPhoto = {
          id: `photo_${Date.now()}`,
          base64: base64Compressed,
          caption: `Captured asset file: ${file.name}`,
          timestamp: Date.now()
        };

        const updatedPhotos = [...(survey.photos || []), newPhoto];
        const updatedSurvey = { ...survey, photos: updatedPhotos };
        setSurvey(updatedSurvey);
        await saveSurvey(updatedSurvey);
      };
      img.src = event.target.result;
    };

    reader.readAsDataURL(file);
  };

  // Signatures saving
  const handleSaveSignature = async (type: 'enumerator' | 'respondent', base64: string) => {
    if (!survey) return;

    const updatedSigs = {
      ...(survey.signatures || { enumerator: '', respondent: '' }),
      [type]: base64
    };

    const updatedSurvey = { ...survey, signatures: updatedSigs };
    setSurvey(updatedSurvey);
    await saveSurvey(updatedSurvey);
  };

  // Jump Audio elements to specific timestamps referenced in extraction snippets
  const handleSeekAudio = (seconds?: number) => {
    if (!seconds || !audioPlayerRef.current) return;
    audioPlayerRef.current.currentTime = seconds;
    audioPlayerRef.current.play();
    setIsPlayingRecordedAudio(true);
  };

  // Completion calculation
  const totalCompletedCount = survey
    ? Object.values(survey.answers).filter(
        (ans: any) => ans.value !== null && ans.value !== undefined && ans.value !== '' && (Array.isArray(ans.value) ? ans.value.length > 0 : true)
      ).length
    : 0;

  const totalQuestionsCount = PREDEFINED_QUESTIONS.length;
  const progressPercent = Math.round((totalCompletedCount / totalQuestionsCount) * 100);

  // Mark survey session as completed & return to dashboard
  const handleFinalizeSurvey = async () => {
    if (!survey) return;
    
    // Check if required fields are filled
    const missingRequired = PREDEFINED_QUESTIONS.filter(
      q => q.required && (!survey.answers[q.id]?.value)
    );

    if (missingRequired.length > 0) {
      alert(`Please fill mandatory fields before finalizing: \n${missingRequired.map(q => q.label).join('\n')}`);
      return;
    }

    const updated = { ...survey, status: 'completed' as const };
    await saveSurvey(updated);
    onBack();
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!survey) {
    return (
      <div className="flex justify-center items-center h-96">
        <RefreshCw className="animate-spin h-10 w-10 text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Session Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 md:p-6 rounded-2xl border border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-3 bg-slate-700 hover:bg-slate-600 text-gray-900 rounded-xl transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {survey.respondentName || 'New Rural Survey'}
            </h2>
            <p className="text-xs text-gray-500 font-mono mt-0.5">ID: {survey.id}</p>
          </div>
        </div>

        {/* GPS coordinates & network stats */}
        <div className="flex flex-wrap items-center gap-3">
          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold font-mono ${sessionDuration > 600 ? 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
            ⏱️ {formatDuration(sessionDuration)}
          </div>
          
          <div className="px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-2 text-xs text-gray-700">
            <MapPin className={`h-4 w-4 ${gpsLoading ? 'animate-bounce text-emerald-600' : 'text-gray-400'}`} />
            <span>{gpsStatus || 'GPS coordinates off'}</span>
          </div>

          <button
            id="btn_complete_survey"
            onClick={handleFinalizeSurvey}
            className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl flex items-center gap-2 transition-all"
          >
            <Save className="h-4.5 w-4.5" />
            Save & Finalize
          </button>
        </div>
      </div>

      {/* Progress & Audio Player bar */}
      <div className="bg-white border border-gray-200 p-4 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-700">INTERVIEW PROGRESS:</span>
            <span className="text-lg font-bold text-emerald-600">{totalCompletedCount} / {totalQuestionsCount} Fields ({progressPercent}%)</span>
          </div>
          <span className="text-xs text-gray-500 font-medium">Autosaved to IndexedDB (Dexie)</span>
        </div>
        <div className="w-full bg-gray-50 h-3 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
        </div>

        {/* Audio Evidence Audio Player */}
        {playbackAudioUrl && (
          <div className="bg-gray-100 p-3 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-500 uppercase">AUDIO EVIDENCE:</span>
              <audio
                ref={audioPlayerRef}
                src={playbackAudioUrl}
                controls
                onPlay={() => setIsPlayingRecordedAudio(true)}
                onPause={() => setIsPlayingRecordedAudio(false)}
                className="h-8 max-w-xs"
              />
            </div>
            <p className="text-[11px] text-gray-400">
              Click timestamps (e.g. <span className="text-emerald-600 font-bold font-mono">🔊 0:25</span>) below questions to listen to original audio parts.
            </p>
          </div>
        )}
      </div>

      {/* Main Grid: Transcription vs survey form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Voice input, live transcript logs, playback simulator */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Real-time Voice control module */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-gray-900">Enumerator Speech Assistant</h3>
            
            <div className="flex items-center gap-4">
              {isRecording ? (
                <button
                  id="btn_stop_mic"
                  onClick={stopRecording}
                  className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 animate-pulse"
                >
                  <MicOff className="h-5 w-5" />
                  Stop Assistant
                </button>
              ) : (
                <button
                  id="btn_start_mic"
                  onClick={startRecording}
                  className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 text-lg"
                >
                  <Mic className="h-5 w-5 stroke-[2.5]" />
                  Listen Interview
                </button>
              )}
            </div>

            {/* Simulated Audio levels visualizer */}
            {isRecording && (
              <div className="bg-gray-50 p-3 rounded-xl flex items-center gap-3">
                <span className="text-xs font-mono text-gray-500">MIC GAIN:</span>
                <div className="flex-1 flex items-center gap-0.5 h-6">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-emerald-500 w-1.5 rounded-full transition-all duration-75"
                      style={{ height: `${Math.max(4, Math.min(100, micLevel * (i % 2 === 0 ? 0.8 : 1.2) * (1 - Math.abs(12 - i)/12)))}%` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Scrolling Transcription Log */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 flex flex-col h-96">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Continuous Transcript Log</h3>
              {isProcessingAI && (
                <span className="text-xs text-emerald-600 flex items-center gap-1">
                  <RefreshCw className="animate-spin h-3.5 w-3.5" /> Mapping fields...
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
              {survey.fullTranscript.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 space-y-2">
                  <Mic className="h-8 w-8 text-slate-600" />
                  <p className="text-sm">Speak into the mic or click the Playbook dialogues above to begin capturing rural interview logs.</p>
                </div>
              ) : (
                survey.fullTranscript.map((log, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex flex-col gap-1 ${
                      log.speaker === 'Enumerator'
                        ? 'bg-gray-50/50 border-gray-200'
                        : 'bg-gray-50 border-slate-750'
                    }`}
                  >
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className={`font-bold ${log.speaker === 'Enumerator' ? 'text-gray-500' : 'text-emerald-600'}`}>
                        {log.speaker}
                      </span>
                      <button
                        onClick={() => handleSeekAudio(log.timestamp)}
                        className="text-emerald-500 hover:underline flex items-center gap-0.5 font-bold"
                      >
                        🔊 0:{log.timestamp < 10 ? `0${log.timestamp}` : log.timestamp}
                      </button>
                    </div>
                    <p className="text-xs text-gray-900 font-medium leading-relaxed">{log.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Autonomous Survey Status */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Cross-Field Validation Warnings */}
          {crossValidationIssues.length > 0 && (
            <div className="bg-amber-950/20 border border-amber-900/30 p-4 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                Cross-Field Logical Validation Warnings ({crossValidationIssues.length})
              </h4>
              <ul className="text-xs text-amber-200/80 list-disc list-inside space-y-1 font-medium">
                {crossValidationIssues.map((issue, idx) => (
                  <li key={idx}>{issue.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Survey State Checklist */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                Survey State
                <span className="text-sm font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-200">
                  {Object.keys(survey.answers || {}).length} / {PREDEFINED_QUESTIONS.length} Filled
                </span>
              </h3>
              <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-500 select-none hover:text-gray-700">
                <input
                  type="checkbox"
                  checked={hideCompleted}
                  onChange={(e) => setHideCompleted(e.target.checked)}
                  className="rounded bg-gray-100 border-gray-200 text-emerald-500 focus:ring-emerald-500/20"
                />
                Auto-hide Confirmed
              </label>
            </div>

            <div className="space-y-2">
              {PREDEFINED_QUESTIONS.map((q) => {
                const answer = survey.answers[q.id];
                const value = answer ? answer.value : null;
                const isConfirmed = answer ? answer.isConfirmed : false;
                const status = answer ? answer.status : 'empty';

                if (hideCompleted && (status === 'green' || isConfirmed)) {
                  return null;
                }

                let rowBg = 'bg-gray-50';
                const isNextPending = q.id === (PREDEFINED_QUESTIONS.find(pq => !survey.answers[pq.id] || (survey.answers[pq.id].status !== 'green' && !survey.answers[pq.id].isConfirmed))?.id);
                let borderClass = 'border-gray-200';
                let icon = <div className="w-5 h-5 rounded border-2 border-gray-300 flex-shrink-0 bg-white" />; // ⬜ Pending
                let valueDisplay = <span className="text-gray-400 italic text-sm font-medium">Waiting for response...</span>;
                if (isNextPending && (status === 'empty' || status === 'red')) {
                  rowBg = 'bg-blue-50/50';
                  borderClass = 'border-blue-400 shadow-sm';
                  icon = <div className="w-5 h-5 rounded border-2 border-blue-500 flex-shrink-0 bg-white" />;
                  valueDisplay = <span className="text-blue-500 italic text-sm font-bold animate-pulse">Active Question (Speak to answer)</span>;
                }

                if (status === 'green' || isConfirmed) {
                  rowBg = 'bg-emerald-50/50';
                  borderClass = 'border-emerald-200';
                  icon = <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />;
                  
                  // Format value
                  let displayStr = String(value);
                  if (typeof value === 'boolean') displayStr = value ? 'Yes' : 'No';
                  if (Array.isArray(value)) displayStr = value.join(', ');
                  
                  valueDisplay = <span className="font-bold text-gray-900 text-sm">{displayStr}</span>;
                } else if (status === 'yellow') {
                  rowBg = 'bg-amber-50/50';
                  borderClass = 'border-amber-200';
                  icon = <HelpCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />;
                  
                  let displayStr = String(value);
                  if (typeof value === 'boolean') displayStr = value ? 'Yes' : 'No';
                  if (Array.isArray(value)) displayStr = value.join(', ');

                  valueDisplay = (
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-amber-700 text-sm">{displayStr}</span>
                      <button 
                        onClick={() => { setEditingField(q.id); setEditValue(value); }}
                        className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded font-bold transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button 
                        onClick={() => handleConfirmField(q.id)}
                        className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded font-bold transition-colors shadow-sm flex items-center gap-1"
                      >
                        <Check className="h-3 w-3" /> Confirm
                      </button>
                    </div>
                  );
                } else if (status === 'red') {
                  rowBg = 'bg-red-50/50';
                  borderClass = 'border-red-200';
                  icon = <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />;
                  valueDisplay = (
                  <div className="flex items-center gap-3">
                    <span className="text-red-500 font-bold text-sm">Failed Validation</span>
                    <button 
                      onClick={() => { setEditingField(q.id); setEditValue(value || ""); }}
                      className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded font-bold transition-colors"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  </div>
                );
                }

                return (
                  <div
                    key={q.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl transition-all border ${borderClass} ${rowBg} gap-2`}
                  >
                    <div className="flex items-start sm:items-center gap-3 flex-1">
                      {icon}
                      <span className="text-sm font-bold text-gray-700">{q.label}</span>
                    </div>
                    <div className="sm:ml-8 sm:text-right">
                      {editingField === q.id ? (
                      <div className="flex items-center gap-2">
                        <input 
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-sm w-32 focus:ring-1 focus:ring-emerald-500"
                          placeholder="Correct answer..."
                        />
                        <button 
                          onClick={() => handleEditSave(q.id)}
                          className="bg-emerald-500 text-white p-1 rounded hover:bg-emerald-600"
                        ><Check className="w-4 h-4" /></button>
                      </div>
                    ) : valueDisplay}
                    </div>
                    
                    {answer && answer.audioTimestamp !== undefined && answer.audioTimestamp > 0 && (
                      <button
                        onClick={() => handleSeekAudio(answer.audioTimestamp)}
                        title="Listen to original source dialogue"
                        className="text-[10px] font-mono text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded font-bold transition-colors"
                      >
                        🔊 0:{answer.audioTimestamp < 10 ? `0${answer.audioTimestamp}` : answer.audioTimestamp}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Signatures & Consent Capture (At bottom of form) */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">
              <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-3">Digital Signature Consent</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DigitalSignature
                  label="Investigator / Enumerator Signature"
                  initialValue={survey.signatures?.enumerator}
                  onSave={(base64) => handleSaveSignature('enumerator', base64)}
                />
                <DigitalSignature
                  label="Respondent Thumbprint / Mark"
                  initialValue={survey.signatures?.respondent}
                  onSave={(base64) => handleSaveSignature('respondent', base64)}
                />
              </div>
            </div>

          {/* Photo evidence capturing (At bottom of details) */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">
              <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-3">Asset Photo Evidence (Optional)</h3>
              
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                  <p className="text-xs text-gray-500">Capture local physical assets (house, livestock, documents) compressed automatically on-device.</p>
                  
                  <label className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-colors">
                    <Camera className="h-4 w-4" />
                    Capture Photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {survey.photos && survey.photos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {survey.photos.map((photo) => (
                      <div key={photo.id} className="relative bg-gray-50 border border-gray-200 rounded-xl overflow-hidden group">
                        <img src={photo.base64} alt={photo.caption} className="w-full h-32 object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-gray-100/80 p-2 text-[10px] text-gray-700 font-bold truncate">
                          {photo.caption}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
