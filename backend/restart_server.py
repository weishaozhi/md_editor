import os
import signal
import subprocess
import time

# Kill processes on port 8000
result = subprocess.run(['netstat', '-ano'], capture_output=True, text=True)
for line in result.stdout.split('\n'):
    if ':8000' in line and 'LISTENING' in line:
        parts = line.split()
        if parts[-1] != 'PID':
            pid = int(parts[-1])
            try:
                os.kill(pid, signal.SIGTERM)
                print(f"Killed process {pid}")
            except:
                pass

time.sleep(2)

# Start new backend
os.chdir(r'd:\ai\projects\md_editor\backend')
subprocess.Popen(['python', '-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000'],
                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print("Backend restarted")
