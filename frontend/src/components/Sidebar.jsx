import { FaPlus, FaTrash, FaAngleRight, FaTimes } from 'react-icons/fa';
import { useTheme } from '../ThemeContext';

function Sidebar({ 
  isOpen, 
  onClose, 
  savedChats, 
  onDeleteChat, 
  onLoadChat, 
  onNewChat 
}) {
  const { theme } = useTheme();
  
  // Group chats by timeframe
  const groupChatsByTime = () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const groups = {
      '7 Days': [],
      '30 Days': [],
      'Older': []
    };
    
    savedChats.forEach(chat => {
      const chatDate = new Date(chat.timestamp);
      
      if (chatDate >= sevenDaysAgo) {
        groups['7 Days'].push(chat);
      } else if (chatDate >= thirtyDaysAgo) {
        groups['30 Days'].push(chat);
      } else {
        groups['Older'].push(chat);
      }
    });
    
    return groups;
  };

  const chatGroups = groupChatsByTime();

  // Define sidebar classes based on if it's open or not
  const sidebarClasses = `
    h-screen
    transition-transform duration-300 ease-in-out
    bg-gray-100 dark:bg-gray-800
    border-r border-gray-200 dark:border-gray-700
    md:w-64 md:block
    ${isOpen ? 'w-64' : 'w-0 md:w-64'}
    md:relative md:flex-shrink-0
    flex flex-col
    ${isOpen ? '' : 'md:translate-x-0 -translate-x-full'}
  `;

  // Mobile sidebar (absolute positioned)
  const mobileSidebarClasses = `
    fixed top-0 left-0 z-40 h-screen
    transition-transform duration-300 ease-in-out
    bg-gray-100 dark:bg-gray-800
    border-r border-gray-200 dark:border-gray-700
    ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full w-0'}
    md:hidden
    flex flex-col shadow-lg
  `;

  // Overlay for mobile
  const overlayClasses = `
    fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity duration-300
    ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}
    md:hidden
  `;

  return (
    <>
      {/* Dark overlay for mobile when sidebar is open */}
      <div className={overlayClasses} onClick={onClose} />
      
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex ${sidebarClasses}`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">Conversations</h1>
        </div>
        
        <div className="p-4">
          <button 
            onClick={onNewChat} 
            className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded-lg transition-colors"
          >
            <FaPlus />
            <span>New chat</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-1">
          {Object.entries(chatGroups).map(([timeframe, chats]) => (
            chats.length > 0 && (
              <div key={timeframe} className="mb-4">
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {timeframe}
                </div>
                <div className="space-y-1">
                  {chats.map(chat => (
                    <div 
                      key={chat.id} 
                      onClick={() => onLoadChat(chat.id)}
                      className="flex items-center justify-between px-4 py-2 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer text-gray-800 dark:text-gray-200 rounded mx-1"
                    >
                      <div className="truncate flex-1">{chat.title}</div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                        className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 p-1"
                        aria-label="Delete conversation"
                      >
                        <FaTrash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
          
          {savedChats.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>No saved conversations yet</p>
              <p className="text-sm mt-2">Your conversations will appear here once saved</p>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <aside className={mobileSidebarClasses}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">Conversations</h1>
          <button 
            onClick={onClose}
            className="text-gray-600 dark:text-gray-300 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            aria-label="Close sidebar"
          >
            <FaTimes />
          </button>
        </div>
        
        <div className="p-4">
          <button 
            onClick={() => {onNewChat(); onClose();}}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded-lg transition-colors"
          >
            <FaPlus />
            <span>New chat</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-1">
          {Object.entries(chatGroups).map(([timeframe, chats]) => (
            chats.length > 0 && (
              <div key={timeframe} className="mb-4">
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {timeframe}
                </div>
                <div className="space-y-1">
                  {chats.map(chat => (
                    <div 
                      key={chat.id} 
                      onClick={() => { onLoadChat(chat.id); onClose(); }}
                      className="flex items-center justify-between px-4 py-2 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer text-gray-800 dark:text-gray-200 rounded mx-1"
                    >
                      <div className="truncate flex-1">{chat.title}</div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                        className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 p-1"
                        aria-label="Delete conversation"
                      >
                        <FaTrash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
          
          {savedChats.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>No saved conversations yet</p>
              <p className="text-sm mt-2">Your conversations will appear here once saved</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export default Sidebar; 