from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, pipeline
from peft import PeftModel, PeftConfig
import random
import json
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load medical QA model
def load_medical_qa_model():
    try:
        # Paths to fine-tuned model files
        base_model_name = "GanjinZero/biobart-v2-base"
        adapter_path = os.path.join(os.path.dirname(__file__), "models", "fine_tuned_model")
        
        logger.info(f"Using base model: {base_model_name}")
        logger.info(f"Loading fine-tuned adapter from: {adapter_path}")
        
        # Check if CUDA is available
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {device}")
        
        # Load tokenizer from base model
        logger.info("Loading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(base_model_name)
        
        # Load base model
        logger.info("Loading base model...")
        base_model = AutoModelForSeq2SeqLM.from_pretrained(base_model_name)
        
        # Load adapter on top of base model
        logger.info("Loading PEFT adapter (fine-tuned model)...")
        model = PeftModel.from_pretrained(base_model, adapter_path)
        logger.info("PEFT adapter loaded successfully!")
        
        # Move model to the appropriate device
        model = model.to(device)
        
        logger.info("Fine-tuned model loaded successfully!")
        return model, tokenizer
    except Exception as e:
        logger.error(f"Error loading fine-tuned model: {str(e)}")
        raise

# Load medical knowledge base
def load_medical_data():
    # For a real implementation, you would load a comprehensive medical dataset
    # This is a simplified example
    medical_data = {
        "headache": ["Migraine", "Tension Headache", "Sinusitis", "Meningitis"],
        "fever": ["Common Cold", "Flu", "COVID-19", "Infection", "Malaria"],
        "cough": ["Common Cold", "Flu", "COVID-19", "Bronchitis", "Pneumonia"],
        "fatigue": ["Flu", "Anemia", "Depression", "Sleep Disorder", "Chronic Fatigue Syndrome"],
        "nausea": ["Food Poisoning", "Migraine", "Pregnancy", "Vertigo", "Gastroenteritis"],
        "vomiting": ["Food Poisoning", "Gastroenteritis", "Migraine", "Morning Sickness"],
        "dizziness": ["Vertigo", "Low Blood Pressure", "Anemia", "Inner Ear Infection"],
        "chest pain": ["Heart Attack", "Angina", "Acid Reflux", "Anxiety", "Pulmonary Embolism"],
        "shortness of breath": ["Asthma", "COVID-19", "Heart Failure", "Anxiety", "Pulmonary Embolism"],
        "abdominal pain": ["Appendicitis", "Gastritis", "IBS", "Food Poisoning", "Kidney Stones"],
        "joint pain": ["Arthritis", "Gout", "Lupus", "Lyme Disease", "Rheumatoid Arthritis"],
        "rash": ["Allergic Reaction", "Eczema", "Psoriasis", "Chickenpox", "Measles"],
        "sore throat": ["Strep Throat", "Common Cold", "Flu", "Tonsillitis"],
        "runny nose": ["Common Cold", "Flu", "Allergies", "Sinusitis"],
        "muscle aches": ["Flu", "Fibromyalgia", "Exercise-Related Injury", "Viral Infection"]
    }
    
    # Follow-up questions for common symptoms
    follow_up_questions = {
        "headache": [
            "How long have you had the headache?", 
            "Is it on one side or both?", 
            "Is it throbbing or constant?",
            "On a scale of 1-10, how severe is the pain?",
            "Do you have any other symptoms like nausea or sensitivity to light?"
        ],
        "fever": [
            "What is your temperature?", 
            "How long have you had the fever?",
            "Have you recently traveled to any tropical regions?",
            "Do you have any other symptoms like cough or body aches?"
        ],
        "cough": [
            "Is your cough dry or productive?", 
            "How long have you had it?", 
            "Any blood in your cough?",
            "Does it get worse at night or in certain environments?"
        ],
        "fatigue": [
            "When did the fatigue begin?", 
            "Does rest help?", 
            "Have you experienced weight loss?",
            "Is it constant or does it come and go?"
        ],
        "chest pain": [
            "Does the pain radiate to your arm or jaw?", 
            "Is it worse with exertion?", 
            "How would you rate the pain on a scale of 1-10?",
            "Does the pain change when you breathe deeply?"
        ],
        "abdominal pain": [
            "Where exactly is the pain located?",
            "Is it sharp or dull?",
            "Does it come and go or is it constant?",
            "Does eating make it better or worse?"
        ]
    }
    
    # Disease descriptions for educational purposes
    disease_info = {
        "Migraine": "A neurological condition characterized by intense, debilitating headaches, often accompanied by nausea, vomiting, and sensitivity to light and sound.",
        "Tension Headache": "The most common type of headache, characterized by dull, aching head pain, tightness or pressure across the forehead or the back of the head and neck.",
        "Common Cold": "A viral infection of the upper respiratory tract, causing symptoms like runny nose, sneezing, and mild fever.",
        "Flu": "A contagious respiratory illness caused by influenza viruses, characterized by fever, cough, sore throat, body aches, and fatigue.",
        "COVID-19": "A respiratory illness caused by the SARS-CoV-2 virus, with symptoms ranging from mild to severe, including fever, cough, and shortness of breath.",
        "Pneumonia": "An infection that inflames the air sacs in one or both lungs, which may fill with fluid, causing cough, fever, chills, and difficulty breathing.",
        "Bronchitis": "Inflammation of the lining of the bronchial tubes, which carry air to and from the lungs, causing coughing with mucus, fatigue, shortness of breath, and mild fever."
    }
    
    return medical_data, follow_up_questions, disease_info

# Initialize model and data
try:
    model, tokenizer = load_medical_qa_model()
    medical_data, follow_up_questions, disease_info = load_medical_data()
    logger.info("Application initialized successfully!")
except Exception as e:
    logger.error(f"Failed to initialize application: {str(e)}")
    raise

# Extract symptoms from user input
def extract_symptoms(text, symptom_dict):
    found_symptoms = []
    for symptom in symptom_dict.keys():
        if symptom.lower() in text.lower():
            found_symptoms.append(symptom)
    return found_symptoms

def find_potential_conditions(symptoms, medical_data):
    """Find potential conditions based on symptoms."""
    conditions = []
    
    # Count how many symptoms match each condition
    condition_matches = {}
    
    for symptom in symptoms:
        if symptom in medical_data:
            for condition in medical_data[symptom]:
                if condition not in condition_matches:
                    condition_matches[condition] = 0
                condition_matches[condition] += 1
    
    # Sort conditions by number of matching symptoms
    sorted_conditions = sorted(condition_matches.items(), 
                               key=lambda x: x[1], 
                               reverse=True)
    
    # Return condition names only
    return [condition for condition, count in sorted_conditions]

def generate_condition_scores(symptoms, medical_data):
    """Generate confidence scores for conditions."""
    condition_scores = []
    conditions = find_potential_conditions(symptoms, medical_data)
    
    # Create score objects
    for i, condition in enumerate(conditions[:5]):  # Return top 5 at most
        # Calculate a score that decreases with position
        # First condition gets 0.9, then 0.8, etc.
        score = min(0.9, max(0.4, 0.9 - (i * 0.1)))
        condition_scores.append({
            "name": condition,
            "match_score": score
        })
    
    return condition_scores

def generate_fallback_response(symptoms, user_input):
    """Generate a fallback response when model generation fails."""
    response = "Based on the symptoms you've described"
    
    # Add symptom list to the response
    if symptoms:
        response += f" ({', '.join(symptoms)})"
    
    response += ", here are some possible considerations:\n\n"
    
    # Add possible conditions
    conditions = find_potential_conditions(symptoms, medical_data)
    if conditions:
        response += "Possible conditions to consider:\n"
        for i, condition in enumerate(conditions[:3]):
            response += f"- {condition}\n"
        response += "\n"
    
    # Add general advice
    response += "General advice:\n"
    response += "- Monitor your symptoms and keep track of any changes\n"
    response += "- Stay hydrated and get plenty of rest\n"
    
    # Add specific advice based on symptoms
    if "fever" in symptoms:
        response += "- For fever, you can use over-the-counter fever reducers like acetaminophen as directed\n"
        response += "- If your fever persists beyond 3 days or rises above 103°F (39.4°C), consult a healthcare professional\n"
    
    if "cough" in symptoms:
        response += "- For cough, staying hydrated and using honey (if over 1 year old) may help\n"
    
    if "headache" in symptoms:
        response += "- For headache, rest in a quiet, dark room and consider appropriate pain relievers\n"
    
    # Add important disclaimer
    response += "\nPlease note that this is general information and not a medical diagnosis. If your symptoms are severe, persistent, or concerning, please consult a healthcare professional right away."
    
    return response

def generate_medical_response(user_input, chat_history=[]):
    try:
        # Track our conversation context
        context = {
            "detected_symptoms": [],
            "last_question": None
        }
        
        # Extract relevant information from chat history
        conversation_context = ""
        if chat_history:
            # Format previous conversation for context
            conversation_context = "Previous conversation:\n"
            for i, (user_msg, bot_msg) in enumerate(chat_history[-3:]):  # Use last 3 exchanges for context
                if user_msg is None:
                    user_msg = ""
                if bot_msg is None:
                    bot_msg = ""
                conversation_context += f"User: {user_msg}\n"
                conversation_context += f"Assistant: {bot_msg}\n"
                
                # Extract previously detected symptoms from bot responses
                if bot_msg and "Detected symptoms:" in bot_msg:
                    try:
                        symptom_line = [line for line in bot_msg.split('\n') if "Detected symptoms:" in line][0]
                        previous_symptoms = symptom_line.split("Detected symptoms:")[1].strip().split(", ")
                        context["detected_symptoms"].extend(previous_symptoms)
                    except Exception as e:
                        logger.warning(f"Error extracting symptoms from history: {str(e)}")
        
        # Process current message in context of conversation
        current_symptoms = extract_symptoms(user_input, medical_data)
        all_symptoms = list(set(context["detected_symptoms"] + current_symptoms))
        
        # Prepare input for the model
        if all_symptoms:
            try:
                # Format the prompt in a way expected by your fine-tuned model
                prompt = f"Patient presents with the following symptoms: {', '.join(all_symptoms)}. "
                
                # Add context from user's current message
                prompt += f"Patient states: \"{user_input}\". "
                
                # Request medical analysis
                prompt += "Provide medical analysis and advice."
                
                logger.info(f"Using prompt for fine-tuned model: {prompt}")
                
                # Generate response using the fine-tuned model
                inputs = tokenizer(prompt, return_tensors="pt", max_length=128, truncation=True)
                
                # Move inputs to the same device as the model
                if torch.cuda.is_available():
                    inputs = {k: v.cuda() for k, v in inputs.items()}
                
                # Generate with appropriate parameters for your fine-tuned model
                outputs = model.generate(
                    inputs["input_ids"],
                    max_length=200,
                    min_length=30,
                    num_beams=4,
                    temperature=0.7,
                    do_sample=True,
                    pad_token_id=tokenizer.eos_token_id
                )
                
                # Decode the model's response
                model_response = tokenizer.decode(outputs[0], skip_special_tokens=True)
                logger.info(f"Fine-tuned model generated response: {model_response}")
                
                # Format the response for better presentation
                if not model_response.strip():
                    model_response = "Based on the symptoms you've described, I recommend consulting with a healthcare professional for proper evaluation and treatment advice."
                
                # Extract possible conditions
                possible_conditions = find_potential_conditions(all_symptoms, medical_data)
                condition_scores = generate_condition_scores(all_symptoms, medical_data)
                
                # Create a formatted response including model output
                response = model_response
                
            except Exception as e:
                logger.error(f"Error during model generation: {str(e)}")
                # Create a message that explains the model error
                response = f"Based on your symptoms ({', '.join(all_symptoms)}), I'd provide medical information, but I'm currently experiencing technical difficulties. Please consult a healthcare professional for proper evaluation of your symptoms."
                possible_conditions = find_potential_conditions(all_symptoms, medical_data)
                condition_scores = generate_condition_scores(all_symptoms, medical_data)
            
            # Return the complete response
            return {
                "response": response,
                "detected_symptoms": all_symptoms,
                "possible_conditions": condition_scores,
                "follow_up_question": "How long have you been experiencing these symptoms?"
            }
        else:
            # If no symptoms detected, ask for more details
            response = "I understand you're not feeling well. Could you please describe your symptoms in more detail? For example, do you have a fever, cough, or headache?"
            return {
                "response": response,
                "detected_symptoms": [],
                "possible_conditions": [],
                "follow_up_question": "Could you please describe your symptoms?"
            }
            
    except Exception as e:
        logger.error(f"Error generating response: {str(e)}")
        return {
            "response": "I apologize, but I encountered an error while processing your message. Could you please rephrase your symptoms or try again?",
            "detected_symptoms": [],
            "possible_conditions": [],
            "isError": True
        }

# API routes
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"})

@app.route('/api/analyze', methods=['POST'])
def analyze_symptoms():
    try:
        data = request.json
        user_message = data.get('message', '')
        
        # Properly format chat history if provided
        chat_history = data.get('chat_history', [])
        
        # Generate response with chat context
        result = generate_medical_response(user_message, chat_history)
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error in analyze_symptoms endpoint: {str(e)}")
        return jsonify({
            "response": "I apologize, but I encountered an error while processing your request. Please try again.",
            "detected_symptoms": [],
            "possible_conditions": [],
            "isError": True
        }), 500

@app.route('/api/symptoms', methods=['GET'])
def get_symptoms():
    # Return the list of symptoms the system can recognize
    return jsonify({"symptoms": list(medical_data.keys())})

if __name__ == '__main__':
    # Run the Flask app
    app.run(debug=True, host='0.0.0.0', port=5000) 