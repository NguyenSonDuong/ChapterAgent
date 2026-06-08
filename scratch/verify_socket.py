import sys
import os
import io

# Reconfigure stdout/stderr to UTF-8 for Vietnamese printing on Windows
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        # Fallback for older python
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import time
import requests
import socketio

BACKEND_URL = "http://127.0.0.1:5000"
STORY_UUID = "d813d7e2-07ec-47b6-ac05-1422c679e964"

sio = socketio.Client()
is_finished = False
has_error = False

@sio.event
def connect():
    print("[TEST] Socket.IO connected.")

@sio.event
def disconnect():
    print("[TEST] Socket.IO disconnected.")

@sio.on('connection_response')
def on_connection_response(data):
    print(f"[TEST] Connection response: {data}")

@sio.on('agent_status')
def on_agent_status(data):
    print(f"[TEST] Agent Status: {data.get('status')} - {data.get('message')}")
    if data.get('status') in ['completed', 'success', 'done']:
        global is_finished
        is_finished = True
    elif data.get('status') == 'error':
        global has_error
        has_error = True

@sio.on('clarify_requirements')
def on_clarify_requirements(data):
    print(f"[TEST] AI Clarification Prompt: {data.get('questions')}")
    # Simulate user answering the questions
    sio.emit('submit_clarification', {
        'story_uuid': STORY_UUID,
        'answers': "Niệm Phàm cõng Linh Nhi đi qua cánh rừng mù sương, gặp vài loại thú hoang nhỏ nhưng đều né tránh được. Cậu bé lo lắng khôn nguôi về bệnh tình của mẹ và sự an toàn của cô bé."
    })
    print("[TEST] Submitted clarification answers.")

@sio.on('draft_review_needed')
def on_draft_review_needed(data):
    print(f"[TEST] AI Draft Review Needed. Content length: {len(data.get('draft_content', ''))} characters.")
    # Simulate user approving the draft
    sio.emit('submit_review_feedback', {
        'story_uuid': STORY_UUID,
        'feedback': "Done"
    })
    print("[TEST] Submitted draft approval ('Done').")

@sio.on('audit_warnings')
def on_audit_warnings(data):
    print(f"[TEST] Audit Warnings: {data.get('warnings')}")

def main():
    print("[TEST] Connecting to Socket.IO server...")
    try:
        sio.connect(BACKEND_URL)
    except Exception as e:
        print(f"[TEST] Failed to connect to socket server: {e}")
        sys.exit(1)

    # Trigger generation
    payload = {
        "user_idea": "Chu Niệm Phàm cõng Chu Linh Nhi vượt qua sương mù núi Vong Tinh để trở về Tử Minh trấn, trên đường đi lo lắng về bệnh của mẹ và vết thương của Linh Nhi.",
        "model": "gemini-2.5-flash"  # Use gemini-2.5-flash which is active and working
    }
    
    print("[TEST] Sending POST request to trigger chapter generation...")
    try:
        resp = requests.post(f"{BACKEND_URL}/api/stories/{STORY_UUID}/chapters/generate", json=payload)
        if resp.status_code == 200:
            print(f"[TEST] Generation started successfully: {resp.json()}")
        else:
            print(f"[TEST] Generation start failed: {resp.status_code} - {resp.text}")
            sio.disconnect()
            sys.exit(1)
    except Exception as e:
        print(f"[TEST] Request error: {e}")
        sio.disconnect()
        sys.exit(1)

    # Wait for completion or error
    timeout = 180  # 3 minutes timeout
    start_time = time.time()
    
    while not is_finished and not has_error:
        if time.time() - start_time > timeout:
            print("[TEST] Timeout reached waiting for generation.")
            break
        time.sleep(1)

    sio.disconnect()
    
    if is_finished:
        print("[TEST] E2E verification COMPLETED successfully!")
        sys.exit(0)
    else:
        print("[TEST] E2E verification FAILED or timed out.")
        sys.exit(1)

if __name__ == "__main__":
    main()
