@echo off
echo Setting up environment for fine-tuned model...

cd backend

if not exist env (
    echo Creating virtual environment...
    python -m venv env
)

echo Activating virtual environment...
call env\Scripts\activate.bat

echo Uninstalling existing packages...
pip uninstall -y peft transformers accelerate safetensors

echo Installing compatible versions for the fine-tuned model...
pip install transformers==4.33.3
pip install peft==0.3.0
pip install accelerate==0.22.0
pip install safetensors==0.3.2

echo Updating other required packages...
pip install flask==2.3.3
pip install flask-cors==4.0.0
pip install torch==2.0.1

echo Setup complete! Your fine-tuned model should now work correctly.
echo To run the application:
echo cd backend
echo python app.py

pause 