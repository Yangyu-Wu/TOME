"""Small standard-library CDP client: wait for actual page results, not virtual clocks."""
import base64
import json
from pathlib import Path
import os
import socket
import struct
import time
import urllib.request


class BrowserPage:
    def __init__(self, profile, process, timeout=30):
        deadline = time.monotonic() + timeout
        port_file = Path(profile) / 'DevToolsActivePort'
        while not port_file.is_file():
            if process.poll() is not None or time.monotonic() > deadline:
                raise RuntimeError('Browser debugging port did not start')
            time.sleep(.05)
        port = int(port_file.read_text().splitlines()[0])
        while True:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/json', timeout=5) as response:
                pages = json.load(response)
            page = next((p for p in pages if p.get('type') == 'page'), None)
            if page:
                break
            if time.monotonic() > deadline:
                raise RuntimeError('Browser page did not start')
            time.sleep(.05)
        path = page['webSocketDebuggerUrl'].split(str(port), 1)[1]
        self.socket = socket.create_connection(('127.0.0.1', port), timeout=30)
        key = base64.b64encode(os.urandom(16)).decode()
        self.socket.sendall((f'GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n'
                             'Upgrade: websocket\r\nConnection: Upgrade\r\n'
                             f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        header = bytearray()
        while not header.endswith(b'\r\n\r\n'):
            header.extend(self.exact(1))
        if b' 101 ' not in header.split(b'\r\n', 1)[0]:
            raise RuntimeError('Browser websocket handshake failed')
        self.sequence = 0

    def exact(self, length):
        data = bytearray()
        while len(data) < length:
            part = self.socket.recv(length-len(data))
            if not part:
                raise RuntimeError('Browser disconnected')
            data.extend(part)
        return bytes(data)

    def call(self, method, params=None):
        self.sequence += 1
        data = json.dumps({'id': self.sequence, 'method': method, 'params': params or {}}).encode()
        length = len(data)
        header = bytes([129, 128+length]) if length < 126 else bytes([129, 254])+struct.pack('!H', length)
        mask = os.urandom(4)
        self.socket.sendall(header+mask+bytes(v ^ mask[i % 4] for i, v in enumerate(data)))
        fragments = bytearray()
        while True:
            a, b = self.exact(2)
            size = b & 127
            if size == 126:
                size = struct.unpack('!H', self.exact(2))[0]
            elif size == 127:
                size = struct.unpack('!Q', self.exact(8))[0]
            payload = self.exact(size)
            if a & 15 == 8:
                raise RuntimeError('Browser websocket closed')
            fragments.extend(payload)
            if not a & 128:
                continue
            result = json.loads(fragments)
            fragments.clear()
            if result.get('id') == self.sequence:
                if 'error' in result:
                    raise RuntimeError(str(result['error']))
                return result.get('result', {})

    def evaluate(self, expression):
        result = self.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True})
        if result.get('exceptionDetails'):
            raise RuntimeError(str(result['exceptionDetails']))
        return result.get('result', {}).get('value')

    def wait_for_result(self, home=False, screenshot=None):
        deadline = time.monotonic()+90
        expression = ("document.readyState==='complete' && !!document.querySelector('.deployment')" if home else
                      "document.body.dataset.ready==='true'||document.body.dataset.ready==='error'" if screenshot or 'asset-lab.html' in self.page_url else
                      "document.querySelector('#result')?.textContent.trim().startsWith('{')")
        while True:
            try:
                ready = self.evaluate(expression)
            except RuntimeError:
                ready = False
            if ready:
                break
            if time.monotonic() > deadline:
                raise TimeoutError('Page did not report a completed result')
            time.sleep(.05)
        if screenshot:
            result = self.call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False})
            screenshot.write_bytes(base64.b64decode(result['data']))
        return self.evaluate('document.documentElement.outerHTML')

    def close(self):
        self.socket.close()
