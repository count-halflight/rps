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
TORSO_WEIGHT=[0.0]*len(vertices);ARM_WEIGHT=[0.0]*len(vertices)
for name,entries in WEIGHTS.items():
    field=TORSO_WEIGHT if name.startswith(('spine','breast','pelvis','clavicle','shoulder')) else ARM_WEIGHT if name.startswith(('upperarm','lowerarm','wrist','finger')) else None
    if field is not None:
        for index,weight in entries:field[index]+=weight
PROFILES=[
 dict(id='echo',target='asian-female-young',skin=(.46,.255,.16),coat=(.008,.105,.105),trim=(.24,.76,.57),hair=(.016,.022,.032)),
 dict(id='ronin',target='asian-male-young',skin=(.53,.30,.19),coat=(.32,.016,.025),trim=(.64,.38,.14),hair=(.012,.011,.018)),
 dict(id='brawler',target='african-male-young',skin=(.205,.095,.046),coat=(.036,.031,.030),trim=(.84,.23,.033),hair=(.009,.008,.007)),
 dict(id='nyx',target='caucasian-female-young',skin=(.58,.35,.25),coat=(.105,.026,.19),trim=(.57,.41,.86),hair=(.55,.54,.64)),
 dict(id='vex',target='african-female-young',skin=(.28,.14,.078),coat=(.013,.075,.056),trim=(.62,.40,.12),hair=(.025,.014,.008))]
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
    def surface(name,predicate,mat,thickness=0,subdivision=0,exclude=None):
        chosen=[i for i,f in enumerate(faces) if (exclude is None or i not in exclude) and predicate(sum((coords[v] for v in f),Vector())/len(f))]
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
    def tailored_mesh(name,verts,polys,mat,bone=None):
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],polys);mesh.update()
        obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(mat)
        if bone:return skin_mesh(obj,bone=bone)
        obj.parent=arm
        chain=sorted([(joint(RIG['bones'][n]['head']).z,n) for n in ['spine04','spine03','spine02','spine01','neck03']])
        groups={n:obj.vertex_groups.new(name=n) for _,n in chain}
        for v in mesh.vertices:
            h=v.co.z
            a=next((i for i in range(len(chain)-1) if chain[i][0]<=h<=chain[i+1][0]),0 if h<chain[0][0] else len(chain)-2)
            lo,hi=chain[a:a+2];t=max(0,min(1,(h-lo[0])/max(.001,hi[0]-lo[0])))
            groups[lo[1]].add([v.index],1-t,'REPLACE');groups[hi[1]].add([v.index],t,'REPLACE')
        mod=obj.modifiers.new('Tailoring follows the spine','ARMATURE');mod.object=arm
        for p in mesh.polygons:p.use_smooth=True
        uv=mesh.uv_layers.new(name='UVMap')
        for p in mesh.polygons:
            for li in p.loop_indices:
                co=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(math.atan2(co.x,-co.y)/math.tau,co.z*.6)
        return obj
    def jacket(name,rings,opening,mat):
        verts=[];polys=[];segments=44
        for ri,(z,width,front,back) in enumerate(rings):
            for i in range(segments+1):
                angle=opening+(math.tau-opening*2)*i/segments
                wave=.0035*math.sin(angle*13+ri*.75)+.002*math.sin(angle*23)
                verts.append((math.sin(angle)*(width+wave),-math.cos(angle)*((front if math.cos(angle)>0 else back)+wave),z))
        for r in range(len(rings)-1):
            for i in range(segments):
                a=r*(segments+1)+i;b=a+segments+1;polys.append((a,b,b+1,a+1))
        obj=tailored_mesh(name,verts,polys,mat)
        # Real garment edges have thickness; a narrow hem catches a key light.
        solid=obj.modifiers.new('Fabric thickness','SOLIDIFY');solid.thickness=.005
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=solid.name)
        return obj
    def ribbon(name,points,widths,mat,bone='head',depth=.004):
        verts=[];polys=[]
        for i,(point,w) in enumerate(zip(points,widths)):
            p=Vector(point);t=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
            direction=t.cross(Vector((0,-1,0))).normalized()
            if direction.length<.01:direction=Vector((1,0,0))
            for side in [-1,1]:verts.append(tuple(p+direction*w*side))
        for i in range(len(points)-1):polys.append((i*2,i*2+1,i*2+3,i*2+2))
        o=tailored_mesh(name,verts,polys,mat,bone);solid=o.modifiers.new('Strand thickness','SOLIDIFY');solid.thickness=depth
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=solid.name)
        return o
    skin=material('Skin',profile['skin'],.59);skin.node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value=.075
    cloth=material('Tailored jacket',profile['coat'],.87);lining=material('Shirt',[(.49,.53,.49),(.055,.044,.047),(.012,.014,.021),(.25,.23,.29),(.21,.24,.15)][kind],.94)
    trousers=material('Woven trousers',[(.013,.020,.028),(.022,.016,.025),(.007,.013,.026),(.026,.015,.043),(.021,.027,.014)][kind],.92);leather=material('Leather',(.009,.012,.018),.58)
    rubber=material('Boot sole',(.006,.008,.012),.93)
    hair=material('Hair',profile['hair'],.77);trim=material('Stitching',profile['trim'],.72,.08);steel=material('Brushed steel',(.20,.24,.26),.38,.75)
    hair_light=material('Hair strands',tuple(min(1,c*1.3+.022) for c in profile['hair']),.82)
    eyes=material('Sclera',(.72,.72,.68),.30);iris=material('Iris',[(.021,.15,.13),(.14,.075,.021),(.095,.039,.016),(.22,.12,.32),(.18,.16,.025)][kind],.29);pupil=material('Pupil',(.001,.002,.003),.24)
    eye_glint=material('Eye catchlight',(.93,.96,1),.10)
    neck=joint(RIG['bones']['neck03']['head']);hips=joint(RIG['bones']['spine04']['head'])
    wrists=[joint(RIG['bones']['wrist.'+s]['head']) for s in ['L','R']];waist=hips.z+.08
    sleeve_end=.62 if kind in (0,1,3) else .34
    def visible_anatomy(c):
        if c.z>neck.z-.02:return False
        # Covered shirt/body polygons must be removed, not rendered beneath a
        # differently weighted coat. The overlap produced torn-looking patches
        # when a shoulder or chest moved under the jacket during combat.
        covered=waist+.065<c.z<neck.z-.115 and abs(c.x)<.215
        return not covered
    # The muscular fighters extend beyond a rectangular torso cutoff. Use
    # their source skin weights to remove the actual covered torso, including
    # the pectorals and abdominal strip. Upper-arm-dominant and neck faces stay.
    covered_torso=set()
    for index,f in enumerate(faces):
        c=sum((coords[v] for v in f),Vector())/len(f)
        torso=sum(TORSO_WEIGHT[v] for v in f)/len(f)
        arm_weight=sum(ARM_WEIGHT[v] for v in f)/len(f)
        if waist+.020<c.z<neck.z-.065 and torso>.10 and torso>=arm_weight:
            covered_torso.add(index)
    body=surface('Anatomy',visible_anatomy,skin,exclude=covered_torso)
    # One continuous garment surface avoids intersecting duplicate skin shells.
    for v in body.data.vertices:
        if waist-.03<v.co.z<neck.z-.075 and abs(v.co.x)<sleeve_end:
            v.co+=v.normal*(.008 if kind==2 else .012)
        elif v.co.z<waist-.03:v.co+=v.normal*.007
        if kind in (0,3,4) and v.co.y<-.075 and abs(v.co.x)<.19 and waist+.07<v.co.z<neck.z-.12:
            # A woven shirt spans the chest instead of tracing each breast.
            # The centre opening should read as clothing, not a painted body.
            h=max(0,min(1,(v.co.z-waist-.07)/(neck.z-waist-.19)))
            flat_depth=.17+.027*math.sin(h*math.pi)-.008*(v.co.x/.19)**2
            blend=min(1,h*9,(1-h)*9)*min(1,(.19-abs(v.co.x))/.025)
            v.co.y=v.co.y*(1-blend)-flat_depth*blend
    body.data.update()
    for mat in [cloth,trousers,leather,lining]:body.data.materials.append(mat)
    for p in body.data.polygons:
        c=p.center
        if c.z<waist+.025:p.material_index=2
        elif abs(c.x)>=abs(wrists[0].x)-.025:p.material_index=3
        elif c.z<neck.z-.055 and abs(c.x)<sleeve_end:
            p.material_index=0 if kind==2 else 1
    sub=body.modifiers.new('Smooth anatomy and sleeves','SUBSURF');sub.levels=sub.render_levels=1
    face=surface('Face',lambda c:c.z>neck.z-.02,skin,subdivision=1)
    face.data.materials.append(hair)
    for side in ['L','R']:
        sign=1 if side=='L' else -1;foot=joint(RIG['bones']['foot.'+side]['head']);wrist=wrists[0 if side=='L' else 1]
        ellipsoid('Boot upper',(foot.x,-.09,.075),(.087,.17,.075),leather,'foot.'+side)
        box('Boot sole',(foot.x,-.09,.026),(.18,.325,.035),rubber,'foot.'+side)
        ellipsoid('Boot cuff',(foot.x,foot.y,.17),(.083,.077,.14),leather,'foot.'+side)
        for i in range(4):line('Boot lace',[(foot.x-.05,-.08-i*.025,.128-i*.006),(foot.x+.05,-.095-i*.025,.13-i*.006)],.0025,trim,'foot.'+side)
        box('Wrist cuff',(wrist.x,wrist.y,wrist.z+.014),(.095,.085,.055),leather,'wrist.'+side)
    for side in ['L','R']:
        eye=joint(RIG['bones']['eye.'+side]['head']);eye.y+=.004
        ellipsoid('Eyeball',eye,(.024,.021,.021),eyes)
        ellipsoid('Iris',eye+Vector((0,-.020,0)),(.010,.003,.010),iris)
        ellipsoid('Pupil',eye+Vector((0,-.023,0)),(.004,.0015,.005),pupil)
        ellipsoid('Eye catchlight',eye+Vector((-.004,-.024,.004)),(.0028,.001,.0028),eye_glint)
        brow=eye+Vector((0,-.017,.028));line('Eyebrow',[brow+Vector((-.028,0,-.002)),brow+Vector((0,-.006,.004)),brow+Vector((.024,0,-.005))],.0035,hair)
    top=max(coords[i].z for f in faces for i in f)
    for p in face.data.polygons:
        c=p.center
        if c.z>top-.13 or (c.z>top-.23 and c.y>-.012):p.material_index=1
    # Sculpted, overlapping locks follow a deliberate hairstyle rather than
    # leaving a smooth hemisphere painted on the head.
    for i in range(22 if kind!=2 else 14):
        a=math.tau*i/(22 if kind!=2 else 14)
        end_z=top-(.29 if kind in (0,3) else .16)
        if kind==0:end_z-=.085*(math.sin(a)>0)
        points=[(.022*math.sin(a),.015+.024*math.cos(a),top+.012),(.083*math.sin(a),.01+.070*math.cos(a),top-.035),(.12*math.sin(a),.005+.090*math.cos(a),top-.12),(.13*math.sin(a),.01+.083*math.cos(a),end_z)]
        # Keep long side/back locks away from the eyes.
        if math.cos(a)<-.3:points[-1]=(points[-1][0],-.087,top-.12-.017*math.sin(a))
        ribbon('Sculpted hair lock',points,[.014,.019,.016,.002],hair_light if i%4==0 else hair,depth=.007)
    for i in range(9 if kind in (0,3) else 4):
        x=-.093+i*.021
        ribbon('Swept fringe',[(x*.3,-.031,top+.006),(x,-.075,top-.05),(x+.040,-.107,top-.115),(x+.033,-.097,top-.155)], [.014,.021,.017,.0015],hair_light if i%3==0 else hair,depth=.006)
    if kind==1:
        ellipsoid('Tied topknot',(0,.098,top+.065),(.048,.036,.082),hair)
        for i in range(7):
            a=math.tau*i/7
            line('Topknot strand',[(math.sin(a)*.045,.098+math.cos(a)*.025,top+.055),(math.sin(a)*.038,.106+math.cos(a)*.023,top+.12),(0,.13,top+.09)],.003,hair_light)
        line('Hair tie',[(-.036,.10,top+.018),(0,.131,top+.02),(.036,.10,top+.018)],.006,trim)
    elif kind==2:
        # Cinder has a cropped textured fade, strong eyebrows and a short beard.
        for i in range(32):
            a=i*2.399;rad=.087*math.sqrt((i+.5)/32)
            ellipsoid('Cropped hair texture',(math.cos(a)*rad,.013+math.sin(a)*rad*.65,top-.006),(.012,.014,.010),hair_light if i%5==0 else hair)
        jaw=joint(RIG['bones']['jaw']['head'])
        for sign in [-1,1]:line('Jaw beard',[(sign*.060,-.090,jaw.z+.015),(sign*.035,-.123,jaw.z-.025),(0,-.132,jaw.z-.031)],.009,hair,'jaw')
    elif kind==3:
        for sign in [-1,1]:
            for i in range(6):ribbon('Layered silver bob',[(sign*(.085+i*.006),.012,top-.085),(sign*(.125+i*.006),.024,top-.19),(sign*(.128+i*.008),.008,top-.33),(sign*(.098+i*.006),-.006,top-.40)], [.014,.019,.020,.002],hair_light if i%2==0 else hair,depth=.006)
        line('Fine temple chain',[(-.113,-.034,top-.14),(-.10,-.055,top-.20),(-.092,-.067,top-.23)],.0025,steel)
    elif kind==4:
        for i in range(10):
            z=top-.095-i*.047
            for sign in [-1,1]:ellipsoid('Braided ponytail',(.014+sign*.016,.135+i*.006,z),(.021,.026,.031),hair_light if (i+sign)%3==0 else hair)
        line('Ponytail tie',[(-.03,.12,top-.075),(0,.16,top-.07),(.03,.12,top-.075)],.006,trim)
    # Individually cut outer garments. The base mesh is the shirt and sleeves,
    # not an inflated duplicate of the entire torso.
    def fit_depth(z,minimum):
        samples=[-c.y for c in coords if abs(c.z-z)<.048 and abs(c.x)<.19 and c.y<0]
        return max(minimum,max(samples,default=minimum)+.027)
    upper=[(neck.z-.080,.18,fit_depth(neck.z-.080,.155),.14),(neck.z-.18,.235,fit_depth(neck.z-.18,.22),.17),(neck.z-.31,.235,fit_depth(neck.z-.31,.23),.18),(waist+.14,.184,fit_depth(waist+.14,.18),.16),(waist+.04,.182,fit_depth(waist+.04,.17),.15)]
    # The inner shirt has its own continuous edges and spine weights. Painting
    # a white material onto torso polygons left serrated strips at openings.
    inner=[(neck.z-.105,.128,.13,.112),(neck.z-.23,.208,.196,.148),(neck.z-.38,.206,.193,.150),(waist+.14,.170,.17,.13),(waist+.025,.170,.17,.13)]
    if kind==2:inner=[(neck.z-.14,.145,.14,.125),(neck.z-.25,.245,.218,.177),(neck.z-.40,.23,.209,.173),(waist+.14,.188,.184,.151),(waist+.025,.186,.18,.145)]
    jacket('Continuous woven inner shirt',inner,.001,lining)
    if kind==0:
        jacket('Cropped courier jacket',upper,.32,cloth)
    elif kind==1:
        jacket('Split red haori',upper+[(waist-.17,.25,.18,.16),(waist-.39,.29,.20,.18)],.47,cloth)
    elif kind==2:
        jacket('Sleeveless fighting vest',[(neck.z-.15,.205,fit_depth(neck.z-.15,.18)+.014,.15),(neck.z-.30,.270,fit_depth(neck.z-.30,.24)+.014,.19),(waist+.17,.211,.215,.17),(waist+.08,.202,.205,.16)],.63,cloth)
    elif kind==3:
        jacket('Long split prism coat',upper+[(waist-.22,.24,.185,.18),(waist-.46,.29,.21,.20),(waist-.62,.30,.21,.21)],.39,cloth)
    else:
        jacket('Ranger waistcoat',upper,.48,cloth)
        # A curved, tessellated mantle follows the back and shoulder. A single
        # flat polygon looked like a cardboard rectangle beside the archer.
        mantle=[];mantle_faces=[];columns=14;rows=10
        for row in range(rows+1):
            u=row/rows;width=.26+.045*math.sin(u*math.pi)-.03*u
            for col in range(columns+1):
                a=-1.53+col/columns*2.67
                mantle.append((math.sin(a)*width,math.cos(a)*(.135+.055*u)+.008*math.sin(a*9)*u,neck.z-.10-u*.50-.055*abs(math.sin(a))-.035*math.sin(a)+.016*math.cos(a*7)*u))
        for row in range(rows):
            for col in range(columns):
                a=row*(columns+1)+col;b=a+columns+1;mantle_faces.append((a,b,b+1,a+1))
        tailored_mesh('Curved ranger shoulder mantle',mantle,mantle_faces,cloth,'spine01')
    for sign in [-1,1]:
        # Flat, pointed lapels with a narrow stitched edge replace tubular trim.
        pts=[(sign*.067,-.156,neck.z-.09),(sign*.135,-.217,neck.z-.24),(sign*.070,-.184,neck.z-.36),(sign*.049,-.18,neck.z-.17)]
        tailored_mesh('Folded lapel',pts,[(0,1,2,3)],lining if kind in (1,3) else cloth,'spine01')
        line('Lapel topstitch',[pts[0],pts[1],pts[2]],.0018,trim,'spine01')
        line('Jacket seam',[(sign*.185,-.125,neck.z-.30),(sign*.159,-.132,waist+.045)],.0018,trim,'spine02')
        box('Utility belt tab',(sign*.15,-.122,waist+.015),(.062,.024,.047),leather,'spine04')
        if kind in (0,4):
            side='L' if sign==1 else 'R';thigh=joint(RIG['bones']['upperleg01.'+side]['head'])
            box('Thigh pouch',(thigh.x+sign*.070,-.005,thigh.z-.18),(.068,.085,.11),cloth,'upperleg01.'+side)
            line('Thigh pouch piping',[(thigh.x+sign*.075,-.052,thigh.z-.12),(thigh.x+sign*.075,-.056,thigh.z-.20)],.002,trim,'upperleg01.'+side)
    belt=joint(RIG['bones']['spine04']['head']);box('Belt buckle',(0,-.163,belt.z+.04),(.052,.022,.035),steel,'spine04')
    line('Canvas belt',[(-.17,-.07,waist+.005),(-.11,-.17,waist+.005),(0,-.174,waist+.005),(.11,-.17,waist+.005),(.17,-.07,waist+.005)],.013,leather,'spine04')
    if kind==0:
        box('Shoulder insignia',(.244,-.032,neck.z-.15),(.042,.019,.035),trim,'upperarm01.L')
        line('Jacket sleeve stripe',[(.32,-.043,neck.z-.20),(.43,-.05,neck.z-.29),(.51,-.049,neck.z-.37)],.009,trim,'upperarm01.L')
    elif kind==1:
        for i in range(3):line('Woven waist sash',[(-.184,-.09,waist+.045-i*.012),(0,-.181,waist+.045-i*.012),(.184,-.09,waist+.045-i*.012)],.008,trim,'spine04')
        ribbon('Sash tail',[(.115,-.18,waist),(.15,-.19,waist-.12),(.135,-.17,waist-.27),(.19,-.13,waist-.38)],[.025,.030,.028,.014],trim,'spine04',.004)
    elif kind==2:
        for side in ['L','R']:
            wrist=wrists[0 if side=='L' else 1]
            for i in range(5):line('Fighting wrist wrap',[(wrist.x-.032,wrist.y-.027,wrist.z+.034+i*.008),(wrist.x,wrist.y-.043,wrist.z+.029+i*.008),(wrist.x+.032,wrist.y-.027,wrist.z+.023+i*.008)],.004,trim,'wrist.'+side)
        line('Boxer necklace',[(-.062,-.119,neck.z-.04),(0,-.173,neck.z-.20),(.062,-.119,neck.z-.04)],.0025,steel,'spine01')
        box('Dog tag',(0,-.178,neck.z-.20),(.028,.004,.038),steel,'spine01')
    elif kind==3:
        for sign in [-1,1]:
            for i in range(3):ellipsoid('Prism coat fastener',(sign*.086,-.182,neck.z-.36-i*.09),(.009,.006,.009),steel,'spine02')
        tailored_mesh('Violet shoulder cape',[(-.25,.04,neck.z-.07),(-.30,.13,neck.z-.27),(-.15,.23,waist-.04),(.15,.23,waist-.04),(.30,.13,neck.z-.27),(.25,.04,neck.z-.07)],[(0,1,2,3,4,5)],lining,'spine01')
    else:
        ribbon('Quiver strap',[(-.15,-.12,neck.z-.11),(-.035,-.218,neck.z-.29),(.08,-.19,neck.z-.44),(.17,-.14,waist)], [.022,.022,.022,.022],leather,'spine02',.004)
        ellipsoid('Quiver',(.13,.145,neck.z-.23),(.058,.059,.24),leather,'spine02')
        for i in range(5):
            x=.092+i*.015;line('Stored arrow',[(x,.145,neck.z-.33),(x,.145,neck.z+.055)],.0025,steel,'spine02')
            ribbon('Arrow fletching',[(x,.145,neck.z+.02),(x+.017,.145,neck.z+.055),(x,.145,neck.z+.075)],[.009,.012,.001],trim,'spine02',.002)
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
