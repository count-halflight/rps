"""Build clothed fighters on the CC0 MakeHuman mesh, rig and morph targets.
Run: blender --background --python scripts/build_fighters.py
FIGHTER_ONLY=echo optionally rebuilds one model during art development.
Source notices: public/licenses/MakeHuman-CC0.md.
"""
import bpy,bmesh,json,math,os,struct
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
TORSO_WEIGHT=[0.0]*len(vertices);ARM_WEIGHT=[0.0]*len(vertices);HEAD_WEIGHT=[0.0]*len(vertices)
for name,entries in WEIGHTS.items():
    field=TORSO_WEIGHT if name.startswith(('spine','breast','pelvis','clavicle','shoulder')) else ARM_WEIGHT if name.startswith(('upperarm','lowerarm','wrist','finger')) else HEAD_WEIGHT if name.startswith(('head','neck','jaw','oris','oculi','eye')) else None
    if field is not None:
        for index,weight in entries:field[index]+=weight
PROFILES=[
 dict(id='echo',target='asian-female-young',skin=(.46,.255,.16),coat=(.008,.016,.021),trim=(.24,.76,.57),hair=(.004,.006,.008)),
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
    standing_height=height*size
    for v in coords:v.z-=floor;v*=size
    def joint(name):return sum((coords[i] for i in RIG['joints'][name]),Vector())/len(RIG['joints'][name])
    armature=bpy.data.armatures.new('HumanRig');arm=bpy.data.objects.new('HumanRig',armature);bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    for name,desc in RIG['bones'].items():
        b=armature.edit_bones.new(name);b.head,b.tail=joint(desc['head']),joint(desc['tail'])
        if (b.tail-b.head).length<.001:b.tail.z+=.02
    for name,desc in RIG['bones'].items():
        if desc['parent']:armature.edit_bones[name].parent=armature.edit_bones[desc['parent']]
    if kind==0:
        # Original motion bones extend the existing skeleton without renaming
        # its anatomy. The runtime can scrub their secondary motion exactly.
        head_top=max(c.z for c in coords)
        for i in range(3):
            b=armature.edit_bones.new('echo_ponytail'+str(i+1))
            b.head=(0,.13+i*.035,head_top-.04-i*.20)
            b.tail=(.018,.165+i*.035,head_top-.24-i*.20)
            b.parent=armature.edit_bones['head' if i==0 else 'echo_ponytail'+str(i)]
        b=armature.edit_bones.new('echo_jacket_tail')
        b.head=(-.125,.11,joint(RIG['bones']['spine04']['head']).z+.08)
        b.tail=(-.15,.17,b.head.z-.52)
        b.parent=armature.edit_bones['spine04']
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
    def tag(obj,name):
        obj.vertex_groups.new(name=name).add(list(range(len(obj.data.vertices))),1,'REPLACE');return obj
    def box(name,pos,scale,mat,bone):
        bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name=name;o.scale=scale
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        bevel=o.modifiers.new('Rounded seams','BEVEL');bevel.width=min(scale)*.18;bevel.segments=3;bpy.ops.object.modifier_apply(modifier=bevel.name);return attach(o,bone,mat)
    def line(name,points,radius,mat,bone='head'):
        c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=3;s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
        for p,co in zip(s.bezier_points,points):p.co=co;p.handle_left_type=p.handle_right_type='AUTO'
        obj=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.ops.object.convert(target='MESH')
        if bone:return attach(obj,bone,mat)
        verts=[tuple(v.co) for v in obj.data.vertices];polys=[tuple(p.vertices) for p in obj.data.polygons]
        bpy.data.objects.remove(obj,do_unlink=True)
        return tailored_mesh(name,verts,polys,mat)
    def tailored_mesh(name,verts,polys,mat,bone=None):
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],polys);mesh.update()
        obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(mat)
        uv=mesh.uv_layers.new(name='UVMap')
        for p in mesh.polygons:
            for li in p.loop_indices:
                co=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(math.atan2(co.x,-co.y)/math.tau,co.z*.6)
        if bone:return skin_mesh(obj,bone=bone)
        obj.parent=arm
        chain=sorted([(joint(RIG['bones'][n]['head']).z,n) for n in ['spine04','spine03','spine02','spine01','neck03']])
        groups={n:obj.vertex_groups.new(name=n) for _,n in chain}
        shoulder_groups={s:obj.vertex_groups.new(name='upperarm01.'+s) for s in ['L','R']} if kind==0 and (name in ['Asymmetric Echo jacket','Continuous woven inner shirt'] or name.startswith('Echo tailored')) else None
        for v in mesh.vertices:
            h=v.co.z
            a=next((i for i in range(len(chain)-1) if chain[i][0]<=h<=chain[i+1][0]),0 if h<chain[0][0] else len(chain)-2)
            lo,hi=chain[a:a+2];t=max(0,min(1,(h-lo[0])/max(.001,hi[0]-lo[0])))
            shoulder_weight=.24*max(0,min(1,(abs(v.co.x)-.15)/.085))*max(0,min(1,(h-neck.z+.32)/.14)) if shoulder_groups else 0
            groups[lo[1]].add([v.index],(1-t)*(1-shoulder_weight),'REPLACE');groups[hi[1]].add([v.index],t*(1-shoulder_weight),'REPLACE')
            if shoulder_weight:shoulder_groups['L' if v.co.x>0 else 'R'].add([v.index],shoulder_weight,'REPLACE')
        mod=obj.modifiers.new('Tailoring follows the spine','ARMATURE');mod.object=arm
        for p in mesh.polygons:p.use_smooth=True
        return obj
    def jacket(name,rings,opening,mat):
        verts=[];polys=[];segments=44
        echo_fabric=kind==0 and name in ['Asymmetric Echo jacket','Continuous woven inner shirt']
        if echo_fabric:
            dense=[]
            for a,b in zip(rings,rings[1:]):
                for step in range(3):dense.append(tuple(a[i]+(b[i]-a[i])*step/3 for i in range(4)))
            rings=dense+[rings[-1]]
        for ri,(z,width,front,back) in enumerate(rings):
            for i in range(segments+1):
                angle=opening+(math.tau-opening*2)*i/segments
                wave=.0035*math.sin(angle*13+ri*.75)+.002*math.sin(angle*23)
                if echo_fabric:
                    # Small compression folds follow the waist and seams;
                    # a dense curved profile replaces a six-ring rigid cone.
                    fold=math.sin(angle*8+z*15)*.0025+math.sin(angle*17-z*8)*.0013
                    wave=fold*(.35+.65*max(0,1-abs(z-(waist+.12))/.30))
                    if ri==0:z_adjust=.017-.030*max(0,math.cos(angle))**3
                    else:z_adjust=.0015*math.sin(angle*9+z*22)
                else:z_adjust=0
                verts.append((math.sin(angle)*(width+wave),-math.cos(angle)*((front if math.cos(angle)>0 else back)+wave),z+z_adjust))
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
    def hair_clump(name,points,widths,depths,mat,bone='head'):
        # Closed elliptical locks keep volume in profile and blend smoothly
        # into an overlapping hairstyle. Flat ribbons read as sparse ropes.
        path=[];sizes=[]
        points=[Vector(p) for p in points]
        for i in range(len(points)-1):
            p0,p1,p2,p3=points[max(0,i-1)],points[i],points[i+1],points[min(len(points)-1,i+2)]
            for step in range(5):
                t=step/5
                path.append((2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)*.5)
                sizes.append((widths[i]+(widths[i+1]-widths[i])*t,depths[i]+(depths[i+1]-depths[i])*t))
        path.append(points[-1]);sizes.append((widths[-1],depths[-1]))
        verts=[];polys=[];segments=10
        for i,(point,(width,depth)) in enumerate(zip(path,sizes)):
            tangent=(path[min(i+1,len(path)-1)]-path[max(0,i-1)]).normalized()
            outward=(point-Vector((0,.03,top-.13))).normalized() if bone=='head' else Vector((0,-1,0))
            across=tangent.cross(outward).normalized()
            if across.length<.01:across=Vector((1,0,0))
            normal=across.cross(tangent).normalized()
            for j in range(segments):
                a=math.tau*j/segments
                verts.append(tuple(point+across*(math.cos(a)*width)+normal*(math.sin(a)*depth)))
        for i in range(len(path)-1):
            for j in range(segments):
                a=i*segments+j;b=i*segments+(j+1)%segments;polys.append((a,b,b+segments,a+segments))
        polys.extend([tuple(range(segments-1,-1,-1)),tuple((len(path)-1)*segments+j for j in range(segments))])
        return tailored_mesh(name,verts,polys,mat,bone)
    skin=material('Skin',profile['skin'],.59);skin.node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value=.075
    cloth=material('Tailored jacket',profile['coat'],.65 if kind==0 else .87);lining=material('Shirt',[(.025,.032,.038),(.055,.044,.047),(.012,.014,.021),(.25,.23,.29),(.21,.24,.15)][kind],.94)
    trousers=material('Woven trousers',[(.013,.020,.028),(.022,.016,.025),(.007,.013,.026),(.026,.015,.043),(.021,.027,.014)][kind],.92);leather=material('Leather',(.009,.012,.018),.58)
    rubber=material('Boot sole',(.006,.008,.012),.93)
    hair=material('Hair',profile['hair'],.89 if kind==0 else .77);trim=material('Stitching',profile['trim'],.72,.08);steel=material('Brushed steel',(.20,.24,.26),.38,.75)
    hair_light=material('Hair strands',tuple(min(1,c*1.3+(.003 if kind==0 else .022)) for c in profile['hair']),.94 if kind==0 else .82)
    eyes=material('Sclera',(.64,.64,.59),.22);iris=material('Iris',[(.025,.34,.24),(.14,.075,.021),(.095,.039,.016),(.22,.12,.32),(.18,.16,.025)][kind],.24);pupil=material('Pupil',(.001,.002,.003),.20)
    eye_glint=material('Eye catchlight',(.93,.96,1),.10)
    lips=material('Lips',(.40,.205,.16) if kind==0 else tuple(c*k for c,k in zip(profile['skin'],(.70,.54,.55))),.60)
    mouth_dark=material('Mouth interior',(.025,.006,.008),.88)
    tooth=material('Teeth',(.58,.55,.47),.44)
    mint_light=material('Echo band',(0.22,.70,.49),.30,.12)
    bs=mint_light.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(.18,.70,.44,1);bs.inputs['Emission Strength'].default_value=.65
    if kind==0:
        # The official CC0 young-Asian MakeHuman skin matches this mesh's UVs.
        # Preserve the original atlas instead of inventing pore noise over a
        # flat colour. Source and copyright notices accompany the asset.
        skin_image=bpy.data.images.load(str(SOURCE/'skins/young_asian_female/young_lightskinned_female_diffuse3.png'),check_existing=True)
        skin_image.colorspace_settings.name='sRGB'
        skin_texture=skin.node_tree.nodes.new('ShaderNodeTexImage');skin_texture.image=skin_image
        skin.node_tree.links.new(skin_texture.outputs['Color'],skin.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
        def surface_maps(mat,stem,scale,strength):
            nodes=mat.node_tree.nodes;links=mat.node_tree.links;bs=nodes.get('Principled BSDF')
            uv=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeMapping');mapping.inputs['Scale'].default_value=(*scale,1)
            links.new(uv.outputs['UV'],mapping.inputs['Vector'])
            for suffix,input_name in [('baseColor','Base Color'),('roughness','Roughness'),('normal','Normal')]:
                path=ROOT/'assets/generated/echo'/(stem+'_'+suffix+'.png')
                image=bpy.data.images.load(str(path),check_existing=True)
                image.colorspace_settings.name='sRGB' if suffix=='baseColor' else 'Non-Color'
                texture=nodes.new('ShaderNodeTexImage');texture.image=image;texture.extension='REPEAT'
                links.new(mapping.outputs['Vector'],texture.inputs['Vector'])
                if suffix=='normal':
                    normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=strength
                    links.new(texture.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bs.inputs[input_name])
                else:links.new(texture.outputs['Color'],bs.inputs[input_name])
        surface_maps(cloth,'worn_leather',(5,8),.7)
        surface_maps(leather,'worn_leather',(5,8),.7)
        surface_maps(lining,'ribbed_shirt',(6,10),.45)
        surface_maps(hair,'fine_hair',(2,4),.08)
        surface_maps(hair_light,'fine_hair',(2,4),.08)
        # Black hair catches a narrow sheen, not a broad green lacquer coat.
        # Keep the authored roughness maps and soften only the dielectric lobe.
        for mat in [hair,hair_light]:mat.node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=.22
    neck=joint(RIG['bones']['neck03']['head']);hips=joint(RIG['bones']['spine04']['head'])
    wrists=[joint(RIG['bones']['wrist.'+s]['head']) for s in ['L','R']];waist=hips.z+.08
    sleeve_end=.62 if kind in (0,1,3) else .34
    def head_neck(c):
        # neck03 is an upper-neck joint close to the jaw, not the garment
        # neckline. Echo keeps the complete neck in the facial skin mesh and
        # hides its partition down inside the shirt instead of across the chin.
        return c.z>neck.z-.02
    def visible_anatomy(c):
        if kind==0:return True
        if kind!=0 and head_neck(c):return False
        # Covered shirt/body polygons must be removed, not rendered beneath a
        # differently weighted coat. The overlap produced torn-looking patches
        # when a shoulder or chest moved under the jacket during combat.
        covered=waist+.065<c.z<neck.z-(.188 if kind==0 else .115) and abs(c.x)<.215
        return not covered
    # The muscular fighters extend beyond a rectangular torso cutoff. Use
    # their source skin weights to remove the actual covered torso, including
    # the pectorals and abdominal strip. Upper-arm-dominant and neck faces stay.
    covered_torso=set();head_faces=set()
    for index,f in enumerate(faces):
        c=sum((coords[v] for v in f),Vector())/len(f)
        torso=sum(TORSO_WEIGHT[v] for v in f)/len(f)
        arm_weight=sum(ARM_WEIGHT[v] for v in f)/len(f)
        head_weight=sum(HEAD_WEIGHT[v] for v in f)/len(f)
        if head_neck(c) or (kind==0 and ((c.z>neck.z-.20 and head_weight>.15 and head_weight>=torso and head_weight>=arm_weight) or (c.z>neck.z-.245 and abs(c.x)<.075))):
            head_faces.add(index)
        if waist+.020<c.z<neck.z-(.188 if kind==0 else .065) and torso>.10 and torso>=arm_weight:
            covered_torso.add(index)
    # Echo's woven underlayer is one continuous native garment, including its
    # shoulder bridge. A separate elliptical shirt disconnected that bridge
    # from the sleeves and peeled into two collar flaps in a resting pose.
    body=surface('Anatomy',visible_anatomy,skin,exclude=head_faces if kind==0 else covered_torso|head_faces)
    # One continuous garment surface avoids intersecting duplicate skin shells.
    for v in body.data.vertices:
        if waist-.03<v.co.z<neck.z-(.185 if kind==0 else .075) and abs(v.co.x)<sleeve_end:
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
        elif kind==0:p.material_index=4 if abs(c.x)<.225 else 1
        elif c.z<neck.z-.055 and abs(c.x)<sleeve_end:
            p.material_index=0 if kind==2 else 1
    sub=body.modifiers.new('Smooth anatomy and sleeves','SUBSURF');sub.levels=sub.render_levels=1
    face=surface('Face',lambda c:True,skin,subdivision=1,exclude=set(range(len(faces)))-head_faces)
    # Both meshes partition the same original neck polygons. Independent
    # subdivision must keep their matching open edges in place; smoothing each
    # cut separately shrank it into two serrated contours under a small collar.
    for seam_mesh in [body.data,face.data]:
        counts={}
        for polygon in seam_mesh.polygons:
            for edge_key in polygon.edge_keys:counts[edge_key]=counts.get(edge_key,0)+1
        crease=seam_mesh.attributes.get('crease_edge') or seam_mesh.attributes.new('crease_edge','FLOAT','EDGE')
        for edge in seam_mesh.edges:
            z=sum(seam_mesh.vertices[i].co.z for i in edge.vertices)/2
            if counts.get(edge.key)==1 and (neck.z-.27<z<neck.z-.05 if kind==0 else abs(z-(neck.z-.02))<.03):crease.data[edge.index].value=1
    tag(face,'ExpressionSkin')
    face.data.materials.append(hair)
    bpy.context.view_layer.update()
    def face_front_y(x,z,fallback):
        hit,point,normal,index=face.ray_cast(Vector((x,-.65,z)),Vector((0,1,0)))
        return point.y-.0006 if hit else fallback
    for side in ['L','R']:
        sign=1 if side=='L' else -1;foot=joint(RIG['bones']['foot.'+side]['head']);wrist=wrists[0 if side=='L' else 1]
        ellipsoid('Boot upper',(foot.x,-.09,.075),(.087,.17,.075),leather,'foot.'+side)
        box('Boot sole',(foot.x,-.09,.026),(.18,.325,.035),rubber,'foot.'+side)
        ellipsoid('Boot cuff',(foot.x,foot.y,.17),(.083,.077,.14),leather,'foot.'+side)
        for i in range(4):line('Boot lace',[(foot.x-.05,-.08-i*.025,.128-i*.006),(foot.x+.05,-.095-i*.025,.13-i*.006)],.0025,trim,'foot.'+side)
        box('Wrist cuff',(wrist.x,wrist.y,wrist.z+.014),(.095,.085,.055),leather,'wrist.'+side)
    expression_eyes=[]
    for side in ['L','R']:
        eye=joint(RIG['bones']['eye.'+side]['head'])
        # Anatomical eye joints locate the sphere behind its sculpted socket.
        # Moving the centre toward the skin placed corneas ahead of the lids,
        # making a blink leave floating, exposed eyes in front of the face.
        if kind!=0:eye.y-=.012
        expression_eyes.append(eye.copy())
        ocular=[ellipsoid('Eyeball',eye,(.0205,.0198,.0198) if kind==0 else (.024,.014,.0135),eyes),
            ellipsoid('Iris',eye+Vector((0,-.0198 if kind==0 else -.0135,0)),(.0066,.0007,.0073) if kind==0 else (.0085,.0018,.0090),iris),
            ellipsoid('Pupil',eye+Vector((0,-.0207 if kind==0 else -.0151,0)),(.0030,.0005,.0039) if kind==0 else (.0039,.0012,.0048),pupil),
            ellipsoid('Eye catchlight',eye+Vector((-.0025,-.0213 if kind==0 else -.0161,.0028)),(.0011,.0004,.0011),eye_glint)]
        brow=eye+Vector((0,-.011,.025))
        if kind==0:
            points=[]
            for x,z in [(-.021,-.001),(-.011,.0012),(0,.002),(.013,.001),(.023,-.0015)]:
                p=eye+Vector((x,0,.025+z))
                p.y=face_front_y(p.x,p.z,eye.y-.017);points.append(p)
            tag(ribbon('Tapered eyebrow',points,[.0006,.0017,.002,.0015,.0003],hair,depth=.0008),'ExpressionBrow'+side)
        else:tag(line('Eyebrow',[brow+Vector((-.025,0,-.002)),brow+Vector((0,-.002,.004)),brow+Vector((.024,0,-.004))],.0032,hair),'ExpressionBrow'+side)
        if kind==0:
            # The native sculpted eyelid contour closes in the facial morph.
            # Separate planar caps made the eyes read as protruding plates.
            lash=[]
            for x,z in [(-.021,0),(0,.0064),(.021,0)]:
                p=eye+Vector((x,0,z));p.y=face_front_y(p.x,p.z,eye.y-.0198);lash.append(p)
            tag(line('Upper lash '+side,lash,.0005,hair),'ExpressionLash'+side)
    lip_centre=joint(RIG['bones']['oris05']['head'])
    if kind==0:
        # These two stable source landmarks bound the actual closed lip seam.
        # The oris05 joint is above the seam, at the upper lip's arch.
        lip_centre=(coords[468]+coords[523])*.5
        # The neutral mouth stays closed. The cavity rests behind the skin and
        # comes forward only for a shout; a permanently open oval looked like
        # a second mouth beneath the sculpted anatomical lips.
        tag(ellipsoid('Mouth cavity',lip_centre+Vector((0,.005,-.003)),(.027,.0012,.001),mouth_dark),'ExpressionMouth')
        tag(ellipsoid('Closed lip contact',lip_centre+Vector((0,-.0004,-.0005)),(.025,.0011,.0011),lips),'ExpressionLipSeal')
        tag(line('Fine mouth seam',[lip_centre+Vector((-.024,-.0015,-.0005)),lip_centre+Vector((0,-.0018,-.0008)),lip_centre+Vector((.024,-.0015,-.0005))],.00023,mouth_dark),'ExpressionLipSeal')
        for upper in [True,False]:
            points=[]
            for i in range(9):
                x=-.027+i*.00675;arch=1-(x/.027)**2
                z=lip_centre.z+(.0035*arch-.0018*math.exp(-(x/.007)**2) if upper else -.0040*arch)
                samples=[c.y for c in coords if abs(c.x-x)<.006 and abs(c.z-z)<.004 and c.y<-.15]
                y=min(samples,default=lip_centre.y)-.00035
                points.append((x,y,z))
            tag(line('Upper lip' if upper else 'Lower lip',points,.0008 if upper else .0011,lips),'ExpressionLipTop' if upper else 'ExpressionLipBottom')
        for i,x in enumerate([-.0105,-.0035,.0035,.0105]):
            tag(box('Upper tooth '+str(i),lip_centre+Vector((x,.020,-.001)),(.006,.002,.005 if i in [1,2] else .004),tooth,'head'),'ExpressionTeeth')
        mark=[Vector((.031,0,expression_eyes[0].z-.024)),Vector((.059,0,expression_eyes[0].z-.030))]
        for p in mark:p.y=face_front_y(p.x,p.z,expression_eyes[0].y-.018)-.0004
        line('Mint eye mark',mark,.0011,mint_light)
    top=max(coords[i].z for f in faces for i in f)
    for p in face.data.polygons:
        c=p.center
        if kind!=0 and (c.z>top-.13 or (c.z>top-.23 and c.y>-.012)):p.material_index=1
    if kind==0:
        # A fitted, subdivided scalp follows the actual anatomy. Broad fan
        # ribbons and material-only helmet edges broke the ponytail silhouette.
        def echo_hairline(c):
            front=max(0,min(1,(.025-c.y)/.16))
            temple=min(1,abs(c.x)/.125)
            irregular=.0025*math.sin(c.x*53)+.0015*math.sin(c.x*109)
            return top-.175+.085*front+.035*temple**1.5*front+irregular*front
        def echo_scalp(c):return c.z>echo_hairline(c)
        scalp=surface('Echo fitted swept-back hair',echo_scalp,hair,.005,2)
        bpy.context.view_layer.objects.active=scalp
        bpy.ops.object.modifier_apply(modifier='Smooth tailoring')
        # Match the open hairline to a continuous, irregular swept-back curve.
        # Polygon-centre selection alone left a coarse scalloped cap edge.
        edge_counts={}
        for polygon in scalp.data.polygons:
            for key in polygon.edge_keys:edge_counts[key]=edge_counts.get(key,0)+1
        boundary=set(i for edge in scalp.data.edges if edge_counts.get(edge.key)==1 for i in edge.vertices)
        adjacency=[set() for _ in scalp.data.vertices]
        for edge in scalp.data.edges:
            a,b=edge.vertices;adjacency[a].add(b);adjacency[b].add(a)
        original=[v.co.copy() for v in scalp.data.vertices];front_displacement={}
        for i in boundary:
            v=scalp.data.vertices[i]
            if v.co.y<-.035:
                # The source scalp rows vary in depth. Feeding that depth
                # back into the hairline made a tabbed cap even after subdivision.
                # A gently asymmetric front curve recedes at both temples.
                temple=min(1,abs(v.co.x)/.125)
                v.co.z=top-.107+.026*temple**1.5+.0018*math.sin(v.co.x*39)+.0006*math.sin(v.co.x*97)
                v.co.y=face_front_y(v.co.x,v.co.z,v.co.y)-.0016
                front_displacement[i]=v.co-original[i]
            else:v.co.z=echo_hairline(v.co)+.0015
        # Carry the hairline fit into the neighbouring scalp rings. Moving
        # only boundary vertices left a stretched, near-vertical black band.
        # A smooth falloff preserves the untouched crown and rear silhouette.
        visited=set(boundary);ring=front_displacement
        for falloff in [.72,.40,.14]:
            candidates=set(n for i in ring for n in adjacency[i] if n not in visited)
            next_ring={}
            for i in candidates:
                neighbours=[ring[n] for n in adjacency[i] if n in ring]
                if not neighbours:continue
                displacement=sum(neighbours,Vector())/len(neighbours)
                next_ring[i]=displacement
                scalp.data.vertices[i].co=original[i]+displacement*falloff
            visited.update(candidates);ring=next_ring
        scalp.data.update()
        # An off-centre part exposes the existing anatomical scalp beneath
        # the hair rather than painting skin onto a second surface. It also
        # keeps skin in the existing face primitive instead of adding a draw.
        bm=bmesh.new();bm.from_mesh(scalp.data)
        part=[p for p in bm.faces if abs(p.calc_center_median().x+.030)<.0019 and -.095<p.calc_center_median().y<.085 and p.calc_center_median().z>top-.066]
        bmesh.ops.delete(bm,geom=part,context='FACES_ONLY');bm.to_mesh(scalp.data);bm.free();scalp.data.update()
        # Fine combed strands project onto the actual scalp. Smooth guide
        # trajectories avoid rectangular paths along the topology's grid,
        # while POLY samples cannot overshoot away from the fitted surface.
        bpy.context.view_layer.update()
        front_boundary=[i for i in boundary if scalp.data.vertices[i].co.y<-.04]
        front_edges=[edge for edge in scalp.data.edges if edge_counts.get(edge.key)==1 and all(scalp.data.vertices[i].co.y<-.04 for i in edge.vertices)]
        hair_centre=Vector((0,.026,top-.130))
        for strand in range(69):
            x=-.100+strand*.00295+.0007*math.sin(strand*2.37)
            start=min(front_boundary,key=lambda i:abs(scalp.data.vertices[i].co.x-x))
            origin=scalp.data.vertices[start].co.copy()
            roots=[]
            for edge in front_edges:
                a,b=(scalp.data.vertices[i].co for i in edge.vertices)
                if min(a.x,b.x)<=x<=max(a.x,b.x) and abs(a.x-b.x)>.00001:
                    roots.append(a.lerp(b,(x-a.x)/(b.x-a.x)))
            if roots:origin=min(roots,key=lambda p:p.y)
            # An individual tapered root reaches the hairline instead of
            # starting centimetres above it on a uniformly combed cap.
            tip=origin.copy();tip.x+=.00055*math.sin(strand*1.71)
            tip.z-=.0004+.0023*(.5+.5*math.sin(strand*2.13))
            tip.y=face_front_y(tip.x,tip.z,tip.y)-.00055
            route=[tip,origin+(origin-hair_centre).normalized()*.0002]
            sweep=.017+.013*(.5+.5*math.sin(strand*.83))
            direction=-1 if x<-.030 else 1
            for i in range(49):
                t=.003+(i/48)*(.97-.04*(.5+.5*math.sin(strand*.73)))
                px=-.030+(x+.030)*(1-t)**.85+direction*sweep*math.sin(t*math.pi)+.0017*math.sin(t*math.pi*2+strand*.71)*math.sin(t*math.pi)
                py=origin.y+(.12-origin.y)*t+.002*math.sin(strand*.91)*math.sin(t*math.pi)
                pz=origin.z+(top-.105-origin.z)*t+.115*math.sin(t*math.pi)**.75
                guide=Vector((px,py,pz));outward=(guide-hair_centre).normalized()
                # Inward radial projection also hits the vertical front band.
                # A +Z ray covered only the crown and stranded the roots above
                # the forehead, which made the hairstyle resemble a helmet.
                hit,point,normal,index=scalp.ray_cast(hair_centre+outward*.35,-outward)
                # Open-boundary misses must not bind a strand to the far side
                # of the scalp or the cap's inward-facing underside.
                if hit and (point-hair_centre).dot(outward)>.01 and normal.dot(outward)>.08:
                    route.append(point+normal*.0005)
            if len(route)<15:continue
            if (math.sin(strand*12.9898+23.31)*43758.5453)%1>.80:
                guides=[p.copy() for p in [route[0],route[1]]+route[3::4]]
                if guides[-1]!=route[-1]:guides.append(route[-1].copy())
                for i,p in enumerate(guides):
                    normal=(p-hair_centre).normalized()
                    p+=normal*(.0003+.0006*math.sin(i/(len(guides)-1)*math.pi))
                variation=.72+.28*math.sin(strand*1.73)**2
                widths=[(.0028+.001*math.sin(i/(len(guides)-1)*math.pi))*(1-.64*i/(len(guides)-1))*variation for i in range(len(guides))]
                widths[0]=.000045; widths[1]=.00042; widths[-1]=.0003
                hair_clump('Swept sculpted Echo lock',guides,widths,[w*.22 for w in widths],hair_light if strand%15==0 else hair)
            if strand in [13,36,57]:
                guides=[p.copy() for p in route[::4]]
                if guides[-1]!=route[-1]:guides.append(route[-1].copy())
                for i,p in enumerate(guides):p+=(p-hair_centre).normalized()*(.0007+.0014*math.sin(i/(len(guides)-1)*math.pi))
                widths=[(.0055+.0014*math.sin(i/(len(guides)-1)*math.pi))*(1-.78*i/(len(guides)-1)) for i in range(len(guides))]
                widths[0]=.00008;widths[-1]=.0004
                hair_clump('Soft asymmetrical crown volume',guides,widths,[w*.38 for w in widths],hair)
            c=bpy.data.curves.new('Surface swept hair strand','CURVE');c.dimensions='3D';c.bevel_depth=.00016+.000055*(.5+.5*math.sin(strand*1.13));c.bevel_resolution=2
            spline=c.splines.new('POLY');spline.points.add(len(route)-1)
            for i,(point,coordinate) in enumerate(zip(spline.points,route)):
                point.co=(*coordinate,1)
                point.radius=.12+.88*min(1,i/4)*min(1,(len(route)-1-i)/5)
            obj=bpy.data.objects.new(c.name,c);bpy.context.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj
            bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.ops.object.convert(target='MESH');attach(obj,'head',hair_light)
        # Irregular temple strands break the clean cap edge without covering
        # the eyes or adding a blunt geometric fringe.
        for sign in [-1,1]:
            hair_clump('Loose swept temple lock',[(sign*.066,-.089,top-.037),(sign*.096,-.134,top-.075),(sign*.108,-.135,top-.135),(sign*.105,-.12,top-.205)],[.004,.005,.003,.0004],[.002,.002,.0015,.0003],hair)
        hair_clump('Asymmetric cheek wisp',[(-.085,-.076,top-.028),(-.103,-.145,top-.087),(-.113,-.144,top-.169),(-.120,-.125,top-.235)],[.003,.004,.002,.0004],[.0015,.0015,.001,.0003],hair_light)
    # Sculpted, overlapping locks follow a deliberate hairstyle rather than
    # leaving a smooth hemisphere painted on the head.
    for i in range(0 if kind==0 else 22 if kind!=2 else 14):
        a=math.tau*i/(22 if kind!=2 else 14)
        end_z=top-(.15 if kind==0 else .29 if kind==3 else .16)
        points=[(.022*math.sin(a),.015+.024*math.cos(a),top+.012),(.083*math.sin(a),.01+.070*math.cos(a),top-.035),(.12*math.sin(a),.005+.090*math.cos(a),top-.12),(.13*math.sin(a),.01+.083*math.cos(a),end_z)]
        # Keep long side/back locks away from the eyes.
        if math.cos(a)<-.3:
            if kind==0:
                points[2]=(points[2][0],-.154+.037*abs(math.sin(a)),top-.10)
                points[-1]=(points[-1][0],-.169+.025*abs(math.sin(a)),top-.115-.014*math.sin(a))
            else:points[-1]=(points[-1][0],-.087,top-.12-.017*math.sin(a))
        ribbon('Sculpted hair lock',points,[.014,.019,.016,.002],hair_light if i%4==0 else hair,depth=.007)
    for i in range(0 if kind==0 else 9 if kind==3 else 4):
        x=-.093+i*.021
        if kind==0:
            fringe=[(x*.3,-.031,top+.006),(x,-.097,top-.052),(x+.026,-.170,top-.10),(x+.020,-.185,top-.13-abs(x)*.12)]
        else:fringe=[(x*.3,-.031,top+.006),(x,-.075,top-.05),(x+.040,-.107,top-.115),(x+.033,-.097,top-.155)]
        ribbon('Swept fringe',fringe,[.012,.018,.014,.0015],hair_light if i%3==0 else hair,depth=.0045)
    if kind==0:
        core=[(0,.15,top-.066),(.015,.186,top-.19),(.029,.225,top-.39),(.071,.266,top-.61),(.111,.259,top-.82)]
        pony_objects=[hair_clump('Full flowing ponytail core',core,[.049,.052,.046,.031,.002],[.032,.039,.034,.021,.001],hair,'echo_ponytail1')]
        for i in range(24):
            a=i*2.3999632297;variation=.76+.24*(.5+.5*math.sin(i*1.73))
            points=[]
            for j,p in enumerate(core):
                twist=a+j*(.29+.10*math.sin(i*.81));radius=[.035,.047,.043,.031,.006][j]*variation
                points.append((p[0]+math.sin(twist)*radius+.006*math.sin(j*1.7+i)*j/4,p[1]+math.cos(twist)*radius*.76,p[2]+.007*math.sin(a+j)-(.035+.025*math.sin(i*1.43))*j*j/16))
            pony_objects.append(hair_clump('Layered Echo ponytail lock',points,[w*variation for w in [.008,.013,.011,.006,.0003]],[w*variation for w in [.004,.006,.005,.003,.0002]],hair_light if i%5==0 else hair,'echo_ponytail1'))
        for i in range(5):
            points=[(p[0]+.048*math.sin(i*1.83+j*.6),p[1]+.031*math.cos(i*1.83+j*.6),p[2]+.014*math.sin(i+j)-.018*j) for j,p in enumerate(core)]
            pony_objects.append(line('Loose ponytail strand',points,.00035,hair_light,'echo_ponytail1'))
        for o in pony_objects:
            # Each strand follows a three-bone chain rather than a rigid rod.
            o.vertex_groups.clear();groups=[o.vertex_groups.new(name='echo_ponytail'+str(j+1)) for j in range(3)]
            for v in o.data.vertices:
                u=max(0,min(2,(top-.16-v.co.z)/.21));lo=min(1,int(u));t=u-lo
                groups[lo].add([v.index],1-t,'REPLACE');groups[lo+1].add([v.index],t,'REPLACE')
        line('Glowing Echo ponytail band',[(-.052,.142,top-.090),(-.038,.187,top-.082),(0,.193,top-.077),(.038,.187,top-.082),(.052,.142,top-.090)],.005,mint_light)
    elif kind==1:
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
        fit_coords=(v.co for v in body.data.vertices) if kind==0 else coords
        samples=[-c.y for c in fit_coords if abs(c.z-z)<(.019 if kind==0 else .048) and abs(c.x)<.19 and c.y<0]
        return max(minimum,max(samples,default=minimum)+(.009 if kind==0 else .027))
    upper=[(neck.z-.080,.18,fit_depth(neck.z-.080,.155),.14),(neck.z-.18,.235,fit_depth(neck.z-.18,.22),.17),(neck.z-.31,.235,fit_depth(neck.z-.31,.23),.18),(waist+.14,.184,fit_depth(waist+.14,.18),.16),(waist+.04,.182,fit_depth(waist+.04,.17),.15)]
    if kind==0:
        upper=[(neck.z-.174,.172,fit_depth(neck.z-.174,.145),.110),(neck.z-.235,.222,fit_depth(neck.z-.235,.172),.123),(neck.z-.30,.219,fit_depth(neck.z-.30,.184),.130),(neck.z-.405,.193,fit_depth(neck.z-.405,.175),.124),(waist+.14,.169,fit_depth(waist+.14,.155),.120),(waist+.04,.176,fit_depth(waist+.04,.153),.128)]
    # The inner shirt has its own continuous edges and spine weights. Painting
    # a white material onto torso polygons left serrated strips at openings.
    inner=[(neck.z-.105,.128,.13,.112),(neck.z-.23,.208,.196,.148),(neck.z-.38,.206,.193,.150),(waist+.14,.170,.17,.13),(waist+.025,.170,.17,.13)]
    if kind==2:inner=[(neck.z-.14,.145,.14,.125),(neck.z-.25,.245,.218,.177),(neck.z-.40,.23,.209,.173),(waist+.14,.188,.184,.151),(waist+.025,.186,.18,.145)]
    if kind!=0:jacket('Continuous woven inner shirt',inner,.001,lining)
    if kind==0:
        jacket('Asymmetric Echo jacket',upper,.25,cloth)
        # The short coat is cut from shaped panels instead of a plain black
        # tube. Every front seam is fitted to the same elliptical coat profile
        # and follows its height-dependent spine/shoulder weights.
        def coat_point(x,z,lift=.004):
            a,b=next(((a,b) for a,b in zip(upper,upper[1:]) if b[0]<=z<=a[0]),(upper[0],upper[1]) if z>upper[0][0] else (upper[-2],upper[-1]))
            t=max(0,min(1,(a[0]-z)/max(.001,a[0]-b[0])))
            width=a[1]+(b[1]-a[1])*t;front=a[2]+(b[2]-a[2])*t
            return Vector((x,-front*math.sqrt(max(.018,1-(x/width)**2))-lift,z))
        def coat_panel(name,rows,mat,stitch=True):
            rows=[(z,min(left,right),max(left,right)) for z,left,right in rows]
            grid=[];sections=[];columns=14
            for a,b in zip(rows,rows[1:]):
                for i in range(4):sections.append(tuple(a[j]+(b[j]-a[j])*i/4 for j in range(3)))
            sections.append(rows[-1])
            for z,left,right in sections:
                for i in range(columns+1):grid.append(coat_point(left+(right-left)*i/columns,z,.006))
            polys=[]
            for r in range(len(sections)-1):
                for i in range(columns):
                    a=r*(columns+1)+i;b=a+columns+1;polys.append((a,b,b+1,a+1))
            panel=tailored_mesh(name,grid,polys,mat)
            solid=panel.modifiers.new('Turned leather edge','SOLIDIFY');solid.thickness=.003
            bpy.context.view_layer.objects.active=panel;bpy.ops.object.modifier_apply(modifier=solid.name)
            if stitch:
                for edge in [1,2]:
                    points=[coat_point(row[edge],row[0],.009) for row in sections]
                    line('Echo tailored inset binding',points,.00115,leather,None)
                    # Separate short stitches make a sewn seam, not an
                    # uninterrupted glowing outline around the chest.
                    for a,b in zip(points[::2],points[2::2]):
                        start=a.lerp(b,.27);end=a.lerp(b,.46)
                        line('Echo tailored saddle stitch',[start,end],.00052,trim,None)
            return panel
        coat_panel('Echo tailored asymmetric shoulder yoke',[(neck.z-.214,-.191,-.045),(neck.z-.260,-.201,.019),(neck.z-.347,-.181,-.040),(neck.z-.396,-.160,-.097)],lining)
        coat_panel('Echo tailored crossing leather lapel',[(neck.z-.193,.033,.083),(neck.z-.275,-.002,.105),(neck.z-.389,-.062,.059),(waist+.171,-.075,.036),(waist+.061,-.031,.068)],leather)
        for sign in [-1,1]:
            coat_panel('Echo tailored waist dart',[(neck.z-.36,sign*.125,sign*.151),(waist+.20,sign*.111,sign*.139),(waist+.065,sign*.117,sign*.145)],lining)
        # One small, flush clasp closes the overlapping lapel. Its metal
        # leaves have real thickness; three floating wire bars looked like a cage.
        clasp=coat_point(.035,neck.z-.355,.011)
        for sign in [-1,1]:
            ribbon('Inset pewter lapel leaf',[clasp+Vector((sign*.020,0,.010)),clasp+Vector((sign*.033,-.001,0)),clasp+Vector((sign*.020,0,-.010))],[.0005,.006,.0005],steel,'spine02',.002)
        line('Small lapel closure',[clasp+Vector((-.016,0,0)),clasp+Vector((0,-.001,-.003)),clasp+Vector((.016,0,0))],.0015,steel,'spine02')
        # A true broad waist band and an open buckle frame give the silhouette
        # a practical cinch without box armour or a round sausage belt.
        cinch=[];cinch_faces=[];segments=56
        for z in [waist+.040,waist-.012]:
            for i in range(segments+1):
                angle=math.tau*i/segments
                cinch.append((math.sin(angle)*.176,-math.cos(angle)*(.164 if math.cos(angle)>0 else .134),z))
        for i in range(segments):cinch_faces.append((i,i+segments+1,i+segments+2,i+1))
        tailored_mesh('Echo tailored shaped waist cinch',cinch,cinch_faces,leather,'spine04')
        buckle_y=-.174;buckle_z=waist+.015
        line('Open pewter belt frame',[(-.029,buckle_y,buckle_z+.016),(.029,buckle_y,buckle_z+.016),(.032,buckle_y,buckle_z),(.029,buckle_y,buckle_z-.016),(-.029,buckle_y,buckle_z-.016),(-.032,buckle_y,buckle_z),(-.029,buckle_y,buckle_z+.016)],.0024,steel,'spine04')
        line('Belt tongue',[(-.025,buckle_y-.001,buckle_z),(.026,buckle_y-.001,buckle_z)],.0017,steel,'spine04')
        for sign in [-1,1]:
            for i in range(3):ellipsoid('Belt keeper rivet',(sign*(.079+i*.022),-.166+(.008*i),buckle_z),(.0035,.0015,.0035),steel,'spine04')
        tail=[];tail_faces=[];rows=16;columns=10
        for row in range(rows+1):
            t=row/rows
            for col in range(columns+1):
                u=col/columns
                x=-.23+u*.26-.026*t
                z=waist+.07-t*(.52-.10*u)+.035*math.sin(u*math.pi)*t
                y=.125+.060*t+.015*math.sin(u*math.pi*3)*t
                tail.append((x,y,z))
        for row in range(rows):
            for col in range(columns):
                a=row*(columns+1)+col;b=a+columns+1
                # The narrow split catches light and makes her rear silhouette
                # asymmetric even when both blades are hidden in their sheaths.
                if col!=6 or row<5:tail_faces.append((a,b,b+1,a+1))
        tailored_mesh('Split Echo jacket tail',tail,tail_faces,cloth,'echo_jacket_tail')
        line('Mint tail edge',[tail[row*(columns+1)] for row in range(rows+1)],.0026,mint_light,'echo_jacket_tail')
        for sign in [-1,1]:
            side='L' if sign==1 else 'R';shin=joint(RIG['bones']['lowerleg01.'+side]['head'])
            cuff=[];cuff_faces=[];columns=16
            for row in range(7):
                t=row/6;z=shin.z-.055-t*.228;width=.061-.010*t
                for col in range(columns+1):
                    a=-1.13+2.26*col/columns
                    cuff.append((shin.x+math.sin(a)*width,-.045-math.cos(a)*(.072-.019*t),z))
            for row in range(6):
                for col in range(columns):
                    a=row*(columns+1)+col;b=a+columns+1;cuff_faces.append((a,b,b+1,a+1))
            tailored_mesh('Curved Echo boot shaft',cuff,cuff_faces,leather,'lowerleg01.'+side)
            for edge in [0,columns]:line('Boot shaft binding',[cuff[row*(columns+1)+edge] for row in range(7)],.0014,lining,'lowerleg01.'+side)
            line('Short mint boot stitch',[(shin.x,-.118,shin.z-.103),(shin.x,-.111,shin.z-.133)],.0017,mint_light,'lowerleg01.'+side)
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
        if kind!=0:
            tailored_mesh('Folded lapel',pts,[(0,1,2,3)],lining if kind in (1,3) else cloth,'spine01')
            line('Lapel topstitch',[pts[0],pts[1],pts[2]],.0018,trim,'spine01')
            line('Jacket seam',[(sign*.185,-.125,neck.z-.30),(sign*.159,-.132,waist+.045)],.0018,trim,'spine02')
        box('Utility belt tab',(sign*.15,-.122,waist+.015),(.062,.024,.047),leather,'spine04')
        if kind in (0,4):
            side='L' if sign==1 else 'R';thigh=joint(RIG['bones']['upperleg01.'+side]['head'])
            box('Thigh pouch',(thigh.x+sign*.070,-.005,thigh.z-.18),(.068,.085,.11),cloth,'upperleg01.'+side)
            line('Thigh pouch piping',[(thigh.x+sign*.075,-.052,thigh.z-.12),(thigh.x+sign*.075,-.056,thigh.z-.20)],.002,trim,'upperleg01.'+side)
    belt=joint(RIG['bones']['spine04']['head'])
    if kind!=0:
        box('Belt buckle',(0,-.163,belt.z+.04),(.052,.022,.035),steel,'spine04')
        line('Canvas belt',[(-.17,-.07,waist+.005),(-.11,-.17,waist+.005),(0,-.174,waist+.005),(.11,-.17,waist+.005),(.17,-.07,waist+.005)],.013,leather,'spine04')
    if kind==0:
        # Fine, flush scrollwork follows the cut lapel rather than hovering on
        # a front-depth estimate shared by unrelated pieces of the costume.
        scroll=[coat_point(x,z,.010) for x,z in [(.075,neck.z-.255),(.088,neck.z-.28),(.081,neck.z-.302),(.061,neck.z-.305),(.055,neck.z-.290)]]
        line('Echo tailored restrained lapel scroll',scroll,.0008,steel,None)
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
    meshes=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
    expression_mesh=body
    if kind==0:
        # Open a real oral seam after subdivision. Quads that connect the
        # closed upper/lower contact strip otherwise stretch into a skin flap
        # when the jaw opens. The cavity remains behind the resulting opening.
        seam=lip_centre.z-.0003
        bm=bmesh.new();bm.from_mesh(face.data)
        oral=[]
        for polygon in bm.faces:
            c=polygon.calc_center_median();zs=[v.co.z for v in polygon.verts]
            if abs(c.x)<.028 and lip_centre.y+.0007<c.y<-.16 and min(zs)<seam<max(zs):oral.append(polygon)
        bmesh.ops.delete(bm,geom=oral,context='FACES_ONLY');bm.to_mesh(face.data);bm.free();face.data.update()
        expressive=[obj for obj in meshes if any(g.name.startswith('Expression') for g in obj.vertex_groups)]
        static=[obj for obj in meshes if obj not in expressive]
        bpy.ops.object.select_all(action='DESELECT')
        for obj in static:obj.select_set(True)
        bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
        bpy.ops.object.select_all(action='DESELECT')
        for obj in expressive:obj.select_set(True)
        bpy.context.view_layer.objects.active=face;bpy.ops.object.join()
        expression_mesh=face;expression_mesh.name='Facial expressions'
    else:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in meshes:obj.select_set(True)
        bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
    if kind==0:
        # These are real geometry morphs, retained by glTF and meshopt packing.
        # Tiny tagged facial surfaces share the skin skeleton and seven keys
        # with the face mesh so runtime expressions cannot desynchronise lips,
        # brows and anatomical lids from the underlying facial deformation.
        expression_mesh.shape_key_add(name='Basis')
        expressions=['blink','browUp','browDown','smirk','grit','hurt','shout']
        tags={g.index:g.name for g in expression_mesh.vertex_groups if g.name.startswith('Expression')}
        eye_by_side=dict(zip(['L','R'],expression_eyes))
        def bell(x,width):return max(0,1-(x/max(.001,width))**2)
        for expression in expressions:
            key=expression_mesh.shape_key_add(name=expression)
            for vertex in expression_mesh.data.vertices:
                p=vertex.co.copy();delta=Vector();names={tags[g.group] for g in vertex.groups if g.group in tags and g.weight>.1}
                for side,eye in eye_by_side.items():
                    x=p.x-eye.x;arc=math.sqrt(bell(x,.023))
                    if 'ExpressionSkin' in names and p.y<-.135:
                        z=p.z-eye.z
                        lateral=max(0,min(1,(.031-abs(x))/.012))
                        edge=max(0,min(1,(abs(z)-.009*arc)/(.028-.009*arc)))
                        falloff=1-edge*edge*(3-2*edge)
                        lid_weight=lateral*falloff
                        if expression=='blink':
                            # A curved closed lid wraps the seated cornea,
                            # instead of pushing a flat rectangular skin patch
                            # a constant distance out in front of the eye.
                            seam=(-.0014 if z>=0 else .0011)*arc
                            delta.z+=(seam-z)*lid_weight
                            cornea_y=eye.y-math.sqrt(max(0,.0208**2-x*x))-.0012-(.0007 if z>=0 else 0)
                            delta.y+=(min(p.y,cornea_y)-p.y)*lid_weight
                        elif expression=='browDown' and 0<z<.023:delta.z-=.0015*lid_weight
                        elif expression=='browUp' and 0<z<.023:delta.z+=.0018*lid_weight
                        elif expression=='hurt':delta.z-=z*lid_weight*.25
                    if 'ExpressionLash'+side in names:
                        if expression=='blink':delta.z=-(p.z-eye.z)
                        elif expression=='browDown':delta.z=-.0032*arc
                        elif expression=='browUp':delta.z=.0028*arc
                    if 'ExpressionBrow'+side in names:
                        inner=1-max(0,min(1,abs(p.x)/.080))
                        if expression=='browUp':delta.z=.011+.006*inner
                        elif expression=='browDown':delta.z=-.006-.005*inner
                        elif expression=='hurt':delta.z=.008*inner-.003
                        elif expression=='smirk' and side=='L':delta.z=.0035
                        elif expression in ['grit','shout']:delta.z=-.005-.003*inner
                lower='ExpressionLipBottom' in names;upper='ExpressionLipTop' in names
                if lower or upper:
                    w=bell(p.x,.037)
                    if expression=='smirk':delta.z=.008*max(0,p.x/.035);delta.x=.002*max(0,p.x/.035)
                    elif expression=='grit':delta.z=(-.002 if lower else .002)*w;delta.y=-.0015*w
                    elif expression=='hurt':delta.z=-.004*w+.004*abs(p.x/.035)
                    elif expression=='shout':delta.z=(-.034 if lower else .004)*w;delta.x=p.x*.15
                if 'ExpressionMouth' in names:
                    if expression=='shout':delta.z=(p.z-lip_centre.z+.003)*23-.014;delta.x=p.x*.18
                    elif expression=='grit':delta.z=(p.z-lip_centre.z)*.6
                    elif expression=='smirk':delta.z=.006*max(0,p.x/.034)
                if 'ExpressionTeeth' in names:
                    if expression=='grit':delta.y=-.021
                    elif expression=='shout':delta.y=-.026;delta.z=.001
                if 'ExpressionLipSeal' in names:
                    if expression in ['grit','shout']:delta.y=.030
                    elif expression=='smirk':delta.z=.006*max(0,p.x/.035)
                if 'ExpressionSkin' in names and p.y<-.10:
                    eye_weight=max((bell(p.x-e.x,.055)*bell(p.z-e.z-.025,.035) for e in expression_eyes),default=0)
                    mouth_weight=bell(p.x,.07)*bell(p.z-lip_centre.z,.060)
                    if expression=='browUp':delta.z+=.009*eye_weight
                    elif expression=='browDown':delta.z-=.005*eye_weight
                    elif expression=='smirk':delta.z+=.004*mouth_weight*max(0,p.x/.05)
                    elif expression=='grit':delta.y-=.0025*mouth_weight;delta.z-=.002*eye_weight
                    elif expression=='hurt':delta.z+=.006*eye_weight-.003*mouth_weight
                    elif expression=='shout':
                        if p.z<lip_centre.z-.0003:
                            below=lip_centre.z-p.z
                            width=.038+min(1,below/.10)*.05
                            jaw_weight=bell(p.x,width)*bell(below-.011,.055)
                            delta.z-=.034*jaw_weight;delta.y+=.0015*jaw_weight
                        else:
                            delta.z+=.004*bell(p.x,.037)*bell(p.z-lip_centre.z-.006,.017)
                key.data[vertex.index].co=p+delta
        expression_mesh['facialTargets']=expressions
        body['characterDesign']='Echo: reverse-grip Gothic runner, split leather coat, long light-banded ponytail'
    bpy.ops.object.select_all(action='SELECT')
    destination=ROOT/'public/models'/(profile['id']+'-human.glb')
    bpy.ops.export_scene.gltf(filepath=str(destination),export_format='GLB',export_yup=True,export_animations=False,export_skins=True,export_apply=True,export_extras=True)
    # An anatomical measurement excludes all generated hair, boots, weapons
    # and costumes. Keep it at asset level so runtime scaling is unambiguous.
    binary=destination.read_bytes();json_length=struct.unpack_from('<I',binary,12)[0]
    document=json.loads(binary[20:20+json_length])
    document['asset'].setdefault('extras',{}).update(standingHeight=standing_height,anatomyUnits='metres',heightSource='unclothed-source-body')
    encoded=json.dumps(document,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    remainder=binary[20+json_length:]
    destination.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(remainder))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+remainder)
    print('EXPORTED',destination)
