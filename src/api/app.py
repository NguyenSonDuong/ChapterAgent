import eventlet
eventlet.monkey_patch()

import sys
from pathlib import Path

# Add project root directory to sys.path to allow absolute imports under src
_root_dir = str(Path(__file__).resolve().parent.parent.parent)
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

import os
import uuid
import json
import threading
from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS

import src.core.config as config
import src.models.story as models
from src.agent.graph import app as graph_app
from src.core.state import AgentState
from src.utils.session_manager import session_manager, SessionCancelledError
from src.utils.socket_emitter import set_socketio, emit_event

app = Flask(__name__)
# Enable CORS for all routes (important for ReactJS frontend connection)
CORS(app)

# Initialize Socket.IO with auto-detected async mode
socketio = SocketIO(app, cors_allowed_origins="*")
set_socketio(socketio)

# ----------------------------------------------------
# Real-time Websocket event handlers
# ----------------------------------------------------

@socketio.on('connect')
def handle_connect():
    print("Socket.IO client connected")
    emit('connection_response', {'data': 'Connected successfully'})

@socketio.on('disconnect')
def handle_disconnect():
    print("Socket.IO client disconnected")

@socketio.on('submit_clarification')
def handle_submit_clarification(data):
    """Client provides clarification answers for requirement analyzer."""
    story_uuid = data.get('story_uuid')
    answers = data.get('answers')
    print(f"Received clarification for story {story_uuid}: {answers}")
    session = session_manager.get_session(story_uuid)
    if session:
        session.input_data = answers
        session.input_event.set()
        emit('response_status', {'status': 'acknowledged', 'story_uuid': story_uuid})
    else:
        emit('response_status', {'status': 'error', 'message': 'Session not found'})

@socketio.on('submit_review_feedback')
def handle_submit_review_feedback(data):
    """Client provides review feedback (or 'Done') for the chapter draft."""
    story_uuid = data.get('story_uuid')
    feedback = data.get('feedback')
    print(f"Received review feedback for story {story_uuid}: {feedback}")
    session = session_manager.get_session(story_uuid)
    if session:
        session.input_data = feedback
        session.input_event.set()
        emit('response_status', {'status': 'acknowledged', 'story_uuid': story_uuid})
    else:
        emit('response_status', {'status': 'error', 'message': 'Session not found'})

@socketio.on('submit_model_change')
def handle_submit_model_change(data):
    """Client provides a new model selection on LLM error/rate limit."""
    story_uuid = data.get('story_uuid')
    model_name = data.get('model_name')
    print(f"Received model change for story {story_uuid}: {model_name}")
    session = session_manager.get_session(story_uuid)
    if session:
        session.input_data = model_name
        session.input_event.set()
        emit('response_status', {'status': 'acknowledged', 'story_uuid': story_uuid})
    else:
        emit('response_status', {'status': 'error', 'message': 'Session not found'})



# ----------------------------------------------------
# Story HTTP APIs (CRUD)
# ----------------------------------------------------

@app.route('/api/stories', methods=['GET'])
def get_stories():
    """List all stories in STORIES_DIR."""
    meta_files = list(config.STORIES_DIR.glob("*_meta.json"))
    stories_list = []
    for f in meta_files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            stories_list.append(data)
        except Exception as e:
            print(f"Error reading {f.name}: {e}")
    return jsonify(stories_list)

@app.route('/api/stories/<story_uuid>', methods=['GET'])
def get_story(story_uuid):
    """Get metadata for a specific story."""
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        return jsonify({'error': 'Story not found'}), 404
    try:
        data = json.loads(meta_path.read_text(encoding="utf-8"))
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': f'Failed to read story: {str(e)}'}), 500

