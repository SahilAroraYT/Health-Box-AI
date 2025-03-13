import { useState, useRef, useEffect } from 'react';
import { FaRegPaperPlane, FaRobot, FaUserCircle, FaSave } from 'react-icons/fa';
import axios from 'axios';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import { useTheme } from './ThemeContext';

// Mock symptoms for testing
const mockSymptoms = [
  "headache", 
  "fever", 
  "cough", 
  "fatigue", 
  "shortness of breath", 
  "sore throat",
  "muscle pain",
  "loss of taste or smell"
];

// Medical database for local processing
const medicalDatabase = {
  symptoms: [
    "headache", "fever", "cough", "fatigue", 
    "shortness of breath", "sore throat", "muscle pain",
    "nausea", "dizziness", "chest pain", "stomachache",
    "rash", "joint pain", "chills", "weakness"
  ]
};

// Enhanced response generator with chat history support
const generateMedicalResponse = (userMessage, chatHistory = []) => {
  const lowerCaseMessage = userMessage.toLowerCase();
  
  // Build context from chat history
  let context = {
    detectedSymptoms: [],
    lastQuestion: null
  };
  
  // Extract context from chat history
  if (chatHistory && chatHistory.length > 0) {
    for (const [userMsg, botMsg] of chatHistory) {
      // If bot detected symptoms previously, add them to our context
      if (botMsg && botMsg.includes("I've detected that you're experiencing")) {
        const match = botMsg.match(/I've detected that you're experiencing (.*?)\./);
        if (match && match[1]) {
          const symptoms = match[1].split(", ");
          context.detectedSymptoms.push(...symptoms);
        }
      }
      
      // Track if we asked a question
      if (botMsg && (
        botMsg.includes("how long have you been experiencing") ||
        botMsg.includes("Would you like to provide more details") ||
        botMsg.includes("Could you describe")
      )) {
        context.lastQuestion = botMsg;
      }
    }
  }
  
  // Current message symptom detection
  const currentDetectedSymptoms = mockSymptoms.filter(symptom => 
    lowerCaseMessage.includes(symptom)
  );
  
  // Combined symptoms from history and current message
  const allSymptoms = [...new Set([...context.detectedSymptoms, ...currentDetectedSymptoms])];
  
  let response = '';
  let possibleConditions = [];
  
  // Handle short responses to previous questions (like "3 days")
  if (userMessage.trim().split(/\s+/).length < 4 && context.lastQuestion) {
    if (context.lastQuestion.includes("how long") && 
        /\d+\s*(day|days|week|weeks|month|months|year|years)/i.test(userMessage)) {
      
      response = `Thank you for sharing that you've been experiencing symptoms for ${userMessage.trim()}. `;
      
      if (/[123]\s*days?/i.test(userMessage)) {
        response += "For symptoms lasting a few days, it could be an acute condition. ";
        response += "Rest, hydration, and over-the-counter medications may help manage symptoms. ";
      } else {
        response += "For symptoms lasting longer, it's advisable to consult with a healthcare provider. ";
        response += "Persistent symptoms may require professional evaluation. ";
      }
      
      if (allSymptoms.length > 0) {
        response += `\nBased on the symptoms you've mentioned (${allSymptoms.join(", ")}), `;
        response += "I'll provide some information about potential causes. ";
      }
    } else {
      // Generic response for other short answers
      response = `Thank you for that information. `;
    }
  }
  
  // If we have symptoms, provide information about them
  if (allSymptoms.length > 0) {
    if (!response) {  // If we haven't already built a response for a follow-up
      response = `I've detected that you're experiencing ${allSymptoms.join(", ")}. `;
    }
    
    // Add specific information for each symptom
    if (allSymptoms.includes("headache")) {
      response += "Headaches can be caused by various factors including stress, dehydration, or tension. ";
      possibleConditions.push({name: "Tension headache", match_score: 0.85});
      possibleConditions.push({name: "Migraine", match_score: 0.65});
      possibleConditions.push({name: "Dehydration", match_score: 0.55});
    }
    
    if (allSymptoms.includes("fever")) {
      response += "Fever is often a sign that your body is fighting an infection. ";
      possibleConditions.push({name: "Common cold", match_score: 0.75});
      possibleConditions.push({name: "Influenza", match_score: 0.70});
    }
    
    if (allSymptoms.includes("cough")) {
      response += "A cough can be caused by an infection, allergies, or irritants in the air. ";
      possibleConditions.push({name: "Bronchitis", match_score: 0.60});
      possibleConditions.push({name: "Common cold", match_score: 0.80});
    }
    
    if (allSymptoms.includes("fatigue")) {
      response += "Fatigue can result from many conditions, as well as from poor sleep or stress. ";
      possibleConditions.push({name: "Anemia", match_score: 0.45});
      possibleConditions.push({name: "Depression", match_score: 0.40});
    }
    
    // If it's not a follow-up response, ask a question
    if (!context.lastQuestion || userMessage.trim().split(/\s+/).length >= 4) {
      response += "\n\nWould you like to provide more details about your symptoms? For example, how long have you been experiencing them?";
    }
  } else {
    // No symptoms detected
    response = "I understand you're not feeling well. Could you please describe your symptoms in more detail? For example, do you have a fever, cough, or headache?";
  }
  
  // Remove duplicate conditions and sort by match score
  possibleConditions = [...new Map(possibleConditions.map(item => 
    [item.name, item])).values()].sort((a, b) => b.match_score - a.match_score);
  
  return {
    response,
    detected_symptoms: allSymptoms,
    possible_conditions: possibleConditions,
    follow_up_question: "How long have you been experiencing these symptoms?"
  };
};

