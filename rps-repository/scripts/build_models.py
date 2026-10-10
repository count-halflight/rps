"""Create original, freely reusable hard-surface fighter assets with Blender 4.3+.
Run: blender --background --python scripts/build_models.py
Geometry is authored procedurally here. No downloaded meshes or paid assets.
"""
import bpy
import math
import os
from mathutils import Vector
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'models')
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, color, metal=.8, rough=.32, emission=None, alpha=1):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, alpha)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, alpha)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1)
        bsdf.inputs['Emission Strength'].default_value = 2.5
    if alpha < 1:
        bsdf.inputs['Alpha'].default_value = alpha
        mat.surface_render_method = 'DITHERED'
    return mat

shell = material('Shell | ceramic tungsten', (.095, .135, .15), .78, .36)
armor = material('Armor | brushed graphite', (.12, .17, .19), .88, .4)
trim = material('Trim | machined titanium', (.39, .47, .49), .93, .26)
black = material('Chassis | carbon polymer', (.015, .025, .03), .32, .53)
gold = material('Contact | copper alloy', (.32, .16, .06), .84, .34)
light = material('Emitter', (.15, .75, .64), .35, .25, (.09, .95, .76))
glass = material('Veil | optical membrane', (.12, .61, .48), .1, .13, (.1, .35, .3), .16)
visor = material('Visor | black optical ceramic', (.012, .036, .04), .82, .08)

parts = defaultdict(list)
parents = {}


def group(name, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    if parent: obj.parent = parent
    parents[name] = obj
    return obj


def finish(obj, mat, parent, bevel=0):
    obj.data.materials.append(mat)
    obj.parent = parent
    bpy.context.view_layer.objects.active = obj
    if bevel:
        mod = obj.modifiers.new('Edge machining', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
        for polygon in obj.data.polygons: polygon.use_smooth = True
        mod = obj.modifiers.new('Weighted plate normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    parts[parent.name].append(obj)
    return obj


def box(name, size, loc, mat, parent, bevel=.012, rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.location = loc
    if rotation: obj.rotation_euler = rotation
    return finish(obj, mat, parent, bevel)


def sphere(name, radius, loc, mat, parent, scale=(1, 1, 1), segments=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=12, radius=radius)
    obj = bpy.context.object
    obj.name = name
    obj.location = loc
    obj.scale = scale
    for poly in obj.data.polygons: poly.use_smooth = True
    return finish(obj, mat, parent)


def cylinder(name, radius, depth, loc, mat, parent, rotation=(0, 0, 0), vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth)
    obj = bpy.context.object
    obj.name = name
    obj.location = loc
    obj.rotation_euler = rotation
    return finish(obj, mat, parent, .005)


def torus(name, major, minor, loc, mat, parent, rotation=(0, 0, 0), segments=32):
    bpy.ops.mesh.primitive_torus_add(major_segments=segments, minor_segments=8, major_radius=major, minor_radius=minor)
    obj = bpy.context.object
    obj.name = name
    obj.location = loc
    obj.rotation_euler = rotation
    for poly in obj.data.polygons: poly.use_smooth = True
    return finish(obj, mat, parent)


def prism(name, outline, depth, loc, mat, parent, bevel=.01):
    # Outline in horizontal and vertical plane, depth along Blender Y.
    count = len(outline)
    vertices = [(x, -depth / 2, z) for x, z in outline] + [(x, depth / 2, z) for x, z in outline]
    faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, count * 2))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    # A planar UV for consistent micro-surface finish.
    uv = mesh.uv_layers.new(name='Machining UV')
    for poly in mesh.polygons:
        for loop in poly.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop].vertex_index].co
            uv.data[loop].uv = (vertex.x * 2, vertex.z * 2)
    return finish(obj, mat, parent, bevel)


def cable(name, coords, thickness, mat, parent):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 12
    curve.bevel_depth = thickness
    curve.bevel_resolution = 3
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(coords) - 1)
    for point, coord in zip(spline.bezier_points, coords):
        point.co = coord
        point.handle_left_type = 'AUTO'
        point.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return finish(obj, mat, parent)


