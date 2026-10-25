"""Record unchanged export bytes and the exact native-source provenance."""
from pathlib import Path
import hashlib
import json
import struct

root = Path(__file__).resolve().parent.parent
assets = root/'public'/'assets'

def record(path):
    data=path.read_bytes()
    item={'path':str(path.relative_to(root)), 'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest()}
    if path.suffix=='.png':
        assert data[:8]==b'\x89PNG\r\n\x1a\n'
        item['width'],item['height']=struct.unpack('>II',data[16:24])
    return item

atlas_data={name:json.loads((assets/f'{name}.json').read_text()) for name in ('characters','town','objects')}
manifest={
 'version':2,
 'createdDate':'2026-10-25',
 'project':'GODMODE',
 'status':'Original local prototype asset pack; competition eligibility unconfirmed',
 'authoring':{
  'style':'Anime-inspired chibi, warm pastel palette',
  'method':'Original native Aseprite pixel construction via project Lua source; deterministic geometry and palette variants',
  'tool':'Aseprite 1.3.18.6-dev',
  'projectOwner':'Ryan Morrison / Built by Magnus',
  'remoteGenerativeModel':None,
  'remoteJobId':None,
  'providerCalls':0,
  'providerChargeForThisPack':0,
  'thirdPartyRasterAssets':[],
  'reference':'Ultima VII-era miniature-world visual density only; no imported game content',
  'rightsNote':'Original project assets; no separate public asset-pack license granted by this manifest'
 },
 'rendering':{'nativeTile':16,'townTiles':{'width':64,'height':48},'characterCell':{'width':16,'height':24},'footAnchor':{'x':8,'y':23},'cargoAnchor':{'x':8,'y':18},'lighting':'upper-left','sampling':'nearest-neighbor','palette':atlas_data['town']['meta']['palette']},
 'atlases':{name:{'png':f'/assets/{name}.png','metadata':f'/assets/{name}.json','width':data['meta']['size']['w'],'height':data['meta']['size']['h'],'packedSourceFrames':data['meta']['frameCount'],'namedFrames':len(data['frames']),'animations':len(data['animations'])} for name,data in atlas_data.items()},
 'residents':json.loads((assets/'residents.json').read_text()),
 'viewer':'/assets/viewer.html',
 'validation':json.loads((assets/'validation.json').read_text()),
 'verification':{'nativePixelAudit':'passed','visualContactReview':'Native and exact2x sheets inspected','browserAnimationReview':'Pending integrated root browser playtest; in-app browser unavailable to asset agent','stagingNote':'Contact town is a deliberate art arrangement, not a simulated result'},
 'exports':[record(path) for path in sorted(assets.iterdir()) if path.is_file() and path.name!='manifest.json'],
 'editableSources':[record(path) for path in sorted((root/'art').iterdir()) if path.is_file()],
}
(assets/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Manifest records {len(manifest["exports"])} exports and {len(manifest["editableSources"])} editable/source files.')
