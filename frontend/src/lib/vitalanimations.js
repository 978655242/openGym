// Existing catalogue IDs -> local VitalAnimations Free50 filenames, never Vital IDs.
// ponytail: curated action/equipment/posture/grip matches; no runtime name matching.
// Instructions and inspected clips resolve aliases; no catalogue metadata is changed.
// Source metadata errors: 0080 is visibly dumbbells, not a machine; 0091 is pronated.
export const VITAL_VIDEOS = {
  '0856': '0052.mp4', // Weighted Svend press (the clip uses one plate).
  '0043': '0054.mp4', // Barbell full/back squat.
  '1436': '0054.mp4', // Barbell high-bar squat.
  '1461': '0054.mp4', // Same barbell full squat, existing back-view entry.
  '1462': '0054.mp4', // Same barbell full squat, existing side-view entry.
  '0029': '0056.mp4', // Barbell clean-grip front squat.
  '0039': '0056.mp4', // Barbell front chest squat, elbows-forward front rack.
  '0042': '0056.mp4', // Barbell front squat.
  '3562': '0057.mp4', // Bench-supported barbell glute bridge/hip thrust, not floor bridge.
  '0077': '0059.mp4', // Barbell rear/reverse lunge v. 2.
  '0078': '0059.mp4', // Barbell rear/reverse lunge.
  '0085': '0060.mp4', // Barbell Romanian deadlift.
  '0798': '0062.mp4', // Stationary bike walk/cycling.
  '2138': '0062.mp4', // Stationary bike run v. 3/cycling.
  '0410': '0063.mp4', // Dumbbell split squat with rear foot elevated on a bench.
  '1760': '0064.mp4', // Dumbbell goblet squat.
  '1459': '0065.mp4', // Dumbbell Romanian deadlift/soft-knee hip hinge.
  '2141': '0067.mp4', // Elliptical cross trainer, moving handles and pedals.
  '0743': '0068.mp4', // Shoulder-width sled hack squat.
  '0597': '0069.mp4', // Seated machine hip abduction.
  '0549': '0072.mp4', // Two-handed kettlebell swing to shoulder height.
  '0585': '0073.mp4', // Seated machine leg extension.
  '0739': '0074.mp4', // Shoulder-width 45-degree sled leg press.
  '1463': '0074.mp4', // Same sled leg press, existing side-view entry.
  '1464': '0074.mp4', // Same sled leg press, existing back-view entry.
  '0586': '0075.mp4', // Prone machine leg curl.
  '0128': '0076.mp4', // Alternating battle-rope waves.
  '0599': '0079.mp4', // Seated machine leg curl.
  '0405': '0080.mp4', // Seated dumbbell shoulder press, palms forward (inspect clip).
  '2311': '0082.mp4', // Walking on a rotating-staircase stepmill.
  '0200': '0085.mp4', // High-pulley cable triceps pushdown with rope, palms facing.
  '0287': '0087.mp4', // Seated dumbbell Arnold press v. 2.
  '2137': '0087.mp4', // Seated dumbbell Arnold press.
  '1457': '0088.mp4', // Standing barbell military press, wider-than-shoulder grip.
  '0119': '0089.mp4', // Standard-grip barbell upright row v. 2.
  '0120': '0089.mp4', // Standard-grip barbell upright row.
  '0121': '0089.mp4', // Standard-grip barbell upright row v. 3.
  '0426': '0090.mp4', // Standing bilateral dumbbell overhead press, palms forward.
  '0437': '0091.mp4', // Pronated dumbbell upright row (inspect clip, not JSON grip).
  '1765': '0091.mp4', // Same dumbbell upright row, existing back-view entry.
  '0309': '0092.mp4', // Standing bilateral dumbbell front raise v. 2.
  '0310': '0092.mp4', // Standing bilateral dumbbell front raise.
  '0834': '0092.mp4', // Weighted front raise: existing instructions specify dumbbells.
  '0539': '0094.mp4', // Standing one-arm kettlebell military press to the side.
  '0178': '0095.mp4', // Standing bilateral cable lateral raise.
  '0334': '0096.mp4', // Standing dumbbell lateral raise.
  '0765': '0098.mp4', // Seated Smith-machine shoulder press, bar in front.
  '0601': '0099.mp4', // Seated reverse pec-deck fly with parallel/neutral grip.
}

// Deliberately unmapped Free50 clips retain the existing GIFs:
// 0051: neutral pec-deck handles; existing 0596 specifies a pronated grip.
// 0053: air-bike machine sprint; existing air bike is a floor abdominal exercise.
// 0055: rear-foot-elevated barbell Bulgarian squat; existing split-squat steps are grounded.
// 0058, 0070: barbell/kettlebell marches have no matching existing loaded march.
// 0061: faces the cable machine; existing hip-extension steps face away.
// 0066: parallel-foot jump squat; existing dumbbell plyo squat switches feet each jump.
// 0071: kettlebell floor deadlift has no matching existing kettlebell entry.
// 0077, 0078: no existing rowing ergometer or treadmill-running identity.
// 0081: clip keeps the trailing foot off the bench; existing step-ups plant both feet,
//       or explicitly add a knee drive/biceps curl.
// 0083: clip is a pedal stair-stepper, not the rotating staircase in 2311/0082.
// 0084: standing machine stiff-leg deadlift; existing lever deadlift is seated.
// 0086: general treadmill walk; existing treadmill walking specifically requires incline.
// 0093: plate front raise; existing weighted-front-raise steps specify dumbbells.
// 0097: standing machine lateral raise; existing lever lateral raise is seated.
// 0100: shoulder-height reverse fly; existing high reverse-fly steps pull toward the front.
