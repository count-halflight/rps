"""Build original clothed duelists on the CC0 MakeHuman anatomical mesh and rig.
Run: blender --background --python scripts/build_fighters.py
Source attribution and license: public/licenses/MakeHuman-CC0.md.
"""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT/'assets/source/makehuman'
verts=[];faces=[];group=''
for line in (SOURCE/'base.obj').read_text().splitlines():
    if line.startswith('v '):verts.append(tuple(float(x) for x in line.split()[1:]))
    elif line.startswith('g '):group=line[2:]
    elif line.startswith('f ') and group=='body':faces.append([int(x.split('/')[0])-1 for x in line.split()[1:]])
rig=json.loads((SOURCE/'default.mhskel').read_text());weights=json.loads((SOURCE/'default_weights.mhw').read_text())['weights']
def convert(v):return Vector((v[0]*.14,-v[2]*.14,(v[1]+8.45)*.14))
def joint(name):return sum((convert(verts[i]) for i in rig['joints'][name]),Vector())/len(rig['joints'][name])
def material(name,color,rough=.65,metal=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal;return m
for kind in range(5):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    coords=[convert(v) for v in verts]
    # Individual silhouette: lighter runner, taller ronin, broad brawler.
    if kind==2:
        for p in coords:p.x*=1.13;p.y*=1.12
    for i,p in enumerate(coords):
        x,y,z=verts[i]
        if y<5.65 and abs(x)<3.15:
            if y>.25:p.x*=1.065;p.y*=1.12
            elif y>-5.6:p.x*=1.035;p.y*=1.08
            else:p.y*=1.10
        if kind==1 and 2.0<y<5.5:p.x*=1.08
    mesh=bpy.data.meshes.new('Anatomy');mesh.from_pydata(coords,[],faces);mesh.update();body=bpy.data.objects.new('Fighter',mesh);bpy.context.collection.objects.link(body)
    skin=material('Skin',[(.61,.37,.24),(.67,.45,.33),(.28,.135,.08),(.54,.32,.25),(.39,.24,.17)][kind],.72)
    jacket=material('Jacket',[(.022,.037,.04),(.19,.027,.039),(.08,.07,.045),(.065,.025,.16),(.035,.11,.095)][kind],.52)
    trousers=material('Trousers',(.023,.025,.03),.9);boot=material('Boots',(.013,.017,.023),.4);lip=material('Lips',(.24,.082,.063),.66)
    for m in [skin,jacket,trousers,boot,lip]:body.data.materials.append(m)
    for p in mesh.polygons:
        c=sum((Vector(verts[i]) for i in p.vertices),Vector())/len(p.vertices);x,y,z=c
        p.material_index=0 if y>5.65 or abs(x)>3.15 else 3 if y<-5.6 else 2 if y<.25 else 1
        if 6.96<y<7.14 and abs(x)<.25 and z>1.1:p.material_index=4
        p.use_smooth=True
    armature=bpy.data.armatures.new('HumanRig');arm=bpy.data.objects.new('HumanRig',armature);bpy.context.collection.objects.link(arm);bpy.context.view_layer.objects.active=arm;arm.select_set(True);body.select_set(False);bpy.ops.object.mode_set(mode='EDIT')
    for name,desc in rig['bones'].items():
        b=armature.edit_bones.new(name);b.head=joint(desc['head']);b.tail=joint(desc['tail']);
        if kind==2:b.head.x*=1.13;b.head.y*=1.12;b.tail.x*=1.13;b.tail.y*=1.12
        if (b.tail-b.head).length<.001:b.tail.z+=.02
    for name,desc in rig['bones'].items():
        if desc['parent']:armature.edit_bones[name].parent=armature.edit_bones[desc['parent']]
    bpy.ops.object.mode_set(mode='OBJECT');body.parent=arm;mod=body.modifiers.new('Skinning','ARMATURE');mod.object=arm
    for name,entries in weights.items():
        vg=body.vertex_groups.new(name=name)
        for index,value in entries:
            if index<len(coords):vg.add([index],value,'REPLACE')
    # All new hair, jacket trim, eyes and accessories use this same skinning rig.
    def attach(obj,bone,mat):
        obj.data.materials.append(mat);obj.parent=arm;vg=obj.vertex_groups.new(name=bone);vg.add(list(range(len(obj.data.vertices))),1,'REPLACE');m=obj.modifiers.new('Skinning','ARMATURE');m.object=arm
        for p in obj.data.polygons:p.use_smooth=True
    def ellipsoid(name,pos,scale,mat,bone='head'):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=pos);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);bpy.ops.object.transform_apply(location=True,rotation=False,scale=False);attach(o,bone,mat);return o
    def line(name,points,radius,mat,bone='head'):
        c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=2;s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
        for p,co in zip(s.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
        o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');attach(o,bone,mat);return o
    white=material('Eyes',(.68,.64,.54),.4);iris=material('Iris',(.023,.029,.026),.26);hair=material('Hair',(.024,.02,.018) if kind!=1 else (.43,.45,.42),.72);trim=material('Trim',(.38,.36,.29),.6);steel=material('Steel',(.35,.4,.41),.28,.8)
    # Base mesh facial features retain their natural proportions. Eyes sit behind lids.
    for side in ['L','R']:
        eye=joint(rig['bones']['eye.'+side]['head']);eye.y-=.008
        ellipsoid('Eyeball',eye,(.036,.022,.023),white)
        ellipsoid('Iris',eye+Vector((0,-.019,0)),(.014,.008,.014),iris)
        eyebrow=eye+Vector((0,-.018,.04));line('Eyebrow',[eyebrow+Vector((-.037,0,0)),eyebrow,eyebrow+Vector((.034,0,-.005))],.005,hair)
    top=max(p.z for p in coords);center=Vector((0,.025,top-.12))
    ellipsoid('Hair crown',center,(.147,.126,.12),hair)
    if kind==0:
        for i in range(10):
            x=-.12+i*.023;line('Swept lock',[(x,.09,top-.06),(x-.035,-.045,top+.015),(x-.09,-.105,top-.13)],.014,hair)
        ellipsoid('Back hair',(0,.085,top-.26),(.145,.065,.22),hair)
    elif kind==1:
        for i in range(14):
            a=i*2.399;x=math.cos(a)*.12;y=math.sin(a)*.07;line('Ronin lock',[(x,y,top-.08),(x*.85,y-.035,top+.09),(x-.065,y-.1,top-.09)],.012,hair)
    elif kind==2:
        for i in range(6):line('Cropped hair',[(-.1+i*.04,.065,top-.08),(-.1+i*.04,-.055,top-.008)],.018,hair)
        jaw=joint(rig['bones']['jaw']['head']);ellipsoid('Beard',jaw+Vector((0,-.055,-.045)),(.086,.06,.075),hair)
    elif kind==3:
        for i in range(12):
            a=i*math.pi/6;line('Long hair',[(math.cos(a)*.13,math.sin(a)*.1,top-.07),(math.cos(a)*.16,math.sin(a)*.12,top-.25),(math.cos(a)*.14,math.sin(a)*.1,top-.49)],.018,hair)
        ellipsoid('Staff crest',(0,-.055,top+.015),(.06,.025,.035),steel)
    else:
        for i in range(8):
            x=-.11+i*.03;line('Swept hair',[(x,-.08,top-.11),(x,.015,top),(x*.5,.14,top-.05)],.014,hair)
        line('Ponytail',[(0,.13,top-.07),(.02,.18,top-.31),(.07,.14,top-.52)],.055,hair)
    # Jacket seam geometry follows anatomical shoulders and chest.
    neck=joint(rig['bones']['neck03']['head']);hip=joint(rig['bones']['spine04']['head']);
    for s in [-1,1]:
        line('Jacket lapel',[(s*.075,-.105,neck.z-.065),(s*.115,-.175,neck.z-.24),(s*.07,-.145,neck.z-.34)],.018,trim,'spine01')
        line('Jacket seam',[(s*.205,-.12,neck.z-.24),(s*.155,-.16,hip.z+.22)],.007,steel,'spine02')
    line('Jacket zip',[(0,-.152,neck.z-.29),(0,-.139,hip.z+.1)],.005,steel,'spine02')
    if kind in [1,3,4]:
        c=[(-.19,.04,hip.z+.05),(.19,.04,hip.z+.05),(-.26,.07,.48),(.26,.07,.48)]
        tail=bpy.data.meshes.new('Coat tails');tail.from_pydata(c,[],[(0,1,3,2)]);o=bpy.data.objects.new('Coat tails',tail);bpy.context.collection.objects.link(o);attach(o,'spine04',jacket);solid=o.modifiers.new('Cloth thickness','SOLIDIFY');solid.thickness=.01;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=solid.name)
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects:
        if o.type=='MESH':o.select_set(True)
    bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
    bpy.ops.object.select_all(action='SELECT')
    destination=ROOT/'public/models'/['echo-human.glb','ronin-human.glb','brawler-human.glb','nyx-human.glb','vex-human.glb'][kind]
    bpy.ops.export_scene.gltf(filepath=str(destination),export_format='GLB',export_yup=True,export_animations=False,export_skins=True,export_apply=False,export_extras=True)
    print('EXPORTED',destination)
