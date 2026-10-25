"""Read-only raster audit, source hashes and archive packaging. No image editing."""
from pathlib import Path
from collections import deque
from datetime import datetime, timezone
import hashlib, json, struct, zipfile

ART = Path(__file__).resolve().parent
PUBLIC = ART.parent.parent / 'public/assets/cozy'

def describe(path, root):
    raw = path.read_bytes()
    result = {'path': str(path.relative_to(root)), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
    if raw[:8] == b'\x89PNG\r\n\x1a\n':
        w, h = struct.unpack('>II', raw[16:24])
        result['dimensions'] = {'width': w, 'height': h}
    return result

mapping = json.loads((PUBLIC / 'map.json').read_text())
ground = {(x,y) for y,row in enumerate(mapping['walkableRows']) for x,c in enumerate(row) if c == '.'}
start = tuple(mapping['places'][0]['position'].values())
queue, seen = deque([start]), {start}
while queue:
    x, y = queue.popleft()
    for p in [(x-1,y), (x+1,y), (x,y-1), (x,y+1)]:
        if p in ground and p not in seen:
            seen.add(p)
            queue.append(p)
assert ground == seen
for place in mapping['places'] + mapping['plots']:
    assert tuple(place['position'].values()) in seen, place['id']
for block in mapping['buildings'] + mapping['sceneryColliders']:
    occupied = {(x,y) for x in range(block['x'], block['x']+block['width']) for y in range(block['y'], block['y']+block['height'])}
    assert not occupied & ground, block['id']
native = json.loads((ART / 'native-qa.json').read_text())
assert native['passed']
provenance = {
    'version': 1,
    'createdAt': datetime.now(timezone.utc).isoformat(),
    'purpose': 'Original cozy life-sim production art. Not a gameplay or AI-inference assertion.',
    'scope': 'Only art/cozy and public/assets/cozy. Legacy art is preserved.',
    'background': {
        'source': 'Earlier original project concept; exact reference and prompt preserved in source package.',
        'currentBuiltInImageEditCalls': 2,
        'earlierConceptImageGenerationCalls': 1,
        'method': 'Built-in edits, local Aseprite nearest resize, optimal palette quantization, original scene-material path clearance.',
        'nativePixels': [512,384],
        'opaqueColors': native['map']['actualOpaqueColors'],
        'containsBakedPeopleAnimalsFoodCropsFestivalTableBunting': False,
        'modularity': 'Fixed environment raster with separate semantic overlays; not a modular building tile atlas.',
    },
    'characters': {'method': 'Original native Aseprite construction from included Lua', 'remoteGenerationCalls': 0, 'residents': 4, 'poses': 288, 'clips': 96, 'cell': [24,32], 'footAnchor': [12,31], 'cargoAnchor': [12,22]},
    'foreground': {'method': 'Original native Aseprite construction from included Lua', 'remoteGenerationCalls': 0, 'sourceCells':21, 'namedFrames':24, 'clips':2, 'intentionalTransparentFrames':['crop.empty']},
    'thirdPartyReferencePixelsImported':0,
    'paidProviderCalls':0,
    'purchases':0,
    'metaCallsInArtWorkflow':0,
    'checks': {'nativeAuditPassed':True, 'connectedGroundCells':len(ground), 'reachablePlaces':len(mapping['places']), 'reachablePlots':len(mapping['plots']), 'noGroundInsideSceneryOrBuildingBlocks':True, 'nativeContactSheetVisuallyInspected':True, 'integrationPreviewIsStagedArt':True, 'browserIntegrationQa':'Parent agent; this subagent CUA exposed no browser surfaces'},
    'runtimeFiles': [describe(p, PUBLIC) for p in sorted(PUBLIC.iterdir()) if p.is_file() and p.name != 'provenance.json'],
}
(PUBLIC / 'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
manifest = {'version':1,'sourceFiles':[describe(p,ART) for p in sorted(ART.iterdir()) if p.is_file() and p.name not in ['ART-MANIFEST.json','cozy-art-source.zip']], 'runtimeFiles':[describe(p,PUBLIC) for p in sorted(PUBLIC.iterdir()) if p.is_file()]}
(ART/'ART-MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
with zipfile.ZipFile(ART/'cozy-art-source.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for p in sorted(ART.iterdir()):
        if p.is_file() and p.name!='cozy-art-source.zip':archive.write(p,'art/cozy/'+p.name)
    for p in sorted(PUBLIC.iterdir()):
        if p.is_file():archive.write(p,'public/assets/cozy/'+p.name)
print(json.dumps({'passed':True,'groundCells':len(ground),'targets':len(mapping['places'])+len(mapping['plots']),'archive':describe(ART/'cozy-art-source.zip',ART),'runtimeFileCount':len(manifest['runtimeFiles'])},indent=2))
