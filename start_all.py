import subprocess
import sys
import os
import time

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
VENV_PYTHON = os.path.join(BASE_DIR, ".venv", "Scripts", "python.exe")
SYSTEM_PYTHON = r"C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe"

if os.path.exists(VENV_PYTHON):
    PYTHON_EXEC = VENV_PYTHON
elif os.path.exists(SYSTEM_PYTHON):
    PYTHON_EXEC = SYSTEM_PYTHON
else:
    PYTHON_EXEC = sys.executable

services = [
    ("call-management-service", 8001),
    ("call-analysis-service", 8002),
    ("user-management-service", 8003),
    ("complaint-assignment-service", 8004),
    ("admin-service", 8005),
    ("citizen-service", 8006),
]

def main():
    processes = []
    print("==================================================")
    print(" Starting Complaint Tracker Platform Services")
    print("==================================================")

    for service_name, port in services:
        cwd = os.path.join(BASE_DIR, "backend", service_name)
        cmd = [PYTHON_EXEC, "-m", "uvicorn", "app.main:app", "--port", str(port), "--host", "127.0.0.1"]
        print(f"-> Launching {service_name} on port {port}...")
        p = subprocess.Popen(cmd, cwd=cwd)
        processes.append((service_name, p))

    time.sleep(2)
    print("\n-> Launching Frontend Dev Server (port 5173)...")
    frontend_cwd = os.path.join(BASE_DIR, "frontend")
    p_frontend = subprocess.Popen(["cmd", "/c", "npm run dev"], cwd=frontend_cwd)
    processes.append(("frontend", p_frontend))

    print("\n==================================================")
    print(" All backend services and frontend are running!")
    print(" Access the application at: http://localhost:5173")
    print(" Press Ctrl+C to terminate all services.")
    print("==================================================")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down all processes...")
        for name, proc in processes:
            proc.terminate()
        print("All processes stopped successfully.")

if __name__ == "__main__":
    main()
