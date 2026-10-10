"""Assemble fixed-beat screenshots captured through the real game's controls."""
import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
rows=json.loads(Path('artifacts/choreography/captures.json').read_text())
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
for fighter in sorted(set(r['character'] for r in rows)):
    attacks=[r for r in rows if r['character']==fighter]
    sheet=Image.new('RGB',(1280,len(attacks)*240+45),'#10161c');draw=ImageDraw.Draw(sheet)
    draw.text((12,12),f'{fighter} | real-game captures: anticipation, travel, impact, recovery',fill='#c5e5df',font=font)
    for row,attack in enumerate(attacks):
        y=45+row*240;draw.text((8,y),attack['id']+' | '+attack['title'],fill='white',font=font)
        for col,frame in enumerate(attack['frames']):
            img=Image.open(frame['path']).convert('RGB').resize((320,213),Image.Resampling.LANCZOS)
            sheet.paste(img,(col*320,y+22))
    sheet.save('public/proof/'+fighter+'.png',optimize=True)
    sheet.save('public/proof/'+fighter+'.webp',quality=83,method=6)
Path('public/proof/index.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Trinity choreography proof</title><style>body{background:#10161c;color:#dbebe7;font:16px sans-serif;margin:24px}img{width:100%;height:auto;max-width:1280px}a{color:#a7e5d2}section{margin:40px 0}</style><h1>Trinity: afterlight</h1><p>75 attacks captured through the game controls, four fixed beats per sequence. The numeric report compares sampled wrist, root, weapon and camera paths. It verifies variety, not artistic quality.</p><p><a href="#desktop">Desktop screenshots</a> · <a href="#finishers">Finisher worlds</a> · <a href="#encounters">Bosses and elites</a></p><p><a href="distances.csv">All 2,775 pair distances (CSV)</a> · <a href="distances.json">Full report (JSON)</a> · <a href="captures.json">Fixed-beat capture manifest</a></p>'''+''.join(f'<section><h2>{f}</h2><a href="{f}.png">Download original PNG</a><p><a href="{f}.png"><img loading="lazy" width="1280" height="3645" src="{f}.webp" alt="{f} attack contact sheet"></a></p></section>' for f in sorted(set(r['character'] for r in rows))))
encounters=[]
for name in ['morrow','varda','irid','vesra','senn','orven']+[f'elite-{i}' for i in range(6)]:
    source=Path('artifacts/encounters')/(f'{name}.png' if name.startswith('elite') else f'boss-{name}.png')
    if not source.exists():
        continue
    target=Path('public/proof/encounters')/(name+'.webp')
    target.parent.mkdir(exist_ok=True)
    Image.open(source).convert('RGB').save(target,quality=85,method=4)
    encounters.append(f'<p>{name}</p><img loading="lazy" width="960" height="640" src="encounters/{name}.webp" alt="{name} in the game arena">')
if encounters:
    with Path('public/proof/index.html').open('a') as gallery:
        gallery.write('<section id="encounters"><h2>Boss intros and minibosses</h2><p>These are screenshots of the current game in lightweight graphics, rather than concept art.</p>'+''.join(encounters)+'</section>')

showcases=[]
for attack in rows:
    frame=attack.get('showcase')
    if not frame:
        continue
    target=Path('public/proof/cinematics')/(attack['id']+'.webp')
    target.parent.mkdir(exist_ok=True)
    Image.open(frame['path']).convert('RGB').save(target,quality=88,method=6)
    showcases.append(f'<article><h3>{attack["title"]}</h3><img loading="lazy" width="960" height="640" src="cinematics/{attack["id"]}.webp" alt="{attack["title"]} midway cinematic screenshot"></article>')
if showcases:
    with Path('public/proof/index.html').open('a') as gallery:
        gallery.write('<section id="finishers"><h2>Thirty finisher worlds</h2><p>Actual game frames from the middle of each finisher, before the final impact.</p>'+''.join(showcases)+'</section>')

desktop_report=Path('artifacts/art-upgrade/report.json')
if desktop_report.exists():
    desktop=json.loads(desktop_report.read_text())
    images=[]
    for source in [Path('artifacts/art-upgrade/title.png')]+[Path(p) for p in desktop['shots']]:
        if not source.exists():
            continue
        target=Path('public/proof/desktop')/(source.stem+'.webp')
        target.parent.mkdir(exist_ok=True)
        Image.open(source).convert('RGB').save(target,quality=88,method=6)
        label=source.stem.replace('-',' ')
        images.append(f'<article><h3>{label}</h3><img loading="lazy" width="1280" height="800" src="desktop/{source.stem}.webp" alt="{label} in the production game"></article>')
    with Path('public/proof/index.html').open('a') as gallery:
        gallery.write(f'<section id="desktop"><h2>Desktop game captures</h2><p>Production screenshots at 1280 × 800 in {desktop.get("quality","low")} graphics. The live geometry appears in front of the district artwork.</p>'+''.join(images)+'</section>')
