from pathlib import Path
import hashlib
import json
import subprocess

root=Path(__file__).resolve().parent
video=root/'godmode-prototype-56s.mp4'
assert video.exists() and video.stat().st_size>0
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(video)]))
stream=next(s for s in probe['streams'] if s['codec_type']=='video')
assert (stream['width'],stream['height'])==(1920,1080)
assert stream['r_frame_rate']=='30/1'
assert abs(float(probe['format']['duration'])-56)<0.04
assert int(stream['nb_frames'])==1680
assert not any(s['codec_type']=='audio' for s in probe['streams'])
review=root/'decoded-review';review.mkdir(exist_ok=True)
for index,time in enumerate([0,10,20.5,28,36,43,49,54.5]):
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(time),'-i',str(video),'-frames:v','1',str(review/f'{index:02d}-at-{time}s.png')],check=True)
select='+'.join(f'eq(n,{n})' for n in [0,300,615,840,1080,1290,1470,1635])
subprocess.run(['ffmpeg','-v','error','-y','-i',str(video),'-vf',f"select='{select}',scale=960:540:flags=neighbor,tile=2x4",'-frames:v','1',str(review/'encoded-contact.png')],check=True)
record={'file':video.name,'bytes':video.stat().st_size,'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'codec':stream['codec_name'],'width':stream['width'],'height':stream['height'],'fps':stream['r_frame_rate'],'frames':int(stream['nb_frames']),'duration':float(probe['format']['duration']),'audio':'none; intentionally silent','decodedFrames':[0,10,20.5,28,36,43,49,54.5]}
(root/'ffprobe.json').write_text(json.dumps(probe,indent=2)+'\n');(root/'video-verification.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
