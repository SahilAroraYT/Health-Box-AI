import { FaUserCircle, FaRobot } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';

function ChatMessage({ message, theme }) {
  const { sender, text, timestamp, detectedSymptoms = [], possibleConditions = [], isError } = message;
  
  const isUser = sender === 'user';
  
  // Format timestamp for display
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} my-3`}>
      <div className={`
        flex max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}
      `}>
        {/* Avatar */}
        <div className="flex-shrink-0 flex items-start mt-1">
          {isUser ? (
            <FaUserCircle className="text-2xl text-primary-600 dark:text-primary-400" />
          ) : (
            <FaRobot className="text-2xl text-secondary-600 dark:text-secondary-400" />
          )}
        </div>
        
        {/* Message bubble */}
        <div className={`mx-2 px-4 py-3 rounded-lg shadow-sm ${
          isUser 
            ? theme === 'light'
              ? 'bg-primary-100 text-primary-900 border border-primary-200 rounded-tr-none'
              : 'bg-primary-800 text-primary-50 border border-white rounded-tr-none'
            : isError
              ? 'bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-800 rounded-tl-none'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-tl-none'
        }`}>
          {/* User message with better styling */}
          {isUser ? (
            <div className="prose prose-sm max-w-none">
              <p className={`${theme === 'light' ? 'text-primary-900' : 'text-white'} whitespace-pre-wrap`}>{text}</p>
            </div>
          ) : (
            <div>
              {/* For AI responses, handle markdown */}
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{text}</ReactMarkdown>
              </div>
              
              {/* If there are detected symptoms, show them */}
              {detectedSymptoms && detectedSymptoms.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Detected symptoms:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {detectedSymptoms.map((symptom, index) => (
                      <span key={index} className="px-2 py-0.5 bg-secondary-100 dark:bg-secondary-900 text-secondary-800 dark:text-secondary-200 rounded text-xs">
                        {symptom}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* If there are possible conditions with scores, show them */}
              {possibleConditions && possibleConditions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Confidence scores:</span>
                  <div className="space-y-1 mt-1">
                    {possibleConditions.map((condition, index) => (
                      <div key={index} className="flex items-center">
                        <span className="text-xs mr-2">{condition.name}:</span>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                          <div 
                            className="bg-primary-600 dark:bg-primary-500 h-1.5 rounded-full" 
                            style={{ width: `${Math.round(condition.match_score * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Timestamp */}
          <div className={`text-xs mt-1 ${
            isUser 
              ? theme === 'light' ? 'text-primary-500' : 'text-primary-300' 
              : theme === 'light' ? 'text-gray-500' : 'text-gray-400'
          }`}>
            {formatTime(timestamp)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatMessage;