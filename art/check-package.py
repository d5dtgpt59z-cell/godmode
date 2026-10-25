"""Verify byte provenance and offline-viewer embedding without editing images."""
from pathlib import Path
import base64
import hashlib
import json
import re
import subprocess

root=Path(__file__).resolve().parent.parent
assets=root/'public'/'assets'
manifest=json.loads((assets/'manifest.json').read_text())
for record in manifest['exports']+manifest['editableSources']:
    data=(root/record['path']).read_bytes()
    assert len(data)==record['bytes'],record['path']
    assert hashlib.sha256(data).hexdigest()==record['sha256'],record['path']
html=(assets/'viewer.html').read_text()
script=re.search(r'<script>(.*?)</script>',html,re.S).group(1)
result=subprocess.run(['node','--check'],input=script,capture_output=True,text=True)
assert result.returncode==0,result.stderr
bundle=json.loads(re.search(r'const DATA=(.*?);\nconst RESIDENTS=',script,re.S).group(1))
for name,data in bundle.items():
    embedded=base64.b64decode(data.pop('imageData').split(',',1)[1])
    assert embedded==(assets/f'{name}.png').read_bytes(),name
    assert data==json.loads((assets/f'{name}.json').read_text()),name
assert not re.search(r'<(?:script|link)[^>]+(?:src|href)=["\']https?://',html)
assert manifest['validation']['status']=='passed'
subprocess.run(['node',str(root/'art'/'check-phaser-anchors.cjs')],check=True)
print('PASS: all hashes match; embedded PNG/JSON bytes match; viewer JavaScript parses; no external script/style dependency; native raster audit passed.')
