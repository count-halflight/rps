// Midpoints of the real short-blade cutting edges, measured with the production
// 2.10 m Echo rig at the eight authored contact poses (reverse grip, time zero).
// The rig regression verifies these against weaponSegments; the offline pack
// carries the same measurements for its renderer-side surface correction.
export const ECHO_REFLECTION_BLADE_ANCHORS=Object.freeze([
  [.0319470,1.3375909,.7919756],
  [-.0926154,1.1073469,.6875819],
  [.0110369,1.3199244,.8086150],
  [-.0410440,1.2851941,.7612773],
  [.0232730,1.3682738,.7851533],
  [-.0954812,1.2737126,.8603242],
  [-.0213595,1.2344870,.7947152],
  [.0474917,1.3313203,.8545865],
].map(point=>Object.freeze(point)));
