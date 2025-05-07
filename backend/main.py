from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import whisper
import torch
from transformers import Blip2Processor, Blip2ForConditionalGeneration
from PIL import Image
import io
import pyttsx3
import base64
import tempfile
import os

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# # Initialize models
whisper_model = whisper.load_model("small")
processor = Blip2Processor.from_pretrained("Salesforce/blip2-opt-2.7b")
model = Blip2ForConditionalGeneration.from_pretrained(
    "Salesforce/blip2-opt-2.7b", torch_dtype=torch.float16
)
if torch.cuda.is_available():
    model = model.to("cuda")

# Initialize TTS engine
#tts_engine = pyttsx3.init()

@app.post("/transcribe")
async def transcribe_audio(audio_file: UploadFile = File(...)):
    # Save the uploaded audio file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
        content = await audio_file.read()
        temp_audio.write(content)
        temp_audio_path = temp_audio.name

    try:
        # Transcribe audio using Whisper
        result = whisper_model.transcribe(temp_audio_path)
        return {"text": result["text"]}
    finally:
        # Clean up temporary file
        os.unlink(temp_audio_path)

@app.post("/ask-image")
async def ask_image(
    image: UploadFile = File(...),
    question: str = Form(...)
):
    # Read and process the image
    image_content = await image.read()
    image = Image.open(io.BytesIO(image_content))
    
    # Process image and question
    inputs = processor(image, question, return_tensors="pt").to("cuda" if torch.cuda.is_available() else "cpu")
    
    # Generate answer
    generated_ids = model.generate(**inputs, max_length=50)
    answer = processor.batch_decode(generated_ids, skip_special_tokens=True)[0].strip()
    
    return {"answer": answer}

@app.post("/text-to-speech")
async def text_to_speech(text: str):
    # Generate speech from text
    tts_engine.save_to_file(text, "temp_speech.wav")
    tts_engine.runAndWait()
    
    # Read the generated audio file
    with open("temp_speech.wav", "rb") as audio_file:
        audio_content = audio_file.read()
    
    # Clean up
    os.remove("temp_speech.wav")
    
    # Convert to base64 for sending to frontend
    audio_base64 = base64.b64encode(audio_content).decode()
    return {"audio": audio_base64}

@app.get("/")
async def root():
    return {"message": "Hello World"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 