def bolts(parent, positions, radius=.016):
    for i, loc in enumerate(positions): cylinder(f'Captive fastener {i}', radius, .016, loc, trim, parent, (math.pi / 2, 0, 0), 6)


# Blender uses Z up, the glTF exporter converts to the web's Y-up convention.
root = group('frame')
body = group('body', (0, 0, 0), root)
box('Central chassis', (.6, .37, .65), (0, 0, 1.91), black, body, .04)
prism('Upper chest contour', [(-.45, .23),(-.38,.4),(.38,.4),(.45,.23),(.28,-.28),(-.28,-.28)], .36, (0, -.04, 1.98), shell, body, .035)
for side in [-1, 1]:
    outline = [(side*x, z) for x,z in [(.035,.18),(.3,.2),(.39,.13),(.32,-.035),(.085,-.085)]]
    prism('Pectoral titanium plate', outline, .105, (0,-.26,2.13), armor, body, .018)
    outline2 = [(side*x,z) for x,z in [(.065,.05),(.28,.09),(.31,-.01),(.17,-.075),(.07,-.035)]]
    prism('Angled pectoral overlay', outline2, .028, (0,-.327,2.19), trim, body, .008)
    box('Chest neural tracing', (.24,.012,.015), (side*.2,-.352,2.16), light, body, .003, (0,side*-.18,0))
    bolts(body, [(side*.34,-.32,2.24),(side*.1,-.335,2.22),(side*.26,-.30,1.98)])
    box('Flank armor', (.1,.25,.43),(side*.34,.015,1.82), armor, body, .016, (0,side*-.11,0))
    for i in range(5): box('Layered flex rib', (.15,.16,.035),(side*.25,-.10,1.9-i*.064), trim, body, .004, (0,side*-.15,0))
    cylinder('Rib shock absorber', .023,.44,(side*.37,.03,1.82),trim,body,(0,side*-.18,0))
    cylinder('Rib shock sleeve', .035,.19,(side*.352,.03,1.72),black,body,(0,side*-.18,0))
    box('Reactor cooling pack', (.2,.14,.52),(side*.23,.27,2.01),black,body,.02)
    for i in range(6): box('Reactor fin', (.2,.085,.028),(side*.23,.375,2.23-i*.071),trim,body,.005)
    cable('Spinal power umbilical', [(side*.33,.22,2.19),(side*.37,.33,1.88),(side*.24,.30,1.48)],.023,black,body)
for i in range(4):
    box('Articulated abdominal armor', (.39-i*.035,.27,.082),(0,-.03,1.76-i*.105),armor,body,.02)
    box('Abdominal accent', (.18,.016,.014),(0,-.177,1.76-i*.105),trim,body,.004)
# Recessed reactor with concentrically machined housing.
cylinder('Reactor housing', .145,.07,(0,-.323,2.035),black,body,(math.pi/2,0,0))
torus('Reactor outer machining',.135,.017,(0,-.37,2.035),trim,body,(math.pi/2,0,0))
torus('Reactor luminous annulus',.103,.008,(0,-.395,2.035),light,body,(math.pi/2,0,0))
cylinder('Reactor emissive lens',.077,.015,(0,-.386,2.035),light,body,(math.pi/2,0,0))
for i in range(8):
    angle=i*math.pi/4
    cylinder('Reactor housing stud',.013,.012,(math.cos(angle)*.116,-.39,2.035+math.sin(angle)*.116),trim,body,(math.pi/2,0,0),6)
box('Pelvic chassis',(.52,.33,.23),(0,0,1.36),shell,body,.03)
prism('Pelvic face shield',[(-.24,.11),(.24,.11),(.16,-.13),(-.16,-.13)],.07,(0,-.21,1.37),armor,body,.02)
for side in [-1,1]:
    cylinder('Hip coupling',.13,.13,(side*.29,.005,1.35),trim,body,(0,math.pi/2,0))
    torus('Hip joint gasket',.105,.014,(side*.368,.005,1.35),black,body,(0,math.pi/2,0))
    box('Belt accessory tab',(.08,.09,.16),(side*.205,-.19,1.37),black,body,.009)
    box('Belt catch',(.065,.02,.03),(side*.205,-.25,1.39),gold,body,.006)
