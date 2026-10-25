from pathlib import Path
import hashlib, json, zipfile

root=Path(__file__).resolve().parent
excluded={'.hyperframes','snapshots-first','snapshots-review','snapshots-motion','snapshots-final','node_modules'}
files=[p for p in root.rglob('*') if p.is_file() and not any(x in excluded or x.startswith('snapshots-') for x in p.relative_to(root).parts) and p.suffix not in ['.mp4','.zip','.log'] and p!=root/'provenance.json' and ('decoded-review' not in p.parts or p.name.startswith('encoded-contact-'))]
summary=json.loads((root/'recording-summary.json').read_text())
manifest={'version':1,'sourceDate':'2026-10-25','video':json.loads((root/'video-verification.json').read_text()),'recordings':json.loads((root/'recording-verification.json').read_text()),'sourceAudit':json.loads((root/'source-audit.json').read_text()),'claims':{'mode':'Exact manual editor plus deterministic rule-policy simulation','metaConnected':False,'modelCalls':0,'rawProductUiRecording':False,'presentation':'Recorded states, edited for time; cosmetic sprite/path interpolation only','rendererCosmeticStackSpacingMaxNativePixels':0,'newMediaGenerationCalls':0,'audio':'intentionally silent','cloudPublishing':False,'hackathonSubmission':False},'selectedSourceEvents':{'manualRule':summary['beats']['rule-applied']['event'],'food':summary['food'],'setup':summary['setup'],'arrivals':summary['arrivals']},'files':[{'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(files)]}
(root/'provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
archive=root/'godmode-cozy-demo-source.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p in files+[root/'provenance.json']:z.write(p,str(p.relative_to(root)))
print(json.dumps({'archive':archive.name,'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':len(files)+1},indent=2))
