from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, pipeline
import random
import json

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load medical QA model
def load_medical_qa_model():
    # Use a medical-specific model for better medical reasoning
    model_name = "GanjinZero/biobart-v2-base"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
    return model, tokenizer

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
model, tokenizer = load_medical_qa_model()
medical_data, follow_up_questions, disease_info = load_medical_data()

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

def generate_medical_response(user_input, chat_history=[]):
    # Track our conversation context
    context = {
        "detected_symptoms": [],
        "last_question": None
    }
    
    # Extract relevant information from chat history
    if chat_history:
        for user_msg, bot_msg in chat_history:
            # Extract previously detected symptoms from bot responses
            if bot_msg and "Detected symptoms:" in bot_msg:
                # Parse previously detected symptoms from the bot message
                try:
                    symptom_line = [line for line in bot_msg.split('\n') if "Detected symptoms:" in line][0]
                    previous_symptoms = symptom_line.split("Detected symptoms:")[1].strip().split(", ")
                    context["detected_symptoms"].extend(previous_symptoms)
                except:
                    pass
            
            # Track if the bot asked a question last
            if bot_msg:
                questions = [
                    "how long have you been experiencing", 
                    "could you describe", 
                    "can you tell me more", 
                    "when did",
                    "do you have any other"
                ]
                for q in questions:
                    if q in bot_msg.lower():
                        context["last_question"] = bot_msg
                        break
    
    # Process current message in context of conversation
    current_symptoms = extract_symptoms(user_input, medical_data)
    
    # Handle short responses to previous questions (follow-ups)
    if len(user_input.split()) < 5 and context["last_question"]:
        # User likely responding to a previous question with a short answer
        if "how long" in context["last_question"].lower() and any(word in user_input.lower() for word in ["day", "days", "week", "weeks", "month"]):
            # User is telling us duration of symptoms
            duration = user_input.strip()
            response = f"Thank you for sharing that you've been experiencing symptoms for {duration}. "
            response += "Based on the duration and symptoms you've mentioned, "
            
            # Add different advice based on duration
            if "day" in duration.lower() and any(d in duration.lower() for d in ["1", "2", "3", "one", "two", "three"]):
                response += "this could be an acute condition like a viral infection. "
                response += "Rest, staying hydrated, and over-the-counter medications may help manage symptoms. "
            else:
                response += "this could indicate a more persistent condition. "
                response += "If symptoms have lasted more than a week, it's advisable to consult with a healthcare provider. "
            
            if context["detected_symptoms"]:
                response += f"Based on your symptoms ({', '.join(context['detected_symptoms'])}), "
                
                # Generate condition matches based on all symptoms
                all_symptoms = set(context["detected_symptoms"] + current_symptoms)
                possible_conditions = find_potential_conditions(all_symptoms, medical_data)
                
                # Include top conditions
                if possible_conditions:
                    response += "here are some potential conditions to be aware of: "
                    for cond in possible_conditions[:3]:
                        response += f"{cond}, "
                    response = response.rstrip(", ") + ". "
            
            response += "\nIs there anything else you're experiencing that I should know about?"
            return {
                "response": response,
                "detected_symptoms": list(set(context["detected_symptoms"] + current_symptoms)),
                "possible_conditions": generate_condition_scores(list(set(context["detected_symptoms"] + current_symptoms)), medical_data),
                "follow_up_question": "Do you have any other symptoms besides what you've already mentioned?"
            }
    
    # Combine previously detected symptoms with current ones
    all_symptoms = list(set(context["detected_symptoms"] + current_symptoms))
    
    # Generate the response based on all symptoms detected in the conversation
    if all_symptoms:
        response = f"Based on our conversation, I understand you're experiencing {', '.join(all_symptoms)}. "
        
        # Generate condition matches
        possible_conditions = find_potential_conditions(all_symptoms, medical_data)
        condition_scores = generate_condition_scores(all_symptoms, medical_data)
        
        if possible_conditions:
            response += "Here are some potential conditions that might be related to these symptoms:\n\n"
            for condition in possible_conditions[:3]:
                response += f"- {condition}: {medical_data.get(condition, 'Common condition')}\n"
            
            response += "\nHowever, please note that this is not a diagnosis. "
        
        response += "Would you like to provide more details about your symptoms? For example, how long have you been experiencing them?"
    else:
        response = "I understand you're not feeling well. Could you please describe your symptoms in more detail? For example, do you have a fever, cough, or headache?"
    
    # Return complete response data
    return {
        "response": response,
        "detected_symptoms": all_symptoms,
        "possible_conditions": condition_scores,
        "follow_up_question": "How long have you been experiencing these symptoms?"
    }

# API routes
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"})

@app.route('/api/analyze', methods=['POST'])
def analyze_symptoms():
    data = request.json
    user_message = data.get('message', '')
    
    # Properly format chat history if provided
    chat_history = data.get('chat_history', [])
    
    # Generate response with chat context
    result = generate_medical_response(user_message, chat_history)
    
    return jsonify(result)

@app.route('/api/symptoms', methods=['GET'])
def get_symptoms():
    # Return the list of symptoms the system can recognize
    return jsonify({"symptoms": list(medical_data.keys())})

if __name__ == '__main__':
    # Run the Flask app
    app.run(debug=True, host='0.0.0.0', port=5000) 