from pathlib import Path
import subprocess, math, wave, json
import fitz
import imageio_ffmpeg

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'videos'; WORK=OUT/'.render'; WORK.mkdir(parents=True,exist_ok=True)
FF=imageio_ffmpeg.get_ffmpeg_exe(); FPS=24; FADE=.55
SCENES=[
('Meet ServeOS', 'Meet Serve O S. One platform for your restaurant website, orders, team workflows, and customer support.'),
('One connected workflow', 'Bring scattered restaurant work into one connected experience. Help guests discover your restaurant, keep service moving, and stay in control.'),
('Your digital restaurant', 'Showcase your restaurant with a branded website and a menu with photos. Let guests browse dishes and order through table Q R links.'),
('The right tools for your team', 'Give owners, admins, kitchen staff, and waiters their own workspaces. Manage menus, staff, tickets, and orders, with business tools available by package.'),
('ServeOS AI and human support', 'Serve O S A I answers platform questions in the customer’s language, using approved guides. Your support team can review replies and take over when needed.'),
('Flexible packages', 'Start with a seven day free trial. Paid packages begin at three hundred forty nine taka for one month, with three month, six month, and yearly options.'),
('Start your seven-day trial', 'Create your restaurant, add your menu and staff, then share your website and table Q R links. Serve O S. One platform for the team behind every meal.'),
]

def run(args):
    subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)

def stamp(t):
    ms=round(t*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}'

pdf=fitz.open(ROOT/'presentations/ServeOS-Product-Brief.pdf')
clips=[]; durations=[]; captions=[]; timeline=0
for n,((title,narration),page) in enumerate(zip(SCENES,pdf),1):
    frame=WORK/f'scene-{n}.png'
    page.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False).save(frame)
    audio=WORK/f'voice-{n}.aiff'
    run(['say','-v','Samantha','-r','170','-o',str(audio),narration])
    wav=WORK/f'voice-{n}.wav'
    run([FF,'-y','-loglevel','error','-i',str(audio),'-c:a','pcm_s16le',str(wav)])
    audio=wav
    with wave.open(str(audio),'rb') as f:voice_duration=f.getnframes()/f.getframerate()
    duration=math.ceil((voice_duration+1.1)*FPS)/FPS
    frames=round(duration*FPS);durations.append(duration)
    clip=WORK/f'clip-{n}.mp4'
    # A gentle push-in gives motion while preserving safe margins and readable text.
    zoom=f"scale=1920:1080,zoompan=z='1+0.000018*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d={frames}:s=1920x1080:fps={FPS},setsar=1"
    run([FF,'-y','-loglevel','error','-i',str(frame),'-i',str(audio),'-filter_complex',f'[0:v]{zoom}[v];[1:a]adelay=300|300,apad,atrim=duration={duration}[a]','-map','[v]','-map','[a]','-frames:v',str(frames),'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k',str(clip)])
    clips.append(clip)
    # Split captions into sentence-length chunks rather than a full paragraph.
    sentences=[s.strip()+'.' for s in narration.split('.') if s.strip()]
    weights=[len(s) for s in sentences]; total=sum(weights);cursor=timeline+.3
    for text,weight in zip(sentences,weights):
        end=cursor+voice_duration*weight/total
        clean=text.replace('Serve O S A I','ServeOS AI').replace('Serve O S','ServeOS').replace('Q R','QR')
        captions.append((cursor,end,clean));cursor=end
    timeline+=duration-(FADE if n<7 else 0)
    print(f'Scene {n}/7 rendered: {title} ({duration:.1f}s)',flush=True)

args=[FF,'-y','-loglevel','error']
for clip in clips:args+=['-i',str(clip)]
filters=[]; v='0:v';a='0:a';offset=durations[0]
for n in range(1,len(clips)):
    offset-=FADE
    filters.append(f'[{v}][{n}:v]xfade=transition=fade:duration={FADE}:offset={offset:.5f}[v{n}]')
    filters.append(f'[{a}][{n}:a]acrossfade=d={FADE}:c1=tri:c2=tri[a{n}]')
    v=f'v{n}';a=f'a{n}';offset+=durations[n]
output=OUT/'ServeOS-Explainer-Promo.mp4'
args+=['-filter_complex_threads','1','-filter_complex',';'.join(filters),'-map',f'[{v}]','-map',f'[{a}]','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',str(output)]
run(args)
srt='\n\n'.join(f'{i}\n{stamp(start)} --> {stamp(end)}\n{text}' for i,(start,end,text) in enumerate(captions,1))+'\n'
(OUT/'ServeOS-Explainer-Promo.srt').write_text(srt)
# Embed optional subtitles in the MP4; a separate SRT is also supplied.
with_subs=WORK/'final.mp4'
run([FF,'-y','-loglevel','error','-i',str(output),'-i',str(OUT/'ServeOS-Explainer-Promo.srt'),'-map','0:v','-map','0:a','-map','1:0','-c:v','copy','-c:a','copy','-c:s','mov_text','-metadata:s:s:0','language=eng','-movflags','+faststart',str(with_subs)])
with_subs.replace(output)
run([FF,'-y','-loglevel','error','-ss','1.2','-i',str(output),'-frames:v','1',str(OUT/'ServeOS-Promo-Poster.jpg')])
(OUT/'ServeOS-Voiceover.txt').write_text('\n\n'.join(title+'\n'+narration.replace('Serve O S A I','ServeOS AI').replace('Serve O S','ServeOS').replace('Q R','QR') for title,narration in SCENES))
print(f'Done: {output.name}, {timeline:.1f}s, 1920x1080, {FPS}fps',flush=True)