# Layered helmet, recessed visor, slotted intake and horn-like receiver fins.
head=group('head',(0,0,2.55),body)
cylinder('Neck actuator',.095,.2,(0,0,-.22),trim,head)
torus('Neck flexible gasket',.105,.021,(0,0,-.17),black,head)
sphere('Helmet dorsal shell',.23,(0,.015,.025),shell,head,(.91,1,.94),24)
prism('Face armored contour',[(-.185,.13),(-.12,.22),(.12,.22),(.185,.13),(.16,-.11),(.07,-.21),(-.07,-.21),(-.16,-.11)],.095,(0,-.178,-.005),armor,head,.014)
box('Visor lens recess',(.31,.045,.10),(0,-.238,.035),visor,head,.013)
box('Visor neural band',(.277,.008,.018),(0,-.266,.038),light,head,.004)
box('Visor upper lip',(.338,.026,.025),(0,-.245,.095),black,head,.006)
prism('Jaw intake',[(-.075,.035),(.075,.035),(.063,-.05),(-.063,-.05)],.035,(0,-.229,-.14),black,head,.005)
for i in range(5):box('Jaw grille',(.011,.01,.045),(-.048+i*.024,-.252,-.139),trim,head,.002)
for side in [-1,1]:
    cylinder('Helmet acoustic sensor',.085,.027,(side*.21,.015,.035),black,head,(0,math.pi/2,0))
    cylinder('Sensor insert',.051,.035,(side*.226,.015,.035),trim,head,(0,math.pi/2,0))
    prism('Lateral receiver fin',[(0,-.14),(.035,-.1),(.062,.30),(.025,.24)],.07,(side*.165,.085,.03),armor,head,.008)
    box('Receiver glint',(.008,.02,.075),(side*.202,.039,.225),light,head,.002)
    bolts(head,[(side*.135,-.242,-.08),(side*.127,-.236,.139)],.011)

# Legs articulate from the hip and feature working piston geometry and tendon cables.
for side, letter in [(-1,'L'),(1,'R')]:
    leg=group('leg_'+letter,(side*.255,0,1.27),root)
    sphere('Hip spherical bearing',.135,(0,0,-.005),black,leg)
    prism('Outer thigh plate',[(-.15,.14),(.13,.13),(.16,-.12),(.11,-.37),(-.10,-.37),(-.16,-.1)],.30,(0,0,-.29),shell,leg,.025)
    prism('Anterior thigh armor',[(-.08,.13),(.08,.13),(.10,-.12),(.045,-.20),(-.055,-.2)],.033,(0,-.18,-.255),armor,leg,.012)
    box('Thigh corner stripe',(.017,.008,.20),(side*.09,-.2,-.28),light,leg,.002)
    cylinder('Thigh hydraulic piston',.02,.34,(side*.14,.04,-.28),trim,leg)
    cylinder('Thigh piston housing',.034,.17,(side*.14,.04,-.36),black,leg)
    cable('Rear thigh flex cable',[(0,.12,-.1),(0,.20,-.37),(0,.13,-.60)],.018,black,leg)
    cylinder('Knee transverse hinge',.107,.285,(0,0,-.59),black,leg,(0,math.pi/2,0))
    cylinder('Knee bearing cap',.083,.04,(side*.15,0,-.59),trim,leg,(0,math.pi/2,0))
    prism('Patellar shield',[(-.13,.065),(-.08,.12),(.08,.12),(.13,.065),(.11,-.08),(-.11,-.08)],.095,(0,-.14,-.60),armor,leg,.014)
    box('Patellar aperture',(.11,.01,.022),(0,-.2,-.59),light,leg,.004)
    prism('Shin armored greave',[(-.12,.22),(.12,.22),(.14,.02),(.1,-.25),(-.09,-.25),(-.13,-.03)],.255,(0,0,-.94),shell,leg,.025)
    prism('Shin central ridge',[(-.055,.18),(.055,.18),(.068,-.12),(0,-.21),(-.06,-.12)],.05,(0,-.16,-.94),armor,leg,.01)
    for i in range(3):box('Lower greave recessed vent',(.08,.015,.017),(side*.087,-.153,-.97-i*.04),black,leg,.003)
    cylinder('Shin hydraulic rail',.019,.34,(side*.113,.09,-.93),trim,leg)
    cylinder('Ankle machined joint',.068,.28,(0,0,-1.18),trim,leg,(0,math.pi/2,0))
    box('Heel impact pad',(.26,.25,.12),(0,.045,-1.23),black,leg,.018)
    prism('Sabatons',[(-.15,.08),(.15,.08),(.16,-.065),(-.16,-.065)],.4,(0,-.10,-1.25),shell,leg,.02)
    for i in range(3):box('Toe segmented armor',(.078,.22,.057),(-.084+i*.084,-.22,-1.208),armor,leg,.012)
    bolts(leg,[(-.08,-.16,-.76),(.08,-.16,-.76),(-.08,-.22,-1.15),(.08,-.22,-1.15)],.012)

