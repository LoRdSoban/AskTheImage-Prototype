import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { MicrophoneIcon, PhotoIcon, PlayIcon, StopIcon } from '@heroicons/react/24/solid';

const API_BASE_URL = 'http://localhost:8000';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('audio_file', audioBlob);

        try {
          const response = await axios.post(`${API_BASE_URL}/transcribe`, formData);
          setTranscribedText(response.data.text);
        } catch (error) {
          console.error('Error transcribing audio:', error);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Stop recording after 10 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          stream.getTracks().forEach(track => track.stop());
        }
      }, 10000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
    }
  };

  const handleAskQuestion = async () => {
    if (!selectedImage || !transcribedText) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.append('image', selectedImage);
    formData.append('question', transcribedText);

    try {
      const response = await axios.post(`${API_BASE_URL}/ask-image`, formData);
      setAnswer(response.data.answer);
      
      // Convert answer to speech
      const ttsResponse = await axios.post(`${API_BASE_URL}/text-to-speech`, {
        text: response.data.answer
      });

      // Play the audio
      const audio = new Audio(`data:audio/wav;base64,${ttsResponse.data.audio}`);
      audioRef.current = audio;
      audio.play();
      setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
    } catch (error) {
      console.error('Error processing question:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h1 className="text-3xl font-bold text-center mb-8">Ask the Image</h1>
                
                {/* Image Upload Section */}
                <div className="mb-8">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload or Capture Image
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                      <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600">
                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                          <span>Upload a file</span>
                          <input type="file" className="sr-only" accept="image/*" onChange={handleImageUpload} />
                        </label>
                      </div>
                    </div>
                  </div>
                  {selectedImage && (
                    <div className="mt-4">
                      <img
                        src={URL.createObjectURL(selectedImage)}
                        alt="Selected"
                        className="h-32 w-32 object-cover mx-auto rounded-lg"
                      />
                    </div>
                  )}
                </div>

                {/* Voice Recording Section */}
                <div className="mb-8">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ask a Question (Voice)
                  </label>
                  <div className="flex items-center justify-center space-x-4">
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`p-4 rounded-full ${
                        isRecording
                          ? 'bg-red-500 hover:bg-red-600'
                          : 'bg-blue-500 hover:bg-blue-600'
                      } text-white`}
                    >
                      {isRecording ? (
                        <StopIcon className="h-6 w-6" />
                      ) : (
                        <MicrophoneIcon className="h-6 w-6" />
                      )}
                    </button>
                    {transcribedText && (
                      <p className="text-sm text-gray-600">{transcribedText}</p>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-center">
                  <button
                    onClick={handleAskQuestion}
                    disabled={!selectedImage || !transcribedText || isLoading}
                    className={`px-4 py-2 rounded-md text-white ${
                      !selectedImage || !transcribedText || isLoading
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {isLoading ? 'Processing...' : 'Ask Question'}
                  </button>
                </div>

                {/* Answer Section */}
                {answer && (
                  <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Answer:</h3>
                    <p className="text-gray-700">{answer}</p>
                    {isPlaying && (
                      <div className="mt-2 text-sm text-gray-500">
                        Playing audio response...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;