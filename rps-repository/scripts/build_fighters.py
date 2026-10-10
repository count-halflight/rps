"""Build clothed fighters on the CC0 MakeHuman mesh, rig and morph targets.
Run: blender --background --python scripts/build_fighters.py
FIGHTER_ONLY=echo optionally rebuilds one model during art development.
Source notices: public/licenses/MakeHuman-CC0.md.
"""
import bpy,json,math,os
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]; SOURCE=ROOT/'assets/source/makehuman'
vertices=[]; faces=[]; face_uvs=[]; uvs=[]; group=''
for line in (SOURCE/'base.obj').read_text().splitlines():
    if line.startswith('v '): vertices.append(Vector(tuple(float(v) for v in line.split()[1:])))
    elif line.startswith('vt '): uvs.append(tuple(float(v) for v in line.split()[1:3]))
    elif line.startswith('g '): group=line[2:]
    elif line.startswith('f ') and group=='body':
        parts=[v.split('/') for v in line.split()[1:]]
        faces.append([int(v[0])-1 for v in parts]);face_uvs.append([uvs[int(v[1])-1] for v in parts])
RIG=json.loads((SOURCE/'default.mhskel').read_text())
WEIGHTS=json.loads((SOURCE/'default_weights.mhw').read_text())['weights']
PROFILES=[
 dict(id='echo',target='asian-female-young',skin=(.46,.255,.16),coat=(.018,.125,.115),trim=(.17,.57,.43),hair=(.018,.024,.032)),
 dict(id='ronin',target='asian-male-young',skin=(.53,.30,.19),coat=(.22,.018,.032),trim=(.56,.31,.12),hair=(.017,.015,.02)),
 dict(id='brawler',target='african-male-young',skin=(.205,.095,.046),coat=(.035,.042,.055),trim=(.8,.27,.04),hair=(.009,.008,.007)),
 dict(id='nyx',target='caucasian-female-young',skin=(.58,.35,.25),coat=(.16,.065,.24),trim=(.54,.37,.73),hair=(.029,.015,.05)),
 dict(id='vex',target='african-female-young',skin=(.28,.14,.078),coat=(.025,.12,.07),trim=(.55,.40,.11),hair=(.025,.014,.008))]
def morph(points,name,strength=1):
    for line in (SOURCE/'targets'/(name+'.target')).read_text().splitlines():
        if line and not line.startswith('#'):
            i,x,y,z=line.split();points[int(i)]+=Vector((float(x),float(y),float(z)))*strength
