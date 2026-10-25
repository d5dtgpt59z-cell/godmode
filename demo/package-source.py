from pathlib import Path
import hashlib
import json
from zipfile import ZipFile,ZIP_DEFLATED

root=Path(__file__).resolve().parent
excluded={'.hyperframes','snapshots-first','snapshots-review','snapshots-motion'}
files=[p for p in root.rglob('*') if p.is_file() and not any(part in excluded for part in p.relative_to(root).parts) and p.suffix not in ['.mp4','.zip','.log'] and p.name!='provenance.json']
manifest={'video':json.loads((root/'video-verification.json').read_text()),'sourceDate':'2026-10-25','engineEvidence':json.loads((root/'recording-summary.json').read_text()),'files':[{'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(files)]}
(root/'provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
archive=root/'godmode-demo-source.zip'
with ZipFile(archive,'w',ZIP_DEFLATED) as z:
    for p in files+[root/'provenance.json']:z.write(p,str(p.relative_to(root)))
print(json.dumps({'sourceArchive':archive.name,'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'recordedFiles':len(files)}))
