import * as THREE from "three";

// Anchor the authored edge to the posed opponent, including its real floor
// support and crouch. The incoming and departing trajectories remain intact.
export function reflectionContactTransform(reflection, snapshots, { attacker, defender, center, targetHeight = 2.2 } = {}) {
  const position = new THREE.Vector3(...reflection.root), quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, reflection.yaw ?? -reflection.angle - Math.PI / 2, 0));
  const scale = attacker?.root.scale.clone() ?? new THREE.Vector3(1, 1, 1);
  const bankA = reflection.poseBankA ?? (reflection.index % 8) * 3 + 1, bankB = reflection.poseBankB ?? bankA;
  const mix = Math.min(1, Math.max(0, reflection.poseBlend ?? 0));
  const actualA = snapshots[bankA]?.userData.bladeAnchor, actualB = snapshots[bankB]?.userData.bladeAnchor;
  const contactBank = Math.floor(bankA / 3) * 3 + 1, actualContact = snapshots[contactBank]?.userData.bladeAnchor;
  let targetPoint = reflection.contactPoint ? new THREE.Vector3(...reflection.contactPoint) : null;
  if (reflection.active && targetPoint && reflection.contactLocal) {
    const bone = defender?.model?.getObjectByName(reflection.targetBone);
    if (bone) {
      defender.root.updateWorldMatrix(true, true);
      const outward = new THREE.Vector3(targetPoint.x - center[0], 0, targetPoint.z - center[2]);
      if (outward.lengthSq() < 1e-8) outward.set(Math.cos(reflection.angle), 0, Math.sin(reflection.angle));
      const actualTarget = bone.getWorldPosition(new THREE.Vector3()).add(outward.normalize().multiplyScalar(reflection.surfaceOffset ?? .14 * targetHeight / 2.2));
      position.add(actualTarget.clone().sub(targetPoint)); targetPoint = actualTarget;
    }
    if (actualContact) position.add(new THREE.Vector3(...reflection.contactLocal).sub(new THREE.Vector3(...actualContact)).multiply(scale).applyQuaternion(quaternion));
  }
  const bladePoint = actualA && actualB ? new THREE.Vector3(...actualA).lerp(new THREE.Vector3(...actualB), mix).multiply(scale).applyQuaternion(quaternion).add(position) : null;
  return { position, quaternion, scale, bankA, bankB, blend: mix, diagnostic: reflection.active && bladePoint && targetPoint ? {
    index: reflection.index, progress: reflection.progress, contact: !!reflection.contact,
    poseBankA: bankA, poseBankB: bankB, poseBlend: mix,
    bladePoint: bladePoint.toArray(), targetPoint: targetPoint.toArray(), distance: bladePoint.distanceTo(targetPoint),
  } : null };
}