def convert(v): return Vector((v.x*.14,-v.z*.14,(v.y+8.45)*.14))
def material(name,color,rough=.6,metal=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal;return m
for kind,profile in enumerate(PROFILES):
    if os.environ.get('FIGHTER_ONLY') not in (None,profile['id']): continue
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    raw=[v.copy() for v in vertices];morph(raw,profile['target'])
    if kind==2:morph(raw,'universal-male-young-maxmuscle-averageweight',.75)
    coords=[convert(v) for v in raw];floor=min(coords[i].z for f in faces for i in f)
    height=max(coords[i].z for f in faces for i in f)-floor
    size=[2.10,2.20,2.25,2.05,2.12][kind]/height
    for v in coords:v.z-=floor;v*=size
    def joint(name):return sum((coords[i] for i in RIG['joints'][name]),Vector())/len(RIG['joints'][name])
    armature=bpy.data.armatures.new('HumanRig');arm=bpy.data.objects.new('HumanRig',armature);bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    for name,desc in RIG['bones'].items():
        b=armature.edit_bones.new(name);b.head,b.tail=joint(desc['head']),joint(desc['tail'])
        if (b.tail-b.head).length<.001:b.tail.z+=.02
    for name,desc in RIG['bones'].items():
        if desc['parent']:armature.edit_bones[name].parent=armature.edit_bones[desc['parent']]
    bpy.ops.object.mode_set(mode='OBJECT')
    def skin_mesh(obj,indices=None,bone=None):
        obj.parent=arm
        if bone:obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))),1,'REPLACE')
        else:
            mapping={old:new for new,old in enumerate(indices)}
            for name,entries in WEIGHTS.items():
                relevant=[(mapping[i],w) for i,w in entries if i in mapping]
                if relevant:
                    vg=obj.vertex_groups.new(name=name)
                    for i,w in relevant:vg.add([i],w,'REPLACE')
        mod=obj.modifiers.new('Skinning','ARMATURE');mod.object=arm
        for p in obj.data.polygons:p.use_smooth=True
        return obj
    def surface(name,predicate,mat,thickness=0,subdivision=0):
        chosen=[i for i,f in enumerate(faces) if predicate(sum((coords[v] for v in f),Vector())/len(f))]
        used=sorted(set(v for i in chosen for v in faces[i]));mapping={old:new for new,old in enumerate(used)}
        mesh=bpy.data.meshes.new(name);mesh.from_pydata([coords[i] for i in used],[],[[mapping[v] for v in faces[i]] for i in chosen]);mesh.update()
        layer=mesh.uv_layers.new(name='UVMap')
        for p,fi in zip(mesh.polygons,chosen):
            for loop,uv in zip(p.loop_indices,face_uvs[fi]):layer.data[loop].uv=uv
        if thickness:
            for v in mesh.vertices:v.co+=v.normal*thickness
        obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(mat);skin_mesh(obj,used)
        if subdivision:
            sub=obj.modifiers.new('Smooth tailoring','SUBSURF');sub.levels=sub.render_levels=subdivision
        return obj
    def attach(obj,bone,mat):
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);obj.data.materials.append(mat);return skin_mesh(obj,bone=bone)
    def ellipsoid(name,pos,scale,mat,bone='head'):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=pos);o=bpy.context.object;o.name=name;o.scale=scale;return attach(o,bone,mat)
    def box(name,pos,scale,mat,bone):
        bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name=name;o.scale=scale
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        bevel=o.modifiers.new('Rounded seams','BEVEL');bevel.width=min(scale)*.18;bevel.segments=3;bpy.ops.object.modifier_apply(modifier=bevel.name);return attach(o,bone,mat)
    def line(name,points,radius,mat,bone='head'):
        c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=3;s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
        for p,co in zip(s.bezier_points,points):p.co=co;p.handle_left_type=p.handle_right_type='AUTO'
        obj=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.ops.object.convert(target='MESH');return attach(obj,bone,mat)
    skin=material('Skin',profile['skin'],.57);skin.node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value=.09
    cloth=material('Tailored jacket',profile['coat'],.78);lining=material('Shirt',(.036,.042,.051),.9)
    trousers=material('Woven trousers',(.024,.03,.041),.88);leather=material('Leather',(.016,.020,.028),.46)
    hair=material('Hair',profile['hair'],.68);trim=material('Stitching',profile['trim'],.64,.15);steel=material('Brushed steel',(.30,.34,.36),.31,.8)
    eyes=material('Sclera',(.56,.53,.46),.24);iris=material('Iris',(.033,.048,.026),.21);pupil=material('Pupil',(.003,.004,.005),.2)
    neck=joint(RIG['bones']['neck03']['head']);hips=joint(RIG['bones']['spine04']['head'])
    wrists=[joint(RIG['bones']['wrist.'+s]['head']) for s in ['L','R']];waist=hips.z+.08
    sleeve_end=.57 if kind in (0,1,3) else .34
    body=surface('Anatomy',lambda c:c.z<=neck.z-.02,skin)
    # One continuous garment surface avoids intersecting duplicate skin shells.
    for v in body.data.vertices:
        if waist-.03<v.co.z<neck.z-.075 and abs(v.co.x)<sleeve_end:
            v.co+=v.normal*.032
        elif v.co.z<waist-.03:v.co+=v.normal*.012
    body.data.update()
    for mat in [cloth,trousers,leather]:body.data.materials.append(mat)
    for p in body.data.polygons:
        c=p.center
        if c.z<waist+.025:p.material_index=2
        elif abs(c.x)>=abs(wrists[0].x)-.025:p.material_index=3
        elif c.z<neck.z-.055 and abs(c.x)<sleeve_end:p.material_index=1
    face=surface('Face',lambda c:c.z>neck.z-.02,skin,subdivision=1)
    face.data.materials.append(hair)
    for side in ['L','R']:
        sign=1 if side=='L' else -1;foot=joint(RIG['bones']['foot.'+side]['head']);wrist=wrists[0 if side=='L' else 1]
        ellipsoid('Boot upper',(foot.x,-.09,.075),(.087,.17,.075),leather,'foot.'+side)
        box('Boot sole',(foot.x,-.09,.026),(.19,.34,.04),lining,'foot.'+side)
        ellipsoid('Boot cuff',(foot.x,foot.y,.17),(.083,.077,.14),leather,'foot.'+side)
        for i in range(4):line('Boot lace',[(foot.x-.05,-.08-i*.025,.128-i*.006),(foot.x+.05,-.095-i*.025,.13-i*.006)],.0025,trim,'foot.'+side)
        box('Wrist cuff',(wrist.x,wrist.y,wrist.z+.014),(.095,.085,.055),leather,'wrist.'+side)
    for side in ['L','R']:
        eye=joint(RIG['bones']['eye.'+side]['head']);eye.y+=.004
        ellipsoid('Eyeball',eye,(.024,.021,.021),eyes)
        ellipsoid('Iris',eye+Vector((0,-.020,0)),(.010,.003,.010),iris)
        ellipsoid('Pupil',eye+Vector((0,-.023,0)),(.004,.0015,.005),pupil)
        brow=eye+Vector((0,-.017,.028));line('Eyebrow',[brow+Vector((-.028,0,-.002)),brow+Vector((0,-.006,.004)),brow+Vector((.024,0,-.005))],.0035,hair)
    top=max(coords[i].z for f in faces for i in f)
    for p in face.data.polygons:
        c=p.center
        if c.z>top-.13 or (c.z>top-.23 and c.y>-.012):p.material_index=1
    if kind==0:
        ellipsoid('Asymmetric bob',(.06,.085,top-.22),(.105,.047,.13),hair)
        line('Side fringe',[(-.085,-.035,top-.035),(-.115,-.075,top-.12),(-.11,-.02,top-.21)],.013,hair)
    elif kind==1:
        ellipsoid('Top knot',(0,.095,top+.008),(.068,.055,.065),hair)
        line('Hair tie',[(-.047,.11,top-.032),(0,.14,top-.036),(.047,.11,top-.032)],.009,trim)
    elif kind==2:
        for p in face.data.polygons:
            if top-.18<p.center.z<top-.06 and p.center.y>-.012:p.material_index=1
    elif kind==3:
        for sign in [-1,1]:ellipsoid('Long hair',(sign*.115,.025,top-.28),(.057,.096,.25),hair)
        ellipsoid('Back hair',(0,.09,top-.30),(.13,.06,.27),hair)
        line('Circlet',[(-.11,-.072,top-.14),(0,-.12,top-.12),(.11,-.072,top-.14)],.004,trim)
    else:
        for i in range(6):ellipsoid('Braid',(.008+math.sin(i*.8)*.012,.115,top-.17-i*.055),(.035-i*.002,.035-i*.002,.045),hair)
        line('Tie',[(-.04,.1,top-.11),(0,.14,top-.12),(.04,.1,top-.11)],.007,trim)
    for sign in [-1,1]:
        box('Tailored shoulder',(sign*.19,.005,neck.z-.07),(.12,.14,.065),cloth,'upperarm01.'+('L' if sign==1 else 'R'))
        line('Lapel',[(sign*.072,-.09,neck.z-.075),(sign*.13,-.15,neck.z-.20),(sign*.075,-.16,neck.z-.34)],.013,trim,'spine01')
        line('Side seam',[(sign*.19,-.115,neck.z-.26),(sign*.15,-.12,waist+.06)],.003,trim,'spine02')
    line('Fastener',[(0,-.16,neck.z-.30),(0,-.145,waist+.03)],.004,steel,'spine02')
    belt=joint(RIG['bones']['spine04']['head']);box('Belt buckle',(0,-.147,belt.z+.015),(.062,.025,.043),steel,'spine04')
    if kind==2:
        for sign in [-1,1]:
            line('Chest harness',[(sign*.15,-.09,neck.z-.08),(sign*.12,-.18,neck.z-.38),(sign*.18,-.14,waist)],.028,leather,'spine02')
            side='L' if sign==1 else 'R';shoulder=joint(RIG['bones']['upperarm01.'+side]['head'])
            ellipsoid('Shoulder pad',shoulder+Vector((sign*.015,0,.015)),(.10,.10,.07),leather,'upperarm01.'+side)
    if kind in (1,3):
        for side in ['L','R']:
            sign=1 if side=='L' else -1
            line('Coat edge',[(sign*.17,.085,waist),(sign*.24,.08,waist-.22),(sign*.21,.055,waist-.40)],.023,cloth,'upperleg01.'+side)
    if kind==4:
        line('Quiver strap',[(-.14,-.12,neck.z-.11),(.04,-.185,neck.z-.36),(.17,-.14,waist)],.022,leather,'spine02')
        ellipsoid('Quiver',(.13,.12,neck.z-.22),(.064,.066,.25),leather,'spine02')
        for i in range(4):line('Stored arrow',[(.1+i*.015,.12,neck.z-.33),(.1+i*.015,.12,neck.z+.055)],.003,steel,'spine02')
    # Apply subdivision before joining so a single skeleton and material groups
    # serve the whole model, rather than dozens of tiny skinned draw calls.
    for obj in list(bpy.context.scene.objects):
        if obj.type=='MESH':
            bpy.context.view_layer.objects.active=obj
            for modifier in list(obj.modifiers):
                if modifier.type=='SUBSURF':bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH':obj.select_set(True)
    bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
    bpy.ops.object.select_all(action='SELECT')
    destination=ROOT/'public/models'/(profile['id']+'-human.glb')
    bpy.ops.export_scene.gltf(filepath=str(destination),export_format='GLB',export_yup=True,export_animations=False,export_skins=True,export_apply=True,export_extras=True)
    print('EXPORTED',destination)