// Mock response generator - Keeping the original for backward compatibility
const generateMockResponse = (userMessage) => {
  return generateMedicalResponse(userMessage, []);
};

function App() {
  const { theme } = useTheme();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [symptoms, setSymptoms] = useState([]);
  const [useBackend, setUseBackend] = useState(true);
  const [backendUrl, setBackendUrl] = useState('http://localhost:5000');
  const [savedChats, setSavedChats] = useState(() => {
    const saved = localStorage.getItem('savedChats');
    return saved ? JSON.parse(saved) : [];
  });
  const [chatTitle, setChatTitle] = useState('New Conversation');
  const [sidebarOpen, setSidebarOpen] = useState(false); // Default closed on mobile, open on desktop via CSS
  const messagesEndRef = useRef(null);

  // Check if we're on a mobile device
  const isMobile = () => window.innerWidth < 768;

  // Apply dark mode to html and body elements
  useEffect(() => {
    // Remove any existing background color on body
    document.body.className = '';
    document.documentElement.className = theme;
    
    // Apply background color to body to ensure full coverage
    if (theme === 'dark') {
      document.body.style.backgroundColor = '#111827'; // bg-gray-900
      document.documentElement.style.backgroundColor = '#111827'; // bg-gray-900
    } else {
      document.body.style.backgroundColor = '#f9fafb'; // bg-gray-50
      document.documentElement.style.backgroundColor = '#f9fafb'; // bg-gray-50
    }
  }, [theme]);

  // Handle sidebar visibility based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (!isMobile()) {
        // Ensure sidebar is visually open on desktop/tablet regardless of state
        // The CSS in Sidebar component handles this with md:translate-x-0
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch symptoms from backend
  useEffect(() => {
    const fetchSymptoms = async () => {
      try {
        // Create axios instance
        const api = axios.create({
          baseURL: backendUrl,
          timeout: 10000,
        });
        
        // Try to fetch symptoms from backend
        const response = await api.get('/api/symptoms');
        if (response.data && response.data.symptoms) {
          setSymptoms(response.data.symptoms);
        } else {
          // Fallback to mockSymptoms if API doesn't return expected data
          setSymptoms(mockSymptoms);
        }
      } catch (error) {
        console.error('Error fetching symptoms:', error);
        // Use mock symptoms as fallback
        setSymptoms(mockSymptoms);
      }
    };

    fetchSymptoms();
  }, []);

  // Save chats to localStorage
  useEffect(() => {
    localStorage.setItem('savedChats', JSON.stringify(savedChats));
  }, [savedChats]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const generateTitle = (messages) => {
    if (messages.length === 0) return 'New Conversation';
    
    // Find the first user message to use as title
    const firstUserMessage = messages.find(msg => msg.sender === 'user');
    if (firstUserMessage) {
      // Limit title to first 30 characters
      return firstUserMessage.text.length > 30 
        ? firstUserMessage.text.substring(0, 27) + '...' 
        : firstUserMessage.text;
    }
    
    return 'New Conversation';
  };

  const handleNewChat = () => {
    setMessages([]);
    setChatTitle('New Conversation');
    if (isMobile()) setSidebarOpen(false);
  };

  const saveCurrentChat = () => {
    if (messages.length === 0) return;
    
    const title = generateTitle(messages);
    const now = new Date();
    const newChat = {
      id: Date.now(),
      title: title,
      timestamp: now.toISOString(),
      messages: [...messages],
    };
    
    setSavedChats(prev => [newChat, ...prev]);
    setChatTitle(title);
  };

  const loadChat = (chatId) => {
    const chat = savedChats.find(chat => chat.id === chatId);
    if (chat) {
      setMessages(chat.messages);
      setChatTitle(chat.title);
    }
  };

  const deleteChat = (chatId) => {
    setSavedChats(prev => prev.filter(chat => chat.id !== chatId));
  };

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!inputValue.trim()) return;
    
    // Add user message to chat
    const userMessage = {
      text: inputValue,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    try {
      // Format chat history for the backend - ensure correct format
      const chatHistory = messages.map(msg => {
        // Each entry should be [user_message, bot_message]
        return [
          msg.sender === 'user' ? msg.text : '',
          msg.sender === 'bot' ? msg.text : ''
        ];
      });
      
      // Create axios instance with the current backend URL
      const api = axios.create({
        baseURL: backendUrl,
        timeout: 15000, // Increase timeout to 15 seconds for potentially slow responses
      });
      
      // Send request to backend
      const response = await api.post('/api/analyze', {
        message: userMessage.text,
        chat_history: chatHistory
      });
      
      // Ensure we have a valid response
      if (!response || !response.data) {
        throw new Error("Invalid response from server");
      }
      
      // Add AI response to chat
      const botMessage = {
        text: response.data.response || "I couldn't generate a proper response.",
        sender: 'bot',
        timestamp: new Date().toISOString(),
        detectedSymptoms: response.data.detected_symptoms || [],
        possibleConditions: response.data.possible_conditions || [],
        followUpQuestion: response.data.follow_up_question || ''
      };
      
      setMessages(prev => [...prev, botMessage]);
      
      // Update chat title if it's the first message
      if (messages.length === 0) {
        setChatTitle(generateTitle([userMessage]));
      }
    } catch (error) {
      console.error('Error sending message to backend:', error);
      
      // Add more descriptive error message
      const errorMessage = {
        text: `Sorry, there was an error processing your request. Please try again. ${error.message || ''}`,
        sender: 'bot',
        timestamp: new Date().toISOString(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Sidebar component */}
      <div className="flex-shrink-0">
        <Sidebar 
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          savedChats={savedChats}
          onDeleteChat={deleteChat}
          onLoadChat={loadChat}
          onNewChat={handleNewChat}
        />
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header toggleSidebar={toggleSidebar} />
        
        <main className="flex-1 flex justify-center overflow-hidden">
          <div className="w-full max-w-4xl px-3 py-4 md:px-4 md:py-6">
            <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden flex flex-col h-[calc(100vh-7rem)]">
              {/* Chat header */}
              <div className="bg-gray-50 dark:bg-gray-700 p-3 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
                <h2 className="font-medium text-gray-800 dark:text-white truncate">{chatTitle}</h2>
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={saveCurrentChat}
                    disabled={messages.length === 0}
                    className="text-gray-600 dark:text-gray-300 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 focus:outline-none"
                    title="Save conversation"
                  >
                    <FaSave />
                  </button>
                </div>
              </div>
              
              {/* Chat messages area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Welcome message */}
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <div className="flex justify-center">
                      <FaRobot className="text-5xl text-primary-500 dark:text-primary-400 mb-4" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">Welcome to HealthBox AI</h2>
                    <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto">
                      Describe your symptoms and I'll help identify possible conditions
                      and ask relevant follow-up questions.
                    </p>
                    <div className="mt-6 space-y-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Try asking about:</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {symptoms.slice(0, 6).map((symptom) => (
                          <button
                            key={symptom}
                            className="px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-sm text-gray-700 dark:text-gray-300 focus:outline-none"
                            onClick={() => setInputValue(`I have ${symptom}`)}
                          >
                            {symptom}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Chat messages */}
                {messages.map((message, index) => (
                  <ChatMessage key={index} message={message} theme={theme} />
                ))}
                
                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 bg-primary-500 rounded-full animate-bounce"></div>
                      <div className="h-2 w-2 bg-primary-500 rounded-full animate-bounce delay-100"></div>
                      <div className="h-2 w-2 bg-primary-500 rounded-full animate-bounce delay-200"></div>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">HealthBox AI is analyzing...</span>
                  </div>
                )}
                
                {/* Reference for auto scroll */}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Input area */}
              <div className="border-t dark:border-gray-700 p-3 md:p-4 bg-white dark:bg-gray-800">
                <form onSubmit={handleSubmit} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Describe your symptoms or ask a question..."
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    className="p-2 bg-primary-600 dark:bg-primary-700 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:ring-offset-2 disabled:bg-gray-400 dark:disabled:bg-gray-600"
                    disabled={!inputValue.trim() || isLoading}
                  >
                    <FaRegPaperPlane />
                  </button>
                </form>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  This is for educational purposes only. Not a substitute for professional medical advice.
                </p>
              </div>
            </div>
          </div>
        </main>
        
        <footer className="w-full bg-white dark:bg-gray-800 py-2 border-t dark:border-gray-700">
          <div className="container mx-auto px-4 text-center text-gray-600 dark:text-gray-400 text-xs md:text-sm">
            &copy; {new Date().getFullYear()} HealthBox AI - Educational Project
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;