# Arms are deliberately asymmetrical: reinforced strike surfaces and a blade spine.
for side, letter in [(-1,'L'),(1,'R')]:
    arm=group('arm_'+letter,(side*.53,0,2.20),body)
    sphere('Shoulder spherical actuator',.155,(0,0,0),black,arm)
    cylinder('Shoulder pivot',.115,.24,(0,0,0),trim,arm,(0,math.pi/2,0))
    prism('Pauldron hard shell',[(-.23,.11),(-.13,.22),(.12,.22),(.25,.08),(.2,-.14),(-.17,-.16)],.39,(0,0,.01),shell,arm,.024)
    prism('Pauldron floating face plate',[(-.18,.08),(-.09,.145),(.09,.145),(.19,.04),(.15,-.065),(-.13,-.08)],.025,(0,-.222,.01),armor,arm,.01)
    box('Pauldron edge tracer',(.26,.008,.018),(0,-.241,.097),light,arm,.003)
    bolts(arm,[(-.15,-.237,-.04),(.15,-.237,-.04)])
    for i in range(3):box('Pauldron louver',(.22,.022,.016),(0,.22,.13-i*.055),trim,arm,.003)
    box('Upper arm underframe',(.16,.17,.32),(0,0,-.30),black,arm,.022)
    prism('Bicep armor',[(-.12,.14),(.12,.14),(.115,-.13),(-.09,-.17)],.22,(0,-.013,-.28),shell,arm,.012)
    for axis in [-1,1]:
        cylinder('Upper arm hydraulic rod',.015,.28,(axis*.105,.025,-.29),trim,arm)
        cylinder('Upper arm hydraulic sleeve',.025,.13,(axis*.105,.025,-.39),black,arm)
    cable('Elbow umbilical',[(side*.09,.09,-.12),(side*.16,.16,-.35),(side*.1,.13,-.59)],.017,black,arm)
    cylinder('Elbow rotary joint',.102,.23,(0,0,-.5),trim,arm,(0,math.pi/2,0))
    torus('Elbow actuator seal',.082,.012,(side*.125,0,-.5),black,arm,(0,math.pi/2,0))
    prism('Forearm reinforced housing',[(-.13,.16),(.13,.16),(.15,-.10),(.1,-.22),(-.1,-.22),(-.14,-.08)],.275,(0,0,-.72),shell,arm,.02)
    box('Forearm channel recess',(.135,.045,.255),(0,-.156,-.71),black,arm,.01)
    for i in range(4):box('Forearm power cell',(.102,.011,.025),(0,-.184,-.625-i*.055),light,arm,.004)
    for i in range(3):box('Forearm inset fin',(.075,.019,.018),(side*.11,.06,-.68-i*.045),trim,arm,.003)
    cylinder('Wrist articulated ball',.068,.19,(0,0,-.945),trim,arm,(0,math.pi/2,0))
    box('Palm armor',(.19,.2,.14),(0,-.012,-1.04),armor,arm,.015)
    for i in range(4):
        x=-.072+i*.048
        cylinder('Finger knuckle',.026,.037,(x,-.119,-1.00),trim,arm,(0,math.pi/2,0),12)
        box('Finger first phalange',(.036,.046,.095),(x,-.128,-1.055),shell,arm,.007)
        box('Finger curled tip',(.036,.082,.042),(x,-.10,-1.118),armor,arm,.008)
    box('Opposable digit',(.058,.12,.065),(side*.126,-.055,-1.039),armor,arm,.01, (0,side*.38,0))
    rock=group('weapon_rock_'+letter,(0,0,0),arm)
    prism('Seismic reinforced gauntlet',[(-.20,.18),(.19,.19),(.23,-.10),(.15,-.26),(-.17,-.24),(-.23,-.08)],.33,(0,-.045,-.85),armor,rock,.023)
    for i in range(3):
        box('Seismic coil sheath',(.05,.041,.29),(-.115+i*.115,-.229,-.86),black,rock,.009)
        box('Seismic induction filament',(.018,.012,.26),(-.115+i*.115,-.255,-.86),light,rock,.004)
    for i in range(4):cylinder('Impact knuckle stud',.037,.04,(-.12+i*.08,-.245,-1.07),trim,rock,(math.pi/2,0,0),6)
    razor=group('weapon_scissors_'+letter,(0,0,0),arm)
    for x in [-.115,.115]:
        prism('Razor titanium blade body',[(-.047,.12),(.047,.12),(.039,-.67),(0,-.9),(-.019,-.66)],.026,(x,-.175,-.92),trim,razor,.007)
        prism('Razor heated edge',[(-.006,.08),(.009,.08),(.012,-.65),(0,-.89),(-.009,-.65)],.031,(x+.027,-.181,-.92),light,razor,.002)
        box('Razor mounting lock',(.08,.14,.13),(x,-.13,-.85),black,razor,.01)
        box('Razor locking clamp',(.09,.055,.035),(x,-.225,-.84),gold,razor,.006)
    veil=group('weapon_paper_'+letter,(0,0,0),arm)
    torus('Veil machined projector',.14,.027,(0,-.203,-.71),trim,veil,(math.pi/2,0,0))
    cylinder('Veil projector lens',.115,.025,(0,-.229,-.71),light,veil,(math.pi/2,0,0))
    cylinder('Veil holographic surface',.46,.005,(0,-.37,-.71),glass,veil,(math.pi/2,0,0),6)
    torus('Veil hexagonal perimeter',.46,.007,(0,-.38,-.71),light,veil,(math.pi/2,0,0),6)
    for i in range(3):torus('Veil holographic scan ring',.12+i*.11,.0025,(0,-.382,-.71),light,veil,(math.pi/2,0,0),36)

# Combine parts by articulated parent for low draw-call count without losing materials.
for parent_name, objects in parts.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    joined=bpy.context.object
    joined.name=parent_name+'_mesh'
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # Set origin to the articulated group's origin, preserving world geometry.
    bpy.context.scene.cursor.location=parents[parent_name].matrix_world.translation
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.select_all(action='DESELECT')

if os.environ.get('SAVE_BLEND') == '1':
    source_dir = os.path.join(ROOT, 'artifacts', 'source')
    os.makedirs(source_dir, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(source_dir, 'echo-frame.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'echo-frame.glb'),export_format='GLB',export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
print('Original Echo asset exported to',OUT)
print('Triangles',sum(len(obj.data.loop_triangles) for obj in bpy.data.objects if obj.type=='MESH'))

# A second, genuinely lighter mesh for slower mobile GPUs.
for obj in [obj for obj in bpy.data.objects if obj.type == 'MESH']:
    bpy.context.view_layer.objects.active = obj
    modifier = obj.modifiers.new('Mobile mesh reduction', 'DECIMATE')
    modifier.ratio = .28
    bpy.ops.object.modifier_apply(modifier=modifier.name)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'echo-frame-low.glb'),export_format='GLB',export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
print('Lightweight frame exported')
