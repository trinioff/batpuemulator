#!/usr/bin/env python3
"""
BatPU-2 Simulator with Web GUI
Drag & drop interface for assembly files
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import os
import sys
import tempfile
import webbrowser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from assembler import assemble
from simulator import BatPU2

cpu = BatPU2()

class SimulatorHandler(SimpleHTTPRequestHandler):
    
    def log_message(self, format, *args):
        pass
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        if self.path == '/' or self.path == '/index.html':
            self.serve_file('index.html', 'text/html; charset=utf-8')
        elif self.path == '/style.css':
            self.serve_file('style.css', 'text/css')
        elif self.path == '/script.js':
            self.serve_file('script.js', 'application/javascript')
        elif self.path == '/api/state':
            self.get_state()
        elif self.path == '/api/disasm':
            self.get_disasm()
        elif self.path == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
        else:
            self.send_error(404)
    
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8') if content_length else ''
        
        if self.path == '/api/load':
            self.load_program(body)
        elif self.path == '/api/step':
            self.step()
        elif self.path == '/api/run':
            self.run_program(body)
        elif self.path == '/api/reset':
            self.reset()
        else:
            self.send_error(404)
    
    def send_json(self, data):
        response = json.dumps(data).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', len(response))
        self.end_headers()
        self.wfile.write(response)
    
    def get_state(self):
        global cpu
        outputs = []
        for i, v in enumerate(cpu.registers):
            if v != 0:
                outputs.append(f"r{i} = {v}")
        
        self.send_json({
            'pc': cpu.pc,
            'registers': cpu.registers,
            'flags': {'zero': cpu.zero_flag, 'carry': cpu.carry_flag},
            'halted': cpu.halted,
            'instructions': cpu.instruction_count,
            'memory': cpu.memory[:128],
            'programLength': len(cpu.program),
            'numberDisplay': cpu.number_display,
            'charBuffer': ''.join(cpu.char_buffer),
            'screen': cpu.screen,
            'outputs': outputs,
            'lastInstruction': cpu.disassemble(cpu.program[max(0, cpu.pc-1)]) if cpu.program and cpu.pc > 0 else None
        })
    
    def get_disasm(self):
        global cpu
        lines = []
        for i, instr in enumerate(cpu.program[:200]):
            lines.append({
                'addr': i,
                'text': cpu.disassemble(instr),
                'current': i == cpu.pc,
                'binary': f'{instr:016b}'
            })
        self.send_json({'disasm': lines})
    
    def load_program(self, body):
        global cpu
        try:
            data = json.loads(body)
            code = data.get('code', '')
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.as', delete=False) as f:
                f.write(code)
                as_file = f.name
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.mc', delete=False) as f:
                mc_file = f.name
            
            try:
                assemble(as_file, mc_file)
                cpu.reset()
                cpu.load_mc(mc_file)
                self.send_json({'success': True, 'message': f'✓ {len(cpu.program)} instructions'})
            except SystemExit as e:
                self.send_json({'success': False, 'message': str(e)})
            finally:
                os.unlink(as_file)
                os.unlink(mc_file)
        except Exception as e:
            self.send_json({'success': False, 'message': str(e)})
    
    def step(self):
        global cpu
        if not cpu.halted and cpu.pc < len(cpu.program):
            cpu.execute_one()
        self.get_state()
    
    def run_program(self, body):
        global cpu
        try:
            data = json.loads(body) if body else {}
            max_instr = data.get('max', 100000)
            
            count = 0
            while count < max_instr and not cpu.halted and cpu.pc < len(cpu.program):
                cpu.execute_one()
                count += 1
            
            self.get_state()
        except Exception as e:
            self.send_json({'error': str(e)})
    
    def reset(self):
        global cpu
        program = cpu.program.copy()
        cpu.reset()
        cpu.program = program
        self.get_state()
    
    def serve_file(self, filename, content_type):
        try:
            web_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web')
            file_path = os.path.join(web_dir, filename)
            
            with open(file_path, 'rb') as f:
                content = f.read()
                
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', len(content))
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_error(404, f"File not found: web/{filename}")
        except Exception as e:
            self.send_error(500, str(e))


def main():
    port = 8080
    
    import socket
    for p in range(8080, 8100):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.bind(('', p))
            s.close()
            port = p
            break
        except:
            continue
    
    server = HTTPServer(('localhost', port), SimulatorHandler)
    
    url = f'http://localhost:{port}'
    print(f"\\n{'='*50}")
    print(f"  🚀 BatPU-2 Simulator")
    print(f"  📍 {url}")
    print(f"{'='*50}")
    print(f"  Ctrl+C pour arrêter")
    print(f"{'='*50}\\n")
    
    webbrowser.open(url)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\\n👋 Arrêt")
        server.shutdown()


if __name__ == '__main__':
    main()
