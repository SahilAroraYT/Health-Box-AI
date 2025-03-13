@echo off
echo Setting up HealthBox AI...
echo Creating virtual environment...

python -m venv backend\env

echo Activating virtual environment...
call backend\env\Scripts\activate.bat

echo Installing dependencies...
pip install -r backend\requirements.txt

echo Installation complete!
echo To run the server, use: cd backend && python app.py
echo Remember to activate the virtual environment first: backend\env\Scripts\activate.bat

pause 