@app.route('/api/stories', methods=['POST'])
def create_story():
    """Create a new story and initialize its ledger."""
    data = request.json
    if not data or not data.get('name') or not data.get('context') or not data.get('style'):
        return jsonify({'error': 'Missing required fields (name, context, style)'}), 400

    story_uuid = str(uuid.uuid4())
    
    # Structure characters list
    characters = []
    for c in data.get('characters', []):
        characters.append(models.CharacterInfo(
            name=c.get('name'),
            role=c.get('role'),
            description=c.get('description'),
            first_chapter=c.get('first_chapter'),
            appearance_context=c.get('appearance_context')
        ))

    meta = models.StoryMeta(
        uuid=story_uuid,
        name=data.get('name'),
        characters=characters,
        context=data.get('context'),
        style=data.get('style'),
        tags=[t.strip() for t in data.get('tags', []) if t.strip()],
        max_chapters=data.get('max_chapters', 10),
        max_words_per_chapter=data.get('max_words_per_chapter', 2000),
        model=data.get('model', 'gemini-2.5-flash')
    )

    ledger = models.GlobalLedger(
        timeline=[],
        unresolved_threads=data.get('unresolved_threads') or ["Bắt đầu cuộc phiêu lưu của nhân vật."]
    )

    # Save to files
    meta_path = config.get_meta_path(story_uuid)
    ledger_path = config.get_ledger_path(story_uuid)
    
    try:
        config.get_chapters_dir(story_uuid)
        config.get_states_dir(story_uuid)
        
        meta_path.write_text(meta.model_dump_json(indent=2), encoding="utf-8")
        ledger_path.write_text(ledger.model_dump_json(indent=2), encoding="utf-8")
        
        return jsonify({
            'message': 'Story created successfully',
            'uuid': story_uuid,
            'meta': meta.model_dump()
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to write story data: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>', methods=['PUT'])
def update_story(story_uuid):
    """Update story metadata."""
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        return jsonify({'error': 'Story not found'}), 404

    data = request.json
    try:
        existing_meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception as e:
        return jsonify({'error': f'Failed to read existing metadata: {str(e)}'}), 500

    # Update fields from request
    existing_meta['name'] = data.get('name', existing_meta.get('name'))
    existing_meta['context'] = data.get('context', existing_meta.get('context'))
    existing_meta['style'] = data.get('style', existing_meta.get('style'))
    existing_meta['tags'] = data.get('tags', existing_meta.get('tags', []))
    existing_meta['max_chapters'] = data.get('max_chapters', existing_meta.get('max_chapters', 10))
    existing_meta['max_words_per_chapter'] = data.get('max_words_per_chapter', existing_meta.get('max_words_per_chapter', 2000))
    existing_meta['model'] = data.get('model', existing_meta.get('model', 'gemini-2.5-flash'))
    
    # Handle characters update
    if 'characters' in data:
        existing_meta['characters'] = data['characters']

    try:
        # Validate metadata model
        validated_meta = models.StoryMeta(**existing_meta)
        meta_path.write_text(validated_meta.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({'message': 'Story updated successfully', 'meta': validated_meta.model_dump()})
    except Exception as e:
        return jsonify({'error': f'Validation or saving failed: {str(e)}'}), 400

@app.route('/api/stories/<story_uuid>/ledger', methods=['GET'])
def get_story_ledger(story_uuid):
    """Get global ledger timeline & unresolved threads."""
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404
    try:
        data = json.loads(ledger_path.read_text(encoding="utf-8"))
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': f'Failed to read ledger: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger', methods=['PUT'])
def update_story_ledger(story_uuid):
    """Update global ledger."""
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404

    data = request.json
    try:
        validated_ledger = models.GlobalLedger(**data)
        ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({'message': 'Ledger updated successfully', 'ledger': validated_ledger.model_dump()})
    except Exception as e:
        return jsonify({'error': f'Validation or saving failed: {str(e)}'}), 400


# ----------------------------------------------------
# Global Ledger & Meta Details management APIs
# ----------------------------------------------------

def is_main_character(role: str) -> bool:
    if not role:
        return False
    return role.strip().lower() in ["chính", "nhân vật chính", "main", "protagonist"]

@app.route('/api/stories/<story_uuid>/model', methods=['PUT'])
def update_story_model(story_uuid):
    """Update only the default AI model for a story."""
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        return jsonify({'error': 'Story not found'}), 404

    data = request.json
    if not data or 'model' not in data:
        return jsonify({'error': 'Missing model field in request body'}), 400

    new_model = data['model'].strip()
    if not new_model:
        return jsonify({'error': 'Model name cannot be empty'}), 400

    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        meta['model'] = new_model
        # Validate and save
        validated_meta = models.StoryMeta(**meta)
        meta_path.write_text(validated_meta.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({'message': 'Model updated successfully', 'model': validated_meta.model})
    except Exception as e:
        return jsonify({'error': f'Failed to update model: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger/threads', methods=['POST'])
def add_ledger_thread(story_uuid):
    """Add a new unresolved thread to the ledger."""
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404

    data = request.json
    if not data or 'thread' not in data:
        return jsonify({'error': 'Missing thread field in request body'}), 400

    new_thread = data['thread'].strip()
    if not new_thread:
        return jsonify({'error': 'Thread text cannot be empty'}), 400

    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        if 'unresolved_threads' not in ledger:
            ledger['unresolved_threads'] = []
            
        new_chapter = data.get('chapter')
        thread_item = {
            'thread': new_thread,
            'chapter': int(new_chapter) if new_chapter is not None and str(new_chapter).strip() != "" else None
        }
        ledger['unresolved_threads'].append(thread_item)

        validated_ledger = models.GlobalLedger(**ledger)
        ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Thread added successfully',
            'unresolved_threads': [t.model_dump() for t in validated_ledger.unresolved_threads]
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to add thread: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger/threads/<int:index>', methods=['PUT'])
def edit_ledger_thread(story_uuid, index):
    """Edit an unresolved thread in the ledger by index."""
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404

    data = request.json
    if not data or 'thread' not in data:
        return jsonify({'error': 'Missing thread field in request body'}), 400

    updated_thread = data['thread'].strip()
    if not updated_thread:
        return jsonify({'error': 'Thread text cannot be empty'}), 400

    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        threads = ledger.get('unresolved_threads', [])
        if index < 0 or index >= len(threads):
            return jsonify({'error': f'Invalid thread index {index}'}), 400

        updated_chapter = data.get('chapter')
        threads[index] = {
            'thread': updated_thread,
            'chapter': int(updated_chapter) if updated_chapter is not None and str(updated_chapter).strip() != "" else None
        }
        ledger['unresolved_threads'] = threads

        validated_ledger = models.GlobalLedger(**ledger)
        ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Thread updated successfully',
            'unresolved_threads': [t.model_dump() for t in validated_ledger.unresolved_threads]
        })
    except Exception as e:
        return jsonify({'error': f'Failed to update thread: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger/threads/<int:index>', methods=['DELETE'])
def delete_ledger_thread(story_uuid, index):
    """Delete an unresolved thread from the ledger by index."""
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404

    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        threads = ledger.get('unresolved_threads', [])
        if index < 0 or index >= len(threads):
            return jsonify({'error': f'Invalid thread index {index}'}), 400

        threads.pop(index)
        ledger['unresolved_threads'] = threads

        validated_ledger = models.GlobalLedger(**ledger)
        ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Thread deleted successfully',
            'unresolved_threads': [t.model_dump() for t in validated_ledger.unresolved_threads]
        })
    except Exception as e:
        return jsonify({'error': f'Failed to delete thread: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger/resolved-threads', methods=['GET'])
def get_ledger_resolved_threads(story_uuid):
    """Get the list of resolved threads."""
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify([])
    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        return jsonify(ledger.get('resolved_threads', []))
    except Exception as e:
        return jsonify({'error': f'Failed to read resolved threads: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger/threads/<int:index>/resolve', methods=['POST'])
def resolve_ledger_thread(story_uuid, index):
    """Manually move an unresolved thread to resolved threads list by index."""
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404

    data = request.json or {}
    chap_resolved = data.get('chapter_resolved')
    res_note = data.get('resolution_note', '').strip()

    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        unresolved = ledger.get('unresolved_threads', [])
        if index < 0 or index >= len(unresolved):
            return jsonify({'error': f'Invalid thread index {index}'}), 400

        # Extract the unresolved thread
        thread_to_resolve = unresolved.pop(index)
        
        # Get thread contents (could be dict or string)
        thread_text = ""
        thread_chap_intro = None
        if isinstance(thread_to_resolve, dict):
            thread_text = thread_to_resolve.get('thread', '')
            thread_chap_intro = thread_to_resolve.get('chapter')
        else:
            thread_text = str(thread_to_resolve)

        if 'resolved_threads' not in ledger:
            ledger['resolved_threads'] = []

        # Add to resolved threads
        ledger['resolved_threads'].append({
            'thread': thread_text,
            'chapter_introduced': thread_chap_intro,
            'chapter_resolved': int(chap_resolved) if chap_resolved is not None and str(chap_resolved).strip() != "" else None,
            'resolution_note': res_note if res_note else "Giải quyết thủ công."
        })

        ledger['unresolved_threads'] = unresolved

        validated_ledger = models.GlobalLedger(**ledger)
        ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Thread resolved successfully',
            'unresolved_threads': [t.model_dump() for t in validated_ledger.unresolved_threads],
            'resolved_threads': [t.model_dump() for t in validated_ledger.resolved_threads]
        })
    except Exception as e:
        return jsonify({'error': f'Failed to resolve thread: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/characters', methods=['POST'])
def add_story_character(story_uuid):
    """Add a new character to the story (excluding main character roles)."""
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        return jsonify({'error': 'Story metadata not found'}), 404

    data = request.json or {}
    char_name = data.get('name', '').strip()
    char_role = data.get('role', '').strip()
    char_description = data.get('description', '').strip()

    if not char_name:
        return jsonify({'error': 'Character name is required'}), 400
    if not char_role:
        return jsonify({'error': 'Character role is required'}), 400

    if is_main_character(char_role):
        return jsonify({'error': 'Không thể thêm nhân vật chính mới tại đây'}), 400

    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        characters = meta.get('characters', [])

        # Check if name duplicate (case-insensitive)
        if any(c.get('name', '').strip().lower() == char_name.lower() for c in characters):
            return jsonify({'error': f'Nhân vật có tên {char_name} đã tồn tại'}), 400

        new_char = {
            'name': char_name,
            'role': char_role,
            'description': char_description,
            'first_chapter': data.get('first_chapter'),
            'appearance_context': data.get('appearance_context', '')
        }
        characters.append(new_char)
        meta['characters'] = characters

        validated_meta = models.StoryMeta(**meta)
        meta_path.write_text(validated_meta.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Character added successfully',
            'characters': [c.model_dump() for c in validated_meta.characters]
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to add character: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/characters/<name>', methods=['PUT'])
def edit_story_character(story_uuid, name):
    """Edit a character by their name (excluding main character roles)."""
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        return jsonify({'error': 'Story metadata not found'}), 404

    data = request.json or {}
    new_name = data.get('name', '').strip()
    new_role = data.get('role', '').strip()
    new_description = data.get('description', '').strip()

    if not new_name:
        return jsonify({'error': 'Character name is required'}), 400
    if not new_role:
        return jsonify({'error': 'Character role is required'}), 400

    if is_main_character(new_role):
        return jsonify({'error': 'Không thể thay đổi vai trò thành nhân vật chính'}), 400

    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        characters = meta.get('characters', [])

        # Find character to update
        char_index = -1
        for i, c in enumerate(characters):
            if c.get('name', '').strip().lower() == name.lower():
                char_index = i
                break

        if char_index == -1:
            return jsonify({'error': f'Không tìm thấy nhân vật {name}'}), 404

        existing_char = characters[char_index]
        if is_main_character(existing_char.get('role', '')):
            return jsonify({'error': 'Không thể chỉnh sửa thông tin của nhân vật chính'}), 400

        # Check name conflict if name changed
        if new_name.lower() != name.lower():
            if any(c.get('name', '').strip().lower() == new_name.lower() for i, c in enumerate(characters) if i != char_index):
                return jsonify({'error': f'Tên nhân vật {new_name} đã bị trùng'}), 400

        existing_char['name'] = new_name
        existing_char['role'] = new_role
        existing_char['description'] = new_description
        if 'first_chapter' in data:
            existing_char['first_chapter'] = data.get('first_chapter')
        if 'appearance_context' in data:
            existing_char['appearance_context'] = data.get('appearance_context')

        characters[char_index] = existing_char
        meta['characters'] = characters

        validated_meta = models.StoryMeta(**meta)
        meta_path.write_text(validated_meta.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Character updated successfully',
            'characters': [c.model_dump() for c in validated_meta.characters]
        })
    except Exception as e:
        return jsonify({'error': f'Failed to update character: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/characters/<name>', methods=['DELETE'])
def delete_story_character(story_uuid, name):
    """Delete a character by name (excluding main character roles)."""
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        return jsonify({'error': 'Story metadata not found'}), 404

    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        characters = meta.get('characters', [])

        # Find character
        char_index = -1
        for i, c in enumerate(characters):
            if c.get('name', '').strip().lower() == name.lower():
                char_index = i
                break

        if char_index == -1:
            return jsonify({'error': f'Không tìm thấy nhân vật {name}'}), 404

        existing_char = characters[char_index]
        if is_main_character(existing_char.get('role', '')):
            return jsonify({'error': 'Không thể xóa nhân vật chính'}), 400

        characters.pop(char_index)
        meta['characters'] = characters

        validated_meta = models.StoryMeta(**meta)
        meta_path.write_text(validated_meta.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Character deleted successfully',
            'characters': [c.model_dump() for c in validated_meta.characters]
        })
    except Exception as e:
        return jsonify({'error': f'Failed to delete character: {str(e)}'}), 500


# ----------------------------------------------------
# Chapter HTTP APIs (CRUD)
# ----------------------------------------------------

@app.route('/api/stories/<story_uuid>/chapters', methods=['GET'])
def get_story_chapters(story_uuid):
    """List all created chapters from ledger and verify file existence."""
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify([])
    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        timeline = ledger.get('timeline', [])
        
        # Verify if content file exists, attach flags
        for chap in timeline:
            chap_num = chap.get('chapter')
            content_path = config.get_chapter_content_path(story_uuid, chap_num)
            state_path = config.get_chapter_state_path(story_uuid, chap_num)
            chap['has_content'] = content_path.exists()
            chap['has_state'] = state_path.exists()
            
        return jsonify(timeline)
    except Exception as e:
        return jsonify({'error': f'Failed to read chapters: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/chapters/<int:chapter_num>', methods=['GET'])
def get_chapter(story_uuid, chapter_num):
    """Get the written content and state logic of a specific chapter."""
    content_path = config.get_chapter_content_path(story_uuid, chapter_num)
    state_path = config.get_chapter_state_path(story_uuid, chapter_num)

    if not content_path.exists():
        return jsonify({'error': f'Chapter {chapter_num} content not found'}), 404

    content = ""
    state_desc = ""
    try:
        content = content_path.read_text(encoding="utf-8")
        if state_path.exists():
            state_desc = state_path.read_text(encoding="utf-8")
    except Exception as e:
        return jsonify({'error': f'Failed to read chapter files: {str(e)}'}), 500

    return jsonify({
        'story_uuid': story_uuid,
        'chapter': chapter_num,
        'content': content,
        'state': state_desc
    })

@app.route('/api/stories/<story_uuid>/chapters/<int:chapter_num>/nodes', methods=['GET'])
def get_chapter_nodes(story_uuid, chapter_num):
    """Get the event nodes & connections for a specific chapter."""
    nodes_path = config.get_chapter_nodes_path(story_uuid, chapter_num)
    if not nodes_path.exists():
        # Try to find it in timeline if not separate file (fallback)
        ledger_path = config.get_ledger_path(story_uuid)
        if ledger_path.exists():
            try:
                ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
                for item in ledger.get("timeline", []):
                    if item.get("chapter") == chapter_num and "nodes" in item:
                        return jsonify({
                            "nodes": item.get("nodes", []),
                            "connections": item.get("connections", [])
                        })
            except Exception:
                pass
        return jsonify({"nodes": [], "connections": []})
    try:
        data = json.loads(nodes_path.read_text(encoding="utf-8"))
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': f'Failed to read nodes: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/chapters/<int:chapter_num>', methods=['PUT'])
def update_chapter(story_uuid, chapter_num):
    """Edit the chapter content manually."""
    content_path = config.get_chapter_content_path(story_uuid, chapter_num)
    if not content_path.exists():
        return jsonify({'error': f'Chapter {chapter_num} content not found'}), 404

    data = request.json
    if not data or 'content' not in data:
        return jsonify({'error': 'Missing content in payload'}), 400

    try:
        content_path.write_text(data['content'], encoding="utf-8")
        return jsonify({'message': f'Chapter {chapter_num} content updated successfully'})
    except Exception as e:
        return jsonify({'error': f'Failed to update chapter: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/chapters/<int:chapter_num>', methods=['DELETE'])
def delete_chapter(story_uuid, chapter_num):
    """Delete a chapter from disk and remove its record in global ledger timeline."""
    content_path = config.get_chapter_content_path(story_uuid, chapter_num)
    state_path = config.get_chapter_state_path(story_uuid, chapter_num)
    ledger_path = config.get_ledger_path(story_uuid)

    deleted_files = []
    # Delete files
    try:
        if content_path.exists():
            content_path.unlink()
            deleted_files.append('content')
        if state_path.exists():
            state_path.unlink()
            deleted_files.append('state')
    except Exception as e:
        return jsonify({'error': f'Failed to delete chapter files: {str(e)}'}), 500

    # Update Ledger
    if ledger_path.exists():
        try:
            ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
            timeline = ledger.get('timeline', [])
            
            # Filter out deleted chapter
            new_timeline = [item for item in timeline if item.get('chapter') != chapter_num]
            ledger['timeline'] = new_timeline
            
            validated_ledger = models.GlobalLedger(**ledger)
            ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        except Exception as e:
            return jsonify({
                'warning': f'Chapter files deleted, but ledger update failed: {str(e)}',
                'deleted_files': deleted_files
            }), 200

    return jsonify({
        'message': f'Chapter {chapter_num} deleted successfully',
        'deleted_files': deleted_files
    })

@app.route('/api/stories/<story_uuid>/chapters/<int:chapter_num>/edit-paragraph', methods=['POST'])
def edit_chapter_paragraph(story_uuid, chapter_num):
    """AI-assisted editing of a single paragraph in a chapter."""
    data = request.json or {}
    original_paragraph = data.get('paragraph', '').strip()
    instruction = data.get('instruction', '').strip()
    
    if not original_paragraph:
        return jsonify({'error': 'Original paragraph text is required.'}), 400
    if not instruction:
        return jsonify({'error': 'Instruction description is required.'}), 400

    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        return jsonify({'error': 'Story metadata not found.'}), 404
        
    try:
        meta_data = json.loads(meta_path.read_text(encoding="utf-8"))
        model_name = meta_data.get('model', 'gemini-2.5-flash')
    except Exception as e:
        return jsonify({'error': f'Failed to read metadata: {str(e)}'}), 500

    # Try to load chapter content for context
    chapter_content = ""
    content_path = config.get_chapter_content_path(story_uuid, chapter_num)
    if content_path.exists():
        try:
            chapter_content = content_path.read_text(encoding="utf-8")
        except Exception:
            pass

    # Build prompt and call Gemini LLM
    try:
        from src.utils.llm import get_llm
        llm = get_llm(model_name=model_name, temperature=0.7)
        
        # Format characters list
        characters_list = meta_data.get('characters', [])
        characters_str = ", ".join([f"{c.get('name')} ({c.get('role')}): {c.get('description')}" for c in characters_list])
        
        # Extract context
        context_str = "..."
        if chapter_content:
            context_str = chapter_content[:3000] # Limit to 3000 chars

        prompt = f"""
Bạn là một biên tập viên văn học chuyên nghiệp. Hãy hỗ trợ tác giả chỉnh sửa một đoạn văn cụ thể trong chương truyện theo yêu cầu chi tiết của họ, đảm bảo giữ vững văn phong và nhất quán logic của toàn bộ tác phẩm.

THÔNG TIN TÁC PHẨM:
- Tên truyện: {meta_data.get('name')}
- Phong cách hành văn: {meta_data.get('style')}
- Bối cảnh chung: {meta_data.get('context')}
- Nhân vật đã biết: {characters_str}

NỘI DUNG CHƯƠNG {chapter_num} ĐỂ THAM KHẢO BỐI CẢNH:
---
{context_str}
---

ĐOẠN VĂN GỐC CẦN CHỈNH SỬA:
---
{original_paragraph}
---

YÊU CẦU CHỈNH SỬA CỦA TÁC GIẢ:
"{instruction}"

HƯỚNG DẪN VIẾT:
1. Chỉnh sửa và viết lại đoạn văn gốc sao cho đáp ứng hoàn hảo yêu cầu của tác giả.
2. Giữ nguyên bối cảnh, ngôi kể và các thông tin logic đã có của tác phẩm trừ khi tác giả có yêu cầu thay đổi chúng cụ thể.
3. Chỉ trả về nội dung đoạn văn mới đã được chỉnh sửa. Tuyệt đối không thêm bất kỳ lời bình luận, lời giới thiệu hay định dạng markdown rườm rà nào khác ngoài đoạn văn chính.
"""
        from src.utils.helpers import ensure_string
        response = llm.invoke(prompt)
        revised_paragraph = ensure_string(response.content).strip()
        
        # Clean up any potential markdown wraps if the model returned them
        if revised_paragraph.startswith("```"):
            lines = revised_paragraph.splitlines()
            if len(lines) >= 2:
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].startswith("```"):
                    lines = lines[:-1]
                revised_paragraph = "\n".join(lines).strip()

        return jsonify({
            'original_paragraph': original_paragraph,
            'revised_paragraph': revised_paragraph
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to call LLM: {str(e)}'}), 500



# ----------------------------------------------------
# Real-time Chapter Generation API (LangGraph trigger)
# ----------------------------------------------------

@app.route('/api/stories/<story_uuid>/chapters/generate', methods=['POST'])
def generate_chapter(story_uuid):
    """Trigger the LangGraph workflow to write the next chapter in a background thread."""
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        return jsonify({'error': 'Story metadata not found'}), 404

    data = request.json or {}
    user_idea = data.get('user_idea')
    if not user_idea:
        return jsonify({'error': 'Missing user_idea in payload'}), 400
    if isinstance(user_idea, str) and not user_idea.strip():
        return jsonify({'error': 'Missing user_idea in payload'}), 400

    # Resolve story metadata and ledger
    try:
        meta_data = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception as e:
        return jsonify({'error': f'Failed to read meta: {str(e)}'}), 500

    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        ledger_data = {"timeline": [], "unresolved_threads": ["Khởi đầu cốt truyện"]}
    else:
        try:
            ledger_data = json.loads(ledger_path.read_text(encoding="utf-8"))
        except Exception as e:
            return jsonify({'error': f'Failed to read ledger: {str(e)}'}), 500

    # Determine next chapter number
    chapters_dir = config.get_chapters_dir(story_uuid)
    existing_chapters = list(chapters_dir.glob("chap_*_content.md"))
    chap_nums = []
    for c in existing_chapters:
        try:
            num = int(c.name.split("_")[1])
            chap_nums.append(num)
        except Exception:
            pass
    next_chap_num = max(chap_nums) + 1 if chap_nums else 1

    # Check for active session
    if session_manager.get_session(story_uuid):
        return jsonify({'error': 'Tiến trình sáng tác đang hoạt động cho truyện này.'}), 400

    selected_model = data.get('model') or meta_data.get('model') or 'gemini-2.5-flash'

    # Create background thread to run LangGraph
    def run_graph_flow():
        print(f"Background thread started for story {story_uuid}, Chapter {next_chap_num}")
        # Create API session
        session = session_manager.create_session(story_uuid, next_chap_num)
        
        initial_state: AgentState = {
            "story_uuid": story_uuid,
            "chapter_num": next_chap_num,
            "user_idea": user_idea,
            "original_user_idea": user_idea,
            "model": selected_model,
            "meta": meta_data,
            "ledger": ledger_data,
            "analyzed_requirements": "",
            "draft_content": "",
            "revision_feedback": "",
            "auditor_feedback": "",
            "warnings": [],
            "is_done": False
        }
        
        try:
            # Execute graph app
            graph_app.invoke(initial_state)
            print(f"Background thread finished successfully for story {story_uuid}")
        except SessionCancelledError as e:
            print(f"LangGraph execution cancelled for story {story_uuid}: {e}")
            # Clean up temp_draft.md
            temp_draft_path = config.get_temp_draft_path(story_uuid)
            if temp_draft_path.exists():
                try:
                    temp_draft_path.unlink()
                    print("✓ Dọn dẹp file nháp tạm temp_draft.md sau khi hủy.")
                except Exception as ex:
                    print(f"Warning: Không thể xóa file nháp tạm: {ex}")
            emit_event("agent_status", {
                "story_uuid": story_uuid,
                "chapter_num": next_chap_num,
                "status": "cancelled",
                "message": "Tiến trình sáng tác đã bị hủy bởi tác giả."
            })
            session_manager.remove_session(story_uuid)
        except Exception as e:
            print(f"Error in background LangGraph execution: {e}")
            emit_event("agent_status", {
                "story_uuid": story_uuid,
                "chapter_num": next_chap_num,
                "status": "error",
                "message": f"Gặp lỗi trong quá trình sáng tác: {str(e)}"
            })
            session_manager.remove_session(story_uuid)

    # Launch background task via socketio to ensure compatibility with eventlet/gevent
    socketio.start_background_task(run_graph_flow)

    return jsonify({
        'status': 'started',
        'chapter': next_chap_num,
        'message': f"Đã bắt đầu tiến trình sáng tác Chương {next_chap_num} ngầm."
    })

@app.route('/api/stories/<story_uuid>/chapters/cancel', methods=['POST'])
def cancel_chapter_generation(story_uuid):
    """Cancel the active chapter generation session."""
    session = session_manager.get_session(story_uuid)
    if not session:
        return jsonify({'error': 'Không có tiến trình sáng tác nào đang chạy cho truyện này.'}), 404
        
    session.cancel()
    return jsonify({
        'status': 'cancelled',
        'message': 'Đã gửi yêu cầu hủy tiến trình sáng tác.'
    })

if __name__ == '__main__':
    socketio.run(app, host='127.0.0.1', port=5000, debug=True, allow_unsafe_werkzeug=True)
