import { FaStethoscope, FaMoon, FaSun, FaBars } from 'react-icons/fa';
import { useTheme } from '../ThemeContext';

function Header({ toggleSidebar }) {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <header className="sticky top-0 w-full bg-white dark:bg-gray-800 shadow-sm transition-colors duration-200 z-10">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button 
            onClick={toggleSidebar}
            className="md:hidden text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-full focus:outline-none"
            aria-label="Toggle sidebar"
          >
            <FaBars size={18} />
          </button>
          <div className="flex items-center space-x-2">
            <FaStethoscope className="text-primary-600 dark:text-primary-400 text-xl" />
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">HealthBox AI</h1>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="hidden sm:inline-block bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-white text-xs px-2 py-1 rounded-full font-medium">
            Medical AI Assistant
          </span>
          <button 
            onClick={() => toggleTheme()}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors duration-200 focus:outline-none"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <FaMoon className="text-gray-600" /> : <FaSun className="text-yellow-300" />}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;