from pathlib import Path
import hashlib, json, subprocess

root=Path(__file__).resolve().parent
video=root/'godmode-cozy-prototype-72s.mp4'
assert video.exists() and video.stat().st_size>0
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(video)]))
stream=next(s for s in probe['streams'] if s['codec_type']=='video')
assert stream['codec_name']=='h264'
assert (stream['width'],stream['height'])==(1920,1080)
assert stream['r_frame_rate']=='30/1'
assert abs(float(probe['format']['duration'])-72)<0.04
assert int(stream['nb_frames'])==2160
assert not any(s['codec_type']=='audio' for s in probe['streams'])
subprocess.run(['ffmpeg','-v','error','-i',str(video),'-f','null','-'],check=True)
review=root/'decoded-review';review.mkdir(exist_ok=True)
times=[0,6.5,12,17,20.5,23,28,33,39,46,51,56.5,60,65.5,69.5,71.9]
for i,t in enumerate(times):
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(t),'-i',str(video),'-frames:v','1',str(review/f'{i:02d}-at-{t}s.png')],check=True)
for page in range(2):
    select='+'.join(f'eq(n,{round(t*30)})' for t in times[page*8:(page+1)*8])
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(video),'-vf',f"select='{select}',scale=960:540:flags=neighbor,tile=2x4",'-frames:v','1',str(review/f'encoded-contact-{page+1}.png')],check=True)
report={'file':video.name,'bytes':video.stat().st_size,'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'codec':stream['codec_name'],'width':stream['width'],'height':stream['height'],'pixelFormat':stream['pix_fmt'],'fps':stream['r_frame_rate'],'frames':int(stream['nb_frames']),'duration':float(probe['format']['duration']),'audio':'none; intentionally silent','fullDecodePassed':True,'decodedReviewTimes':times,'visualReview':'Pending inspection of decoded review files; updated after inspection.'}
(root/'ffprobe.json').write_text(json.dumps(probe,indent=2)+'\n');(root/'video-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
